"""Private subprocess worker: selected IFC geometry only, no source properties or names.

The parent enforces timeout/input/output bounds. This process isolation is not an OS sandbox.
Official geometry API: https://docs.ifcopenshell.org/ifcopenshell-python/geometry_processing.html
"""
import json
import math
import sys


def main():
    import ifcopenshell
    import ifcopenshell.geom
    import ifcopenshell.util.unit
    request = json.loads(sys.stdin.buffer.read(2 * 1024 * 1024 + 1))
    model = ifcopenshell.open(request["input"])
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    settings.set("convert-back-units", False)
    origin = request["sourceOriginMeters"]
    allowed_types = ("IfcWall", "IfcSlab", "IfcRoof", "IfcColumn", "IfcBeam", "IfcDoor", "IfcWindow", "IfcStair", "IfcRailing", "IfcBuildingElementProxy", "IfcCovering", "IfcMember", "IfcCurtainWall", "IfcFooting")
    groups = []
    total_vertices = 0
    for item in request["publicAllowlist"]:
        product = model.by_guid(item["globalId"])
        if not product or not any(product.is_a(kind) for kind in allowed_types):
            raise ValueError("Selected product is missing or outside the public building geometry classes.")
        shape = ifcopenshell.geom.create_shape(settings, product)
        coordinates = list(shape.geometry.verts)
        faces = list(shape.geometry.faces)
        if not coordinates or len(coordinates) % 3 or len(faces) % 3 or not all(math.isfinite(value) and abs(value) < 1e9 for value in coordinates):
            raise ValueError("Selected product has invalid geometry.")
        total_vertices += len(coordinates) // 3
        if total_vertices > 1000000:
            raise ValueError("Selected geometry exceeds the production vertex budget.")
        # Babylon AUTO glTF root equals an X reflection (yaw PI plus Z reflection).
        # IFC E/N/Z -> glTF -E/Z/-N therefore becomes campus E/Z/-N after import.
        positions = []
        for i in range(0, len(coordinates), 3):
            positions.extend((-coordinates[i] + origin[0], coordinates[i + 2] - origin[2], -coordinates[i + 1] + origin[1]))
        indices = []
        for i in range(0, len(faces), 3):
            indices.extend((faces[i], faces[i + 2], faces[i + 1]))
        groups.append({"positions": positions, "indices": indices, "spaceId": item["spaceId"], "color": [0.78, 0.75, 0.66, 1], "doubleSided": False})
    result = {"schemaVersion": 1, "engine": "IfcOpenShell", "engineVersion": ifcopenshell.version, "schema": model.schema, "sourceUnitScaleMeters": ifcopenshell.util.unit.calculate_unit_scale(model), "groups": groups}
    sys.stdout.write(json.dumps(result, separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Model contents, GUIDs and private attributes must never reach ordinary logs.
        sys.stderr.write("IFC geometry conversion failed. Check the selected products and tool installation.\n")
        sys.exit(1)

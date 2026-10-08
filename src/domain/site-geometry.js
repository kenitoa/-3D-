// @ts-check
// Pure geometry in local east/north metres. No Babylon.js or browser dependency.
(() => {
  /** @typedef {[number, number]} Point */
  /** @typedef {{lat:number, lon:number}} GeographicPoint */
  /** @typedef {{x:[number,number,number],y:[number,number,number]}} Affine */
  /** @typedef {{id:string,pointsMeters:Point[],nodeIds?:(string|number)[],tags?:Record<string,string>}} RouteWay */
  /** @typedef {{id:string,point:Point,edges:{to:string,lengthMeters:number,wayId:string,tags:Record<string,string>}[]}} GraphNode */
  const EPSILON = 1e-8;
  /** @param {Point} point */
  function assertPoint(point) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new TypeError('A finite [east, north] point is required.');
  }
  /** @param {Point[]} points */
  function assertRing(points) {
    if (!Array.isArray(points) || points.length < 3) throw new TypeError('A polygon requires at least three points.');
    points.forEach(assertPoint);
  }
  /** @param {Point} first @param {Point} second */
  function distance(first, second) { assertPoint(first); assertPoint(second); return Math.hypot(second[0] - first[0], second[1] - first[1]); }
  /** @param {Point[]} points */
  function signedArea(points) {
    assertRing(points);
    let sum = 0;
    for (let i = 0; i < points.length; i++) { const next = points[(i + 1) % points.length]; sum += points[i][0] * next[1] - next[0] * points[i][1]; }
    return sum / 2;
  }
  /** @param {Point[]} exterior @param {Point[][]} [holes] */
  function polygonArea(exterior, holes = []) {
    const area = Math.abs(signedArea(exterior)) - holes.reduce((total, hole) => total + Math.abs(signedArea(hole)), 0);
    if (area < -EPSILON) throw new RangeError('Polygon holes exceed exterior area.');
    return Math.max(0, area);
  }
  /** @param {Point} point @param {Point} first @param {Point} second */
  function pointOnSegment(point, first, second) {
    const cross = (point[0] - first[0]) * (second[1] - first[1]) - (point[1] - first[1]) * (second[0] - first[0]);
    if (Math.abs(cross) > EPSILON * Math.max(1, distance(first, second))) return false;
    return point[0] >= Math.min(first[0], second[0]) - EPSILON && point[0] <= Math.max(first[0], second[0]) + EPSILON && point[1] >= Math.min(first[1], second[1]) - EPSILON && point[1] <= Math.max(first[1], second[1]) + EPSILON;
  }
  /** Boundary is included. @param {Point} point @param {Point[]} ring */
  function pointInPolygon(point, ring) {
    assertPoint(point); assertRing(ring);
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j]; const b = ring[i];
      if (pointOnSegment(point, a, b)) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  /** @param {Point[]} points */
  function bounds(points) {
    if (!points.length) return null;
    points.forEach(assertPoint);
    const xs = points.map((point) => point[0]); const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, width: maxX - minX, depth: maxY - minY, center: /** @type {Point} */ ([(minX + maxX) / 2, (minY + maxY) / 2]) };
  }
  /** @param {GeographicPoint} origin */
  function projectionRadii(origin) {
    if (![origin.lat, origin.lon].every(Number.isFinite) || Math.abs(origin.lat) >= 85 || Math.abs(origin.lon) > 180) throw new RangeError('A valid non-polar WGS84 origin is required.');
    const latitude = origin.lat * Math.PI / 180; const a = 6378137; const eccentricitySquared = 6.6943799901413165e-3;
    const w = Math.sqrt(1 - eccentricitySquared * Math.sin(latitude) ** 2);
    return { eastRadius: a / w * Math.cos(latitude), northRadius: a * (1 - eccentricitySquared) / w ** 3 };
  }
  /** Local linear WGS84 projection: intended for this campus and its nearby context, not global use. @param {GeographicPoint} point @param {GeographicPoint} origin @returns {Point} */
  function projectWgs84(point, origin) {
    if (![point.lat, point.lon].every(Number.isFinite) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) throw new RangeError('Invalid WGS84 point.');
    if (Math.abs(point.lat - origin.lat) > 0.1 || Math.abs(point.lon - origin.lon) > 0.1) throw new RangeError('Local projection is limited to 0.1 degree from origin.');
    const radii = projectionRadii(origin); const radians = Math.PI / 180;
    return [(point.lon - origin.lon) * radians * radii.eastRadius, (point.lat - origin.lat) * radians * radii.northRadius];
  }
  /** @param {Point} point @param {GeographicPoint} origin @returns {GeographicPoint} */
  function unprojectWgs84(point, origin) {
    assertPoint(point); const radii = projectionRadii(origin); const degrees = 180 / Math.PI;
    return { lon: origin.lon + point[0] / radii.eastRadius * degrees, lat: origin.lat + point[1] / radii.northRadius * degrees };
  }
  /** Babylon x/z convention: east +x, north -z. @param {Point} point @param {number} [metersPerUnit] @returns {Point} */
  function metersToWorld(point, metersPerUnit = 10) { assertPoint(point); if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) throw new RangeError('Scale must be positive.'); return [point[0] / metersPerUnit, -point[1] / metersPerUnit]; }
  /** @param {Point} point @param {number} [metersPerUnit] @returns {Point} */
  function worldToMeters(point, metersPerUnit = 10) { assertPoint(point); if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) throw new RangeError('Scale must be positive.'); return [point[0] * metersPerUnit, -point[1] * metersPerUnit]; }
  /** @param {Point} point @param {Affine} transform @returns {Point} */
  function applyAffine(point, transform) { assertPoint(point); return [transform.x[0] * point[0] + transform.x[1] * point[1] + transform.x[2], transform.y[0] * point[0] + transform.y[1] * point[1] + transform.y[2]]; }
  /** @param {Affine} transform @returns {Affine} */
  function invertAffine(transform) {
    const [a, b, c] = transform.x; const [d, e, f] = transform.y; const determinant = a * e - b * d;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < EPSILON) throw new RangeError('Singular affine transform.');
    return { x: [e / determinant, -b / determinant, (b * f - e * c) / determinant], y: [-d / determinant, a / determinant, (d * c - a * f) / determinant] };
  }
  /** Least-squares fit; validation anchors must be supplied separately. @param {{id:string,source:Point,target:Point}[]} anchors @returns {Affine} */
  function fitAffine(anchors) {
    if (anchors.length < 3) throw new RangeError('Three non-collinear calibration anchors are required.');
    const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; const east = [0, 0, 0]; const north = [0, 0, 0];
    for (const anchor of anchors) {
      assertPoint(anchor.source); assertPoint(anchor.target); const row = [anchor.source[0], anchor.source[1], 1];
      for (let i = 0; i < 3; i++) { east[i] += row[i] * anchor.target[0]; north[i] += row[i] * anchor.target[1]; for (let j = 0; j < 3; j++) matrix[i][j] += row[i] * row[j]; }
    }
    /** @param {number[]} values @returns {[number,number,number]} */
    function solve(values) {
      const augmented = matrix.map((row, i) => [...row, values[i]]);
      for (let col = 0; col < 3; col++) {
        let pivot = col; for (let row = col + 1; row < 3; row++) if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
        if (Math.abs(augmented[pivot][col]) < EPSILON) throw new RangeError('Calibration anchors are collinear.');
        [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]]; const divisor = augmented[col][col];
        for (let i = col; i < 4; i++) augmented[col][i] /= divisor;
        for (let row = 0; row < 3; row++) if (row !== col) { const factor = augmented[row][col]; for (let i = col; i < 4; i++) augmented[row][i] -= factor * augmented[col][i]; }
      }
      return [augmented[0][3], augmented[1][3], augmented[2][3]];
    }
    return { x: solve(east), y: solve(north) };
  }
  /** @param {Point[]} points @returns {Point[]} */
  function convexHull(points) {
    points.forEach(assertPoint);
    const sorted = [...new Map(points.map((point) => [`${point[0]},${point[1]}`, point])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3) throw new RangeError('Three distinct hull points are required.');
    /** @param {Point} a @param {Point} b @param {Point} c */ const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    /** @type {Point[]} */ const lower = []; /** @type {Point[]} */ const upper = [];
    for (const point of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop(); lower.push(point); }
    for (const point of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop(); upper.push(point); }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    if (hull.length < 3) throw new RangeError('Hull points are collinear.');
    return hull;
  }
  /** @param {{id:string,source:Point,target:Point}[]} anchors @param {Affine} transform @param {string[]} [trainingIds] */
  function anchorResiduals(anchors, transform, trainingIds = []) {
    if (anchors.some((anchor) => trainingIds.includes(anchor.id))) throw new Error('Validation anchors must be independent of fit anchors.');
    const samples = anchors.map((anchor) => ({ id: anchor.id, errorMeters: distance(applyAffine(anchor.source, transform), anchor.target) }));
    return { samples, count: samples.length, rmsMeters: samples.length ? Math.sqrt(samples.reduce((total, sample) => total + sample.errorMeters ** 2, 0) / samples.length) : null, maxMeters: samples.length ? Math.max(...samples.map((sample) => sample.errorMeters)) : null, independent: true };
  }
  /** @param {Point} start @param {Point} end @param {Point[]} polygon @returns {[Point,Point][]} */
  function clipSegmentToPolygon(start, end, polygon) {
    assertPoint(start); assertPoint(end); assertRing(polygon);
    if (distance(start, end) <= EPSILON) return [];
    const dx = end[0] - start[0]; const dy = end[1] - start[1]; const parameters = [0, 1];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]; const b = polygon[(i + 1) % polygon.length]; const ex = b[0] - a[0]; const ey = b[1] - a[1]; const denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) <= EPSILON) continue;
      const ax = a[0] - start[0]; const ay = a[1] - start[1]; const t = (ax * ey - ay * ex) / denominator; const u = (ax * dy - ay * dx) / denominator;
      if (t > EPSILON && t < 1 - EPSILON && u >= -EPSILON && u <= 1 + EPSILON) parameters.push(t);
    }
    const sorted = [...new Set(parameters.map((value) => Math.round(value * 1e10) / 1e10))].sort((a, b) => a - b);
    /** @type {[Point,Point][]} */ const segments = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]; const b = sorted[i + 1]; const midpoint = (a + b) / 2;
      if (pointInPolygon([start[0] + dx * midpoint, start[1] + dy * midpoint], polygon)) segments.push([[start[0] + dx * a, start[1] + dy * a], [start[0] + dx * b, start[1] + dy * b]]);
    }
    return segments;
  }
  /** Clips each original edge, rather than dropping outside vertices and inventing shortcuts. @param {RouteWay[]} ways @param {Point[]} polygon */
  function routeSegments(ways, polygon) {
    return ways.flatMap((way) => way.pointsMeters.slice(1).flatMap((end, index) => clipSegmentToPolygon(way.pointsMeters[index], end, polygon).map((points, part) => {
      /** @param {Point} point */
      const nodeId = (point) => {
        if (distance(point, way.pointsMeters[index]) < 1e-7) return way.nodeIds?.[index] ?? `coordinate-${point[0].toFixed(3)},${point[1].toFixed(3)}`;
        if (distance(point, end) < 1e-7) return way.nodeIds?.[index + 1] ?? `coordinate-${point[0].toFixed(3)},${point[1].toFixed(3)}`;
        return `clip-${way.id}-${index}-${point[0].toFixed(6)},${point[1].toFixed(6)}`;
      };
      return { id: `${way.id}:${index}:${part}`, wayId: way.id, index, part, pointsMeters: points, nodeIds: points.map(nodeId), lengthMeters: distance(points[0], points[1]), tags: way.tags ?? {} };
    })));
  }
  /** Shared OSM node IDs preserve actual junctions; coincident but different IDs do not connect bridges. @param {RouteWay[]} ways @returns {Map<string,GraphNode>} */
  function buildRouteGraph(ways) {
    /** @type {Map<string,GraphNode>} */ const graph = new Map();
    for (const way of ways) {
      const ids = way.pointsMeters.map((point, index) => way.nodeIds?.[index] != null ? `osm-node-${way.nodeIds[index]}` : `coordinate-${point[0].toFixed(3)},${point[1].toFixed(3)}`);
      ids.forEach((id, index) => { if (!graph.has(id)) graph.set(id, { id, point: way.pointsMeters[index], edges: [] }); });
      for (let i = 1; i < ids.length; i++) {
        const lengthMeters = distance(way.pointsMeters[i - 1], way.pointsMeters[i]); if (lengthMeters <= EPSILON) continue;
        const tags = way.tags ?? {}; const forward = { to: ids[i], lengthMeters, wayId: way.id, tags }; const backward = { to: ids[i - 1], lengthMeters, wayId: way.id, tags };
        if (tags.oneway !== '-1') graph.get(ids[i - 1])?.edges.push(forward);
        if (tags.oneway !== 'yes') graph.get(ids[i])?.edges.push(backward);
      }
    }
    return graph;
  }
  /** @param {Map<string,GraphNode>} graph @param {string} startId @param {string} endId @param {{avoidSteps?:boolean}} [options] */
  function shortestRoute(graph, startId, endId, options = {}) {
    if (!graph.has(startId) || !graph.has(endId)) return null;
    const remaining = new Set(graph.keys()); const costs = new Map([[startId, 0]]); /** @type {Map<string,{from:string,wayId:string}>} */ const previous = new Map();
    while (remaining.size) {
      let current = ''; let best = Infinity;
      for (const id of remaining) { const cost = costs.get(id) ?? Infinity; if (cost < best) { current = id; best = cost; } }
      if (!current || current === endId) break;
      remaining.delete(current);
      for (const edge of graph.get(current)?.edges ?? []) {
        if (!remaining.has(edge.to) || (options.avoidSteps && (edge.tags.highway === 'steps' || edge.tags.wheelchair === 'no'))) continue;
        const nextCost = best + edge.lengthMeters;
        if (nextCost < (costs.get(edge.to) ?? Infinity)) { costs.set(edge.to, nextCost); previous.set(edge.to, { from: current, wayId: edge.wayId }); }
      }
    }
    if (!costs.has(endId)) return null;
    const nodeIds = [endId]; const wayIds = []; let current = endId;
    while (current !== startId) { const step = previous.get(current); if (!step) return null; wayIds.unshift(step.wayId); nodeIds.unshift(step.from); current = step.from; }
    return { nodeIds, wayIds, pointsMeters: nodeIds.map((id) => /** @type {GraphNode} */ (graph.get(id)).point), lengthMeters: costs.get(endId), accessibility: options.avoidSteps ? 'steps-excluded-other-accessibility-unverified' : 'unverified' };
  }
  Object.assign(globalThis, { SiteGeometry: { distance, signedArea, polygonArea, pointInPolygon, bounds, projectWgs84, unprojectWgs84, metersToWorld, worldToMeters, applyAffine, invertAffine, fitAffine, convexHull, anchorResiduals, clipSegmentToPolygon, routeSegments, buildRouteGraph, shortestRoute } });
})();

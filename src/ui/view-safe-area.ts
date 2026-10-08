type Rect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>;

export function viewSafeArea(options: {
  canvas: Rect;
  panel?: Rect;
  headerBottom: number;
  panelExpanded: boolean;
  renderWidth: number;
  renderHeight: number;
}): { left: number; right: number; top: number; bottom: number } {
  const { canvas, panel, renderWidth, renderHeight } = options;
  const mobile = canvas.width < 700;
  const scaleX = renderWidth / Math.max(canvas.width, 1);
  const scaleY = renderHeight / Math.max(canvas.height, 1);
  const topEdge = mobile && panel && !options.panelExpanded
    ? Math.max(options.headerBottom, panel.bottom)
    : options.headerBottom;
  // Compact mobile controls float at the top; their width does not make them a sidebar.
  const sidePanel = !mobile && panel && panel.width < canvas.width * 0.7;
  const insets = {
    left: sidePanel && panel.left < canvas.left + canvas.width / 2 ? Math.max(0, panel.right - canvas.left + 12) * scaleX : 0,
    right: sidePanel && panel.left >= canvas.left + canvas.width / 2 ? Math.max(0, canvas.right - panel.left + 12) * scaleX : 0,
    top: Math.max(0, topEdge - canvas.top + 12) * scaleY,
    bottom: (panel && (mobile ? options.panelExpanded : panel.width >= canvas.width * 0.7) ? Math.max(55, canvas.bottom - panel.top) : 55) * scaleY,
  };
  const horizontal = Math.min(1, renderWidth * 0.75 / Math.max(insets.left + insets.right, 1));
  const vertical = Math.min(1, renderHeight * 0.75 / Math.max(insets.top + insets.bottom, 1));
  return { left: insets.left * horizontal, right: insets.right * horizontal, top: insets.top * vertical, bottom: insets.bottom * vertical };
}

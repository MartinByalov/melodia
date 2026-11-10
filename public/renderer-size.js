// Keep the viewport inside the physical drawing buffer at fractional pixel ratios.
export function fitRenderer(renderer, width, height, updateStyle = true) {
  width = Math.max(1, width); height = Math.max(1, height);
  renderer.setSize(width, height, updateStyle);
  const ratio = renderer.getPixelRatio(), gl = renderer.getContext();
  renderer.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
}
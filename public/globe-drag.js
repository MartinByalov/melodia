// Direct drag rotation for the left mouse button: the camera turns around the globe in step with the pointer, with no inertia.

// Radians per pixel of drag, so the surface point nearest the camera moves as far on screen as the pointer.
export function rotationPerPixel(THREE, camera, height) {
  const surface = Math.max(camera.position.length() - 1, 1e-4);
  return 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * surface / Math.max(height, 1);
}

export function rotateCamera(THREE, camera, dx, dy, scale) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const turn = new THREE.Quaternion().setFromAxisAngle(up, -dx * scale)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * scale));
  camera.position.applyQuaternion(turn);
  camera.up.applyQuaternion(turn);
  camera.quaternion.premultiply(turn);
  camera.updateMatrixWorld();
}

export function installDragRotation({ THREE, camera, controls, canvas }) {
  let gesture = null;
  // The trackball keeps handling touch and pinch; the left mouse button is ours.
  controls.mouseButtons.LEFT = -1;
  function down(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* The drag still works without capture. */ }
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture.x = event.clientX; gesture.y = event.clientY;
    rotateCamera(THREE, camera, dx, dy, rotationPerPixel(THREE, camera, canvas.clientHeight));
  }
  function up(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture = null;
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    controls.update();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  return { dragging: () => Boolean(gesture), dispose() { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); } };
}

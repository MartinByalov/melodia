// Drag rotation for the left mouse button and for one finger: the globe turns in the direction of the drag at a calm, gentle speed, with no inertia.

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

// The point of the unit sphere under the pointer. When the pointer is off the globe it is the nearest point of the outline.
export function surfacePoint(THREE, camera, canvas, clientX, clientY) {
  camera.updateMatrixWorld();
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * 2 - 1, y = 1 - (clientY - rect.top) / rect.height * 2;
  const origin = camera.position.clone();
  const direction = new THREE.Vector3(x, y, .5).unproject(camera).sub(origin).normalize();
  const along = origin.dot(direction), discriminant = along * along - (origin.lengthSq() - 1);
  if (discriminant >= 0) {
    const distance = -along - Math.sqrt(discriminant);
    if (distance > 0) return { point: origin.addScaledVector(direction, distance), onGlobe: true };
  }
  return { point: origin.addScaledVector(direction, -along).normalize(), onGlobe: false };
}

// Turns the camera around the globe by the rotation that carries the surface point under the pointer to the point it was on before.
export function applyTurn(camera, turn) {
  camera.position.applyQuaternion(turn);
  camera.up.applyQuaternion(turn);
  camera.quaternion.premultiply(turn);
  camera.updateMatrixWorld();
}

// How far the globe turns compared with the pointer: 1 keeps the touched point under the pointer, less is calmer.
export const DRAG_GAIN = .55;
// Milliseconds for the globe to cover about two thirds of the way to where the drag wants it. Long enough to feel smooth.
export const DRAG_SMOOTHING = 110;

export function installDragRotation({ THREE, camera, controls, canvas, smoothing = DRAG_SMOOTHING, gain = DRAG_GAIN }) {
  let gesture = null, settling = null;
  const fingers = new Set();
  const identity = new THREE.Quaternion();
  // Rotation is ours for the left mouse button and one finger. Pinch zoom stays in the globe code.
  controls.mouseButtons.LEFT = -1;
  controls.noRotate = true;
  // Turns the camera a fraction of the rotation still waiting. Returns the angle left, in radians.
  function advance(g, fraction) {
    const step = fraction >= 1 ? g.pending.clone() : identity.clone().slerp(g.pending, fraction);
    applyTurn(camera, step);
    g.pending.premultiply(step.clone().invert());
    return 2 * Math.acos(Math.min(1, Math.abs(g.pending.w)));
  }
  function finish(g) { advance(g, 1); controls.update(); }
  function down(event) {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      fingers.add(event.pointerId);
      if (fingers.size > 1) { if (gesture) finish(gesture); gesture = null; return; }
    } else if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (settling) { finish(settling); settling = null; }
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, pending: new THREE.Quaternion(), onGlobe: surfacePoint(THREE, camera, canvas, event.clientX, event.clientY).onGlobe };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* The drag still works without capture. */ }
  }
  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    // The turn between the point under the previous pointer position and the point under the new one, seen from the camera as it is now.
    const before = surfacePoint(THREE, camera, canvas, gesture.x, gesture.y).point, now = surfacePoint(THREE, camera, canvas, event.clientX, event.clientY).point;
    const full = new THREE.Quaternion().setFromUnitVectors(now.clone().normalize(), before.clone().normalize());
    gesture.pending.premultiply(gain >= 1 ? full : identity.clone().slerp(full, gain));
    gesture.x = event.clientX; gesture.y = event.clientY;
  }
  function up(event) {
    fingers.delete(event.pointerId);
    if (!gesture || event.pointerId !== gesture.id) return;
    settling = Object.assign(gesture, { age: 0 }); gesture = null;
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  return {
    dragging: () => Boolean(gesture),
    // Called once per frame with the frame time in milliseconds. Without a time the globe takes the whole turn at once.
    update(dt) {
      const fraction = !(dt >= 0) || smoothing <= 0 ? 1 : 1 - Math.exp(-dt / smoothing);
      if (gesture) advance(gesture, fraction);
      else if (settling) {
        settling.age += dt >= 0 ? dt : 1e3;
        const left = advance(settling, fraction);
        if (left < 1e-5 || settling.age > 600) { finish(settling); settling = null; }
      }
    },
    dispose() { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); }
  };
}

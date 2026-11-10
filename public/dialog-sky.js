import * as THREE from 'three';
import { createGlobeBackground } from './globe-background.js';
import { profileColors } from './visual-styles.js';

// The sky of the globe (stars, glows, shooting stars) drawn behind a dialog with the same code, so it looks the same. Returns null without WebGL.
export function createDialogSky(dialog) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.className = 'dialog-sky'; canvas.setAttribute('aria-hidden', 'true');
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' }); } catch { return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.Camera(), background = createGlobeBackground(scene);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const globe = document.querySelector('#globe');
  scene.background = new THREE.Color(css('--bg') || '#080b14');
  background.setColor(css('--accent') || '#62efc5');
  background.setVisualProfile({ colors: profileColors(globe?.dataset.visualStyle) });
  dialog.prepend(canvas);
  let frame = 0, last = 0, width = 0, height = 0;
  const fit = () => {
    width = dialog.clientWidth; height = dialog.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  };
  const draw = now => {
    frame = requestAnimationFrame(draw);
    if (now - last < 33) return;
    last = now;
    if (dialog.clientWidth !== width || dialog.clientHeight !== height) fit();
    background.update(now / 1000, width, height, document.body.dataset.reduceEffects === 'true', 0);
    renderer.render(scene, camera);
  };
  fit(); frame = requestAnimationFrame(draw);
  return {
    dispose() {
      cancelAnimationFrame(frame); background.dispose(); renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* The context is already gone. */ }
      canvas.remove();
    }
  };
}

import * as THREE from 'three';
import { createGlobeBackground } from './globe-background.js';
import { profileColors } from './visual-styles.js';
import { fitRenderer } from './renderer-size.js';

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
  let frame = 0, last = 0, width = 0, height = 0, disposed = false;
  const fit = () => {
    width = dialog.clientWidth; height = dialog.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    fitRenderer(renderer, width, height, false);
  };
  const draw = now => {
    if(disposed||!dialog.open){frame=0;return;}
    frame = requestAnimationFrame(draw);
    if(document.hidden||renderer.getContext().isContextLost())return;
    if (now - last < 33) return;
    last = now;
    if (dialog.clientWidth !== width || dialog.clientHeight !== height) fit();
    background.update(now / 1000, width, height, document.body.dataset.reduceEffects === 'true', 0);
    renderer.render(scene, camera);
  };
  const pause=()=>{cancelAnimationFrame(frame);frame=0;};
  const resume=()=>{
    if(disposed||frame||!dialog.open)return;
    scene.background.set(css('--bg') || '#080b14');
    background.setColor(css('--accent') || '#62efc5');
    background.setVisualProfile({ colors: profileColors(globe?.dataset.visualStyle) });
    fit();last=0;frame=requestAnimationFrame(draw);
  };
  resume();
  return {
    pause,
    resume,
    dispose() {
      if(disposed)return;
      disposed=true;pause();background.dispose();renderer.dispose();
      canvas.remove();
    }
  };
}

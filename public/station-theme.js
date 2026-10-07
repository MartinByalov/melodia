import { Color, SRGBColorSpace } from './vendor/three.module.js';
import { stationColorHSL } from './radio.js';

export function stationTheme(id) {
  const hsl=stationColorHSL(id);
  const color=new Color().setHSL(hsl.h,hsl.s,hsl.l,SRGBColorSpace);
  const hex=color.getHexString();
  const channels=[0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16));
  const bg='#'+channels.map(value=>Math.round(6+value*.045).toString(16).padStart(2,'0')).join('');
  return {color:'#'+hex,rgb:channels.join(','),bg};
}
// Audio-driven deformation: no timer-based imitation when analysis is unavailable.
export function wavePath(samples, level, bass, phase, mirrored = false) {
  const sign = mirrored ? -1 : 1;
  const width = 72 + Math.min(1, bass) * 48;
  const height = 2 + Math.min(1, level) * 12;
  const points=Array.from({ length: 121 }, (_, index) => {
    const t = index / 120;
    const offset=t*Math.max(0,(samples?.length||1)-1),left=Math.floor(offset),fraction=offset-left;
    const sample=samples?.length?(samples[left]*(1-fraction)+samples[Math.min(left+1,samples.length-1)]*fraction):0;
    const envelope = .35 + .65 * Math.sin(t * Math.PI);
    const deformation = Math.sin(t * Math.PI * 4 + phase * .6) * bass * .22;
    const y = 18 + sign * envelope * (Math.sin(t * Math.PI * 2 - phase) * height + sample * level * 7 + deformation * 8);
    return [60+(t-.5)*width,y];
  });
  const format=point=>`${point[0].toFixed(2)} ${point[1].toFixed(2)}`;
  let path='M'+format(points[0]);
  for(let i=1;i<points.length;i++){
    const p0=points[Math.max(0,i-2)],p1=points[i-1],p2=points[i],p3=points[Math.min(points.length-1,i+1)];
    const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6];
    const c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    path+=' C'+format(c1)+' '+format(c2)+' '+format(p2);
  }
  return path;
}
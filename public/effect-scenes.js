const quiet=['classical','ambient','talk'];
const mellow=['jazz','blues','lofi','chill','folk','country','soul'];
// Numeric modes are shared with shaders: rays straight/worms/arc/helix,
// Surface remains normal (0); map normal/wave/breath.
export function scenesForStyle(style){
  if(quiet.includes(style))return [[2,0,2],[0,0,2],[7,0,2],[12,0,2]];
  if(mellow.includes(style))return [[1,0,2],[2,0,1],[4,0,2],[7,0,1],[8,0,2],[12,0,2],[11,0,1],[5,0,2]];
  return [[1,0,1],[3,0,1],[2,0,2],[4,0,2],[5,0,1],[6,0,2],[7,0,1],[8,0,2],[9,0,1],[10,0,2],[11,0,1],[12,0,2]];
}
export function createEffectScenes(){
  let elapsed=0,style='pop',sequence=0;
  const result={ray:0,surface:0,map:0,mix:0};
  return {
    reset(next='pop'){style=next;elapsed=0;sequence=0;},
    update(delta,enabled){
      result.mix=0;
      if(!enabled)return result;
      elapsed+=Math.max(0,Math.min(.1,delta));
      const rest=quiet.includes(style)?180:mellow.includes(style)?120:90;
      const duration=quiet.includes(style)?30:24;
      if(elapsed>=rest+duration){elapsed=0;sequence++;}
      if(elapsed<rest)return result;
      const progress=(elapsed-rest)/duration;
      const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
      result.mix=ease(progress*5)*ease((1-progress)*5);
      const scenes=scenesForStyle(style),offset=Math.max(0,style.length%scenes.length);
      [result.ray,result.surface,result.map]=scenes[(sequence+offset)%scenes.length];
      return result;
    }
  };
}
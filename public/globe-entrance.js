// Fade the tiled loading surface after the catalogue and map are ready.
export function createGlobeEntrance(){
  let elapsed=0,finish=null,completion=0;
  const ease=value=>value*value*(3-2*value);
  return {
    get completion(){return completion;},
    update(delta,loading,reduced){
      if(reduced){completion=loading?0:1;return 1;}
      elapsed+=Math.max(0,Math.min(.1,delta));
      if(!loading&&finish===null)finish=elapsed;
      if(finish===null)return 1;
      completion=ease(Math.min(1,(elapsed-finish)/.85));
      return 1;
    }
  };
}
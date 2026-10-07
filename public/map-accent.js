// Trigger only on measured audio peaks; no synthetic beat fallback.
export function createMapAccent(){
  let start=-Infinity,lastTrigger=-Infinity,armed=true;
  return {
    reset(){start=-Infinity;lastTrigger=-Infinity;armed=true;},
    update(time,signal,enabled){
      if(!enabled){start=-Infinity;armed=true;return null;}
      if(signal<.48)armed=true;
      if(armed&&signal>=.68&&time-lastTrigger>=60){start=time;lastTrigger=time;armed=false;}
      const elapsed=time-start;
      return elapsed>=0&&elapsed<16?elapsed/16:null;
    }
  };
}
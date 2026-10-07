// One shared envelope from the currently audible stream. No synthetic beats here.
export class AudioReactivity {
  constructor(){this.reset();}
  reset(){this.level=0;this.bass=0;this.previousBass=0;this.beat=0;this.signal=0;}
  update(bins,samples,sampleRate,fftSize,delta,available){
    const dt=Math.max(0,Math.min(.1,delta));
    let energy=0,bass=0,count=0;
    if(available){
      for(const sample of samples)energy+=sample*sample;
      energy=Math.min(1,Math.sqrt(energy/Math.max(1,samples.length))*2.5);
      for(let i=0;i<bins.length;i++){
        const hz=i*sampleRate/fftSize;
        if(hz>=35&&hz<=220){bass+=bins[i]/255;count++;}
      }
      bass=count?bass/count:0;
    }
    const follow=(current,target,attack,release)=>current+(target-current)*(1-Math.exp(-dt/(target>current?attack:release)));
    this.level=follow(this.level,energy,.045,.24);
    this.bass=follow(this.bass,bass,.035,.28);
    const onset=available?Math.max(0,bass-this.previousBass)*3:0;
    this.previousBass=follow(this.previousBass,bass,.15,.15);
    this.beat=follow(this.beat,Math.min(1,onset),.025,.22);
    this.signal=Math.min(1,this.level*.3+this.bass*.5+this.beat*.2);
    if(!available)this.reset();
    const rhythm=Math.min(1,this.beat*.8+Math.max(0,bass-this.bass*.75)*.7+this.bass*.1);
    return {available:Boolean(available),level:this.level,bass:this.bass,beat:this.beat,signal:this.signal,rhythm};
  }
}
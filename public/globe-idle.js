// Pixel-space movement of the projection; station coordinates never change.
export function verticalDriftBounds(top,bottom,center,radius){
  const min=top+radius-center,max=bottom-radius-center;
  return min<=max?{min,max}:{min:0,max:0};
}
export function createGlobeIdle(){
  let lastActivity=null,x=0,y=0,vx=26,vy=19;
  const result={x:0,y:0,active:false};
  return {
    get active(){return result.active;},
    activity(time){lastActivity=time;},
    update(time,delta,limitX,limitY,blocked=false){
      if(lastActivity===null)lastActivity=time;
      if(blocked)lastActivity=time;
      result.active=!blocked&&time-lastActivity>=30000;
      const dt=Math.max(0,Math.min(.05,delta));
      limitX=Math.max(0,limitX);
      const minY=typeof limitY==='number'?-Math.max(0,limitY):limitY.min;
      const maxY=typeof limitY==='number'?Math.max(0,limitY):limitY.max;
      if(result.active){
        x+=vx*dt;y+=vy*dt;
        if(x>=limitX){x=limitX;vx=-Math.abs(vx);}else if(x<=-limitX){x=-limitX;vx=Math.abs(vx);}
        if(y>=maxY){y=maxY;vy=-Math.abs(vy);}else if(y<=minY){y=minY;vy=Math.abs(vy);}
      }else{
        const ease=Math.exp(-dt/.6);x*=ease;y*=ease;
        if(Math.abs(x)<.05)x=0;if(Math.abs(y)<.05)y=0;
      }
      result.x=x;result.y=y;return result;
    }
  };
}
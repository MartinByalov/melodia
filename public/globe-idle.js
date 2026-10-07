// Pixel-space movement of the projection; station coordinates never change.
export function createGlobeIdle(){
  let lastActivity=null,x=0,y=0,vx=26,vy=19;
  const result={x:0,y:0,active:false};
  return {
    activity(time){lastActivity=time;},
    update(time,delta,limitX,limitY,blocked=false){
      if(lastActivity===null)lastActivity=time;
      if(blocked)lastActivity=time;
      result.active=!blocked&&time-lastActivity>=30000;
      const dt=Math.max(0,Math.min(.05,delta));
      limitX=Math.max(0,limitX);limitY=Math.max(0,limitY);
      if(result.active){
        x+=vx*dt;y+=vy*dt;
        if(x>=limitX){x=limitX;vx=-Math.abs(vx);}else if(x<=-limitX){x=-limitX;vx=Math.abs(vx);}
        if(y>=limitY){y=limitY;vy=-Math.abs(vy);}else if(y<=-limitY){y=-limitY;vy=Math.abs(vy);}
      }else{
        const ease=Math.exp(-dt/.6);x*=ease;y*=ease;
        if(Math.abs(x)<.05)x=0;if(Math.abs(y)<.05)y=0;
      }
      result.x=x;result.y=y;return result;
    }
  };
}
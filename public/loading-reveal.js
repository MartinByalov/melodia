export function createLoadingReveal(container){
  const text='Loading World Vibe',fragments=[];
  const element=document.createElement('div');element.className='globe-loading-reveal';
  element.setAttribute('role','status');element.setAttribute('aria-label',text);
  const visual=document.createElement('span');visual.setAttribute('aria-hidden','true');element.append(visual);container.append(element);
  for(const char of text){
    const letter=document.createElement('span');letter.className='loading-letter';
    if(char===' '){letter.textContent='\u00a0';visual.append(letter);continue;}
    for(let i=0;i<4;i++){
      const fragment=document.createElement('span');fragment.className='loading-letter-fragment';fragment.textContent=char;
      fragment.style.clipPath=`inset(${i*25}% 0 ${75-i*25}% 0)`;
      fragment.style.opacity='0';letter.append(fragment);fragments.push(fragment);
    }
    visual.append(letter);
  }
  const background=document.createElement('span');background.className='loading-background';background.setAttribute('aria-hidden','true');
  for(let row=0;row<4;row++)for(let column=0;column<10;column++){
    const tile=document.createElement('span');tile.className='loading-background-fragment';
    tile.style.left=`${column*10}%`;tile.style.top=`${row*25}%`;tile.style.opacity='0';
    background.append(tile);fragments.push(tile);
  }
  element.append(background);
  const caution=document.createElement('span');caution.className='loading-caution';caution.textContent='Caution\nFlashing Lights';caution.style.whiteSpace='pre-line';
  element.append(caution);
  element.setAttribute('aria-label',`${text}. Caution Flashing Lights`);
  const order=Array.from({length:fragments.length},(_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const rank=[];order.forEach((index,i)=>rank[index]=i);
  let start=null,last=-1;
  return {
    update(time,loading,offset,reduced){
      element.hidden=!loading;
      if(!loading)return;
      element.style.top=`calc(50% + ${offset}px)`;
      if(start===null)start=time;
      const tick=Math.floor((time-start)/75);
      if(tick===last)return;last=tick;
      for(let i=0;i<fragments.length;i++){
        const progress=reduced?1:Math.max(0,Math.min(1,((time-start)-rank[i]*24)/180));
        const opacity=String(progress);
        if(fragments[i].style.opacity!==opacity)fragments[i].style.opacity=opacity;
      }
    },
    dispose(){element.remove();}
  };
}
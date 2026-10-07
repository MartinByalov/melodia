export function faviconURL(color){
  if(!/^#[\da-f]{6}$/i.test(color))throw new Error('Invalid favicon color');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="${color}" stroke-width="6"><circle cx="32" cy="32" r="27"/><circle cx="32" cy="32" r="13"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function createThemeFavicon(link){
  let current='',pending='',timer=null;
  function update(color,animated=false){
    pending=color;
    if(animated){
      if(timer===null)timer=setTimeout(()=>{timer=null;update(pending);},1500);
      return;
    }
    if(timer!==null){clearTimeout(timer);timer=null;}
    if(current===color)return;
    link.href=faviconURL(color);current=color;
  }
  return {update,dispose(){if(timer!==null)clearTimeout(timer);timer=null;}};
}
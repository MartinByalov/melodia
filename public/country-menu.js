// Keep the select as the filter's data source; render a bounded, keyboard-accessible menu.
export function createCountryMenu(select,panel) {
  const label=select.closest('label');
  const wrapper=document.createElement('div');wrapper.className='country-menu';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='country-trigger';
  trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-controls','country-options');
  const list=document.createElement('div');list.id='country-options';list.className='country-options';list.hidden=true;
  list.setAttribute('role','listbox');list.setAttribute('aria-label','Country');
  label.append(wrapper);wrapper.append(trigger,list);select.hidden=true;
  let buttons=[];
  function sync(){
    trigger.textContent=select.selectedOptions[0]?.textContent||'All countries';
    trigger.setAttribute('aria-label',`Country: ${trigger.textContent}`);
    for(const button of buttons)button.setAttribute('aria-selected',String(button.dataset.value===select.value));
  }
  function close(focus=false){list.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function open(){
    sync();list.hidden=false;trigger.setAttribute('aria-expanded','true');
    const panelRect=panel.getBoundingClientRect(),rect=trigger.getBoundingClientRect();
    list.style.maxHeight=`${Math.max(0,Math.min(260,panelRect.bottom-rect.bottom-12))}px`;
    const selected=buttons.find(button=>button.dataset.value===select.value)||buttons[0];selected?.focus();
  }
  function rebuild(){
    buttons=Array.from(select.options,option=>{
      const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.dataset.value=option.value;
      button.setAttribute('role','option');button.tabIndex=-1;
      button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close(true);});
      return button;
    });
    list.replaceChildren(...buttons);sync();
  }
  trigger.addEventListener('click',()=>list.hidden?open():close());
  trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open();}});
  list.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
    const index=buttons.indexOf(document.activeElement);
    let next;
    if(event.key==='ArrowDown')next=Math.min(buttons.length-1,index+1);
    if(event.key==='ArrowUp')next=Math.max(0,index-1);
    if(event.key==='Home')next=0;
    if(event.key==='End')next=buttons.length-1;
    if(next!==undefined){event.preventDefault();buttons[next]?.focus();}
  });
  document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))close();});
  wrapper.addEventListener('focusout',event=>{if(!wrapper.contains(event.relatedTarget))close();});
  select.addEventListener('change',sync);
  const optionsObserver=new MutationObserver(rebuild);optionsObserver.observe(select,{childList:true});
  const panelObserver=new MutationObserver(()=>{if(panel.hidden)close();else sync();});
  panelObserver.observe(panel,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',()=>close());
  rebuild();
  return {sync,close};
}
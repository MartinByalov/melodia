import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingReveal} from '../public/loading-reveal.js';

test('loading letters resolve, respect reduced motion and disappear when ready',()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({style:{},children:[],setAttribute(){},append(child){this.children.push(child);},remove(){this.removed=true;}})};
  try{
    const container={append(element){this.element=element;}},reveal=createLoadingReveal(container);
    reveal.update(100,true,25,false);
    assert.equal(container.element.hidden,false);
    assert.equal(container.element.style.top,'calc(50% + 25px)');
    const fragments=container.element.children[0].children.flatMap(letter=>letter.children);
    assert.equal(fragments.length,64);
    assert.ok(fragments.some(fragment=>fragment.style.opacity==='0'));
    const background=container.element.children[1].children;
    assert.equal(background.length,40);
    assert.equal(container.element.children[2].textContent,'Caution\nFlashing Lights');
    assert.equal(container.element.children[2].style.whiteSpace,'pre-line');
    assert.ok(background.every(tile=>tile.style.opacity==='0'));
    reveal.update(3100,true,25,false);
    assert.ok(fragments.every(fragment=>fragment.style.opacity==='1'));
    assert.ok(background.every(tile=>tile.style.opacity==='1'));
    assert.equal(container.element.children[0].children.map(letter=>letter.children[0]?.textContent||' ').join(''),'Loading World Vibe');
    reveal.update(3200,false,0,false);assert.equal(container.element.hidden,true);
    reveal.dispose();assert.equal(container.element.removed,true);
    const reduced=createLoadingReveal(container);reduced.update(0,true,0,true);
    assert.ok(container.element.children[0].children.flatMap(letter=>letter.children).every(fragment=>fragment.style.opacity==='1'));
    assert.ok(container.element.children[1].children.every(tile=>tile.style.opacity==='1'));
  }finally{globalThis.document=previous;}
});

test('under development notice persists in the loading style',()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({style:{},children:[],setAttribute(){},append(child){this.children.push(child);},remove(){this.removed=true;}})};
  try{
    const container={append(element){this.element=element;}},reveal=createLoadingReveal(container,{text:'Under development',persistent:true,caution:false});
    reveal.update(100,false,0,false);
    assert.equal(container.element.hidden,false);
    assert.equal(container.element.children[0].children.map(letter=>letter.children[0]?.textContent||' ').join(''),'Under development');
    assert.equal(container.element.children.length,2);
    reveal.update(3100,false,0,false);
    assert.equal(container.element.hidden,false);
    reveal.dispose();assert.equal(container.element.removed,true);
  }finally{globalThis.document=previous;}
});
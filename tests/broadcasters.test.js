import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

test('contact (corrections and removal) is a section of the information dialog, not a separate page',async()=>{
  const [index,info]=await Promise.all(['index.html','site-info.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  await assert.rejects(stat(new URL('../public/broadcasters.html',import.meta.url)),/ENOENT/);
  assert.doesNotMatch(index+info,/broadcasters\.html|Report artist|Report this artist/);
  assert.match(index,/<footer>[\s\S]*<button type="button" data-info="requests">Contact<\/button>[\s\S]*<\/footer>/);
  assert.match(index,/<nav class="info-tabs"[\s\S]*data-info="requests">Contact<\/button><\/nav>/);
  const section=info.match(/requests:\{title:'Contact',html:'([^']*)'\}/)?.[1];
  assert.ok(section,'requests section present');
  assert.match(section,/<a href="mailto:contact@melodia\.lol\?subject=Melodia%20artist%20request">contact@melodia\.lol<\/a>/);
  assert.match(section,/Melodia does not send the message for you/);
  assert.match(section,/Artists can change or withdraw their music, location and profile on Jamendo at any time/);
  assert.doesNotMatch(section,/<form\b|formsubmit|Send report/i);
  assert.doesNotMatch(info,/FormSubmit|formsubmit/);
});

test('artist information has no report link and its artist page is a real link',async()=>{
  const [html,app]=await Promise.all(['index.html','app.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  const dialog=html.match(/<dialog id="station-dialog"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(dialog);
  assert.doesNotMatch(dialog,/report/i);
  assert.match(dialog,/<div class="dialog-head"><h2>About this artist<\/h2><button class="dialog-close icon-button" aria-label="Close">/);
  assert.doesNotMatch(app,/report-selected/);
  assert.match(app,/label==='Artist page'&&\/\^https:\\\/\\\/\/\.test\(value\)/);
  assert.match(app,/link\.target='_blank';link\.rel='noopener noreferrer'/);
});

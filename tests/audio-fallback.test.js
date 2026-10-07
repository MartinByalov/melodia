import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('failed CORS streams skip repeated analysis attempts and stale play errors cannot replace fallback audio',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/useCors=useCors&&!streamsWithoutAnalysis\.has\(selected\.url\)/);
  assert.equal((source.match(/streamsWithoutAnalysis\.add\(element\.src\)/g)||[]).length,2);
  assert.match(source,/token !== session \|\| audio !== element \|\| e\.name === 'AbortError'/);
  assert.match(source,/if \(useCors\) element\.crossOrigin = 'anonymous'/);
});
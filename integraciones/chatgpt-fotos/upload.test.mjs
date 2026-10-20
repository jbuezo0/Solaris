import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateLink, detectImage, authorized} from './index.js';
test('allow only exact OpenAI file host',()=>{
  assert.equal(validateLink('https://files.oaiusercontent.com/a?sig=test').hostname,'files.oaiusercontent.com');
  for(const url of ['http://files.oaiusercontent.com/a','https://files.oaiusercontent.com.evil.test/a','https://localhost/a','https://127.0.0.1/a','https://files.oaiusercontent.com@evil.test/a']) assert.throws(()=>validateLink(url));
});
test('detect real supported image signatures',()=>{
  assert.equal(detectImage(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(detectImage(Uint8Array.from([255,216,255])),'image/jpeg');
  assert.throws(()=>detectImage(new TextEncoder().encode('<svg></svg>')));
});
test('fail closed without a strong matching key',async()=>{
  const key='x'.repeat(40);
  assert.equal(await authorized(`Bearer ${key}`,key),true);
  assert.equal(await authorized('Bearer wrong',key),false);
  assert.equal(await authorized(null,key),false);
  assert.equal(await authorized('Bearer short','short'),false);
});

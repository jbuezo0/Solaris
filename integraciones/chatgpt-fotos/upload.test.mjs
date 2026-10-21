import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateLink, detectImage, authorized, productPayload, productAction} from './index.js';
test('allow only exact OpenAI file host',()=>{
  assert.equal(validateLink('https://files.oaiusercontent.com/a?sig=test').hostname,'files.oaiusercontent.com');
  assert.equal(validateLink('https://sdmntprcentralus.oaiusercontent.com/a?sig=test').hostname,'sdmntprcentralus.oaiusercontent.com');
  assert.throws(()=>validateLink('https://sdmntprcentralus.oaiusercontent.com.evil.test/a'));
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
const base='https://cgxrrtyjgdxhhddzxroh.supabase.co';
const input={name:'Prueba local',category:'Lámparas solares',price:340,status:'Disponible',description:'Descripción de prueba, sin publicar.',image_urls:[`${base}/storage/v1/object/public/product-images/chatgpt/12345678-1234-1234-1234-123456789abc.png`]};
test('reject invalid prices, missing photos and foreign images',()=>{
  assert.equal(productPayload(input,base).active,false);
  for(const change of [{price:-1},{price:NaN},{price:'340'},{price:1.001},{image_urls:[]},{image_urls:['https://evil.test/photo.png']},{category:'No existe'},{name:''}])assert.throws(()=>productPayload({...input,...change},base));
});
test('draft -> explicit confirmation -> publish; retries do not duplicate',async()=>{
  const original=globalThis.fetch;let product=null, inserts=0,updates=0;
  const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
  globalThis.fetch=async (url,options={})=>{
    if(options.method==='HEAD')return new Response(null,{status:200});
    if(options.method==='POST'){inserts++;product={...JSON.parse(options.body),updated_at:'2026-10-20T12:00:00Z'};return response([product]);}
    if(options.method==='PATCH'){updates++;product={...product,active:true,updated_at:'2026-10-20T12:01:00Z'};return response([product]);}
    return response(product?[product]:[]);
  };
  try {
    const key='test-key-not-production-'.repeat(3);
    const draft=await (await productAction('draft',input,base,'mock-service',key)).json();
    assert.equal(draft.published,false);assert.equal(product.active,false);assert.equal(updates,0);
    const again=await (await productAction('draft',input,base,'mock-service',key)).json();
    assert.equal(again.product.id,draft.product.id);assert.equal(inserts,1);
    const confirmation={product_id:draft.product.id,preview_token:draft.preview_token,expires:draft.expires,confirmed:true};
    await assert.rejects(()=>productAction('publish',{...confirmation,confirmed:false},base,'mock-service',key));
    await assert.rejects(()=>productAction('publish',{...confirmation,preview_token:'fake'},base,'mock-service',key));
    await assert.rejects(()=>productAction('publish',{...confirmation,expires:0},base,'mock-service',key));
    product.price=999;
    await assert.rejects(()=>productAction('publish',confirmation,base,'mock-service',key));
    assert.equal(updates,0);product.price=340;
    const published=await (await productAction('publish',confirmation,base,'mock-service',key)).json();
    assert.equal(published.published,true);assert.equal(updates,1);
    assert.equal((await (await productAction('publish',confirmation,base,'mock-service',key)).json()).published,true);assert.equal(updates,1);
    product=null;inserts=0;updates=0;
    await assert.rejects(()=>productAction('create',input,base,'mock-service',key));
    assert.equal(inserts,0);
    const direct=await (await productAction('create',{...input,confirmed:true},base,'mock-service',key)).json();
    assert.equal(direct.published,true);assert.equal(inserts,1);assert.equal(updates,1);
    const retry=await (await productAction('create',{...input,confirmed:true},base,'mock-service',key)).json();
    assert.equal(retry.published,true);assert.equal(inserts,1);assert.equal(updates,1);
  } finally {globalThis.fetch=original;}
});

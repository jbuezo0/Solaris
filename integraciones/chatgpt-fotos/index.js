// Supabase Edge Function. No credentials belong in this file or the storefront.
const MAX = 5 * 1024 * 1024;
const TYPES = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/gif','gif']]);
const FILE_HOSTS = new Set(['files.oaiusercontent.com', 'sdmntprcentralus.oaiusercontent.com']);
const reply = (status, body) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function validateLink(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !FILE_HOSTS.has(url.hostname) || url.port || url.username || url.password) throw new Error(`Origen de archivo no permitido. Servidor: ${url.hostname.slice(0,253)}. No compartas el enlace completo.`);
  return url;
}
export function detectImage(b) {
  if (b[0]===255 && b[1]===216 && b[2]===255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n)) return 'image/png';
  const text = new TextDecoder().decode(b.slice(0,12));
  if (text.startsWith('GIF87a') || text.startsWith('GIF89a')) return 'image/gif';
  if (text.startsWith('RIFF') && text.slice(8)==='WEBP') return 'image/webp';
  throw new Error('El archivo no es una imagen compatible');
}
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
}
export async function authorized(header, secret) {
  if (!secret || secret.length<32 || !header?.startsWith('Bearer ')) return false;
  const a=await digest(header.slice(7)), b=await digest(secret);
  let difference=0; for(let i=0;i<a.length;i++) difference|=a[i]^b[i];
  return difference===0;
}
async function limitedBody(response, limit) {
  if (Number(response.headers.get('content-length'))>limit) throw new Error('Archivo demasiado grande');
  const reader=response.body?.getReader(); if(!reader) throw new Error('Archivo vacío');
  const chunks=[]; let length=0;
  try { while(true) {const {done,value}=await reader.read(); if(done) break; length+=value.length; if(length>limit) throw new Error('Archivo demasiado grande'); chunks.push(value);} }
  finally {await reader.cancel();}
  const result=new Uint8Array(length); let offset=0; for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;} return result;
}
const CATEGORIES=['Lámparas solares','Decoración','Iluminación interior','Iluminación exterior','Guirnaldas y ambiente','Reflectores solares','Accesorios','Otros'];
const STATUSES=['Disponible','Últimas unidades','Consultar existencias','Por encargo','Agotado'];
export function productPayload(body, base) {
  const text=(key,max,required=false)=>{const v=body[key];if(v===undefined&&!required)return '';if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw new Error(`Revisa ${key}`);return v.trim();};
  const name=text('name',160,true),description=text('description',4000,true);
  if(!CATEGORIES.includes(body.category)||!STATUSES.includes(body.status))throw new Error('Categoría o disponibilidad no válida');
  if(typeof body.price!=='number'||!Number.isFinite(body.price)||body.price<0||body.price>9999999||Math.abs(body.price*100-Math.round(body.price*100))>0.00001)throw new Error('Precio no válido: usa quetzales y hasta dos decimales');
  if(!Array.isArray(body.image_urls)||body.image_urls.length<1||body.image_urls.length>10)throw new Error('Incluye entre 1 y 10 fotos guardadas');
  const prefix=`${base}/storage/v1/object/public/product-images/chatgpt/`;
  const images=[...new Set(body.image_urls)];
  for(const image of images) {if(typeof image!=='string'||!image.startsWith(prefix)||!new RegExp('^[0-9a-f-]{36}\\.(jpg|png|webp|gif)$').test(image.slice(prefix.length)))throw new Error('Usa únicamente las URLs devueltas por la carga de fotos de Solaris');}
  return {name,category:body.category,price:body.price,status:body.status,description,brand:text('brand',100),model:text('model',100),image_url:images[0],image_urls:images,active:false};
}
async function stableId(payload) {
  const bytes=await digest('solaris-chatgpt-product-v1:'+JSON.stringify(payload));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
async function previewToken(product,expires,key) {
  product={...product}; delete product.active; delete product.updated_at;
  const signing=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',signing,new TextEncoder().encode(JSON.stringify({product,expires})));
  return Array.from(new Uint8Array(signed),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function productAction(action,body,base,service,key) {
  const headers={Authorization:`Bearer ${service}`,apikey:service,'Content-Type':'application/json'};
  const fields='id,name,category,price,status,description,brand,model,image_url,image_urls,active,updated_at';
  const read=async id=>{const res=await fetch(`${base}/rest/v1/products?id=eq.${id}&select=${fields}`,{headers,signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('No se pudo consultar el producto');return (await res.json())[0];};
  if(action==='draft') {
    const payload=productPayload(body,base),id=await stableId(payload);
    for(const url of payload.image_urls){const res=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error('Una foto no existe en el almacenamiento');}
    let product=await read(id);
    if(!product){const res=await fetch(`${base}/rest/v1/products?select=${fields}`,{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({id,...payload}),signal:AbortSignal.timeout(10000)});if(res.status===409)product=await read(id);else if(res.ok)product=(await res.json())[0];else throw new Error('No se pudo guardar el borrador');}
    if(!product)throw new Error('No se pudo verificar el borrador');
    for(const field of Object.keys(payload).filter(x=>x!=='active'))if(JSON.stringify(product[field])!==JSON.stringify(payload[field]))throw new Error('El borrador cambió desde el administrador. Revisa sus datos antes de continuar.');
    const expires=Date.now()+86400000;
    return reply(200,{product,published:product.active,preview_token:await previewToken(product,expires,key),expires,message:product.active?'Este producto ya estaba publicado; no se duplicó.':'Borrador guardado. Muestra los datos al usuario y pide confirmación antes de publicar.'});
  }
  if(action==='publish') {
    if(body.confirmed!==true)throw new Error('Se requiere confirmación explícita del propietario');
    if(typeof body.product_id!=='string'||!/^[0-9a-f-]{36}$/.test(body.product_id))throw new Error('Identificador no válido');
    if(typeof body.expires!=='number'||body.expires<Date.now()||body.expires>Date.now()+86400000)throw new Error('La vista previa venció. Prepara nuevamente el borrador.');
    const product=await read(body.product_id);if(!product) return reply(404,{error:'Producto no encontrado'});
    if(typeof body.preview_token!=='string'||body.preview_token!==await previewToken(product,body.expires,key))throw new Error('La vista previa no coincide con el producto actual. Revisa nuevamente el borrador.');
    if(!product.active){const res=await fetch(`${base}/rest/v1/products?id=eq.${product.id}&active=eq.false&updated_at=eq.${encodeURIComponent(product.updated_at)}&select=${fields}`,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({active:true}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('No se pudo publicar');const saved=(await res.json())[0];if(!saved?.active)throw new Error('El borrador cambió; prepara una nueva vista previa');return reply(200,{product:saved,published:true,url:'https://solarisiluminacion.com/#tienda'});}
    return reply(200,{product,published:true,url:'https://solarisiluminacion.com/#tienda'});
  }
  return reply(404,{error:'Operación no disponible'});
}
export async function handler(req) {
  const key=Deno.env.get('SOLARIS_CHATGPT_UPLOAD_KEY');
  if(!key || key.length<32) return reply(503,{error:'Conexión pendiente de configurar por el administrador'});
  if(!await authorized(req.headers.get('Authorization'),key)) return reply(401,{error:'No autorizado'});
  if(req.method!=='POST') return reply(405,{error:'Solo POST'});
  const base=Deno.env.get('SUPABASE_URL'), service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!base || !service) return reply(503,{error:'Almacenamiento no configurado'});
  const uploaded=[];
  try {
    const raw=new TextDecoder().decode(await limitedBody(req,32768));
    const body=JSON.parse(raw);
    const route=new URL(req.url).pathname.split('/').filter(Boolean).pop();
    if(route==='draft'||route==='publish') return await productAction(route,body,base,service,key);
    if(route!=='solaris-chatgpt-fotos')return reply(404,{error:'Operación no disponible'});
    const refs=body.openaiFileIdRefs;
    if(!Array.isArray(refs) || refs.length<1 || refs.length>5) return reply(400,{error:'Envía entre 1 y 5 fotografías'});
    const files=[];
    for(const ref of refs) {
      if(!ref || typeof ref.download_link!=='string') throw new Error('No se recibieron enlaces reales de ChatGPT. Vuelve a adjuntar las fotos.');
      const url=validateLink(ref.download_link);
      const remote=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000)});
      if(!remote.ok) throw new Error('El enlace de la foto venció o no está disponible');
      const bytes=await limitedBody(remote,MAX), type=detectImage(bytes);
      if(bytes.length<12) throw new Error('Imagen incompleta');
      files.push({bytes,type,path:`chatgpt/${crypto.randomUUID()}.${TYPES.get(type)}`});
    }
    for(const file of files) {
      const stored=await fetch(`${base}/storage/v1/object/product-images/${file.path}`,{method:'POST',headers:{Authorization:`Bearer ${service}`,apikey:service,'Content-Type':file.type,'x-upsert':'false'},body:file.bytes,signal:AbortSignal.timeout(12000)});
      if(!stored.ok) throw new Error('No se pudo guardar una fotografía');
      uploaded.push(file.path);
    }
    return reply(200,{image_urls:uploaded.map(path=>`${base}/storage/v1/object/public/product-images/${path}`),published:false,message:'Fotos guardadas. Aún no se creó ni publicó ningún producto.'});
  } catch(error) {
    if(uploaded.length) {
      try {await fetch(`${base}/storage/v1/object/product-images`,{method:'DELETE',headers:{Authorization:`Bearer ${service}`,apikey:service,'Content-Type':'application/json'},body:JSON.stringify({prefixes:uploaded}),signal:AbortSignal.timeout(5000)});} catch { /* May leave unassociated photos; never delete existing product objects. */ }
    }
    return reply(400,{error:error instanceof Error?error.message:'No se pudo procesar la solicitud'});
  }
}
if(import.meta.main) Deno.serve(handler);

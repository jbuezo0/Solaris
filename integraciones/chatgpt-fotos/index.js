// Supabase Edge Function. No credentials belong in this file or the storefront.
const MAX = 5 * 1024 * 1024;
const TYPES = new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/gif','gif']]);
const reply = (status, body) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function validateLink(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'files.oaiusercontent.com' || url.port || url.username || url.password) throw new Error('Origen de archivo no permitido');
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
    const body=JSON.parse(raw); const refs=body.openaiFileIdRefs;
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

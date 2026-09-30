import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {assertLocalMaintenance} from './environment.mjs';
import {IMAGE_MAX_BYTES} from '../directus/hooks/redirects/image-upload-limit.mjs';
assertLocalMaintenance();
const base=process.env.DIRECTUS_URL;const headers={Authorization:`Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`};
const prefix='image-size-check-'+randomUUID();const ids=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
function bytes(size){const data=Buffer.alloc(size);png.copy(data);return data;}
async function upload(data,name,id){const form=new FormData();form.append('file',new Blob([data],{type:'image/png'}),prefix+name+'.png');const r=await fetch(base+'/files'+(id?'/'+id:''),{method:id?'PATCH':'POST',headers,body:form});const j=await r.json();if(r.ok&&j.data?.id&&!ids.includes(j.data.id))ids.push(j.data.id);return {status:r.status,...j};}
const get=async p=>{const r=await fetch(base+p,{headers});assert.equal(r.status,200);return (await r.json()).data;};
try {
 const small=await upload(png,'-small');assert.ok(small.status<300,JSON.stringify(small));
 const exact=await upload(bytes(IMAGE_MAX_BYTES),'-exact');assert.ok(exact.status<300,JSON.stringify(exact));
 assert.equal(Number(exact.data.filesize),IMAGE_MAX_BYTES);
 const oversized=await upload(bytes(IMAGE_MAX_BYTES+1),'-oversized');assert.equal(oversized.status,413,JSON.stringify(oversized));assert.equal(oversized.errors[0].extensions.code,'IMAGE_TOO_LARGE');
 const replaced=await upload(bytes(IMAGE_MAX_BYTES+1),'-replacement',small.data.id);assert.equal(replaced.status,413,JSON.stringify(replaced));
 const saved=await get('/files/'+small.data.id);assert.equal(Number(saved.filesize),png.length);assert.equal(saved.filename_download,prefix+'-small.png');
 const asset=await fetch(base+'/assets/'+small.data.id,{headers});assert.equal(asset.status,200);const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(Buffer.from(await asset.arrayBuffer())),hash(png));
 const found=await get('/files?'+new URLSearchParams({'filter[filename_download][_starts_with]':prefix,limit:'-1'}));assert.equal(found.length,2);
 console.log('PASS: small and exact 5 MiB uploads accepted; oversized new/replacement rejected with Chinese 413; original image bytes preserved; no rejected file records.');
}finally {for(const id of ids){const r=await fetch(base+'/files/'+id,{method:'DELETE',headers});assert.ok(r.ok);}console.log('Temporary upload fixtures removed.');}

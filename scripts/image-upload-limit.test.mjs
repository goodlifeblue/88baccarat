import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {IMAGE_MAX_BYTES,isImageUpload,prepareImageUpload,installImageUploadLimit} from '../directus/hooks/redirects/image-upload-limit.mjs';
const sizeOf=async stream=>{let size=0;for await(const chunk of stream)size+=chunk.length;return size;};
test('image identification includes MIME, filename and existing replacement type',()=>{
 assert.equal(isImageUpload({type:'image/png'}),true);
 assert.equal(isImageUpload({filename_download:'PHOTO.JPG',type:'application/octet-stream'}),true);
 assert.equal(isImageUpload({type:'video/mp4'}, {type:'image/png'}),true);
 assert.equal(isImageUpload({filename_download:'hero.mp4',type:'video/mp4'}),false);
});
test('images at the boundary pass; exceeding it or truncated data fail',async()=>{
 assert.equal(await sizeOf(await prepareImageUpload(Readable.from([Buffer.alloc(IMAGE_MAX_BYTES)]))),IMAGE_MAX_BYTES);
 await assert.rejects(prepareImageUpload(Readable.from([Buffer.alloc(IMAGE_MAX_BYTES),Buffer.alloc(1)])),e=>e.status===413&&e.code==='IMAGE_TOO_LARGE');
 const truncated=Readable.from([Buffer.alloc(1)]);truncated.truncated=true;
 await assert.rejects(prepareImageUpload(truncated),e=>e.status===413);
});
test('rejected replacements never reach storage; videos retain original upload path',async()=>{
 let writes=0;
 class FilesService {
  knex(){return {where:()=>({select:()=>({first:async()=>({type:'image/png'})})})};}
  async uploadOne(stream){writes++;return sizeOf(stream);}
 }
 installImageUploadLimit(FilesService);installImageUploadLimit(FilesService);
 const service=new FilesService();
 await assert.rejects(service.uploadOne(Readable.from([Buffer.alloc(IMAGE_MAX_BYTES+1)]),{type:'image/png'},'existing'),e=>e.status===413);
 assert.equal(writes,0);
 assert.equal(await service.uploadOne(Readable.from([Buffer.alloc(IMAGE_MAX_BYTES+1)]),{type:'video/mp4'}),IMAGE_MAX_BYTES+1);
 assert.equal(writes,1);
});

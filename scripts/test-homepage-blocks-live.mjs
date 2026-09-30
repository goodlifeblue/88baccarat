import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertLocalMaintenance} from './environment.mjs';
assertLocalMaintenance();
const base=process.env.DIRECTUS_URL;const admin=process.env.DIRECTUS_ADMIN_TOKEN;const prefix='home-check-'+randomUUID();
const blocks=[];const articles=[];const users=[];let checks=0;
async function request(path,method='GET',body,token=admin){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,...(r.status===204?{}:await r.json())};}
async function api(path,method='GET',body,token=admin){const r=await request(path,method,body,token);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
async function roleToken(name){const role=(await api('/roles?'+new URLSearchParams({'filter[name][_eq]':name})))[0];const token=randomUUID()+randomUUID();const user=await api('/users','POST',{email:prefix+'-'+users.length+'@example.com',role:role.id,status:'active',token});users.push(user.id);return token;}
const home=async()=>{const r=await fetch('http://127.0.0.1:4388/');assert.equal(r.status,200);return r.text();};
try {
 const manager=await roleToken('行銷主管');
 const existing=(await api('/items/articles?filter[status][_eq]=published&filter[category][_eq]=guide&limit=1'))[0];
 const block=await api('/items/homepage_blocks','POST',{title:prefix,enabled:false,type:'articles',article_source:'manual',sort:50,articles:{create:[{sort:2,article_id:existing.id},{sort:1,article_id:{title:prefix+' article',slug:prefix,category:'guide',status:'draft',excerpt:'Temporary article',content:'## New article\n\nNew article from homepage block.'}}]}},manager);blocks.push(block.id);
 const read=()=>api(`/items/homepage_blocks/${block.id}?fields=*,articles.*,articles.article_id.*`);
 let saved=await read();const created=saved.articles.find(x=>x.article_id.slug===prefix).article_id;articles.push(created.id);
 assert.equal(created.created_by,users[0]);checks++;
 assert.ok(!(await home()).includes(`data-homepage-block="${block.id}"`));checks++;
 await api('/items/homepage_blocks/'+block.id,'PATCH',{enabled:true},manager);
 let html=await home();assert.ok(html.includes(prefix));assert.ok(!html.includes('/guide/'+prefix+'/'));checks++;
 await api('/items/articles/'+created.id,'PATCH',{status:'published',published_at:new Date().toISOString()},manager);
 html=await home();const start=html.indexOf(`data-homepage-block="${block.id}"`);let section=html.slice(start,html.indexOf('</section>',start));assert.ok(section.indexOf('/guide/'+prefix+'/')<section.indexOf('/guide/'+existing.slug+'/'));checks++;
 const detail=await fetch('http://127.0.0.1:4388/guide/'+prefix+'/');assert.equal(detail.status,200);assert.ok((await detail.text()).includes('New article from homepage block'));checks++;
 saved=await read();const first=saved.articles.find(x=>x.article_id.id===created.id);const second=saved.articles.find(x=>x.article_id.id===existing.id);
 await api('/items/homepage_blocks/'+block.id,'PATCH',{sort:0,articles:{update:[{id:first.id,sort:2},{id:second.id,sort:1}]}},manager);
 html=await home();const next=html.indexOf(`data-homepage-block="${block.id}"`);section=html.slice(next,html.indexOf('</section>',next));assert.ok(section.indexOf('/guide/'+existing.slug+'/')<section.indexOf('/guide/'+prefix+'/'));assert.ok(next<html.indexOf('熱門攻略'));checks+=2;
 const duplicate=await request('/items/homepage_block_articles','POST',{block_id:block.id,article_id:created.id,sort:3},manager);assert.equal(duplicate.status,400);checks++;
 const deletion=await request('/items/articles/'+created.id,'DELETE');assert.equal(deletion.status,400);checks++;
 const editor=await roleToken('文章編輯');const denied=await request('/items/homepage_blocks/'+block.id,'PATCH',{title:'not allowed'},editor);assert.equal(denied.status,403);checks++;
 const draft=await api('/items/homepage_blocks','POST',{title:prefix+' editor',enabled:false,type:'articles',article_source:'manual'},editor);blocks.push(draft.id);checks++;
 const publishDenied=await request('/items/homepage_blocks/'+draft.id,'PATCH',{enabled:true},editor);assert.ok([400,403].includes(publishDenied.status));checks++;
 await api('/items/homepage_blocks/'+block.id,'PATCH',{articles:{delete:[first.id]}},manager);assert.equal((await api('/items/articles/'+created.id)).id,created.id);checks++;
 await api('/items/homepage_blocks/'+block.id,'PATCH',{enabled:false},manager);assert.ok(!(await home()).includes(`data-homepage-block="${block.id}"`));checks++;
 console.log('PASS:',checks,'checks: nested article creation, existing selection, draft exclusion, block/article order, live article detail, duplicate/delete guards, editor permissions and deselection preserves article.');
}finally {
 for(const id of blocks.reverse())await api('/items/homepage_blocks/'+id,'DELETE');
 for(const id of articles)await api('/items/articles/'+id,'DELETE');
 for(const id of users)await api('/users/'+id,'DELETE');
 console.log('Temporary blocks, articles and users removed.');
}

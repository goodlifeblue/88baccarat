import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertLocalMaintenance} from './environment.mjs';
assertLocalMaintenance();
const base=process.env.DIRECTUS_URL;
const token=process.env.DIRECTUS_ADMIN_TOKEN;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const prefix='guard-check-'+randomUUID();
const created=[];let checks=0;
async function request(path,method='GET',body){const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});const j=r.status===204?{}:await r.json();return {status:r.status,...j};}
async function api(path,method='GET',body){const r=await request(path,method,body);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
async function create(c,body){const data=await api('/items/'+c,'POST',body);created.push([c,data.id]);return data;}
async function rejected(path,method,body){const r=await request(path,method,body);assert.equal(r.status,400,JSON.stringify(r));assert.equal(r.errors[0].extensions.code,'INVALID_PAYLOAD',JSON.stringify(r));checks++;}
try {
 const draft=await create('articles',{content:'尚未完成',slug:''});
 const otherDraft=await create('articles',{title:'另一篇暫存',slug:''});
 assert.equal(draft.status,'draft');assert.equal(draft.slug,null);assert.equal(otherDraft.slug,null);
 const draftPath='/items/articles/'+draft.id;
 await api(draftPath,'PATCH',{content:'繼續編輯',faq:[{question:'尚未填答案'}]});
 const before=await api(draftPath);
 await rejected(draftPath,'PATCH',{status:'published'});
 await rejected(draftPath,'PATCH',{slug:'bad slug'});
 assert.deepEqual(await api(draftPath),before);
 await rejected('/items/articles','PATCH',{keys:[draft.id,otherDraft.id],data:{status:'published'}});
 assert.deepEqual(await api(draftPath),before);
 assert.equal((await api('/items/articles/'+otherDraft.id)).status,'draft');
 await api(draftPath,'PATCH',{title:'完成文章',slug:prefix+'-draft',category:'guide',excerpt:'摘要',content:'完整內文',published_at:new Date().toISOString(),faq:[],status:'published'});
 assert.equal((await api(draftPath)).status,'published');checks++;
 const page=await create('pages',{title:'Guard check',path:`/${prefix}/`,status:'draft',page_type:'single_page',description:'Temporary test'});
 const article=await create('articles',{title:'Guard check',slug:prefix,category:'guide',status:'draft',excerpt:'Temporary test',content:'Temporary test'});
 const articlePath='/items/articles/'+article.id; const pagePath='/items/pages/'+page.id;
 await rejected(articlePath,'PATCH',{status:'published'});
 await rejected(articlePath,'PATCH',{slug:'bad slug'});
 await rejected(pagePath,'PATCH',{status:'published',description:''});
 await rejected(pagePath,'PATCH',{hero_interval:1});
 await rejected(pagePath,'PATCH',{path:'/admin/'});
 await rejected(pagePath,'PATCH',{status:'published',sections:[{type:'cards',cards:{}}]});
 await rejected('/items/navigation','POST',{label:'Guard check',status:'published',link_type:'page',page:page.id});
 await rejected('/items/navigation','POST',{label:'Guard check',status:'published',link_type:'url',href:'javascript:alert(1)'});
 await rejected('/items/hero_slides','POST',{page:page.id,enabled:true,media_type:'video'});
 await api(pagePath,'PATCH',{status:'published'});checks++;
 const nav=await create('navigation',{label:'Guard check',status:'published',link_type:'page',page:page.id});
 await rejected(pagePath,'PATCH',{status:'draft'});
 await rejected(pagePath,'DELETE');
 await rejected(pagePath,'PATCH',{path:`/${prefix}-new/`});
 await api('/items/navigation/'+nav.id,'PATCH',{status:'draft'});
 await api(pagePath,'PATCH',{status:'draft'});checks++;
 const redirect=await create('redirects',{old_path:`/${prefix}-old/`,new_path:`/${prefix}-new/`,status_code:301,enabled:true});
 await rejected('/items/redirects','POST',{old_path:`/${prefix}-new/`,new_path:`/${prefix}-old/`,status_code:301,enabled:true});
 await rejected('/items/redirects/'+redirect.id,'PATCH',{new_path:`/${prefix}-old/`});
 await rejected('/items/article_relations','POST',{article_id:article.id,related_id:article.id});
 // Exercise file deletion protection using an isolated uploaded asset.
 const form=new FormData();form.append('file',new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'],{type:'image/svg+xml'}),prefix+'.svg');
 const upload=await fetch(base+'/files',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});const file=(await upload.json()).data;assert.ok(file?.id);created.unshift(['files',file.id]);
 await api(articlePath,'PATCH',{cover_image:file.id});
 await rejected('/files/'+file.id,'DELETE');
 await rejected('/files/'+file.id,'PATCH',{type:'video/mp4'});
 await rejected('/items/hero_slides','POST',{page:page.id,enabled:true,media_type:'video',video:file.id});
 assert.equal((await api(articlePath)).cover_image,file.id);
 const after=await api(pagePath);assert.equal(after.path,`/${prefix}/`);assert.equal(after.hero_interval,6000);checks++;
 console.log('PASS:',checks,'live guard checks; rejected writes preserved stored data.');
} finally {
 for(const [c,id]of created.reverse())await api(c==='files'?'/files/'+id:'/items/'+c+'/'+id,'DELETE');
 console.log('Temporary content and file removed.');
}

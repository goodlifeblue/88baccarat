import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateContent,decodeRow,registerContentValidation} from '../directus/hooks/redirects/content-validation.mjs';
const article={status:'published',title:'標題',slug:'valid-slug',category:'guide',excerpt:'摘要',content:'內文',published_at:'2026-09-22T00:00:00Z',faq:[]};
const page={status:'published',title:'頁面',path:'/example/',description:'摘要',page_type:'single_page',sections:[],faq:[]};
const bad=(c,row)=>assert.throws(()=>validateContent(c,row),e=>e.status===400&&e.name==='DirectusError'&&Boolean(e.extensions.field));
test('partial article drafts can be saved but cannot be published',()=>{
 for(const partial of [{}, {title:'寫到一半'}, {slug:'',category:'',excerpt:'',content:''}, {slug:null,faq:[{question:'待完成'}]}]) {
  validateContent('articles',{...partial,status:'draft'});
  bad('articles',{...partial,status:'published'});
 }
 for(const patch of [{slug:'bad slug'}, {category:'unknown'}, {cover_image:'javascript:alert(1)'}]) bad('articles',{status:'draft',...patch});
 for(const field of ['title','slug','category','excerpt','content','published_at']) bad('articles',{...article,[field]:null});
});
test('empty draft URLs are stored as null so multiple drafts can coexist',async()=>{
 const hooks={};
 registerContentValidation((name,fn)=>hooks[name]=fn,()=>{throw new Error('unexpected DB access');});
 const payload={status:'draft',slug:'',content:'未完成'};
 const saved=await hooks['articles.items.create'](payload,{},{});
 assert.equal(saved.slug,null);
 assert.equal(saved.content,payload.content);
 assert.equal(payload.slug,'');
});
test('publishing articles requires content, dates, route and complete FAQ',()=>{
 validateContent('articles',article);
 for(const patch of [{title:' '},{excerpt:''},{content:null},{slug:'bad slug'},{category:'unknown'},{published_at:null},{published_at:'bad'},{faq:[{question:'問題',answer:''}]},{relatedArticles:{}},{image:'javascript:alert(1)'},{title:[]},{featured:'yes'}])bad('articles',{...article,...patch});
 validateContent('articles',{status:'draft',title:'草稿',faq:[{question:'待寫'}]});
});
test('published article images need accessible alternative text and valid Directus asset IDs',()=>{
 validateContent('articles',{...article,content:'![牌桌](/assets/123e4567-e89b-12d3-a456-426614174000)'});
 for(const content of ['![](/assets/123e4567-e89b-12d3-a456-426614174000)','![牌桌](/assets/not-a-file)','![牌桌](/assets/)']) bad('articles',{...article,content});
 validateContent('articles',{...article,status:'draft',content:'![](/assets/not-a-file)'});
});
test('pages validate templates, reserved routes and enabled sections',()=>{
 validateContent('pages',page);
 for(const patch of [{path:'/admin/'},{path:'/guide/article/'},{path:'bad'},{description:''},{page_type:'unknown'},{page_type:'article_list',article_category:'unknown'},{page_type:'custom_page',custom_template:'unknown'},{hero_interval:0},{hero_interval:30001},{sections:{}},{sections:[null]},{sections:[{type:'cards',cards:{}}]},{sections:[{type:'articles',limit:101}]},{sections:[{type:'cta',link_label:'點我',link_href:''}]},{sections:[{type:'markdown',anchor:'same'},{type:'markdown',anchor:'same'}]}])bad('pages',{...page,...patch});
 validateContent('pages',{...page,sections:[{type:'unknown',enabled:false}]});
});
test('navigation and navbar require safe destinations',()=>{
 validateContent('navigation',{status:'published',label:'首頁',href:'/',link_type:'url'});
 bad('navigation',{status:'published',label:'首頁',href:'',link_type:'url'});
 bad('navigation',{status:'published',label:'頁面',link_type:'page',page:null});
 bad('navbar_settings',{brand_label:'品牌',brand_href:'//evil.test'});
});
test('enabled slides require matching media and complete buttons',()=>{
 const slide={page:'page-id',enabled:true,media_type:'image',image:'/image.png'};
 validateContent('hero_slides',slide);
 for(const patch of [{image:null},{media_type:'video'},{button_label:'點我'},{button_href:'javascript:alert(1)'}])bad('hero_slides',{...slide,...patch});
 validateContent('hero_slides',{page:'page-id',enabled:false,media_type:'image'});
});
test('site settings protect required assets and nested lists',()=>{
 const site=JSON.parse(readFileSync(new URL('../directus/seeds/site-settings.json',import.meta.url)));
 validateContent('site_settings',site);
 for(const patch of [{name:''},{og_image:null},{cta_href:''},{categories:null},{categories:[{...site.categories[0]},{...site.categories[0]}]},{footer_groups:[{title:'頁尾',links:[{label:'連結',href:''}]}]},{floating_buttons:[{enabled:true,label:'LINE',icon:'line',href:''}]}])bad('site_settings',{...site,...patch});
});
test('redirects reject unsafe routes, self loops and unsupported codes',()=>{
 validateContent('redirects',{old_path:'/old/',new_path:'/new/',status_code:301});
 for(const patch of [{new_path:'/old/'},{new_path:'https://example.com/'},{new_path:'/../other/'},{status_code:302}])bad('redirects',{old_path:'/old/',new_path:'/new/',status_code:301,...patch});
 bad('article_relations',{article_id:'a',related_id:'a'});
});
test('SQLite rows are decoded before validating',()=>{
 const row=decodeRow({enabled:1,hero_enabled:0,created_at:1790035200000,faq:'[{"question":"問題","answer":"答案"}]'});
 assert.equal(row.enabled,true);assert.equal(row.hero_enabled,false);assert.equal(row.faq[0].answer,'答案');
 assert.equal(typeof row.created_at,'string');assert.ok(Number.isFinite(Date.parse(row.created_at)));
});
test('all content collections register write and delete checks, including files',()=>{
 const hooks={};registerContentValidation((name,fn)=>hooks[name]=fn,()=>{throw new Error('unexpected DB read')});
 for(const c of ['articles','article_relations','pages','hero_slides','navigation','navbar_settings','site_settings','redirects'])for(const op of ['create','update','delete'])assert.equal(typeof hooks[`${c}.items.${op}`],'function');
 assert.equal(typeof hooks['files.delete'],'function');
});
test('homepage and global settings deletion are blocked before writing',async()=>{
 const hooks={};
 const db=()=>({whereIn:()=>({select:async()=>[{id:'home',path:'/'}]})});
 registerContentValidation((name,fn)=>hooks[name]=fn,db);
 for(const c of ['pages','site_settings','navbar_settings']) await assert.rejects(hooks[`${c}.items.delete`](['home'],{},{}),e=>e.status===400);
});
test('validation field types and defaults remain synchronized with schema',()=>{
 const schema=JSON.parse(readFileSync(new URL('../directus/schema.json',import.meta.url)));
 const rules=JSON.parse(readFileSync(new URL('../directus/hooks/redirects/field-rules.json',import.meta.url)));
 for(const f of schema.fields.filter(f=>f.type!=='alias')){
  assert.equal(rules[f.collection]?.[f.field]?.type,f.type,`${f.collection}.${f.field}`);
  if(Object.hasOwn(f.schema||{},'default_value'))assert.deepEqual(rules[f.collection][f.field].default,f.schema.default_value);
 }
});

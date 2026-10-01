import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHomepageBlocks} from '../src/lib/homepage-blocks.mjs';
import {validateContent} from '../directus/hooks/redirects/content-validation.mjs';
import cmsDevPages from './cms-dev-pages.mjs';
const settings={organization:'編輯部',default_cover:'/images/xx.png'};
const a={id:'a',slug:'first',category:'guide',status:'published',title:'First',excerpt:'First excerpt',published_at:'2026-01-01',faq:[]};
const b={...a,id:'b',slug:'second',title:'Second'};
const block={id:'block',title:'Selected',enabled:true,type:'articles',article_source:'manual'};
test('manual blocks preserve independent block and article order, excluding drafts and duplicates',()=>{
 const result=prepareHomepageBlocks([
  {...block,id:'hidden',enabled:false},
  {...block,id:'later',sort:2,articles:[{id:'1',article_id:a}]},
  {...block,sort:1,articles:[{id:'1',sort:2,article_id:a},{id:'2',sort:1,article_id:b},{id:'3',sort:3,article_id:a},{id:'4',article_id:{...a,id:'draft',status:'draft'}},{id:'5',article_id:null},{id:'6',article_id:{...a,id:'faq',category:'faq'}}]},
 ],[],settings);
 assert.deepEqual(result.map(x=>x.id),['block','later']);
 assert.deepEqual(result[0].selectedArticles.map(x=>x.id),['second','first']);
 assert.equal(result[0].selectedArticles[0].data.cmsId,'b');
});
test('empty manual blocks stay hidden and automatic blocks retain category and featured filters',()=>{
 assert.deepEqual(prepareHomepageBlocks([{...block,articles:[]}],[],settings),[]);
 const rows=prepareHomepageBlocks([{...block,article_source:'auto',category:'guide',featured:true,limit:1}], [{...a,featured:false},{...b,featured:true}],settings);
 assert.deepEqual(rows[0].selectedArticles.map(x=>x.id),['second']);
});
test('block validation covers title, source, sort, link and enabled contents',()=>{
 validateContent('homepage_blocks',{...block,articles:[]});
 for(const patch of [{title:''},{article_source:'bad'},{sort:-1},{sort:1.5},{anchor:'faq-title'},{link_label:'閱讀',link_href:'javascript:alert(1)'},{type:'cards',cards:[{title:'',content:''}]}])assert.throws(()=>validateContent('homepage_blocks',{...block,...patch}),e=>e.status===400);
});
test('enabled image carousel requires complete public-ready slides and a safe interval',()=>{
 const carousel={...block,type:'image_carousel',carousel_interval:5000,carousel_slides:[
  {image:'11111111-1111-4111-8111-111111111111',alt:'第一張示意圖',title:'第一張大標',description:'第一張說明'},
  {image:'22222222-2222-4222-8222-222222222222',alt:'第二張示意圖',title:'第二張大標',description:'第二張說明'},
 ]};
 validateContent('homepage_blocks',carousel);
 for(const patch of [{carousel_slides:carousel.carousel_slides.slice(0,1)},{carousel_interval:1000},{carousel_slides:[{...carousel.carousel_slides[0],alt:''},{...carousel.carousel_slides[1]}]},{carousel_slides:[{...carousel.carousel_slides[0],label:'閱讀'},{...carousel.carousel_slides[1]}]}])assert.throws(()=>validateContent('homepage_blocks',{...carousel,...patch}),e=>e.status===400);
});
test('live CMS articles use dynamic dev routes while builds remain static',()=>{
 for(const command of ['dev','build']){
  const integration=cmsDevPages({liveArticles:true});integration.hooks['astro:config:setup']({command});
  const route={component:'src/pages/guide/[slug].astro',prerender:true};integration.hooks['astro:route:setup']({route});
  assert.equal(route.prerender,command!=='dev');
 }
});

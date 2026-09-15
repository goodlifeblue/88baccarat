import assert from 'node:assert/strict';
import {resolveDirectusAsset as resolve, directusMarkdownImages} from '../src/lib/directus-assets.mjs';
const id = '12345678-1234-1234-1234-123456789abc';
for (const base of ['http://localhost:8055', 'https://cms.example.com', 'https://example.com/cms']) {
  for (const ref of [id, `/assets/${id}`, `assets/${id}`]) assert.equal(resolve(ref,base), `${base}/assets/${id}`);
  assert.equal(resolve(`/assets/${id}?width=800&access_token=secret`,base), `${base}/assets/${id}?width=800`);
  assert.equal(resolve(`http://localhost:8055/assets/${id}`,base,['http://localhost:8055']),`${base}/assets/${id}`);
  assert.equal(resolve('/images/xx.png',base),'/images/xx.png');
  assert.equal(resolve('https://other.example/assets/photo.jpg',base),'https://other.example/assets/photo.jpg');
  assert.throws(()=>resolve('/assets/../private',base));
  assert.throws(()=>resolve('javascript:alert(1)',base));
  const tree={children:[{type:'image',url:id},{type:'imageReference',identifier:'photo'},{type:'definition',identifier:'photo',url:`/assets/${id}`},{type:'code',value:`![example](/assets/${id})`}]};
  directusMarkdownImages({base})(tree);
  assert.equal(tree.children[0].url,`${base}/assets/${id}`);
  assert.equal(tree.children[2].url,`${base}/assets/${id}`);
  assert.equal(tree.children[3].value,`![example](/assets/${id})`);
}
console.log('PASS: local/remote/subpath asset URLs, Markdown references, legacy URLs, query parameters, and code preservation');

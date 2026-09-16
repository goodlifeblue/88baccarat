import assert from 'node:assert/strict';
import { compileRedirects } from '../directus/hooks/redirects/rules.mjs';
const rule = (old_path, new_path, extra = {}) => ({ old_path, new_path, enabled: true, status_code: 301, ...extra });
assert.deepEqual(compileRedirects([rule('/a/', '/b/'), rule('/b/', '/c/')]), [
 { old_path: '/a/', new_path: '/c/', status_code: 301 }, { old_path: '/b/', new_path: '/c/', status_code: 301 },
]);
assert.deepEqual(compileRedirects([rule('/a/', '/b/', { enabled: false })]), []);
for (const rows of [
 [rule('/a/', '/a/')], [rule('/a/', '/b/'), rule('/b/', '/a/')],
 [rule('/a/', '/b/'), rule('/a/', '/c/')], [rule('/a/\n/b/', '/c/')],
 [rule('/a/', '//external.example')], [rule('/a/', '/b/', { status_code: 302 })],
 [rule('/a/', '/x/../b/')], Array.from({length:2001},(_,i)=>rule(`/old-${i}/`,'/new/')),
]) assert.throws(() => compileRedirects(rows));
console.log('PASS: 301 validation, chain flattening, disabled rules, loops, duplicates, invalid paths, and rule limit');

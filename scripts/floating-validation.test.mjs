import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFloatingButtons, registerFloatingValidation } from '../directus/hooks/redirects/floating-validation.mjs';

const button = { enabled: true, label: 'LINE', icon: 'line', href: 'https://line.me/ti/p/example' };
test('enabled contact buttons require complete, safe links; disabled drafts can be saved', () => {
  for (const href of ['', ' ', null, 'javascript:alert(1)', '//evil.test', '/\\evil.test', 'http://example.com', 'https://user:pass@example.com', '/path\n']) {
    assert.throws(() => validateFloatingButtons([{ ...button, href }]), error => error.status === 400 && error.message.includes('第 1 個') && error.extensions.field === 'floating_buttons');
  }
  for (const patch of [{ label: '' }, { label: 42 }, { icon: 'unknown' }]) assert.throws(() => validateFloatingButtons([{ ...button, ...patch }]));
  assert.throws(() => validateFloatingButtons([null]));
  assert.throws(() => validateFloatingButtons({}));
  for (const href of ['/guide/', 'https://t.me/example', button.href]) validateFloatingButtons([{ ...button, href }]);
  validateFloatingButtons([{ enabled: false, href: '' }]);
});
test('hooks cover creation, replacement and enabling stored invalid buttons', async () => {
  const hooks = {};
  const db = () => ({ whereIn: () => ({ select: async () => [{ floating_buttons: JSON.stringify([{ ...button, href: '' }]) }] }) });
  registerFloatingValidation((name, callback) => hooks[name] = callback, db);
  assert.throws(() => hooks['site_settings.items.create']({ floating_buttons: [{ ...button, href: '' }] }));
  const update = hooks['site_settings.items.update'];
  await assert.rejects(update({ floating_enabled: true }, { keys: ['settings'] }, { database: db }));
  await assert.rejects(update({ floating_buttons: [{ ...button, href: '' }] }));
  const valid = { floating_enabled: true, floating_buttons: [button] };
  assert.equal(await update(valid), valid);
  const unrelated = { name: 'Updated site name' };
  assert.equal(await update(unrelated), unrelated);
  assert.deepEqual(await update({ floating_enabled: false }), { floating_enabled: false });
});

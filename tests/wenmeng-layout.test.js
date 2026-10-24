const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('应用外壳包含关系侧栏与提醒挂载点', () => {
  const html = read('public/index.html');
  const app = read('public/js/app.js');
  assert.match(html, /class="side-rail"/);
  assert.match(html, /id="sideTitle"/);
  assert.match(html, /id="sideDays"/);
  assert.match(html, /id="sideReminders"/);
  assert.match(app, /sideTitle/);
  assert.match(app, /sideReminders/);
});

test('偏好页使用画像摘要和可点击的双栏清单', () => {
  const source = read('public/js/views/preferences.js');
  assert.match(source, /class: 'pref-summary'/);
  assert.match(source, /class: 'pref-col-head'/);
  assert.match(source, /class: 'pref-row'/);
  assert.match(source, /class: 'pref-row-icon'/);
  assert.doesNotMatch(source, /class: 'pref-cat', text: '· '/);
});
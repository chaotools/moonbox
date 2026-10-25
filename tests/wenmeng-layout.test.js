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
test('今天首页接入路由并包含旧日与随机回忆', () => {
  const html = read('public/index.html');
  const app = read('public/js/app.js');
  const today = read('public/js/views/today.js');
  assert.match(html, /data-route="today"/);
  assert.match(app, /import \* as today/);
  assert.match(app, /const raw = location\.hash\.replace\('#\/', ''\) \|\| 'today'/);
  assert.match(today, /过去的今天/);
  assert.match(today, /随机翻到这一页/);
  assert.match(today, /最近的记忆/);
});

test('时间轴接入收藏、回收站和删除撤销', () => {
  const source = read('public/js/views/timeline.js');
  assert.match(source, /class: 'favorite-btn'/);
  assert.match(source, /filter\.favorite/);
  assert.match(source, /async function openTrash\(\)/);
  assert.match(source, /showUndo\('已移入回收站'/);
});

test('上传失败会自动重试并保留待上传文件', () => {
  const source = read('public/js/views/timeline.js');
  assert.match(source, /let retryCount = 0/);
  assert.match(source, /failUpload\('网络错误', true\)/);
  assert.match(source, /网络波动，正在自动重试/);
  assert.match(source, /重新上传 \$\{pending\.length\} 个文件/);
});

test('一级导航按记录、关系、计划、洞察分组', () => {
  const html = read('public/index.html');
  const app = read('public/js/app.js');
  assert.match(html, /data-nav-group="record"/);
  assert.match(html, /data-nav-group="relationship"/);
  assert.match(html, /data-nav-group="plan"/);
  assert.match(html, /data-nav-group="insight"/);
  assert.match(html, /class="nav-group-btn"/);
  assert.match(app, /function initNavMenus\(\)/);
  assert.match(app, /group\.classList\.toggle\('active'/);
});

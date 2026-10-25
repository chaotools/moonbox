// 今天：把关系状态、旧日回忆和最近记录放在同一个入口里
import { el, get, fmtDate, fmtDateTime, emptyState, mediaPreview, openLightbox, store } from '../core.js';
import { lunarDateText } from '../lunar.js';

let viewEl = null;
let memories = [];
let events = [];
let reminders = [];
let randomMemory = null;

export async function render(container) {
  viewEl = container;
  container.innerHTML = '';
  try {
    [memories, events, reminders] = await Promise.all([
      get('/api/memories'),
      get('/api/events'),
      get('/api/reminders?days=30').catch(() => ({ items: [] }))
    ]);
  } catch (e) {
    container.append(emptyState('🔒', '请先登录'));
    return;
  }
  build();
}

function build() {
  viewEl.innerHTML = '';
  const config = store.data.config || {};
  const now = new Date();
  const page = el('div', { class: 'page today-page' });
  const onThisDay = memories.filter((m) => isSameMonthDay(m.takenAt, now) && new Date(m.takenAt).getFullYear() < now.getFullYear());
  const recent = [...memories.map((m) => ({ kind: 'memory', date: m.takenAt, item: m })),
    ...events.map((e) => ({ kind: 'event', date: e.date, item: e }))]
    .filter((x) => x.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);
  if (!randomMemory) randomMemory = pickRandom(memories);

  page.append(el('div', { class: 'page-head' },
    el('div', null,
      el('div', { class: 'page-title', text: '今天' }),
      el('div', { class: 'page-desc', text: `${fmtDate(now.toISOString())} · ${lunarDateText(now)}` })),
    el('div', { class: 'today-actions' },
      el('button', { class: 'primary-btn', text: '＋ 记一笔', onclick: () => document.getElementById('quickNoteBtn')?.click() }),
      el('button', { class: 'ghost-btn', text: '查看时间轴', onclick: () => { location.hash = '#/timeline'; } }))));

  page.append(el('section', { class: 'today-hero' },
    el('div', null,
      el('div', { class: 'eyebrow', text: 'YOUR LITTLE ARCHIVE' }),
      el('h2', { text: config.title || '把普通的一天，也认真收好' }),
      el('p', { text: config.names || '今天也值得被记住。' })),
    el('div', { class: 'today-hero-count' },
      el('strong', { text: String(memories.length + events.length) }),
      el('span', { text: '条记忆' }))));

  const grid = el('div', { class: 'today-grid' });
  grid.append(onThisDayCard(onThisDay));
  grid.append(randomCard());
  page.append(grid);

  page.append(el('section', { class: 'today-section' },
    el('div', { class: 'today-section-head' }, el('h3', { text: '最近的记忆' }), el('button', { class: 'link-btn', text: '全部记忆 →', onclick: () => { location.hash = '#/timeline'; } })),
    recent.length ? el('div', { class: 'today-recent' }, ...recent.map(recentCard)) : emptyState('🌱', '还没有记录，先写下今天的第一个瞬间吧。')));

  page.append(el('section', { class: 'today-section' },
    el('div', { class: 'today-section-head' }, el('h3', { text: '接下来的日子' }), el('span', { class: 'today-muted', text: '未来 30 天' })),
    (reminders.items || []).length ? el('div', { class: 'today-reminders' }, ...(reminders.items || []).slice(0, 4).map(reminderRow)) : el('p', { class: 'today-muted', text: '暂时没有新的提醒，按自己的节奏生活。' })));

  viewEl.append(page);
}

function onThisDayCard(items) {
  const body = items.length
    ? el('div', { class: 'today-mini-list' }, ...items.slice(0, 3).map((m) => todayMemoryRow(m, false)))
    : el('p', { class: 'today-muted', text: '过去的今天还没有留下记录。' });
  return el('section', { class: 'today-card on-this-day' },
    el('div', { class: 'today-card-head' },
      el('div', null, el('div', { class: 'today-card-kicker', text: 'ON THIS DAY' }), el('h3', { text: '过去的今天' })),
      el('span', { class: 'today-count', text: items.length + ' 条' })),
    body);
}

function randomCard() {
  if (!randomMemory) {
    return el('section', { class: 'today-card random-card' },
      el('div', { class: 'today-card-kicker', text: 'RANDOM MEMORY' }),
      el('h3', { text: '还没有可以翻的旧记忆' }),
      el('p', { class: 'today-muted', text: '等你记下更多日子，这里会出现一张随机回忆。' }));
  }
  return el('section', { class: 'today-card random-card' },
    el('div', { class: 'today-card-head' },
      el('div', null, el('div', { class: 'today-card-kicker', text: 'RANDOM MEMORY' }), el('h3', { text: '随机翻到这一页' })),
      el('button', { class: 'link-btn', text: '换一条 ↻', onclick: () => { randomMemory = pickRandom(memories); build(); } })),
    todayMemoryRow(randomMemory, true));
}

function todayMemoryRow(m, highlight) {
  const index = memories.indexOf(m);
  return el('div', { class: 'today-memory' + (highlight ? ' highlight' : ''), onclick: () => openLightbox(memories, index) },
    el('div', { class: 'today-memory-thumb' }, mediaPreview(m, { className: 'today-thumb-img', alt: m.note || '' })),
    el('div', { class: 'today-memory-copy' },
      el('b', { text: m.note || '一张照片' }),
      el('span', { text: [fmtDateTime(m.takenAt), m.location].filter(Boolean).join(' · ') }),
      m.motionUrl ? el('em', { class: 'today-live', text: 'LIVE' }) : null));
}

function recentCard(entry) {
  if (entry.kind === 'event') {
    return el('div', { class: 'today-recent-item event' },
      el('span', { class: 'today-recent-icon', text: '✦' }),
      el('div', null, el('b', { text: entry.item.title || '一条记忆' }), el('small', { text: fmtDate(entry.date) })));
  }
  const m = entry.item;
  return el('div', { class: 'today-recent-item photo', onclick: () => openLightbox(memories, memories.indexOf(m)) },
    mediaPreview(m, { className: 'today-recent-thumb', alt: m.note || '' }),
    el('div', { class: 'today-recent-copy' }, el('b', { text: m.note || '一张照片' }), el('small', { text: fmtDate(entry.date) }), m.motionUrl ? el('em', { class: 'today-live', text: 'LIVE' }) : null));
}

function reminderRow(item) {
  const when = item.active ? '正在进行中' : item.inDays === 0 ? '就是今天' : `还有 ${item.inDays} 天`;
  return el('div', { class: 'today-reminder' },
    el('span', { class: 'today-reminder-icon', text: item.type === 'birthday' ? '🎂' : item.type === 'period' ? '🌸' : '♡' }),
    el('div', null, el('b', { text: item.title }), el('small', { text: when + (item.sub ? ' · ' + item.sub : '') })));
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function isSameMonthDay(value, date) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
}
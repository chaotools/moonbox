import { el, get, patch, fmtDate } from './core.js';

const $ = (id) => document.getElementById(id);
const state = { memories: [], filter: 'all', viewerIndex: 0, movieIndex: 0, movieTimer: null, moviePlaying: true };
const SLOTS = [
  { x: 0.02, y: 42, w: 0.21, ratio: 1.2, rot: -4 },
  { x: 0.25, y: 0, w: 0.14, ratio: 1.28, rot: 3.5 },
  { x: 0.43, y: 82, w: 0.17, ratio: 0.72, rot: -2.5 },
  { x: 0.66, y: 18, w: 0.17, ratio: 1.2, rot: 5 },
  { x: 0.05, y: 360, w: 0.14, ratio: 1.24, rot: 4 },
  { x: 0.22, y: 300, w: 0.23, ratio: 0.76, rot: -5 },
  { x: 0.53, y: 340, w: 0.14, ratio: 1.2, rot: 4 },
  { x: 0.69, y: 278, w: 0.19, ratio: 0.78, rot: -3 }
];

function showToast(message) {
  const box = $('wallToast');
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => box.classList.remove('show'), 1800);
}

async function load() {
  try {
    const [config, memories] = await Promise.all([get('/api/config'), get('/api/memories')]);
    state.memories = (memories || []).filter((m) => m && (m.url || m.thumb)).sort((a, b) => String(b.takenAt || '').localeCompare(String(a.takenAt || '')));
    renderRail(config || {});
    renderWall();
    $('wallPlay').disabled = !state.memories.length;
  } catch (error) {
    $('wallGate').hidden = false;
  }
}

function renderRail(config) {
  const names = config.names || '文梦 · 文文 · 2026';
  $('wallNames').textContent = names;
  const anniversary = config.anniversary ? new Date(config.anniversary + 'T00:00:00') : null;
  const days = anniversary ? Math.max(0, Math.floor((Date.now() - anniversary.getTime()) / 86400000)) : '--';
  const years = new Set(state.memories.map((m) => new Date(m.takenAt).getFullYear()).filter((y) => !Number.isNaN(y)));
  $('wallDays').textContent = days;
  $('wallCount').textContent = state.memories.length;
  $('wallYears').textContent = years.size || '--';
  $('filterAllCount').textContent = state.memories.length;
  $('wallFoot').textContent = `${state.memories.length} 个被认真收好的瞬间`;
  $('wallToolbar').textContent = `ALL MEMORIES · ${years.size ? [...years].sort((a, b) => b - a).join(' / ') : new Date().getFullYear()}`;
}

function renderWall() {
  const canvas = $('wallCanvas');
  const viewport = $('wallViewport');
  canvas.innerHTML = '';
  if (!state.memories.length) {
    canvas.append(el('div', { class: 'wall-empty' }, '照片墙还空着。', el('br'), el('a', { href: '/#/timeline', text: '去时间轴添加第一张照片 →' })));
    return;
  }
  const wallWidth = Math.max(720, viewport.clientWidth || 1000);
  let maxBottom = 0;
  state.memories.forEach((m, index) => {
    const slot = SLOTS[index % SLOTS.length];
    const row = Math.floor(index / SLOTS.length);
    const width = Math.max(140, Math.min(280, Math.round(wallWidth * slot.w)));
    const height = Math.round(width * slot.ratio);
    const top = slot.y + row * 650;
    const card = el('article', { class: 'wall-card', title: '点击查看原图' });
    card.style.left = `${slot.x * 100}%`;
    card.style.top = `${top}px`;
    card.style.width = `${width}px`;
    card.style.setProperty('--h', `${height}px`);
    card.style.setProperty('--rot', `${slot.rot}deg`);
    card.dataset.index = String(index);
    card.dataset.depth = String((index % 4) + 1);
    const tags = [];
    if (m.favorite) tags.push('favorite');
    if (m.motionUrl) tags.push('live');
    if (new Date(m.takenAt).getFullYear() === new Date().getFullYear()) tags.push('year');
    card.dataset.tags = tags.join(' ');
    card.append(el('img', { src: m.thumb || m.url, alt: m.note || '一张照片', loading: 'lazy' }));
    if (m.motionUrl) card.append(el('span', { class: 'wall-live-badge', text: 'LIVE' }));
    card.append(el('div', { class: 'wall-card-caption' }, m.note || '一张照片', el('span', { text: fmtDate(m.takenAt) })));
    card.addEventListener('click', () => openViewer(index));
    canvas.append(card);
    maxBottom = Math.max(maxBottom, top + height + 70);
  });
  canvas.style.height = `${Math.max(viewport.clientHeight, maxBottom + 50)}px`;
  applyFilter();
}

function applyFilter() {
  document.querySelectorAll('.wall-card').forEach((card) => {
    const tags = (card.dataset.tags || '').split(' ');
    card.classList.toggle('hidden', state.filter !== 'all' && !tags.includes(state.filter));
  });
}

function openViewer(index) {
  state.viewerIndex = (index + state.memories.length) % state.memories.length;
  renderViewer();
  $('wallViewer').hidden = false;
}

function renderViewer() {
  const m = state.memories[state.viewerIndex];
  if (!m) return;
  const media = $('viewerMedia');
  media.innerHTML = '';
  if (m.type === 'video' || m.motionUrl) {
    media.append(el('video', { src: m.motionUrl || m.url, controls: true, autoplay: true, playsinline: true }));
  } else {
    media.append(el('img', { src: m.url || m.thumb, alt: m.note || '一张照片' }));
  }
  $('viewerCount').textContent = `${String(state.viewerIndex + 1).padStart(2, '0')} / ${String(state.memories.length).padStart(2, '0')}`;
  $('viewerTitle').textContent = m.note || '一张照片';
  $('viewerMeta').textContent = [fmtDate(m.takenAt), m.location].filter(Boolean).join(' · ');
  $('viewerFav').textContent = m.favorite ? '♥ 已收藏' : '♡ 收藏这个瞬间';
}

function closeViewer() {
  $('wallViewer').hidden = true;
  $('viewerMedia').innerHTML = '';
}

function stepViewer(delta) {
  state.viewerIndex = (state.viewerIndex + delta + state.memories.length) % state.memories.length;
  renderViewer();
}

async function toggleFavorite() {
  const m = state.memories[state.viewerIndex];
  if (!m) return;
  try {
    const updated = await patch('/api/memories/' + m.id, { favorite: !m.favorite });
    Object.assign(m, updated);
    renderViewer();
    renderWall();
    showToast(m.favorite ? '已收藏' : '已取消收藏');
  } catch (e) { showToast('收藏失败，请稍后再试'); }
}

function movieMedia(m) {
  if (m.type === 'video' || m.motionUrl) return el('video', { src: m.motionUrl || m.url, muted: true, autoplay: true, playsinline: true, loop: true });
  return el('img', { src: m.url || m.thumb, alt: m.note || '一张照片' });
}

function renderMovie() {
  const m = state.memories[state.movieIndex];
  if (!m) return;
  const media = $('movieMedia');
  media.innerHTML = '';
  media.append(movieMedia(m));
  $('movieDate').textContent = fmtDate(m.takenAt);
  $('movieTitle').textContent = m.note || '一张照片';
  $('movieNote').textContent = [m.location, m.favorite ? '收藏的瞬间' : ''].filter(Boolean).join(' · ') || '把普通的日子，认真收好。';
  $('movieCounter').textContent = `${String(state.movieIndex + 1).padStart(2, '0')} / ${String(state.memories.length).padStart(2, '0')}`;
  $('movieProgress').innerHTML = state.memories.map((_, i) => `<i class="${i <= state.movieIndex ? 'done' : ''}"></i>`).join('');
}

function openMovie() {
  if (!state.memories.length) return showToast('还没有照片可以播放');
  state.movieIndex = 0;
  state.moviePlaying = true;
  $('movieToggle').textContent = '暂停';
  $('wallMovie').hidden = false;
  renderMovie();
  clearInterval(state.movieTimer);
  state.movieTimer = setInterval(nextMovie, 4500);
}

function closeMovie() {
  $('wallMovie').hidden = true;
  $('movieMedia').innerHTML = '';
  clearInterval(state.movieTimer);
  state.movieTimer = null;
}

function nextMovie() {
  state.movieIndex = (state.movieIndex + 1) % state.memories.length;
  renderMovie();
}

function toggleMovie() {
  state.moviePlaying = !state.moviePlaying;
  $('movieToggle').textContent = state.moviePlaying ? '暂停' : '播放';
  if (state.moviePlaying) state.movieTimer = setInterval(nextMovie, 4500);
  else { clearInterval(state.movieTimer); state.movieTimer = null; }
}

function bind() {
  $('viewerClose').addEventListener('click', closeViewer);
  $('viewerPrev').addEventListener('click', () => stepViewer(-1));
  $('viewerNext').addEventListener('click', () => stepViewer(1));
  $('viewerFav').addEventListener('click', toggleFavorite);
  $('wallPlay').addEventListener('click', openMovie);
  $('movieClose').addEventListener('click', closeMovie);
  $('movieToggle').addEventListener('click', toggleMovie);
  $('movieNext').addEventListener('click', nextMovie);
  document.querySelectorAll('.wall-filter').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.wall-filter').forEach((b) => b.classList.toggle('active', b === button));
    state.filter = button.dataset.filter;
    applyFilter();
  }));
  $('wallStage').addEventListener('mousemove', (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    document.querySelectorAll('.wall-card').forEach((card) => {
      const depth = Number(card.dataset.depth || 1);
      card.style.setProperty('--px', `${(x * depth * 8).toFixed(2)}px`);
      card.style.setProperty('--py', `${(y * depth * 6).toFixed(2)}px`);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeViewer(); closeMovie(); }
    if (!$('wallViewer').hidden) {
      if (event.key === 'ArrowLeft') stepViewer(-1);
      if (event.key === 'ArrowRight') stepViewer(1);
    }
  });
  window.addEventListener('resize', () => { if (state.memories.length) renderWall(); });
}

bind();
load().then(() => {
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'movie') openMovie();
  if (mode === 'viewer') openViewer(0);
});
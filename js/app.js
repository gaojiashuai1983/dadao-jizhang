/* 应用入口：初始化数据、绑定交互、注册 Service Worker */
import { initCategories } from './db.js';
import { seedIfNeeded } from './seed.js';
import { $, $$ } from './util.js';
import { loadCategories, watchSheetClose } from './ui.js';
import { renderHome, bindHome } from './home.js';
import { openAddSheet, bindAdd } from './add.js';
import { renderReports, resizeReports, bindReports } from './reports.js';
import { renderMine, bindMine } from './mine.js';

async function switchTab(name) {
  $$('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));

  if (name === 'reports') {
    await renderReports();
    requestAnimationFrame(() => resizeReports());
  } else if (name === 'mine') {
    renderMine();
  }
}

function bindTabs() {
  $$('#tabbar .tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  $('#fab').addEventListener('click', () => openAddSheet(true));
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 离线能力注册失败不影响使用 */ });
  });
}

async function boot() {
  try {
    await initCategories();
    await loadCategories();
    await seedIfNeeded();
  } catch (e) {
    console.error('[大道记账] 数据初始化失败', e);
  }

  watchSheetClose();
  bindTabs();
  bindHome();
  bindAdd();
  bindReports();
  bindMine();

  // 关键：先激活「明细」视图，否则首次加载时所有 .view 都是 display:none，页面会整片空白
  await switchTab('home');
  await renderHome();
  renderMine();

  window.addEventListener('resize', () => {
    if ($('#view-reports').classList.contains('active')) resizeReports();
  });

  registerSW();
}

boot();

/* 界面公共逻辑：类目缓存、弹层、确认框、期间选择 */
import * as db from './db.js';
import { $, $$, escapeHtml, currentYm, pad2 } from './util.js';

export const state = {
  categories: [],
  catMap: new Map()
};

export async function loadCategories() {
  state.categories = await db.listCategories();
  state.catMap = new Map(state.categories.map((c) => [c.id, c]));
  return state.categories;
}

export function catOf(id) {
  return state.catMap.get(id) || { id, name: '未分类', icon: '❓', type: 'expense' };
}

export function catsOfType(type) {
  return state.categories
    .filter((c) => c.type === type)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/* ---------------- 弹层 ---------------- */

let currentSheet = null;
let closeCb = null;

export function openSheet(id, onClose) {
  closeSheet();
  const el = document.getElementById(id);
  if (!el) return;
  $('#overlay').hidden = false;
  el.hidden = false;
  el.scrollTop = 0;
  currentSheet = el;
  closeCb = onClose || null;
}

export function closeSheet() {
  if (currentSheet) {
    currentSheet.hidden = true;
    currentSheet = null;
  }
  const cb = closeCb;
  closeCb = null;
  const overlay = $('#overlay');
  if (overlay) overlay.hidden = true;
  if (cb) cb();
}

export function watchSheetClose() {
  const overlay = $('#overlay');
  if (overlay) overlay.onclick = () => closeSheet();
}

/** 注册「弹层被关闭」回调（由弹层内部用于解析 Promise） */
export function setSheetCloseHandler(cb) {
  closeCb = cb;
}

/* ---------------- 确认对话框 ---------------- */

export function confirmDialog({ title = '提示', text = '', okText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = $('#dialog');
    $('#dialogTitle').textContent = title;
    $('#dialogText').innerHTML = text;
    const ok = $('#dialogOk');
    const cancel = $('#dialogCancel');
    ok.textContent = okText;
    ok.className = danger ? 'd-btn danger' : 'd-btn primary';
    dlg.hidden = false;

    const done = (val) => {
      dlg.hidden = true;
      ok.onclick = null;
      cancel.onclick = null;
      dlg.onclick = null;
      resolve(val);
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    dlg.onclick = (e) => { if (e.target === dlg) done(false); };
  });
}

/* ---------------- 类目网格 ---------------- */

export function renderCatGrid(container, cats, selectedId, onPick) {
  container.innerHTML = cats.map((c) => `
    <button class="cat-cell${c.id === selectedId ? ' active' : ''}" data-id="${escapeHtml(c.id)}" type="button">
      <span class="ico">${escapeHtml(c.icon)}</span>
      <span class="lbl">${escapeHtml(c.name)}</span>
    </button>`).join('');
  container.onclick = (e) => {
    const btn = e.target.closest('.cat-cell');
    if (!btn) return;
    const cat = cats.find((c) => c.id === btn.dataset.id);
    if (cat) onPick(cat);
  };
}

/* ---------------- 期间选择（月 / 年） ---------------- */

export function pickPeriod({ mode = 'month', value, title = '选择时间' } = {}) {
  return new Promise((resolve) => {
    const sheet = $('#sheetPeriod');
    const stepper = sheet.querySelector('.year-stepper');
    const grid = $('#periodGrid');
    const yearEl = $('#periodYear');
    const nowYear = Number(currentYm().slice(0, 4));
    let year = Number(String(value || '').slice(0, 4)) || nowYear;

    $('#periodTitle').textContent = title;

    const render = () => {
      yearEl.textContent = year;
      if (mode === 'month') {
        stepper.hidden = false;
        grid.innerHTML = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const ym = `${year}-${pad2(m)}`;
          return `<button class="month-cell${ym === value ? ' active' : ''}" data-ym="${ym}" type="button">${m}月</button>`;
        }).join('');
      } else {
        stepper.hidden = true;
        let html = '';
        for (let y = nowYear + 1; y >= nowYear - 6; y--) {
          html += `<button class="month-cell${String(y) === String(value) ? ' active' : ''}" data-y="${y}" type="button">${y}年</button>`;
        }
        grid.innerHTML = html;
      }
    };
    render();

    const finish = (val) => {
      closeCb = null;
      closeSheet();
      grid.removeEventListener('click', onClick);
      $('#periodPrev').removeEventListener('click', onPrev);
      $('#periodNext').removeEventListener('click', onNext);
      $('#periodClose').removeEventListener('click', onCancel);
      resolve(val);
    };
    const onClick = (e) => {
      const cell = e.target.closest('.month-cell');
      if (!cell) return;
      finish(mode === 'month' ? cell.dataset.ym : cell.dataset.y);
    };
    const onPrev = () => { year--; render(); };
    const onNext = () => { year++; render(); };
    const onCancel = () => finish(null);

    grid.addEventListener('click', onClick);
    $('#periodPrev').addEventListener('click', onPrev);
    $('#periodNext').addEventListener('click', onNext);
    $('#periodClose').addEventListener('click', onCancel);

    closeCb = onCancel;
    $('#overlay').hidden = false;
    sheet.hidden = false;
    sheet.scrollTop = 0;
    currentSheet = sheet;
  });
}

/* 我的页：类目管理、按年月导出 Excel、清空数据 */
import * as db from './db.js';
import { $, $$, escapeHtml, toast, ymLabel, currentYm } from './util.js';
import {
  state, loadCategories, catsOfType, openSheet, closeSheet,
  setSheetCloseHandler, confirmDialog, pickPeriod
} from './ui.js';
import { ICON_CHOICES } from './categories.js';
import { seedIfNeeded, SEED_COUNT } from './seed.js';
import { exportExcel } from './export.js';
import { renderHome } from './home.js';

let catListType = 'expense';
let exportMode = 'month';
let exportPeriod = currentYm();
let editState = null;
let editFinish = null;

/* ---------------- 类目管理列表 ---------------- */

function renderCatList() {
  $$('#catListTypeSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === catListType);
  });
  const cats = catsOfType(catListType);
  const rows = $('#catListRows');
  rows.innerHTML = cats.map((c) => `
    <div class="cat-manage-row" data-id="${escapeHtml(c.id)}">
      <div class="cat-chip">${escapeHtml(c.icon)}</div>
      <div class="cm-name">${escapeHtml(c.name)}</div>
      ${c.builtin ? '<span class="cm-tag">内置</span>' : '<span class="cm-tag">自定义</span>'}
    </div>`).join('');
}

/* ---------------- 类目编辑 ---------------- */

function renderEditTypeSeg() {
  $$('#catEditTypeSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === editState.type);
  });
}

function renderEmojiGrid() {
  const grid = $('#emojiGrid');
  grid.innerHTML = ICON_CHOICES.map((ic) =>
    `<button class="emoji-cell${ic === editState.icon ? ' active' : ''}" data-ic="${escapeHtml(ic)}" type="button">${ic}</button>`
  ).join('');
}

async function saveCategoryEditor() {
  const name = $('#catEditName').value.trim();
  if (!name) { toast('请输入类目名称'); return; }
  const dup = state.categories.find(
    (c) => c.type === editState.type && c.name === name && c.id !== editState.id
  );
  if (dup) { toast('该类型下已有同名类目'); return; }

  const payload = {
    type: editState.type,
    name,
    icon: editState.icon,
    builtin: editState.builtin,
    order: editState.order
  };
  if (editState.id) payload.id = editState.id;
  if (payload.order == null) payload.order = await db.nextCategoryOrder(editState.type);

  const saved = await db.saveCategory(payload);
  await loadCategories();
  toast(editState.id ? '已保存' : '已添加类目');
  if (editFinish) editFinish(saved);
}

async function deleteCategoryEditor() {
  const cat = state.catMap.get(editState.id);
  if (!cat) { if (editFinish) editFinish(null); return; }
  const used = await db.countRecordsOfCategory(cat.id);
  const siblings = state.categories.filter((c) => c.type === cat.type && c.id !== cat.id);
  if (!siblings.length) { toast('至少保留一个类目'); return; }
  const fallback = siblings.find((c) => c.name === '其他') || siblings[0];

  const ok = await confirmDialog({
    title: '删除类目？',
    text: used > 0
      ? `「${escapeHtml(cat.name)}」下有 ${used} 条账单，删除后这些账单将归入「${escapeHtml(fallback.name)}」。`
      : `确定删除「${escapeHtml(cat.name)}」？`,
    okText: '删除',
    danger: true
  });
  if (!ok) return;

  if (used > 0) await db.reassignCategory(cat.id, fallback.id);
  await db.deleteCategory(cat.id);
  await loadCategories();
  toast('已删除类目');
  if (editFinish) editFinish(null);
}

export function openCategoryEditor({ cat = null, type = 'expense', onClose } = {}) {
  return new Promise((resolve) => {
    editState = {
      id: cat ? cat.id : null,
      type: cat ? cat.type : type,
      icon: cat ? cat.icon : ICON_CHOICES[0],
      builtin: cat ? !!cat.builtin : false,
      order: cat ? (cat.order ?? 0) : null
    };

    $('#catEditTitle').textContent = cat ? '编辑类目' : '添加类目';
    $('#catEditName').value = cat ? cat.name : '';
    $('#catEditDelete').hidden = !cat;
    renderEditTypeSeg();
    renderEmojiGrid();

    editFinish = (val) => {
      setSheetCloseHandler(null);
      editFinish = null;
      editState = null;
      closeSheet();
      if (onClose) onClose(val);
      resolve(val);
    };

    openSheet('sheetCatEdit');
    setSheetCloseHandler(() => { const f = editFinish; if (f) f(null); });
  });
}

/* ---------------- 导出面板 ---------------- */

async function renderExportSheet() {
  $$('#exportRangeSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.range === exportMode);
  });
  $('#exportPeriodLabel').textContent = exportMode === 'month'
    ? ymLabel(exportPeriod)
    : `${exportPeriod}年`;
  $('#exportHint').textContent = '正在统计…';
  const list = exportMode === 'month'
    ? await db.recordsByMonth(exportPeriod)
    : await db.recordsByYear(exportPeriod);
  $('#exportHint').textContent = list.length
    ? `将导出 ${list.length} 条记录，包含「账单明细」与「分类汇总」两个工作表。`
    : '该时间段暂无数据，换个时间段试试。';
}

/* ---------------- 我的页 ---------------- */

export async function renderMine() {
  const ec = state.categories.filter((c) => c.type === 'expense').length;
  const ic = state.categories.filter((c) => c.type === 'income').length;
  $('#cellCatDesc').textContent = `支出 ${ec} · 收入 ${ic}`;

  const seeded = await db.getMeta('seeded_oct2026');
  $('#cellSeedDesc').textContent = seeded ? '已导入' : `共 ${SEED_COUNT} 笔`;
}

export function bindMine() {
  $('#cellCategories').addEventListener('click', () => {
    catListType = 'expense';
    renderCatList();
    openSheet('sheetCatList');
  });
  $('#catListClose').addEventListener('click', () => closeSheet());
  $('#catListTypeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || b.dataset.type === catListType) return;
    catListType = b.dataset.type;
    renderCatList();
  });
  $('#catListRows').addEventListener('click', (e) => {
    const row = e.target.closest('.cat-manage-row');
    if (!row) return;
    const cat = state.catMap.get(row.dataset.id);
    if (!cat) return;
    openCategoryEditor({ cat }).then(() => {
      renderCatList();
      renderMine();
      openSheet('sheetCatList');
    });
  });
  $('#catListAdd').addEventListener('click', () => {
    openCategoryEditor({ type: catListType }).then(() => {
      renderCatList();
      renderMine();
      openSheet('sheetCatList');
    });
  });

  $('#catEditClose').addEventListener('click', () => closeSheet());
  $('#catEditTypeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || !editState || b.dataset.type === editState.type) return;
    editState.type = b.dataset.type;
    renderEditTypeSeg();
  });
  $('#emojiGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.emoji-cell');
    if (!b || !editState) return;
    editState.icon = b.dataset.ic;
    renderEmojiGrid();
  });
  $('#catEditSave').addEventListener('click', saveCategoryEditor);
  $('#catEditDelete').addEventListener('click', deleteCategoryEditor);

  $('#cellExport').addEventListener('click', () => {
    exportMode = 'month';
    exportPeriod = currentYm();
    renderExportSheet();
    openSheet('sheetExport');
  });
  $('#exportClose').addEventListener('click', () => closeSheet());
  $('#exportRangeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || b.dataset.range === exportMode) return;
    exportMode = b.dataset.range;
    exportPeriod = exportMode === 'month' ? currentYm() : String(new Date().getFullYear());
    renderExportSheet();
  });
  $('#exportPeriodBtn').addEventListener('click', async () => {
    const v = await pickPeriod({
      mode: exportMode,
      value: exportPeriod,
      title: exportMode === 'month' ? '选择导出月份' : '选择导出年份'
    });
    if (v) {
      exportPeriod = v;
      renderExportSheet();
    }
  });
  $('#exportDo').addEventListener('click', () => {
    exportExcel({ mode: exportMode, period: exportPeriod });
  });

  $('#cellSeed').addEventListener('click', async () => {
    const list = await db.allRecords();
    if (list.length) {
      const ok = await confirmDialog({
        title: '导入 10 月账单明细？',
        text: `当前已有 ${list.length} 笔账单，导入前需要先清空，清空后无法恢复。`,
        okText: '清空并导入',
        danger: true
      });
      if (!ok) return;
      await db.clearRecords();
    }
    const r = await seedIfNeeded(true);
    await loadCategories();
    toast(r.imported ? `已导入 ${r.imported} 笔账单` : '没有可导入的数据');
    renderHome();
    renderMine();
  });

  $('#cellClear').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '清空全部账单？',
      text: '所有记账记录将被永久删除，且无法恢复。',
      okText: '清空',
      danger: true
    });
    if (!ok) return;
    await db.clearRecords();
    toast('已清空全部账单');
    renderHome();
  });
}

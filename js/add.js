/* 记账弹层：快速添加消费 / 收入 */
import * as db from './db.js';
import { $, $$, todayStr, round2, toast, escapeHtml } from './util.js';
import { catsOfType, openSheet, closeSheet, renderCatGrid } from './ui.js';
import { openCategoryEditor } from './mine.js';
import { renderHome, focusDate } from './home.js';

const addState = { type: 'expense', categoryId: null, editingId: null };

function syncMode() {
  const editing = !!addState.editingId;
  $('#addMode').textContent = editing ? '编辑记录' : '记一笔';
  $('#addSave').textContent = editing ? '保存修改' : '保存';
}

function syncType() {
  $$('#addTypeSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === addState.type);
  });
  const cats = catsOfType(addState.type);
  if (!addState.categoryId || !cats.some((c) => c.id === addState.categoryId)) {
    addState.categoryId = cats[0] ? cats[0].id : null;
  }
  renderCatGrid($('#addCatGrid'), cats, addState.categoryId, (cat) => {
    addState.categoryId = cat.id;
    syncType();
  });
}

export function openAddSheet(reset = true) {
  if (reset) {
    addState.type = 'expense';
    addState.categoryId = null;
    addState.editingId = null;
    $('#addAmount').value = '';
    $('#addDate').value = todayStr();
    $('#addNote').value = '';
  }
  syncMode();
  syncType();
  openSheet('sheetAdd');
  if (reset) setTimeout(() => $('#addAmount').focus(), 280);
}

/** 打开弹层用于修改一条已有记录（金额、类目、日期、备注都可改） */
export function openEditSheet(rec) {
  addState.type = rec.type;
  addState.categoryId = rec.categoryId;
  addState.editingId = rec.id;
  $('#addAmount').value = String(rec.amount);
  $('#addDate').value = rec.date;
  $('#addNote').value = rec.note || '';
  syncMode();
  syncType();
  openSheet('sheetAdd');
  setTimeout(() => $('#addAmount').focus(), 280);
}

async function save() {
  const amount = round2(String($('#addAmount').value).replace(/[^\d.]/g, ''));
  if (!(amount > 0)) {
    toast('请输入金额');
    $('#addAmount').focus();
    return;
  }
  if (!addState.categoryId) {
    toast('请选择类目');
    return;
  }
  const date = $('#addDate').value || todayStr();
  const note = $('#addNote').value.trim();

  if (addState.editingId) {
    await db.updateRecord(addState.editingId, {
      type: addState.type,
      amount,
      categoryId: addState.categoryId,
      date,
      note
    });
    closeSheet();
    focusDate(date);
    toast('已保存修改');
  } else {
    await db.addRecord({
      type: addState.type,
      amount,
      categoryId: addState.categoryId,
      date,
      note
    });
    closeSheet();
    focusDate(date);
    toast(`已记一笔 ${addState.type === 'income' ? '收入' : '支出'}`);
  }
  renderHome();
}

export function bindAdd() {
  $('#addClose').addEventListener('click', () => closeSheet());
  $('#addSave').addEventListener('click', save);

  $('#addTypeSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || btn.dataset.type === addState.type) return;
    addState.type = btn.dataset.type;
    addState.categoryId = null;
    syncType();
  });

  $('#addAmount').addEventListener('input', (e) => {
    let v = String(e.target.value).replace(/[^\d.]/g, '');
    const parts = v.split('.');
    if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join('')}`;
    if (v.includes('.')) {
      const [i, d] = v.split('.');
      v = `${i}.${d.slice(0, 2)}`;
    }
    if (v.length > 10) v = v.slice(0, 10);
    e.target.value = v;
  });

  $('#addAmount').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
  });

  $('#addCatManage').addEventListener('click', () => {
    openCategoryEditor({
      type: addState.type,
      onClose: (cat) => {
        if (cat) addState.categoryId = cat.id;
        openAddSheet(false);
      }
    });
  });

  $('#swapClose').addEventListener('click', () => closeSheet());
}

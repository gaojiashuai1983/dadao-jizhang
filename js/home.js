/* 明细页：月 / 年两种浏览模式 + 首页概览 banner + 行内修改与长按菜单 */
import * as db from './db.js';
import {
  $, $$, fmtMoney, fmtAmount, ymLabel, dayLabel, currentYm,
  escapeHtml, round2, toast, pad2
} from './util.js';
import {
  catOf, catsOfType, openSheet, closeSheet, pickPeriod, confirmDialog, renderCatGrid
} from './ui.js';
import { openEditSheet, openAddSheet } from './add.js';

let range = 'month';           // 'month' | 'year'
let curYm = currentYm();       // 'YYYY-MM'
let curYear = currentYm().slice(0, 4);
let records = [];              // 当前视图内的记录
let actionTarget = null;       // 长按选中的记录
let suppressClickUntil = 0;    // 长按后抑制紧随其后的 click

export function getCurYm() {
  return curYm;
}

export function setCurYm(ym) {
  curYm = ym;
}

/** 让某个日期进入视野（新增 / 编辑保存后调用） */
export function focusDate(dateStr) {
  const ym = String(dateStr).slice(0, 7);
  const yr = String(dateStr).slice(0, 4);
  if (range === 'year' && yr === curYear) return;
  range = 'month';
  curYm = ym;
}

/* ---------------- 汇总 ---------------- */

function sumOf(list) {
  let income = 0;
  let expense = 0;
  list.forEach((r) => {
    if (r.type === 'income') income += r.amount;
    else expense += r.amount;
  });
  return {
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    count: list.length
  };
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function prevYmOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/* ---------------- 概览 banner ---------------- */

function monthBanner(s, prev) {
  const icon = $('#hbIcon');
  const title = $('#hbTitle');
  const sub = $('#hbSub');

  if (!s.count) {
    icon.textContent = '🌱';
    title.textContent = `${ymLabel(curYm)}还没有记账`;
    sub.textContent = prev.count
      ? `上月支出 ¥${fmtMoney(prev.expense)}，本月还没开始记`
      : '点击右侧按钮，记下第一笔';
    return;
  }

  icon.textContent = s.balance >= 0 ? '📈' : '📉';
  title.textContent = `本月支出 ¥${fmtMoney(s.expense)}`;

  if (prev.count) {
    const diff = round2(s.expense - prev.expense);
    if (diff === 0) {
      sub.textContent = `与上月持平 · 共 ${s.count} 笔`;
    } else {
      const up = diff > 0;
      const pct = prev.expense > 0 ? Math.round(Math.abs(diff) / prev.expense * 1000) / 10 : null;
      // 上月基数过小（或涨幅极端）时，百分比没有参考意义，只报金额差
      const pctText = pct !== null && pct <= 999 ? ` ${up ? '↑' : '↓'}${pct}%` : '';
      sub.textContent = `比上月${up ? '多花' : '少花'} ¥${fmtMoney(Math.abs(diff))}${pctText} · 共 ${s.count} 笔`;
    }
  } else {
    sub.textContent = `共 ${s.count} 笔 · 日均 ¥${fmtMoney(round2(s.expense / daysInMonth(curYm)))}`;
  }
}

function yearBanner(s, prev) {
  const icon = $('#hbIcon');
  const title = $('#hbTitle');
  const sub = $('#hbSub');

  if (!s.count) {
    icon.textContent = '🌱';
    title.textContent = `${curYear}年还没有记账`;
    sub.textContent = prev.count ? `去年支出 ¥${fmtMoney(prev.expense)}` : '切换月份开始记录你的收支';
    return;
  }

  const months = new Set(records.map((r) => r.date.slice(0, 7))).size;
  icon.textContent = s.balance >= 0 ? '📈' : '📉';
  title.textContent = `本年支出 ¥${fmtMoney(s.expense)}`;

  if (prev.count) {
    const diff = round2(s.expense - prev.expense);
    if (diff === 0) {
      sub.textContent = `与去年持平 · 共 ${s.count} 笔`;
    } else {
      const up = diff > 0;
      sub.textContent = `比去年${up ? '多花' : '少花'} ¥${fmtMoney(Math.abs(diff))} ${up ? '↑' : '↓'} · 共 ${s.count} 笔`;
    }
  } else {
    sub.textContent = `共 ${s.count} 笔 · 覆盖 ${months} 个月`;
  }
}

/* ---------------- 列表渲染 ---------------- */

function emptyHtml(msg) {
  return `
    <div class="empty">
      <div class="empty-emoji">🧾</div>
      <p>${escapeHtml(msg)}</p>
      <p style="margin-top:6px;font-size:12.5px">点击右下角 ＋ 记一笔</p>
    </div>`;
}

function renderMonthList() {
  const wrap = $('#recordList');

  if (!records.length) {
    wrap.innerHTML = emptyHtml(`${ymLabel(curYm)}没有记账记录`);
    return;
  }

  const groups = [];
  const groupMap = new Map();
  records.forEach((r) => {
    if (!groupMap.has(r.date)) {
      const g = { date: r.date, items: [], income: 0, expense: 0 };
      groupMap.set(r.date, g);
      groups.push(g);
    }
    const g = groupMap.get(r.date);
    g.items.push(r);
    if (r.type === 'income') g.income += r.amount;
    else g.expense += r.amount;
  });

  wrap.innerHTML = groups.map((g) => {
    const sums = [];
    if (g.expense > 0) sums.push(`支出 ${fmtAmount(g.expense)}`);
    if (g.income > 0) sums.push(`收入 ${fmtAmount(g.income)}`);
    const rows = g.items.map((r) => {
      const cat = catOf(r.categoryId);
      const isIncome = r.type === 'income';
      return `
        <div class="row" data-id="${r.id}">
          <div class="cat-chip">${escapeHtml(cat.icon)}</div>
          <div class="row-main">
            <div class="row-name tappable" data-act="cat">${escapeHtml(cat.name)}</div>
            ${r.note ? `<div class="row-note">${escapeHtml(r.note)}</div>` : ''}
          </div>
          <div class="row-amt${isIncome ? ' income' : ''}" data-act="amt">${isIncome ? '+' : '-'}${fmtAmount(r.amount)}</div>
        </div>`;
    }).join('');
    return `
      <div class="day-group">
        <div class="day-head">
          <span class="day-date">${dayLabel(g.date)}</span>
          <span class="day-sum">${sums.join(' · ')}</span>
        </div>
        <div class="rows">${rows}</div>
      </div>`;
  }).join('') + '<p class="hint" style="text-align:center">点金额直接改；长按整行可修改或删除</p>';
}

function renderYearList() {
  const wrap = $('#recordList');

  const byMonth = new Map();
  records.forEach((r) => {
    const ym = r.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(r);
  });
  const months = [...byMonth.keys()].sort().reverse();

  if (!months.length) {
    wrap.innerHTML = emptyHtml(`${curYear}年没有记账记录`);
    return;
  }

  const rows = months.map((ym) => {
    const s = sumOf(byMonth.get(ym));
    return `
      <div class="month-row" data-ym="${ym}">
        <div class="m-badge">${Number(ym.slice(5, 7))}</div>
        <div class="m-main">
          <div class="m-name">${Number(ym.slice(5, 7))}月</div>
          <div class="m-sub">${s.count} 笔</div>
        </div>
        <div class="m-amt">
          ${s.expense > 0 ? `<div class="expense">-${fmtAmount(s.expense)}</div>` : ''}
          ${s.income > 0 ? `<div class="income">+${fmtAmount(s.income)}</div>` : ''}
        </div>
        <svg class="m-arrow" viewBox="0 0 24 24" width="16" height="16"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>`;
  }).join('');

  wrap.innerHTML = `<div class="rows">${rows}</div>
    <p class="hint" style="text-align:center">点击某个月份，查看当月每日明细</p>`;
}

/* ---------------- 主渲染 ---------------- */

export async function renderHome() {
  $$('#homeRangeSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.range === range);
  });

  if (range === 'month') {
    const [y, m] = curYm.split('-');
    $('#ymYear').textContent = `${y}年`;
    $('#ymMonth').textContent = `${Number(m)}月`;
    records = await db.recordsByMonth(curYm);
  } else {
    $('#ymYear').textContent = `${curYear}年`;
    $('#ymMonth').textContent = '';
    records = await db.recordsByYear(curYear);
  }

  const s = sumOf(records);
  $('#sumIncome').textContent = fmtMoney(s.income);
  $('#sumExpense').textContent = fmtMoney(s.expense);
  $('#sumBalance').textContent = fmtMoney(s.balance);

  if (range === 'month') {
    const prev = sumOf(await db.recordsByMonth(prevYmOf(curYm)));
    monthBanner(s, prev);
    renderMonthList();
  } else {
    const prev = sumOf(await db.recordsByYear(String(Number(curYear) - 1)));
    yearBanner(s, prev);
    renderYearList();
  }
}

/* ---------------- 行内修改金额 ---------------- */

function startAmountEdit(el, rec) {
  const input = document.createElement('input');
  input.className = `row-amt-input${rec.type === 'income' ? ' income' : ''}`;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.value = String(rec.amount);
  el.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const commit = async (save) => {
    if (done) return;
    done = true;
    if (save) {
      const v = round2(String(input.value).replace(/[^\d.]/g, ''));
      if (v > 0 && v !== rec.amount) {
        await db.updateRecord(rec.id, { amount: v });
        toast('金额已更新');
      }
    }
    renderHome();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(true); }
    else if (e.key === 'Escape') commit(false);
  });
  input.addEventListener('blur', () => commit(true));
}

/* ---------------- 更换类目 ---------------- */

function openSwapCategory(rec) {
  const cats = catsOfType(rec.type);
  $('#swapTitle').textContent = `${rec.type === 'income' ? '收入' : '支出'} · 更换类目`;
  renderCatGrid($('#swapCatGrid'), cats, rec.categoryId, async (cat) => {
    closeSheet();
    if (cat.id !== rec.categoryId) {
      await db.updateRecord(rec.id, { categoryId: cat.id });
      toast(`已改为「${cat.name}」`);
    }
    renderHome();
  });
  openSheet('sheetSwapCat');
}

/* ---------------- 长按菜单 ---------------- */

function openActions(rec) {
  const cat = catOf(rec.categoryId);
  const sign = rec.type === 'income' ? '+' : '-';
  $('#actionHead').innerHTML = `
    <div class="action-ico">${escapeHtml(cat.icon)}</div>
    <div class="action-info">
      <div class="action-name">${escapeHtml(cat.name)} ${sign}${fmtAmount(rec.amount)}</div>
      <div class="action-meta">${rec.type === 'income' ? '收入' : '支出'} · ${escapeHtml(rec.date)}</div>
    </div>`;
  actionTarget = rec;
  openSheet('sheetActions');
}

async function deleteRecord(rec) {
  const cat = catOf(rec.categoryId);
  const ok = await confirmDialog({
    title: '删除这条记录？',
    text: `${escapeHtml(cat.name)} ${rec.type === 'income' ? '+' : '-'}${fmtAmount(rec.amount)} · ${rec.date}`,
    okText: '删除',
    danger: true
  });
  if (!ok) return;
  await db.deleteRecord(rec.id);
  toast('已删除');
  renderHome();
}

/* ---------------- 事件绑定 ---------------- */

export function bindHome() {
  $('#ymBtn').addEventListener('click', async () => {
    const picked = await pickPeriod({
      mode: range,
      value: range === 'month' ? curYm : curYear,
      title: range === 'month' ? '选择月份' : '选择年份'
    });
    if (!picked) return;
    if (range === 'month') curYm = picked;
    else curYear = picked;
    renderHome();
  });

  $('#homeRangeSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || btn.dataset.range === range) return;
    range = btn.dataset.range;
    if (range === 'year') curYear = curYm.slice(0, 4);
    renderHome();
  });

  $('#hbAction').addEventListener('click', () => openAddSheet(true));

  const list = $('#recordList');

  list.addEventListener('click', (e) => {
    if (Date.now() < suppressClickUntil) return;

    const monthRow = e.target.closest('.month-row');
    if (monthRow) {
      range = 'month';
      curYm = monthRow.dataset.ym;
      renderHome();
      return;
    }

    const row = e.target.closest('.row');
    if (!row) return;
    if (e.target.closest('.row-amt-input')) return;
    const rec = records.find((r) => r.id === Number(row.dataset.id));
    if (!rec) return;

    if (e.target.closest('[data-act="amt"]')) {
      startAmountEdit(e.target.closest('[data-act="amt"]'), rec);
    } else if (e.target.closest('[data-act="cat"]')) {
      openSwapCategory(rec);
    }
  });

  // 长按整行 → 操作菜单
  let pressTimer = null;
  const cancelPress = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };
  list.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.row-amt-input')) return;
    const row = e.target.closest('.row');
    if (!row) return;
    const rec = records.find((r) => r.id === Number(row.dataset.id));
    if (!rec) return;
    cancelPress();
    pressTimer = setTimeout(() => {
      pressTimer = null;
      suppressClickUntil = Date.now() + 700;
      if (navigator.vibrate) navigator.vibrate(12);
      openActions(rec);
    }, 550);
  });
  list.addEventListener('pointerup', cancelPress);
  list.addEventListener('pointercancel', cancelPress);
  list.addEventListener('pointermove', cancelPress);
  list.addEventListener('pointerleave', cancelPress);

  // 操作菜单按钮（只绑定一次）
  $('#actionCancel').addEventListener('click', () => closeSheet());
  $('#actionEdit').addEventListener('click', () => {
    const rec = actionTarget;
    closeSheet();
    if (rec) openEditSheet(rec);
  });
  $('#actionDelete').addEventListener('click', () => {
    const rec = actionTarget;
    closeSheet();
    if (rec) deleteRecord(rec);
  });
}

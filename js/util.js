/* 通用工具函数 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD' */
export function dateToStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date（本地时区，避免 UTC 偏移） */
export function strToDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr() {
  return dateToStr(new Date());
}

export function currentYm() {
  return todayStr().slice(0, 7);
}

/** 'YYYY-MM' */
export function ymOf(dateStr) {
  return String(dateStr).slice(0, 7);
}

export function ymLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
}

export function dayLabel(dateStr) {
  const d = strToDate(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

/** 保留两位小数并加千分位，如 28983.63 / 1.70 */
export function fmtMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [i, d] = v.toFixed(2).split('.');
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${d}`;
}

/** 去掉末尾多余的 0，如 1.7 / 6 / 132.05 */
export function fmtAmount(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  let s = v.toFixed(2).replace(/\.?0+$/, '');
  const [i, d] = s.split('.');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d ? `${int}.${d}` : int;
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 生成自定义 id */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

/** 期间切换动画期间锁定，避免重复触发 */
export function debounce(fn, wait = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

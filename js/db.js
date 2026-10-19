/* IndexedDB 数据层：类目 + 账单 */
import { defaultCategories } from './categories.js';
import { ymOf, uid } from './util.js';

const DB_NAME = 'dadao-accounting';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('records')) {
        const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('ym', 'ym', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/* ---------------- 一次性标记（如初始数据是否已导入） ----------------
 * 刻意放在 localStorage 而不是 IndexedDB：新增对象仓库需要升级数据库版本，
 * 而版本升级一旦被其他标签页的旧连接阻塞，open 的 Promise 会永久挂起，导致整个应用卡死。
 */

const META_PREFIX = 'dadao.meta.';

export async function getMeta(key) {
  try {
    return localStorage.getItem(META_PREFIX + key);
  } catch (e) {
    return null;
  }
}

export async function setMeta(key, value) {
  try {
    localStorage.setItem(META_PREFIX + key, String(value));
  } catch (e) {
    /* 隐私模式等场景下写入失败不影响主流程 */
  }
}

/* ---------------- 类目 ---------------- */

export async function initCategories() {
  const db = await open();
  const count = await new Promise((resolve, reject) => {
    const r = db.transaction('categories', 'readonly').objectStore('categories').count();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  if (count > 0) return;

  const all = [...defaultCategories('expense'), ...defaultCategories('income')];
  await new Promise((resolve, reject) => {
    const t = db.transaction('categories', 'readwrite');
    const store = t.objectStore('categories');
    all.forEach((c) => store.put(c));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function listCategories(type) {
  const db = await open();
  const all = await new Promise((resolve, reject) => {
    const r = db.transaction('categories', 'readonly').objectStore('categories').getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  return all
    .filter((c) => !type || c.type === type)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveCategory(cat) {
  const db = await open();
  const record = { ...cat };
  if (!record.id) record.id = uid('cat');
  await new Promise((resolve, reject) => {
    const t = db.transaction('categories', 'readwrite');
    t.objectStore('categories').put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  return record;
}

export async function deleteCategory(id) {
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction('categories', 'readwrite');
    t.objectStore('categories').delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function nextCategoryOrder(type) {
  const list = await listCategories(type);
  return list.length ? Math.max(...list.map((c) => c.order || 0)) + 1 : 0;
}

/* ---------------- 账单 ---------------- */

export async function addRecord(rec) {
  const db = await open();
  const record = {
    type: rec.type,
    amount: rec.amount,
    categoryId: rec.categoryId,
    note: rec.note || '',
    date: rec.date,
    ym: ymOf(rec.date),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite');
    const r = t.objectStore('records').add(record);
    r.onsuccess = () => resolve({ ...record, id: r.result });
    r.onerror = () => reject(r.error);
  });
}

/** 批量插入（初始数据导入用，单事务写入） */
export async function addRecords(list) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite');
    const store = t.objectStore('records');
    const now = Date.now();
    list.forEach((rec) => {
      store.add({
        type: rec.type,
        amount: rec.amount,
        categoryId: rec.categoryId,
        note: rec.note || '',
        date: rec.date,
        ym: ymOf(rec.date),
        createdAt: now,
        updatedAt: now
      });
    });
    t.oncomplete = () => resolve(list.length);
    t.onerror = () => reject(t.error);
  });
}

export async function updateRecord(id, patch) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite');
    const store = t.objectStore('records');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const cur = getReq.result;
      if (!cur) { reject(new Error('记录不存在')); return; }
      const next = { ...cur, ...patch, updatedAt: Date.now() };
      if (patch.date) next.ym = ymOf(patch.date);
      store.put(next);
      resolve(next);
    };
    getReq.onerror = () => reject(getReq.error);
    t.onerror = () => reject(t.error);
  });
}

export async function deleteRecord(id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite');
    t.objectStore('records').delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

function sortDesc(list) {
  return list.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id || 0) - (a.id || 0);
  });
}

export async function recordsBetween(from, to) {
  const db = await open();
  const list = await new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readonly');
    const idx = t.objectStore('records').index('date');
    const req = idx.getAll(IDBKeyRange.bound(from, to));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return sortDesc(list);
}

export function recordsByMonth(ym) {
  return recordsBetween(`${ym}-01`, `${ym}-31`);
}

export function recordsByYear(year) {
  return recordsBetween(`${year}-01-01`, `${year}-12-31`);
}

export async function allRecords() {
  const db = await open();
  const list = await new Promise((resolve, reject) => {
    const r = db.transaction('records', 'readonly').objectStore('records').getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
  return sortDesc(list);
}

export async function countRecordsOfCategory(categoryId) {
  const list = await allRecords();
  return list.filter((r) => r.categoryId === categoryId).length;
}

export async function clearRecords() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite');
    t.objectStore('records').clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** 把某类目下的记录迁移到另一个类目 */
export async function reassignCategory(fromId, toId) {
  const list = await allRecords();
  const targets = list.filter((r) => r.categoryId === fromId);
  if (!targets.length) return 0;
  const db = await open();
  await new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite');
    const store = t.objectStore('records');
    targets.forEach((r) => store.put({ ...r, categoryId: toId, updatedAt: Date.now() }));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  return targets.length;
}

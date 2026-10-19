/* 导出 Excel（真 .xlsx，两个工作表：账单明细 + 分类汇总） */
import * as db from './db.js';
import { catOf } from './ui.js';
import { strToDate, WEEKDAYS, ymLabel, round2, toast } from './util.js';

export async function buildExport({ mode, period }) {
  const records = mode === 'month'
    ? await db.recordsByMonth(period)
    : await db.recordsByYear(period);

  if (!records.length) return null;

  const asc = [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });

  const detail = [['日期', '星期', '类型', '类目', '备注', '金额(元)']];
  const agg = new Map();
  let income = 0;
  let expense = 0;

  asc.forEach((r) => {
    const cat = catOf(r.categoryId);
    const isIncome = r.type === 'income';
    if (isIncome) income = round2(income + r.amount);
    else expense = round2(expense + r.amount);

    detail.push([
      r.date,
      WEEKDAYS[strToDate(r.date).getDay()],
      isIncome ? '收入' : '支出',
      cat.name,
      r.note || '',
      isIncome ? round2(r.amount) : -round2(r.amount)
    ]);

    const key = `${r.type}|${cat.name}`;
    const item = agg.get(key) || { type: r.type, name: cat.name, total: 0, count: 0 };
    item.total = round2(item.total + r.amount);
    item.count += 1;
    agg.set(key, item);
  });

  const summary = [['类目', '类型', '金额(元)', '笔数']];
  [...agg.values()]
    .sort((a, b) => b.total - a.total)
    .forEach((a) => {
      summary.push([
        a.name,
        a.type === 'income' ? '收入' : '支出',
        a.type === 'income' ? a.total : -a.total,
        a.count
      ]);
    });
  summary.push([]);
  summary.push(['收入合计', '', income, '']);
  summary.push(['支出合计', '', -expense, '']);
  summary.push(['结余', '', round2(income - expense), '']);

  const label = mode === 'month' ? ymLabel(period) : `${period}年`;
  return { detail, summary, label, count: asc.length };
}

export async function exportExcel({ mode, period }) {
  const data = await buildExport({ mode, period });
  if (!data) {
    toast('该时间段暂无数据');
    return false;
  }

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(data.detail);
  ws1['!cols'] = [{ wch: 12 }, { wch: 9 }, { wch: 7 }, { wch: 12 }, { wch: 22 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, '账单明细');

  const ws2 = XLSX.utils.aoa_to_sheet(data.summary);
  ws2['!cols'] = [{ wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, ws2, '分类汇总');

  XLSX.writeFile(wb, `大道记账_${data.label}.xlsx`);
  toast(`已导出 ${data.count} 条记录`);
  return true;
}

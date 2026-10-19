/* 图表页：年度 / 月度消费趋势与类目占比 */
import * as db from './db.js';
import { $, $$, fmtMoney, ymLabel, currentYm, round2 } from './util.js';
import { catOf, pickPeriod } from './ui.js';

const PALETTE = ['#F7B733', '#5B8FF9', '#61DDAA', '#F6903D', '#7262FD', '#78D3F8',
  '#9661BC', '#F6BD16', '#008685', '#F08BB4', '#E8684A', '#6DC8EC'];

let range = 'month';
let period = currentYm();
let instances = [];

function disposeCharts() {
  instances.forEach((c) => { try { c.dispose(); } catch (e) { /* ignore */ } });
  instances = [];
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function expenseByCategory(records) {
  const map = new Map();
  records.filter((r) => r.type === 'expense').forEach((r) => {
    const cat = catOf(r.categoryId);
    map.set(cat.name, round2((map.get(cat.name) || 0) + r.amount));
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function monthlySeries(records, year) {
  const income = new Array(12).fill(0);
  const expense = new Array(12).fill(0);
  records.forEach((r) => {
    const m = Number(r.date.slice(5, 7)) - 1;
    if (m < 0 || m > 11) return;
    if (r.type === 'income') income[m] = round2(income[m] + r.amount);
    else expense[m] = round2(expense[m] + r.amount);
  });
  return { income, expense, labels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`) };
}

function initPie(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  const chart = echarts.init(el);
  chart.setOption({
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>${fmtMoney(p.value)} 元（${p.percent}%）`
    },
    legend: {
      bottom: 0, type: 'scroll', itemWidth: 8, itemHeight: 8,
      textStyle: { fontSize: 11, color: '#5A6472' }
    },
    series: [{
      type: 'pie',
      radius: ['44%', '68%'],
      center: ['50%', '42%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data
    }]
  });
  instances.push(chart);
}

function initDaily(id, records, ym) {
  const el = document.getElementById(id);
  if (!el) return;
  const n = daysInMonth(ym);
  const data = new Array(n).fill(0);
  records.filter((r) => r.type === 'expense').forEach((r) => {
    const d = Number(r.date.slice(8, 10)) - 1;
    if (d >= 0 && d < n) data[d] = round2(data[d] + r.amount);
  });
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 6, right: 10, top: 16, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br/>支出 ${fmtMoney(p[0].value)} 元` },
    xAxis: {
      type: 'category',
      data: Array.from({ length: n }, (_, i) => i + 1),
      axisLabel: { fontSize: 10, color: '#98A2B0', interval: n > 20 ? 2 : 0 },
      axisLine: { lineStyle: { color: '#EEF0F3' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#98A2B0' },
      splitLine: { lineStyle: { color: '#F2F4F6' } }
    },
    series: [{
      type: 'bar',
      data,
      barMaxWidth: 14,
      itemStyle: { color: '#F7B733', borderRadius: [4, 4, 0, 0] }
    }]
  });
  instances.push(chart);
}

function initMonthlyBars(id, records) {
  const el = document.getElementById(id);
  if (!el) return;
  const { income, expense, labels } = monthlySeries(records);
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 6, right: 10, top: 34, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 11, color: '#5A6472' } },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { fontSize: 10, color: '#98A2B0' },
      axisLine: { lineStyle: { color: '#EEF0F3' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', axisLabel: { fontSize: 10, color: '#98A2B0' },
      splitLine: { lineStyle: { color: '#F2F4F6' } }
    },
    series: [
      { name: '收入', type: 'bar', data: income, barMaxWidth: 10, itemStyle: { color: '#12A150', borderRadius: [4, 4, 0, 0] } },
      { name: '支出', type: 'bar', data: expense, barMaxWidth: 10, itemStyle: { color: '#E5484D', borderRadius: [4, 4, 0, 0] } }
    ]
  });
  instances.push(chart);
}

function initTrend(id, records) {
  const el = document.getElementById(id);
  if (!el) return;
  const { expense, labels } = monthlySeries(records);
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 6, right: 14, top: 20, bottom: 6, containLabel: true },
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].axisValue}<br/>支出 ${fmtMoney(p[0].value)} 元` },
    xAxis: {
      type: 'category', boundaryGap: false, data: labels,
      axisLabel: { fontSize: 10, color: '#98A2B0' },
      axisLine: { lineStyle: { color: '#EEF0F3' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', axisLabel: { fontSize: 10, color: '#98A2B0' },
      splitLine: { lineStyle: { color: '#F2F4F6' } }
    },
    series: [{
      name: '支出',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: expense,
      lineStyle: { width: 2.6, color: '#F7B733' },
      itemStyle: { color: '#F7B733' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(247,183,51,.35)' },
          { offset: 1, color: 'rgba(247,183,51,.02)' }
        ])
      }
    }]
  });
  instances.push(chart);
}

function renderStatCards(income, expense) {
  $('#reportStatCards').innerHTML = `
    <div class="stat-card"><span class="k">收入</span><span class="v income">${fmtMoney(income)}</span></div>
    <div class="stat-card"><span class="k">支出</span><span class="v expense">${fmtMoney(expense)}</span></div>
    <div class="stat-card"><span class="k">结余</span><span class="v">${fmtMoney(income - expense)}</span></div>`;
}

export async function renderReports() {
  $$('#reportRangeSeg .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.range === range);
  });
  $('#reportPeriodLabel').textContent = range === 'month' ? ymLabel(period) : `${period}年`;

  disposeCharts();
  const records = range === 'month' ? await db.recordsByMonth(period) : await db.recordsByYear(period);

  let income = 0;
  let expense = 0;
  records.forEach((r) => {
    if (r.type === 'income') income = round2(income + r.amount);
    else expense = round2(expense + r.amount);
  });
  renderStatCards(income, expense);

  const chartsEl = $('#reportCharts');
  const emptyEl = $('#reportEmpty');

  if (!records.length) {
    chartsEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  if (range === 'month') {
    chartsEl.innerHTML = `
      <div class="chart-card"><h3>消费类目占比</h3><div class="chart-box" id="chPie"></div></div>
      <div class="chart-card"><h3>每日消费趋势</h3><div class="chart-box" id="chDaily"></div></div>`;
    requestAnimationFrame(() => {
      initPie('chPie', expenseByCategory(records));
      initDaily('chDaily', records, period);
    });
  } else {
    chartsEl.innerHTML = `
      <div class="chart-card"><h3>月度收支对比</h3><div class="chart-box" id="chMonthly"></div></div>
      <div class="chart-card"><h3>年度消费趋势</h3><div class="chart-box" id="chTrend"></div></div>
      <div class="chart-card"><h3>全年消费类目占比</h3><div class="chart-box" id="chPie"></div></div>`;
    requestAnimationFrame(() => {
      initMonthlyBars('chMonthly', records);
      initTrend('chTrend', records);
      initPie('chPie', expenseByCategory(records));
    });
  }
}

export function resizeReports() {
  instances.forEach((c) => { try { c.resize(); } catch (e) { /* ignore */ } });
}

export function bindReports() {
  $('#reportRangeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || b.dataset.range === range) return;
    range = b.dataset.range;
    period = range === 'month' ? currentYm() : String(period).slice(0, 4);
    if (range === 'year' && !/^\d{4}$/.test(period)) period = String(currentYm().slice(0, 4));
    renderReports();
  });

  $('#reportPeriodBtn').addEventListener('click', async () => {
    const v = await pickPeriod({
      mode: range,
      value: period,
      title: range === 'month' ? '选择月份' : '选择年份'
    });
    if (v) {
      period = v;
      renderReports();
    }
  });
}

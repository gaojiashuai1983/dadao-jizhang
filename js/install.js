/* 安装到主屏幕：Android / 桌面 Chrome 走浏览器原生安装提示，iOS 走手动引导说明 */
import { $, escapeHtml } from './util.js';
import { openSheet, closeSheet } from './ui.js';

const DISMISS_KEY = 'dadao.meta.installHintDismissed';

let deferredPrompt = null;

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isMobile() {
  return navigator.maxTouchPoints > 0 || /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function hintDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
}

function dismissHint() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* 隐私模式下写不进去，只影响本次提示 */ }
}

function guideContent() {
  if (isIOS()) {
    return {
      title: '添加到主屏幕',
      steps: [
        '点 Safari 工具栏上的「分享」按钮（方框 + 向上箭头）',
        '在弹出菜单里向下滑，选择「添加到主屏幕」',
        '确认名称后点右上角「添加」'
      ],
      note: 'iOS 不支持自动弹安装提示，只能这样手动添加。添加后会以独立应用打开，不再显示浏览器地址栏。'
    };
  }
  return {
    title: '安装到主屏幕',
    steps: [
      '点浏览器右上角的「⋮」菜单',
      '选择「安装应用」（部分版本叫「添加到主屏幕」）',
      '确认后即可从桌面图标直接打开'
    ],
    note: '如果菜单里只有「添加到主屏幕」，加出来的图标可能仍会打开浏览器，请优先选「安装应用」。'
  };
}

function renderGuide() {
  const g = guideContent();
  $('#installTitle').textContent = g.title;
  $('#installSteps').innerHTML = g.steps
    .map((s, i) => `<li><span class="is-idx">${i + 1}</span><span>${escapeHtml(s)}</span></li>`)
    .join('');
  $('#installNote').textContent = g.note;
}

/** 更新「我的」页入口文案与首页提示条的显隐 */
export function refreshInstallEntry() {
  const installed = isStandalone();
  const desc = $('#cellInstallDesc');
  if (desc) desc.textContent = installed ? '已安装' : (deferredPrompt ? '可一键安装' : '');
  const hint = $('#installHint');
  if (hint) hint.hidden = installed || hintDismissed() || !isMobile();
  const cell = $('#cellInstall');
  if (cell) cell.hidden = installed;
}

/** 触发安装：有原生提示就用原生，否则展示手动引导 */
export async function installApp() {
  if (deferredPrompt) {
    const evt = deferredPrompt;
    evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      refreshInstallEntry();
      return;
    }
  }
  renderGuide();
  openSheet('sheetInstall');
}

/* 尽早捕获安装事件，避免错过 */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  refreshInstallEntry();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  dismissHint();
  refreshInstallEntry();
});

export function bindInstall() {
  const entry = $('#cellInstall');
  if (entry) entry.addEventListener('click', () => installApp());

  const hintBtn = $('#installHintBtn');
  if (hintBtn) hintBtn.addEventListener('click', () => installApp());

  const hintClose = $('#installHintClose');
  if (hintClose) {
    hintClose.addEventListener('click', () => {
      dismissHint();
      refreshInstallEntry();
    });
  }

  const close = $('#installClose');
  if (close) close.addEventListener('click', () => closeSheet());

  refreshInstallEntry();
}

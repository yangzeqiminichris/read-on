(function () {
  'use strict';
  // 防止重复注入（声明式 + 按需注入）导致重复注册监听。
  if (window.__READON_CONTENT_LOADED__) return;
  window.__READON_CONTENT_LOADED__ = true;
  const P = window.ReadOn.positioning;
  const M = window.ReadOn.marks;
  const S = window.ReadOn.storage;

  // 候选元素：含有可读文字的常见块级元素。
  const SELECTOR = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,pre,article,section,div';

  // 元素自身或祖先是否 fixed / sticky 定位（粘性头部、悬浮搜索框等）。
  function isPinned(el) {
    let node = el;
    for (let i = 0; node && node !== document.body && i < 8; i++) {
      const pos = getComputedStyle(node).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
      node = node.parentElement;
    }
    return false;
  }

  function getTopAnchorText() {
    const els = document.body.querySelectorAll(SELECTOR);
    let best = null;
    let bestTop = Infinity;
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (txt.length < 10) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;
      if (rect.top >= -5 && rect.top < bestTop) {
        if (isPinned(el)) continue;
        bestTop = rect.top;
        best = el;
      }
    }
    if (!best) return '';
    return (best.textContent || '').trim().slice(0, 200);
  }

  function snapshot() {
    return {
      scrollPosition: window.scrollY,
      viewportHeight: window.innerHeight,
      contentHeight: document.documentElement.scrollHeight,
      anchorText: getTopAnchorText(),
      strategy: 'page-ratio',
      pageURL: location.href,
      pageTitle: document.title,
      scrollContainerSelector: null,
    };
  }

  function findAnchorOffsets(anchorText) {
    if (!anchorText) return [];
    const els = document.body.querySelectorAll(SELECTOR);
    const offsets = [];
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (txt.includes(anchorText) && !isPinned(el)) {
        offsets.push(el.getBoundingClientRect().top + window.scrollY);
      }
    }
    return offsets;
  }

  function scrollToMark(mark) {
    const contentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const ratio = P.pageRatio(mark.scrollPosition, mark.viewportHeight, mark.contentHeight);
    const ratioTarget = P.ratioToScroll(mark.strategy, ratio, viewportHeight, contentHeight);
    const offsets = findAnchorOffsets(mark.anchorText);
    const target = P.refineTargetWithAnchors(ratioTarget, offsets, viewportHeight);
    const maxScroll = Math.max(0, contentHeight - viewportHeight);
    window.scrollTo({ top: Math.min(Math.max(target, 0), maxScroll), behavior: 'smooth' });
  }

  // 跨页面跳转：等内容高度稳定（连续 2 次不变或 ~3s 超时）后再回调。
  function waitForStableHeight(cb) {
    let last = -1, stable = 0, tries = 0;
    const iv = setInterval(function () {
      const h = document.documentElement.scrollHeight;
      if (h === last) stable++; else { stable = 0; last = h; }
      tries++;
      if (stable >= 2 || tries > 20) { clearInterval(iv); cb(); }
    }, 150);
  }

  async function consumePendingJump() {
    let rec;
    try { rec = await S.getPendingJump(); } catch (e) { return; }
    if (!rec) return;
    if (rec.pageKey !== M.pageKeyFromURL(location.href)) return;
    await S.clearPendingJump();
    if (Date.now() - rec.ts > 30000) return;
    waitForStableHeight(function () { scrollToMark(rec.mark); });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'READON_PING') {
      sendResponse({ ok: true });
      return true;
    }
    if (msg && msg.type === 'READON_CAPTURE') {
      sendResponse(snapshot());
      return true;
    }
    if (msg && msg.type === 'READON_SCROLL_TO') {
      scrollToMark(msg.mark);
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  consumePendingJump();
})();

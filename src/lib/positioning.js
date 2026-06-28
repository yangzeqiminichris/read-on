(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.positioning = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pageRatio(scrollPosition, viewportHeight, contentHeight) {
    const scrollable = contentHeight - viewportHeight;
    if (scrollable <= 0) return 0;
    return clamp(scrollPosition / scrollable, 0, 1);
  }

  function viewportRatio(scrollPosition, viewportHeight) {
    if (viewportHeight <= 0) return 0;
    return scrollPosition / viewportHeight;
  }

  function ratioToScroll(strategy, ratio, viewportHeight, contentHeight) {
    const maxScroll = Math.max(0, contentHeight - viewportHeight);
    let target;
    if (strategy === 'viewport-ratio') {
      target = ratio * viewportHeight;
    } else {
      target = ratio * maxScroll;
    }
    return clamp(target, 0, maxScroll);
  }

  function displayPercent(scrollPosition, viewportHeight, contentHeight) {
    return Math.round(pageRatio(scrollPosition, viewportHeight, contentHeight) * 100);
  }

  function pickNearestAnchor(candidateOffsets, targetOffset) {
    if (!candidateOffsets || candidateOffsets.length === 0) return null;
    let best = candidateOffsets[0];
    let bestDist = Math.abs(best - targetOffset);
    for (let i = 1; i < candidateOffsets.length; i++) {
      const d = Math.abs(candidateOffsets[i] - targetOffset);
      if (d < bestDist) { best = candidateOffsets[i]; bestDist = d; }
    }
    return best;
  }

  // 文字锚点只用于在比例目标"附近"精确定位（设计：比例给大概区域，锚点小范围纠正）。
  // 若最近的锚点离比例目标超过 maxDistance（页面大改 / 抓到了无关的固定元素），
  // 就放弃锚点、退回纯比例目标——保证最坏情况不差于纯比例定位。
  function refineTargetWithAnchors(ratioTarget, anchorOffsets, maxDistance) {
    const nearest = pickNearestAnchor(anchorOffsets, ratioTarget);
    if (nearest == null) return ratioTarget;
    if (Math.abs(nearest - ratioTarget) > maxDistance) return ratioTarget;
    return nearest;
  }

  return {
    clamp, pageRatio, viewportRatio, ratioToScroll, displayPercent,
    pickNearestAnchor, refineTargetWithAnchors,
  };
});

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.icons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 官方 Lucide 图标内部标记（ISC 开源）。viewBox 0 0 24 24，靠 currentColor 继承父色。
  const data = {
    'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
    'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    'bookmark-plus': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><line x1="12" x2="12" y1="7" y2="13"/><line x1="9" x2="15" y1="10" y2="10"/>',
  };

  function el(id, size) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = data[id] || '';
    return svg;
  }

  return { data: data, el: el };
});

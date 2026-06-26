(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.time = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function plural(n, unit) {
    return n + ' ' + unit + (n === 1 ? '' : 's') + ' ago';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function formatRelativeTime(timestamp, now) {
    let diff = now - timestamp;
    if (diff < 0) diff = 0;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return plural(min, 'minute');
    const hr = Math.floor(min / 60);
    if (hr < 24) return plural(hr, 'hour');
    const day = Math.floor(hr / 24);
    if (day < 7) return plural(day, 'day');

    const d = new Date(timestamp);
    const base = MONTHS[d.getMonth()] + ' ' + d.getDate();
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return sameYear ? base : base + ', ' + d.getFullYear();
  }

  function formatDateTime(timestamp, now) {
    const d = new Date(timestamp);
    const base = MONTHS[d.getMonth()] + ' ' + d.getDate();
    const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    return sameYear ? base + ', ' + hm : base + ', ' + d.getFullYear() + ', ' + hm;
  }

  return { formatRelativeTime: formatRelativeTime, formatDateTime: formatDateTime };
});

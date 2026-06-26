(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.marks = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pageKeyFromURL(url) {
    const u = new URL(url);
    return u.hostname + u.pathname;
  }

  function makeDefaultName(seq) {
    return 'Mark #' + seq;
  }

  function emptyPageData(pageKey) {
    return { pageKey: pageKey, marks: [], nextSeq: 1 };
  }

  function createMark(pageData, opts) {
    const snapshot = opts.snapshot;
    const seq = pageData.nextSeq;
    const name = (opts.name && opts.name.trim()) || makeDefaultName(seq);
    const mark = {
      id: opts.id,
      name: name,
      pageKey: pageData.pageKey,
      pageURL: snapshot.pageURL,
      pageTitle: snapshot.pageTitle,
      note: '',
      createdAt: opts.now,
      updatedAt: opts.now,
      scrollPosition: snapshot.scrollPosition,
      viewportHeight: snapshot.viewportHeight,
      contentHeight: snapshot.contentHeight,
      strategy: snapshot.strategy || 'page-ratio',
      anchorText: snapshot.anchorText || '',
      scrollContainerSelector: snapshot.scrollContainerSelector || null,
    };
    const next = {
      pageKey: pageData.pageKey,
      marks: pageData.marks.concat([mark]),
      nextSeq: seq + 1,
    };
    return { pageData: next, mark: mark };
  }

  function removeMark(pageData, markId) {
    return {
      pageKey: pageData.pageKey,
      marks: pageData.marks.filter(function (m) { return m.id !== markId; }),
      nextSeq: pageData.nextSeq,
    };
  }

  // 把整个 storage 对象（{[pageKey]: pageData}，可能混入非 pageData 键）整理成
  // 按页面分组、组内 createdAt 升序、组间最近活动(组内 max updatedAt)倒序的数组。
  function groupMarksByPage(allData) {
    const groups = [];
    for (const key in allData) {
      const pd = allData[key];
      if (!pd || !Array.isArray(pd.marks) || pd.marks.length === 0) continue;
      const sorted = pd.marks.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
      let recent = sorted[0];
      for (const m of sorted) if (m.updatedAt > recent.updatedAt) recent = m;
      groups.push({
        pageKey: pd.pageKey,
        pageTitle: recent.pageTitle,
        pageURL: recent.pageURL,
        marks: sorted,
        lastActivity: recent.updatedAt,
      });
    }
    groups.sort(function (a, b) { return b.lastActivity - a.lastActivity; });
    return groups;
  }

  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
  };
});

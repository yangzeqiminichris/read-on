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

  return { pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark };
});

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./browser.js'), require('./marks.js'));
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.storage = factory(root.ReadOn.browser, root.ReadOn.marks);
  }
})(typeof self !== 'undefined' ? self : this, function (browser, marks) {
  'use strict';

  async function getPageData(pageKey) {
    const data = await browser.storageGet([pageKey]);
    return data[pageKey] || marks.emptyPageData(pageKey);
  }

  async function saveMark(pageKey, opts) {
    const pageData = await getPageData(pageKey);
    const result = marks.createMark(pageData, opts);
    await browser.storageSet({ [pageKey]: result.pageData });
    return result.mark;
  }

  async function updateMarkPosition(pageKey, markId, snapshot, now) {
    const pageData = await getPageData(pageKey);
    const updated = pageData.marks.map(function (m) {
      if (m.id !== markId) return m;
      return Object.assign({}, m, {
        scrollPosition: snapshot.scrollPosition,
        viewportHeight: snapshot.viewportHeight,
        contentHeight: snapshot.contentHeight,
        anchorText: snapshot.anchorText,
        strategy: snapshot.strategy || m.strategy,
        scrollContainerSelector:
          snapshot.scrollContainerSelector != null
            ? snapshot.scrollContainerSelector
            : m.scrollContainerSelector,
        updatedAt: now,
      });
    });
    await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: updated }) });
  }

  async function setMarkName(pageKey, markId, name) {
    const pageData = await getPageData(pageKey);
    const updated = pageData.marks.map(function (m) {
      return m.id === markId ? Object.assign({}, m, { name: name }) : m;
    });
    await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: updated }) });
  }

  async function deleteMark(pageKey, markId) {
    const pageData = await getPageData(pageKey);
    const next = marks.removeMark(pageData, markId);
    await browser.storageSet({ [pageKey]: next });
  }

  async function setNote(pageKey, markId, note) {
    const pageData = await getPageData(pageKey);
    const updated = pageData.marks.map(function (m) {
      return m.id === markId ? Object.assign({}, m, { note: note }) : m;
    });
    await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: updated }) });
  }

  async function getAllPageData() {
    return browser.storageGet(null);
  }

  const PENDING_KEY = '_readon_pending_jump';

  async function setPendingJump(pageKey, mark, now) {
    const ts = (now === undefined) ? Date.now() : now;
    await browser.storageSet({ [PENDING_KEY]: { pageKey: pageKey, mark: mark, ts: ts } });
  }

  async function getPendingJump() {
    const data = await browser.storageGet([PENDING_KEY]);
    return data[PENDING_KEY] || null;
  }

  async function clearPendingJump() {
    await browser.storageRemove(PENDING_KEY);
  }

  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
  };
});

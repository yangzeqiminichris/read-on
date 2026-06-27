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

  async function deleteMarks(refs) {
    const byPage = {};
    for (const r of refs) { (byPage[r.pageKey] = byPage[r.pageKey] || []).push(r.id); }
    for (const pageKey in byPage) {
      const pageData = await getPageData(pageKey);
      const idset = {};
      for (const id of byPage[pageKey]) idset[id] = true;
      const kept = pageData.marks.filter(function (m) { return !idset[m.id]; });
      await browser.storageSet({ [pageKey]: Object.assign({}, pageData, { marks: kept }) });
    }
  }

  function countMarks(all) {
    let n = 0;
    for (const k in all) { const pd = all[k]; if (pd && Array.isArray(pd.marks)) n += pd.marks.length; }
    return n;
  }

  async function importMerge(importedPages) {
    const existing = await getAllPageData();
    const before = countMarks(existing);
    const merged = marks.mergeImport(existing, importedPages);
    await browser.storageSet(merged);
    return countMarks(merged) - before;
  }

  const ALIASES_KEY = '_readon_aliases';

  async function getAliases() {
    const data = await browser.storageGet([ALIASES_KEY]);
    const a = data[ALIASES_KEY] || {};
    return { domains: a.domains || {}, pages: a.pages || {} };
  }

  async function setAliasField(field, key, alias) {
    const a = await getAliases();
    const v = (alias || '').trim();
    if (v) a[field][key] = v; else delete a[field][key];
    await browser.storageSet({ [ALIASES_KEY]: a });
  }

  async function setDomainAlias(domain, alias) { return setAliasField('domains', domain, alias); }
  async function setPageAlias(pageKey, alias) { return setAliasField('pages', pageKey, alias); }

  const TAGS_KEY = '_readon_tags';

  async function getTags() {
    const data = await browser.storageGet([TAGS_KEY]);
    const t = data[TAGS_KEY] || {};
    return { pages: t.pages || {} };
  }

  async function getAllTags() {
    const t = await getTags();
    const set = {};
    for (const k in t.pages) for (const name of t.pages[k]) set[name] = true;
    return Object.keys(set).sort();
  }

  async function addPageTag(pageKey, tag) {
    const v = (tag || '').trim();
    if (!v) return false;
    const t = await getTags();
    const cur = t.pages[pageKey] || [];
    if (cur.indexOf(v) !== -1) return false;
    if (cur.length >= 3) return false;
    t.pages[pageKey] = cur.concat([v]);
    await browser.storageSet({ [TAGS_KEY]: t });
    return true;
  }

  async function removePageTag(pageKey, tag) {
    const t = await getTags();
    const cur = t.pages[pageKey];
    if (!cur) return;
    const next = cur.filter(function (x) { return x !== tag; });
    if (next.length) t.pages[pageKey] = next; else delete t.pages[pageKey];
    await browser.storageSet({ [TAGS_KEY]: t });
  }

  return {
    getPageData, saveMark, updateMarkPosition, setMarkName, deleteMark, setNote,
    getAllPageData, setPendingJump, getPendingJump, clearPendingJump,
    deleteMarks, importMerge,
    getAliases, setDomainAlias, setPageAlias,
    getTags, getAllTags, addPageTag, removePageTag,
  };
});

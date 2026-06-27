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

  function domainOf(pageKey) {
    const i = pageKey.indexOf('/');
    return i === -1 ? pageKey : pageKey.slice(0, i);
  }

  function groupMarksByDomain(allData) {
    const pageGroups = groupMarksByPage(allData);
    const byDomain = {};
    const order = [];
    for (const g of pageGroups) {
      const d = domainOf(g.pageKey);
      if (!byDomain[d]) { byDomain[d] = { domain: d, markCount: 0, lastActivity: 0, pages: [] }; order.push(d); }
      const entry = byDomain[d];
      entry.pages.push(g);
      entry.markCount += g.marks.length;
      if (g.lastActivity > entry.lastActivity) entry.lastActivity = g.lastActivity;
    }
    const domains = order.map(function (d) { return byDomain[d]; });
    for (const e of domains) e.pages.sort(function (a, b) { return b.lastActivity - a.lastActivity; });
    domains.sort(function (a, b) { return b.lastActivity - a.lastActivity; });
    return domains;
  }

  function groupMarksByTag(allData, tags) {
    const pageGroups = groupMarksByPage(allData);
    const tagMap = (tags && tags.pages) || {};
    const byTag = {};
    const order = [];
    const untagged = { tag: null, pages: [], markCount: 0 };
    for (const g of pageGroups) {
      const ts = tagMap[g.pageKey] || [];
      if (ts.length === 0) {
        untagged.pages.push(g);
        untagged.markCount += g.marks.length;
        continue;
      }
      for (const t of ts) {
        if (!byTag[t]) { byTag[t] = { tag: t, pages: [], markCount: 0 }; order.push(t); }
        byTag[t].pages.push(g);
        byTag[t].markCount += g.marks.length;
      }
    }
    const groups = order.map(function (t) { return byTag[t]; });
    groups.sort(function (a, b) { return a.tag < b.tag ? -1 : (a.tag > b.tag ? 1 : 0); });
    if (untagged.pages.length) groups.push(untagged);
    return groups;
  }

  function isPageData(v) {
    return v && Array.isArray(v.marks) && typeof v.pageKey === 'string';
  }

  function onlyPages(obj) {
    const out = {};
    for (const k in obj) if (isPageData(obj[k])) out[k] = obj[k];
    return out;
  }

  function normalizeImport(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    const src = (parsed.pages && typeof parsed.pages === 'object') ? parsed.pages : parsed;
    const pages = onlyPages(src);
    return Object.keys(pages).length ? pages : null;
  }

  function mergeImport(existingAll, importedPages) {
    const out = {};
    const existingPages = onlyPages(existingAll);
    for (const k in existingPages) {
      out[k] = { pageKey: existingPages[k].pageKey, nextSeq: existingPages[k].nextSeq, marks: existingPages[k].marks.slice() };
    }
    for (const k in importedPages) {
      const imp = importedPages[k];
      if (!isPageData(imp)) continue;
      const cur = out[k] || { pageKey: imp.pageKey, nextSeq: 1, marks: [] };
      const ids = {};
      for (const m of cur.marks) ids[m.id] = true;
      for (const m of imp.marks) if (!ids[m.id]) { cur.marks.push(m); ids[m.id] = true; }
      cur.nextSeq = Math.max(cur.nextSeq || 1, imp.nextSeq || 1);
      out[k] = cur;
    }
    return out;
  }

  function buildExport(allData, now) {
    return { version: 1, exportedAt: now, pages: onlyPages(allData) };
  }

  function aliasOr(map, key, fallback) {
    if (map && typeof map[key] === 'string' && map[key].trim()) return map[key];
    return fallback;
  }

  return {
    pageKeyFromURL, makeDefaultName, emptyPageData, createMark, removeMark, groupMarksByPage,
    domainOf, groupMarksByDomain, groupMarksByTag, normalizeImport, mergeImport, buildExport, aliasOr,
  };
});

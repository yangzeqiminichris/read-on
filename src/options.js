(function () {
  'use strict';
  const { browser, storage, marks, time, positioning, icons } = window.ReadOn;

  const expandedIds = new Set();
  const selectedIds = new Set();
  let query = '';
  let allData = {};

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 2000);
  }

  function iconBtn(iconId, cls, label) {
    const b = document.createElement('button');
    b.className = 'icon-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.appendChild(icons.el(iconId, 16));
    return b;
  }

  function filteredData() {
    if (!query.trim()) return allData;
    const q = query.trim().toLowerCase();
    const out = {};
    for (const key in allData) {
      const pd = allData[key];
      if (!pd || !Array.isArray(pd.marks)) continue;
      const kept = pd.marks.filter(function (m) {
        return (m.name || '').toLowerCase().includes(q)
          || (m.note || '').toLowerCase().includes(q)
          || (m.pageTitle || '').toLowerCase().includes(q)
          || key.toLowerCase().includes(q);
      });
      if (kept.length) out[key] = Object.assign({}, pd, { marks: kept });
    }
    return out;
  }

  function findMark(id) {
    for (const key in allData) {
      const pd = allData[key];
      if (!pd || !Array.isArray(pd.marks)) continue;
      for (const m of pd.marks) if (m.id === id) return m;
    }
    return null;
  }

  function domainMarkIds(group) {
    const ids = [];
    for (const p of group.pages) for (const m of p.marks) ids.push(m.id);
    return ids;
  }

  async function reload() {
    allData = await storage.getAllPageData();
    render();
  }

  function renderBatchBar() {
    const bar = document.getElementById('batchbar');
    bar.innerHTML = '';
    if (selectedIds.size === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const label = document.createElement('span');
    label.className = 'batch-count';
    label.textContent = selectedIds.size + ' selected';
    const del = document.createElement('button');
    del.className = 'danger-btn solid';
    del.textContent = 'Delete';
    del.onclick = onBatchDelete;
    const clear = document.createElement('button');
    clear.className = 'ghost-btn';
    clear.textContent = 'Clear';
    clear.onclick = function () { selectedIds.clear(); render(); };
    bar.appendChild(label);
    bar.appendChild(del);
    bar.appendChild(clear);
  }

  async function onBatchDelete() {
    if (!window.confirm('Delete ' + selectedIds.size + ' marks?')) return;
    const refs = [];
    for (const id of selectedIds) {
      const m = findMark(id);
      if (m) refs.push({ pageKey: m.pageKey, id: id });
    }
    await storage.deleteMarks(refs);
    selectedIds.clear();
    await reload();
  }

  async function onSingleDelete(mark) {
    if (mark.note && mark.note.trim()) {
      if (!window.confirm('Delete this mark? Its note will be lost.')) return;
    }
    await storage.deleteMark(mark.pageKey, mark.id);
    selectedIds.delete(mark.id);
    expandedIds.delete(mark.id);
    await reload();
  }

  function domainHead(group) {
    const li = document.createElement('li');
    li.className = 'domain-head';
    const ids = domainMarkIds(group);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'domain-check';
    cb.checked = ids.length > 0 && ids.every(function (id) { return selectedIds.has(id); });
    cb.onchange = function () {
      for (const id of ids) { if (cb.checked) selectedIds.add(id); else selectedIds.delete(id); }
      render();
    };
    li.appendChild(cb);
    li.appendChild(icons.el('globe', 16));
    const name = document.createElement('span');
    name.className = 'domain-name';
    name.textContent = group.domain;
    const count = document.createElement('span');
    count.className = 'domain-count';
    count.textContent = group.markCount + (group.markCount === 1 ? ' mark' : ' marks');
    li.appendChild(name);
    li.appendChild(count);
    return li;
  }

  function pageHead(p) {
    const li = document.createElement('li');
    li.className = 'page-head';
    const t = document.createElement('span');
    t.className = 'page-title';
    t.textContent = p.pageTitle || '';
    const path = document.createElement('span');
    path.className = 'page-path';
    const slash = p.pageKey.indexOf('/');
    path.textContent = ' · ' + (slash === -1 ? '/' : p.pageKey.slice(slash));
    li.appendChild(t);
    li.appendChild(path);
    return li;
  }

  function markRow(mark) {
    const li = document.createElement('li');
    li.className = 'mark-row';
    li.dataset.markId = mark.id;
    const expanded = expandedIds.has(mark.id);
    if (expanded) li.classList.add('expanded');

    const main = document.createElement('div');
    main.className = 'row-main';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-check';
    cb.checked = selectedIds.has(mark.id);
    cb.onchange = function () {
      if (cb.checked) selectedIds.add(mark.id); else selectedIds.delete(mark.id);
      render();
    };
    main.appendChild(cb);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const top = document.createElement('div');
    top.className = 'row-top';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = mark.name;
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = time.formatRelativeTime(mark.updatedAt, Date.now());
    top.appendChild(name);
    top.appendChild(t);
    meta.appendChild(top);

    const pctValue = positioning.displayPercent(mark.scrollPosition, mark.viewportHeight, mark.contentHeight);
    const barRow = document.createElement('div');
    barRow.className = 'bar-row';
    const track = document.createElement('div');
    track.className = 'track';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = pctValue + '%';
    track.appendChild(fill);
    const pct = document.createElement('span');
    pct.className = 'pct';
    pct.textContent = pctValue + '%';
    barRow.appendChild(track);
    barRow.appendChild(pct);
    meta.appendChild(barRow);

    const hasNote = !!(mark.note && mark.note.trim());
    if (hasNote && !expanded) {
      const prev = document.createElement('div');
      prev.className = 'note-preview';
      prev.appendChild(icons.el('square-pen', 12));
      const span = document.createElement('span');
      span.textContent = mark.note.split('\n')[0];
      prev.appendChild(span);
      meta.appendChild(prev);
    }
    main.appendChild(meta);

    const jump = iconBtn('play', 'jump', 'Open in new tab');
    jump.onclick = async function () {
      await storage.setPendingJump(mark.pageKey, mark);
      await browser.openTab(mark.pageURL);
    };
    main.appendChild(jump);

    const del = iconBtn('trash-2', 'delete', 'Delete');
    del.onclick = function () { onSingleDelete(mark); };
    main.appendChild(del);

    if (hasNote) {
      const exp = iconBtn('chevron-down', 'expand', expanded ? 'Collapse' : 'Expand');
      exp.onclick = function () {
        if (expandedIds.has(mark.id)) expandedIds.delete(mark.id); else expandedIds.add(mark.id);
        render();
      };
      main.appendChild(exp);
    }

    li.appendChild(main);

    if (expanded) {
      const detail = document.createElement('div');
      detail.className = 'row-detail';
      const wrap = document.createElement('div');
      wrap.className = 'note-wrap';
      const ta = document.createElement('textarea');
      ta.className = 'note-input';
      ta.value = mark.note || '';
      ta.addEventListener('blur', async function () {
        if (ta.value === (mark.note || '')) return;
        mark.note = ta.value;
        await storage.setNote(mark.pageKey, mark.id, ta.value);
      });
      wrap.appendChild(ta);
      detail.appendChild(wrap);
      li.appendChild(detail);
    }

    return li;
  }

  function render() {
    renderBatchBar();
    const list = document.getElementById('list');
    const empty = document.getElementById('empty');
    list.innerHTML = '';
    const groups = marks.groupMarksByDomain(filteredData());
    empty.classList.toggle('hidden', groups.length > 0);
    for (const g of groups) {
      list.appendChild(domainHead(g));
      for (const p of g.pages) {
        list.appendChild(pageHead(p));
        for (const m of p.marks) list.appendChild(markRow(m));
      }
    }
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onExport() {
    const data = marks.buildExport(allData, Date.now());
    const d = new Date();
    const fn = 'readon-export-' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '.json';
    download(fn, JSON.stringify(data, null, 2));
  }

  function onImportFile(file) {
    const reader = new FileReader();
    reader.onload = async function () {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (e) { showToast('Import failed: invalid JSON'); return; }
      const pages = marks.normalizeImport(parsed);
      if (!pages) { showToast('Import failed: unrecognized format'); return; }
      const added = await storage.importMerge(pages);
      await reload();
      showToast('Imported ' + added + ' new mark' + (added === 1 ? '' : 's'));
    };
    reader.readAsText(file);
  }

  function mountStaticIcons() {
    document.getElementById('brand-icon').appendChild(icons.el('bookmark', 20));
    document.getElementById('import-icon').appendChild(icons.el('upload', 15));
    document.getElementById('export-icon').appendChild(icons.el('download', 15));
    document.getElementById('search-icon').appendChild(icons.el('search', 16));
    document.getElementById('empty-icon').appendChild(icons.el('bookmark-plus', 28));
  }

  function init() {
    mountStaticIcons();
    document.getElementById('search').addEventListener('input', function (e) {
      query = e.target.value;
      render();
    });
    document.getElementById('export-btn').onclick = onExport;
    const fileInput = document.getElementById('file-input');
    document.getElementById('import-btn').onclick = function () { fileInput.click(); };
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) onImportFile(fileInput.files[0]);
      fileInput.value = '';
    });
    reload();
  }

  init();
})();

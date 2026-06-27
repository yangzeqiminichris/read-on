(function () {
  'use strict';
  const { browser, storage, marks, positioning, time, icons } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;
  let pageMarkable = false;
  let view = 'page';
  const expandedIds = new Set();
  const collapsedDomains = new Set();
  const collapsedPages   = new Set();

  const UNREACHABLE_MSG = "Can't reach this page. Reload it and try again.";

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 1500);
  }

  function showRowToast(markId, text) {
    const row = document.querySelector('.mark-row[data-mark-id="' + markId + '"]');
    if (!row) return;
    const t = document.createElement('div');
    t.className = 'row-toast';
    t.textContent = text;
    row.appendChild(t);
    setTimeout(function () { t.remove(); }, 1500);
  }

  async function capture() {
    await browser.ensureContentScript(currentTabId);
    return browser.sendMessageToTab(currentTabId, { type: 'READON_CAPTURE' });
  }

  function makeIconButton(iconId, className, label) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn ' + className;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.appendChild(icons.el(iconId, 16));
    return btn;
  }

  async function jumpTo(mark) {
    if (pageMarkable && mark.pageKey === currentPageKey) {
      try {
        await browser.ensureContentScript(currentTabId);
        await browser.sendMessageToTab(currentTabId, { type: 'READON_SCROLL_TO', mark: mark });
        window.close();
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
    } else {
      await storage.setPendingJump(mark.pageKey, mark);
      await browser.navigateTab(currentTabId, mark.pageURL);
      window.close();
    }
  }

  // All Marks 里的跳转：在新标签页打开目标页，由其 content script 消费待跳转后定位。
  async function jumpToNewTab(mark) {
    await storage.setPendingJump(mark.pageKey, mark);
    await browser.openTab(mark.pageURL);
    // 新标签页获得焦点后弹窗会自动关闭，无需显式 close。
  }

  function buildDetail(mark) {
    const detail = document.createElement('div');
    detail.className = 'row-detail';

    const noteWrap = document.createElement('div');
    noteWrap.className = 'note-wrap';
    const note = document.createElement('textarea');
    note.className = 'note-input';
    note.placeholder = 'Add a note…';
    note.value = mark.note || '';
    note.addEventListener('blur', async function () {
      const value = note.value;
      if (value === (mark.note || '')) return;
      mark.note = value;
      await storage.setNote(currentPageKey, mark.id, value);
    });
    noteWrap.appendChild(note);
    detail.appendChild(noteWrap);

    const del = document.createElement('div');
    del.className = 'row-delete';

    async function doDelete() {
      await storage.deleteMark(currentPageKey, mark.id);
      expandedIds.delete(mark.id);
      await render();
    }

    function renderDeleteDefault() {
      del.innerHTML = '';
      const btn = makeIconButton('trash-2', 'delete', 'Delete this mark');
      btn.onclick = function () {
        if (mark.note && mark.note.trim()) renderDeleteConfirm();
        else doDelete();
      };
      del.appendChild(btn);
    }

    function renderDeleteConfirm() {
      del.innerHTML = '';
      const q = document.createElement('span');
      q.className = 'delete-q';
      q.textContent = 'Delete this mark?';
      const cancel = document.createElement('button');
      cancel.className = 'ghost-btn';
      cancel.textContent = 'Cancel';
      cancel.onclick = renderDeleteDefault;
      const confirm = document.createElement('button');
      confirm.className = 'danger-btn solid';
      confirm.textContent = 'Delete';
      confirm.onclick = doDelete;
      del.appendChild(q);
      del.appendChild(cancel);
      del.appendChild(confirm);
    }

    renderDeleteDefault();
    detail.appendChild(del);

    return detail;
  }

  function barEl(mark) {
    const pctValue = positioning.displayPercent(
      mark.scrollPosition, mark.viewportHeight, mark.contentHeight);
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
    return barRow;
  }

  function renderRow(mark, editing) {
    const li = document.createElement('li');
    li.className = 'mark-row';
    li.dataset.markId = mark.id;
    const expanded = expandedIds.has(mark.id);
    if (expanded) li.classList.add('expanded');

    const main = document.createElement('div');
    main.className = 'row-main';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const top = document.createElement('div');
    top.className = 'row-top';

    const timeEl = document.createElement('span');
    timeEl.className = 'time';
    timeEl.textContent = time.formatRelativeTime(mark.updatedAt, Date.now());

    if (editing) {
      const input = document.createElement('input');
      input.className = 'name-input';
      input.value = mark.name;

      let committed = false;
      async function commit() {
        if (committed) return;
        committed = true;
        document.removeEventListener('mousedown', onOutside, true);
        const name = input.value.trim() || mark.name;
        mark.name = name;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = name;
        if (input.parentNode) top.replaceChild(nameSpan, input);
        await storage.setMarkName(currentPageKey, mark.id, name);
      }
      function onOutside(e) { if (e.target !== input) commit(); }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === 'Escape') commit();
      });
      input.addEventListener('blur', commit);
      document.addEventListener('mousedown', onOutside, true);

      top.appendChild(input);
      top.appendChild(timeEl);
      setTimeout(function () { input.focus(); input.select(); }, 0);
    } else {
      const nameWrap = document.createElement('span');
      nameWrap.className = 'name-wrap';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = mark.name;
      nameWrap.appendChild(nameSpan);
      if (!expanded && mark.note) {
        const flag = document.createElement('span');
        flag.className = 'name-note-flag';
        flag.title = 'Has note';
        flag.appendChild(icons.el('align-left', 12));
        nameWrap.appendChild(flag);
      }
      top.appendChild(nameWrap);
      top.appendChild(timeEl);
    }
    meta.appendChild(top);
    meta.appendChild(barEl(mark));
    main.appendChild(meta);

    const jump = makeIconButton('play', 'jump', 'Jump to this mark');
    jump.onclick = function () { jumpTo(mark); };
    main.appendChild(jump);

    const upd = makeIconButton('rotate-cw', 'update', "Update this mark's position");
    upd.onclick = async function () {
      try {
        const snap = await capture();
        await storage.updateMarkPosition(currentPageKey, mark.id, snap, Date.now());
        await render();
        showRowToast(mark.id, 'Position updated');
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
    };
    main.appendChild(upd);

    const exp = makeIconButton('chevron-down', 'expand', expanded ? 'Collapse' : 'Expand');
    exp.onclick = async function () {
      if (expandedIds.has(mark.id)) expandedIds.delete(mark.id);
      else expandedIds.add(mark.id);
      await render();
    };
    main.appendChild(exp);

    li.appendChild(main);
    if (expanded) li.appendChild(buildDetail(mark));

    return li;
  }

  function allMarkRow(mark) {
    const li = document.createElement('li');
    li.className = 'mark-row';
    li.dataset.markId = mark.id;

    const main = document.createElement('div');
    main.className = 'row-main';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const top = document.createElement('div');
    top.className = 'row-top';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = mark.name;
    const timeEl = document.createElement('span');
    timeEl.className = 'time';
    timeEl.textContent = time.formatRelativeTime(mark.updatedAt, Date.now());
    top.appendChild(nameSpan);
    top.appendChild(timeEl);
    meta.appendChild(top);
    meta.appendChild(barEl(mark));

    if (mark.note && mark.note.trim()) {
      const prev = document.createElement('div');
      prev.className = 'note-preview';
      prev.appendChild(icons.el('align-left', 12));
      const txt = document.createElement('span');
      txt.textContent = mark.note.split('\n')[0];
      prev.appendChild(txt);
      meta.appendChild(prev);
    }

    main.appendChild(meta);

    const jump = makeIconButton('play', 'jump', 'Jump to this mark (new tab)');
    jump.onclick = function () { jumpToNewTab(mark); };
    main.appendChild(jump);

    li.appendChild(main);
    return li;
  }

  function toolbarEl(domains) {
    const li = document.createElement('li');
    li.className = 'all-toolbar';

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'toolbar-btn';
    collapseBtn.textContent = 'Collapse All';
    collapseBtn.onclick = async function () {
      for (const d of domains) collapsedDomains.add(d.domain);
      await render();
    };

    const expandBtn = document.createElement('button');
    expandBtn.className = 'toolbar-btn';
    expandBtn.textContent = 'Expand All';
    expandBtn.onclick = async function () {
      collapsedDomains.clear();
      collapsedPages.clear();
      await render();
    };

    li.appendChild(collapseBtn);
    li.appendChild(expandBtn);
    return li;
  }

  function domainHeadEl(d) {
    const li = document.createElement('li');
    li.className = 'domain-head';
    if (collapsedDomains.has(d.domain)) li.classList.add('collapsed');

    const chevron = icons.el('chevron-down', 14);
    chevron.classList.add('domain-chevron');
    li.appendChild(chevron);

    const label = document.createElement('span');
    label.className = 'domain-label';
    label.textContent = d.domain;

    const count = document.createElement('span');
    count.className = 'domain-count';
    count.textContent = d.markCount + (d.markCount === 1 ? ' mark' : ' marks');

    li.appendChild(label);
    li.appendChild(count);

    li.onclick = async function () {
      if (collapsedDomains.has(d.domain)) collapsedDomains.delete(d.domain);
      else collapsedDomains.add(d.domain);
      await render();
    };
    return li;
  }

  function pageHeadEl(g, aliases) {
    const li = document.createElement('li');
    li.className = 'page-head';
    if (collapsedPages.has(g.pageKey)) li.classList.add('collapsed');

    li.appendChild(icons.el('globe', 13));

    const box = document.createElement('div');
    box.className = 'group-meta';
    const aliasVal = (aliases && aliases.pages[g.pageKey] || '').trim();
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = aliasVal || g.pageTitle || g.pageKey;
    const u = document.createElement('div');
    u.className = 'group-url';
    u.textContent = aliasVal
      ? (g.pageTitle ? g.pageTitle + ' · ' + g.pageKey : g.pageKey)
      : g.pageKey;
    box.appendChild(t);
    box.appendChild(u);
    li.appendChild(box);

    const chevron = icons.el('chevron-down', 13);
    chevron.classList.add('page-chevron');
    li.appendChild(chevron);

    li.onclick = async function () {
      if (collapsedPages.has(g.pageKey)) collapsedPages.delete(g.pageKey);
      else collapsedPages.add(g.pageKey);
      await render();
    };
    return li;
  }

  async function renderPage(list, empty, editId) {
    const pageData = await storage.getPageData(currentPageKey);
    list.innerHTML = '';
    empty.classList.toggle('hidden', pageData.marks.length > 0);
    for (const mark of pageData.marks) {
      list.appendChild(renderRow(mark, mark.id === editId));
    }
  }

  async function renderAll(list, empty) {
    const allData = await storage.getAllPageData();
    const aliases = await storage.getAliases();
    const domains = marks.groupMarksByDomain(allData);
    list.innerHTML = '';
    empty.classList.toggle('hidden', domains.length > 0);
    if (domains.length > 0) list.appendChild(toolbarEl(domains));
    for (const d of domains) {
      list.appendChild(domainHeadEl(d));
      if (collapsedDomains.has(d.domain)) continue;
      for (const g of d.pages) {
        list.appendChild(pageHeadEl(g, aliases));
        if (collapsedPages.has(g.pageKey)) continue;
        for (const mark of g.marks) list.appendChild(allMarkRow(mark));
      }
    }
  }

  function updateToggleUI() {
    document.getElementById('all-btn').classList.toggle('active', view === 'all');
  }

  async function render(editId) {
    updateToggleUI();
    const list = document.getElementById('mark-list');
    const empty = document.getElementById('empty');
    const restricted = document.getElementById('restricted');
    document.getElementById('all-footer').classList.toggle('hidden', view !== 'all');
    if (view === 'all') {
      restricted.classList.add('hidden');
      await renderAll(list, empty);
    } else if (!pageMarkable) {
      list.innerHTML = '';
      empty.classList.add('hidden');
      restricted.classList.remove('hidden');
    } else {
      restricted.classList.add('hidden');
      await renderPage(list, empty, editId);
    }
  }

  async function onMark() {
    let snap;
    try {
      snap = await capture();
    } catch (e) {
      showToast(UNREACHABLE_MSG);
      return;
    }
    const mark = await storage.saveMark(currentPageKey, {
      snapshot: snap, id: crypto.randomUUID(), now: Date.now(),
    });
    view = 'page';
    await render(mark.id);
  }

  function mountStaticIcons() {
    document.getElementById('brand-icon').appendChild(icons.el('bookmark', 17));
    document.getElementById('mark-icon').appendChild(icons.el('plus', 14));
    document.getElementById('all-icon').appendChild(icons.el('list', 14));
    document.getElementById('empty-icon').appendChild(icons.el('bookmark-plus', 28));
    document.getElementById('manager-icon').appendChild(icons.el('list', 14));
  }

  async function init() {
    mountStaticIcons();
    document.getElementById('manager-btn').onclick = function () { browser.openOptionsPage(); };
    document.getElementById('all-btn').onclick = function () {
      view = (view === 'all') ? 'page' : 'all';
      if (view === 'all') { collapsedDomains.clear(); collapsedPages.clear(); }
      render();
    };
    const tab = await browser.getActiveTab();
    currentTabId = tab ? tab.id : null;
    if (tab && /^https?:/.test(tab.url || '')) {
      pageMarkable = true;
      currentPageKey = marks.pageKeyFromURL(tab.url);
      document.getElementById('mark-btn').onclick = onMark;
    } else {
      pageMarkable = false;
      document.getElementById('mark-btn').disabled = true;
    }
    await render();
  }

  init();
})();

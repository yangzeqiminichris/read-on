(function () {
  'use strict';
  const { browser, storage, marks, positioning, time, icons } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;
  const expandedIds = new Set();

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

  function buildDetail(mark) {
    const detail = document.createElement('div');
    detail.className = 'row-detail';

    const metaLine = document.createElement('div');
    metaLine.className = 'detail-meta';
    let metaText = 'Created ' + time.formatDateTime(mark.createdAt, Date.now());
    if (mark.updatedAt !== mark.createdAt) {
      metaText += ' · Updated ' + time.formatRelativeTime(mark.updatedAt, Date.now());
    }
    metaLine.textContent = metaText;
    detail.appendChild(metaLine);

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
    detail.appendChild(note);

    const del = document.createElement('div');
    del.className = 'row-delete';

    function renderDeleteDefault() {
      del.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'danger-btn ghost';
      btn.appendChild(icons.el('trash-2', 14));
      btn.appendChild(document.createTextNode('Delete'));
      btn.onclick = renderDeleteConfirm;
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
      confirm.onclick = async function () {
        await storage.deleteMark(currentPageKey, mark.id);
        expandedIds.delete(mark.id);
        await render();
      };
      del.appendChild(q);
      del.appendChild(cancel);
      del.appendChild(confirm);
    }

    renderDeleteDefault();
    detail.appendChild(del);

    return detail;
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
    timeEl.textContent = time.formatRelativeTime(mark.createdAt, Date.now());

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
        flag.appendChild(icons.el('square-pen', 12));
        nameWrap.appendChild(flag);
      }
      top.appendChild(nameWrap);
      top.appendChild(timeEl);
    }
    meta.appendChild(top);

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
    meta.appendChild(barRow);

    main.appendChild(meta);

    const jump = makeIconButton('play', 'jump', 'Jump to this mark');
    jump.onclick = async function () {
      try {
        await browser.ensureContentScript(currentTabId);
        await browser.sendMessageToTab(currentTabId, { type: 'READON_SCROLL_TO', mark: mark });
        window.close();
      } catch (e) {
        showToast(UNREACHABLE_MSG);
      }
    };
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

  async function render(editId) {
    const pageData = await storage.getPageData(currentPageKey);
    const list = document.getElementById('mark-list');
    list.innerHTML = '';
    document.getElementById('empty').classList.toggle('hidden', pageData.marks.length > 0);
    for (const mark of pageData.marks) {
      list.appendChild(renderRow(mark, mark.id === editId));
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
    await render(mark.id);
  }

  function mountStaticIcons() {
    document.getElementById('brand-icon').appendChild(icons.el('bookmark', 17));
    document.getElementById('mark-icon').appendChild(icons.el('plus', 14));
    document.getElementById('empty-icon').appendChild(icons.el('bookmark-plus', 28));
  }

  async function init() {
    mountStaticIcons();
    const tab = await browser.getActiveTab();
    if (!tab || !/^https?:/.test(tab.url || '')) {
      document.getElementById('restricted').classList.remove('hidden');
      document.getElementById('mark-btn').disabled = true;
      return;
    }
    currentTabId = tab.id;
    currentPageKey = marks.pageKeyFromURL(tab.url);
    document.getElementById('mark-btn').onclick = onMark;
    await render();
  }

  init();
})();

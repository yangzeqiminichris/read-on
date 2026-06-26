(function () {
  'use strict';
  const { browser, storage, marks, positioning } = window.ReadOn;

  let currentPageKey = null;
  let currentTabId = null;

  function showToast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 1500);
  }

  async function capture() {
    return browser.sendMessageToTab(currentTabId, { type: 'READON_CAPTURE' });
  }

  function renderRow(mark, editing) {
    const li = document.createElement('li');

    const meta = document.createElement('div');
    meta.className = 'meta';

    if (editing) {
      const input = document.createElement('input');
      input.className = 'name-input';
      input.value = mark.name;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') input.blur();
      });
      input.addEventListener('blur', async function () {
        const name = input.value.trim() || mark.name;
        await storage.setMarkName(currentPageKey, mark.id, name);
        await render();
      });
      meta.appendChild(input);
      setTimeout(function () { input.focus(); input.select(); }, 0);
    } else {
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = mark.name;
      meta.appendChild(name);
    }

    const pct = document.createElement('div');
    pct.className = 'pct';
    pct.textContent =
      positioning.displayPercent(mark.scrollPosition, mark.viewportHeight, mark.contentHeight) +
      '% scrolled';
    meta.appendChild(pct);
    li.appendChild(meta);

    const jump = document.createElement('button');
    jump.textContent = '▶';
    jump.title = 'Jump to this mark';
    jump.onclick = async function () {
      await browser.sendMessageToTab(currentTabId, { type: 'READON_SCROLL_TO', mark: mark });
      window.close();
    };
    li.appendChild(jump);

    const upd = document.createElement('button');
    upd.textContent = '⟳';
    upd.title = "Update this mark's position";
    upd.onclick = async function () {
      const snap = await capture();
      await storage.updateMarkPosition(currentPageKey, mark.id, snap, Date.now());
      await render();
      showToast('Position updated');
    };
    li.appendChild(upd);

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
    const snap = await capture();
    const mark = await storage.saveMark(currentPageKey, {
      snapshot: snap, id: crypto.randomUUID(), now: Date.now(),
    });
    await render(mark.id); // 渲染时让新行进入改名编辑态
  }

  async function init() {
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

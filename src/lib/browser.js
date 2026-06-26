(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReadOn = root.ReadOn || {};
    root.ReadOn.browser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // MV3 (Chrome 88+) 的 chrome.storage / chrome.tabs 原生返回 Promise。
  async function storageGet(keys) {
    return chrome.storage.local.get(keys);
  }

  async function storageSet(obj) {
    return chrome.storage.local.set(obj);
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function sendMessageToTab(tabId, message) {
    return chrome.tabs.sendMessage(tabId, message);
  }

  // 声明式注入只对扩展安装/刷新之后才加载的页面生效，旧标签页里没有
  // content script（sendMessage 会报 "Receiving end does not exist"）。
  // 先 ping，没回应就用 chrome.scripting 按需注入，自愈这些旧标签页。
  // ping 优先可避免对已注入页面重复注入（导致重复监听）。
  async function ensureContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'READON_PING' });
      return;
    } catch (e) {
      // 无接收端，往下走注入流程。
    }
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/lib/positioning.js', 'src/content.js'],
    });
  }

  return { storageGet, storageSet, getActiveTab, sendMessageToTab, ensureContentScript };
});

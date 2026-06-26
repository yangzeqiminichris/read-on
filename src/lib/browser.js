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

  return { storageGet, storageSet, getActiveTab, sendMessageToTab };
});

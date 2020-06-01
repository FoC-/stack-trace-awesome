chrome.contextMenus.onClicked.addListener((info, { id }) => chrome.tabs.sendMessage(id, { action: 'beautify' }));
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.create({ title: 'Beautify stack trace', contexts: ['page'], id: 'sta_beautifier' }));

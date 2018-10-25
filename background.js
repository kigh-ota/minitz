chrome.runtime.onMessage.addListener(function(message, callback) {
  console.log("Background script received: ", message);
  if (message.type === 'MINITZ_DESKTOP_NTF_REQUEST') {
    chrome.notifications.create({
      type: 'basic',
      message: message.body,
      title: 'Minitz for kintone',
      iconUrl: 'icon.png',
    });
  }
});


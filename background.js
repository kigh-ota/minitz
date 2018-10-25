chrome.runtime.onMessage.addListener(function(message, callback) {
  console.log("Background script received: ", message);
  chrome.notifications.create({
    type: 'basic',
    message: 'Hello!',
    title: 'TITLE',
    iconUrl: 'icon.png',
  });
  return true;
});


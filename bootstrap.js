const scripts = chrome.runtime.getManifest().web_accessible_resources;

const next = () => {
  const script = scripts.shift();
  if (!script) {
    return;
  }

  const s = document.createElement("script");
  s.setAttribute("src", chrome.extension.getURL(script));
  s.addEventListener("load", next);
  document.documentElement.appendChild(s);
};

next();

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves
  if (event.source != window)
    return;

  if (event.data.type && (event.data.type == 'MINITZ_DESKTOP_NTF_REQUEST')) {
    console.log('Content script received', event.data);
    chrome.runtime.sendMessage(event.data);
  }
}, false);


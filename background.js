const MENU_ID = "download-canva-media";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Download media",
    contexts: ["image", "video"],
    documentUrlPatterns: ["https://*.canva.com/*"]
  });
});

function guessExtension(url) {
  const upper = url.toUpperCase();
  if (upper.includes("FORMAT:MP4")) return "mp4";
  if (upper.includes("FORMAT:WEBM")) return "webm";
  if (upper.includes("FORMAT:MOV")) return "mov";
  if (upper.includes("FORMAT:PNG")) return "png";
  if (upper.includes("FORMAT:JPG") || upper.includes("FORMAT:JPEG")) return "jpg";
  if (upper.includes("FORMAT:WEBP")) return "webp";

  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const last = pathname.split("/").pop() || "";
    const dot = last.lastIndexOf(".");
    if (dot !== -1 && dot < last.length - 1) {
      return last.slice(dot + 1).toLowerCase();
    }
  } catch (_) {
    // ignore
  }
  return "bin";
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isBlobUrl(url) {
  return typeof url === "string" && url.startsWith("blob:");
}

function buildFilename(url, type = "media", name = "") {
  if (name && name.trim()) {
    return sanitizeFilename(name.trim());
  }

  const ext = guessExtension(url);
  const base = type === "video" ? "canva-video" : type === "image" ? "canva-image" : "canva-media";
  return sanitizeFilename(`${base}.${ext}`);
}

function downloadUrl(url, type = "media", name = "") {
  const filename = buildFilename(url, type, name);

  chrome.downloads.download({
    url,
    filename,
    conflictAction: "uniquify",
    saveAs: true
  });
}

function downloadFromPage(tabId, url, type = "media", name = "", sendResponse) {
  if (!tabId) {
    if (sendResponse) {
      sendResponse({
        ok: false,
        error: "Canva tab not found."
      });
    }
    return;
  }

  chrome.tabs.sendMessage(
    tabId,
    {
      type: "pageDownload",
      url,
      mediaType: type,
      name
    },
    (response) => {
      if (!sendResponse) return;

      if (chrome.runtime.lastError) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      sendResponse(response || { ok: false, error: "Page download failed." });
    }
  );
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!info.srcUrl) return;

  if (isBlobUrl(info.srcUrl)) {
    downloadFromPage(tab && tab.id, info.srcUrl, info.mediaType || "media");
    return;
  }

  downloadUrl(info.srcUrl, info.mediaType || "media");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "download" || !msg.url) return;

  if (msg.downloadStrategy === "page" || isBlobUrl(msg.url)) {
    downloadFromPage(msg.tabId, msg.url, msg.mediaType || "media", msg.name || "", sendResponse);
    return true;
  }

  downloadUrl(msg.url, msg.mediaType || "media", msg.name || "");
  sendResponse({ ok: true });
  return true;
});

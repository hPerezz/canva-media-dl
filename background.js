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

function downloadUrl(url) {
  const ext = guessExtension(url);
  const base = "canva-media";
  const filename = sanitizeFilename(`${base}.${ext}`);

  chrome.downloads.download({
    url,
    filename,
    conflictAction: "uniquify",
    saveAs: true
  });
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!info.srcUrl) return;
  downloadUrl(info.srcUrl);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "download" || !msg.url) return;
  downloadUrl(msg.url);
});

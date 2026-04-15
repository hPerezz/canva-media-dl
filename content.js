const PAGE_REQUEST_TYPE = "__canva_media_downloader_request__";
const PAGE_RESPONSE_TYPE = "__canva_media_downloader_response__";

function isDirectCanvaMediaUrl(url) {
  return typeof url === "string" && url.includes("media.canva.com");
}

function isCanvaBlobUrl(url) {
  return typeof url === "string" && url.startsWith("blob:https://www.canva.com/");
}

function guessExtension(url, name = "") {
  const upper = `${name} ${url}`.toUpperCase();
  if (upper.includes("FORMAT:MP4") || upper.includes(".MP4")) return "mp4";
  if (upper.includes("FORMAT:WEBM") || upper.includes(".WEBM")) return "webm";
  if (upper.includes("FORMAT:MOV") || upper.includes(".MOV")) return "mov";
  if (upper.includes("FORMAT:PNG") || upper.includes(".PNG")) return "png";
  if (upper.includes("FORMAT:JPG") || upper.includes("FORMAT:JPEG") || upper.includes(".JPG") || upper.includes(".JPEG")) {
    return "jpg";
  }
  if (upper.includes("FORMAT:WEBP") || upper.includes(".WEBP")) return "webp";

  try {
    const pathname = new URL(url).pathname;
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

function buildFilename(type, url, name = "") {
  if (name && name.trim()) {
    return sanitizeFilename(name.trim());
  }

  const ext = guessExtension(url, name);
  const base = type === "video" ? "canva-video" : type === "image" ? "canva-image" : "canva-media";
  return sanitizeFilename(`${base}.${ext}`);
}

function readMediaName(element, fallback = "") {
  if (!element) return fallback;

  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.getAttribute("alt") ||
    fallback
  );
}

function addMedia(items, seen, media) {
  if (!media || !media.url) return;

  const key = `${media.type}:${media.url}`;
  if (seen.has(key)) return;

  seen.add(key);
  items.push(media);
}

function createImageItem(img) {
  const url = img.currentSrc || img.src;
  if (!isDirectCanvaMediaUrl(url)) return null;

  return {
    url,
    type: "image",
    name: readMediaName(img, ""),
    downloadStrategy: "direct"
  };
}

function createVideoItem(url, video) {
  if (!url) return null;

  const name = readMediaName(video, "");
  const poster = video && isDirectCanvaMediaUrl(video.poster) ? video.poster : "";

  if (isCanvaBlobUrl(url)) {
    return {
      url,
      type: "video",
      name,
      previewUrl: poster,
      downloadStrategy: "page"
    };
  }

  if (!isDirectCanvaMediaUrl(url)) return null;

  return {
    url,
    type: "video",
    name,
    previewUrl: poster,
    downloadStrategy: "direct"
  };
}

function getCanvaMedia() {
  const items = [];
  const seen = new Set();

  const imgs = document.querySelectorAll("img");
  for (const img of imgs) {
    addMedia(items, seen, createImageItem(img));
  }

  const videos = document.querySelectorAll("video");
  for (const video of videos) {
    addMedia(items, seen, createVideoItem(video.currentSrc || video.src, video));
  }

  const sources = document.querySelectorAll("video source");
  for (const source of sources) {
    addMedia(items, seen, createVideoItem(source.src, source.closest("video")));
  }

  return items;
}

function findVideoNameByUrl(url) {
  const videos = document.querySelectorAll("video");
  for (const video of videos) {
    if (video.currentSrc === url || video.src === url) {
      return readMediaName(video, "");
    }
  }

  const sources = document.querySelectorAll("video source");
  for (const source of sources) {
    if (source.src === url) {
      return readMediaName(source.closest("video"), "");
    }
  }

  return "";
}

function requestPageAction(action, payload, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const requestId = `canva-media-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({
        ok: false,
        error: "Timed out while waiting for page hook."
      });
    }, timeoutMs);

    function onMessage(event) {
      if (event.source !== window) return;

      const data = event.data;
      if (!data || data.type !== PAGE_RESPONSE_TYPE || data.requestId !== requestId) return;

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(data);
    }

    window.addEventListener("message", onMessage);
    window.postMessage(
      {
        type: PAGE_REQUEST_TYPE,
        requestId,
        action,
        ...payload
      },
      "*"
    );
  });
}

async function requestPageDownload(url, mediaType = "media", name = "") {
  const filename = buildFilename(mediaType, url, name || findVideoNameByUrl(url));
  const ping = await requestPageAction("ping", {}, 1500);

  if (!ping || ping.ok === false) {
    return {
      ok: false,
      error: "Page hook not available. Reload the extension in chrome://extensions and reload the Canva tab."
    };
  }

  return requestPageAction("downloadBlob", {
    url,
    mediaType,
    name: filename
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "getMedia") {
    sendResponse({ media: getCanvaMedia() });
    return true;
  }

  if (msg.type === "pageDownload" && msg.url) {
    Promise.resolve(requestPageDownload(msg.url, msg.mediaType || "media", msg.name || ""))
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "download failed"
        });
      });

    return true;
  }
});

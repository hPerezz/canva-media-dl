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

function download(url) {
  const ext = guessExtension(url);
  const filename = sanitizeFilename(`canva-media.${ext}`);
  chrome.downloads.download({
    url,
    filename,
    conflictAction: "uniquify",
    saveAs: true
  });
}

function isVideo(url) {
  const upper = url.toUpperCase();
  if (upper.includes("FORMAT:MP4")) return true;
  if (upper.includes("FORMAT:WEBM")) return true;
  if (upper.includes("FORMAT:MOV")) return true;

  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();
    return pathname.endsWith(".mp4") || pathname.endsWith(".webm") || pathname.endsWith(".mov");
  } catch (_) {
    return false;
  }
}

function render(urls) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  grid.innerHTML = "";
  if (!urls || urls.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  for (const url of urls) {
    const card = document.createElement("div");
    card.className = "card";
    card.title = url;

    if (isVideo(url)) {
      const video = document.createElement("video");
      video.className = "thumb";
      video.src = url;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      card.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = url;
      card.appendChild(img);
    }
    card.addEventListener("click", () => download(url));

    grid.appendChild(card);
  }
}

function loadMedia() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      render([]);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "getMedia" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        render([]);
        return;
      }
      render(response.urls || []);
    });
  });
}

loadMedia();

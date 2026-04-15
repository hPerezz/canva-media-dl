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

let activeTabId = null;

function download(item) {
  if (!activeTabId) return;

  chrome.runtime.sendMessage(
    {
      type: "download",
      tabId: activeTabId,
      url: item.url,
      mediaType: item.type || "media",
      name: item.name || "",
      downloadStrategy: item.downloadStrategy || "direct"
    },
    (response) => {
      if (chrome.runtime.lastError) {
        window.alert(chrome.runtime.lastError.message);
        return;
      }

      if (response && response.ok === false && !response.cancelled) {
        window.alert(response.error || "Falha ao baixar a midia.");
      }
    }
  );
}

function render(mediaItems) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  grid.innerHTML = "";
  if (!mediaItems || mediaItems.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  for (const item of mediaItems) {
    const mediaType = item.type || "media";
    const url = item.url;
    if (!url) continue;

    const card = document.createElement("div");
    card.className = "card";
    card.title = url;

    if (mediaType === "video" && item.downloadStrategy !== "page") {
      const video = document.createElement("video");
      video.className = "thumb";
      video.src = url;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.autoplay = true;
      card.appendChild(video);
    } else if (item.previewUrl) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = item.previewUrl;
      card.appendChild(img);
    } else if (mediaType === "video") {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb placeholder";

      const label = document.createElement("strong");
      label.textContent = "VIDEO";
      placeholder.appendChild(label);

      const detail = document.createElement("span");
      detail.textContent = item.name || "Blob video";
      placeholder.appendChild(detail);

      card.appendChild(placeholder);
    } else {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = url;
      card.appendChild(img);
    }

    if (item.name) {
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.name;
      card.appendChild(name);
    }

    card.addEventListener("click", () => download(item));

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

    activeTabId = tab.id;

    chrome.tabs.sendMessage(tab.id, { type: "getMedia" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        render([]);
        return;
      }
      render(response.media || []);
    });
  });
}

loadMedia();

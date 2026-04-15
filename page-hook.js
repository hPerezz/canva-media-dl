(() => {
  if (window.__canvaMediaDownloaderPageHookInstalled) return;
  window.__canvaMediaDownloaderPageHookInstalled = true;

  const REQUEST_TYPE = "__canva_media_downloader_request__";
  const RESPONSE_TYPE = "__canva_media_downloader_response__";
  const mediaByUrl = new Map();
  const mediaSourceByObject = new WeakMap();
  const sourceBufferToRecord = new WeakMap();

  function guessExtension(url, name) {
    const upper = `${String(name || "")} ${String(url || "")}`.toUpperCase();
    if (upper.includes("FORMAT:MP4") || upper.includes(".MP4")) return "mp4";
    if (upper.includes("FORMAT:WEBM") || upper.includes(".WEBM")) return "webm";
    if (upper.includes("FORMAT:MOV") || upper.includes(".MOV")) return "mov";
    if (upper.includes("FORMAT:PNG") || upper.includes(".PNG")) return "png";
    if (
      upper.includes("FORMAT:JPG") ||
      upper.includes("FORMAT:JPEG") ||
      upper.includes(".JPG") ||
      upper.includes(".JPEG")
    ) {
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
    return String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function buildFilename(type, url, name) {
    if (name && String(name).trim()) {
      return sanitizeFilename(String(name).trim());
    }

    const ext = guessExtension(url, name);
    const base = type === "video" ? "canva-video" : type === "image" ? "canva-image" : "canva-media";
    return sanitizeFilename(`${base}.${ext}`);
  }

  function cloneChunk(buffer) {
    if (buffer instanceof ArrayBuffer) {
      return buffer.slice(0);
    }

    if (ArrayBuffer.isView(buffer)) {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }

    return null;
  }

  function createMediaSourceRecord() {
    return {
      kind: "mediasource",
      mimeTypes: [],
      chunks: [],
      totalBytes: 0
    };
  }

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function createObjectURLPatched(object) {
    const url = originalCreateObjectURL(object);

    try {
      if (object instanceof Blob) {
        mediaByUrl.set(url, {
          kind: "blob",
          blob: object,
          mimeType: object.type || "",
          size: object.size || 0
        });
      } else if (typeof MediaSource !== "undefined" && object instanceof MediaSource) {
        let record = mediaSourceByObject.get(object);
        if (!record) {
          record = createMediaSourceRecord();
          mediaSourceByObject.set(object, record);
        }
        mediaByUrl.set(url, record);
      }
    } catch (_) {
      // ignore
    }

    return url;
  };

  if (typeof MediaSource !== "undefined") {
    const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function addSourceBufferPatched(mimeType) {
      const sourceBuffer = originalAddSourceBuffer.apply(this, arguments);

      try {
        let record = mediaSourceByObject.get(this);
        if (!record) {
          record = createMediaSourceRecord();
          mediaSourceByObject.set(this, record);
        }

        if (mimeType && !record.mimeTypes.includes(mimeType)) {
          record.mimeTypes.push(mimeType);
        }

        sourceBufferToRecord.set(sourceBuffer, record);
      } catch (_) {
        // ignore
      }

      return sourceBuffer;
    };
  }

  if (typeof SourceBuffer !== "undefined") {
    const originalAppendBuffer = SourceBuffer.prototype.appendBuffer;
    SourceBuffer.prototype.appendBuffer = function appendBufferPatched(buffer) {
      try {
        const record = sourceBufferToRecord.get(this);
        const chunk = cloneChunk(buffer);

        if (record && chunk && chunk.byteLength) {
          record.chunks.push(chunk);
          record.totalBytes += chunk.byteLength;
        }
      } catch (_) {
        // ignore
      }

      return originalAppendBuffer.apply(this, arguments);
    };
  }

  function downloadBlob(blob, filename) {
    const objectUrl = originalCreateObjectURL(blob);

    try {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.rel = "noopener";
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }

    return {
      ok: true,
      filename,
      size: blob.size || 0
    };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (!data || data.type !== REQUEST_TYPE || !data.requestId) return;

    const respond = (payload) => {
      window.postMessage(
        {
          type: RESPONSE_TYPE,
          requestId: data.requestId,
          ...payload
        },
        "*"
      );
    };

    try {
      if (data.action === "ping") {
        respond({ ok: true, ready: true });
        return;
      }

      if (data.action !== "downloadBlob") {
        respond({ ok: false, error: "unknown action" });
        return;
      }

      const record = mediaByUrl.get(data.url);
      const filename = buildFilename(data.mediaType || "media", data.url, data.name || "");

      if (!record) {
        respond({
          ok: false,
          error: "Video source not captured. Reload the Canva page and play the video once before downloading."
        });
        return;
      }

      if (record.kind === "blob") {
        respond(downloadBlob(record.blob, filename));
        return;
      }

      if (record.kind === "mediasource") {
        if (!record.totalBytes) {
          respond({
            ok: false,
            error: "Video data is not available yet. Play the video once and try again."
          });
          return;
        }

        const mimeType = (record.mimeTypes[0] || "video/mp4").split(";")[0] || "video/mp4";
        const blob = new Blob(record.chunks, { type: mimeType });
        respond({
          ...downloadBlob(blob, filename),
          method: "mediasource"
        });
        return;
      }

      respond({ ok: false, error: "unsupported media source" });
    } catch (error) {
      respond({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
})();

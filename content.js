function getCanvaMediaUrls() {
  const urls = new Set();
  const imgs = document.querySelectorAll('img[src*="media.canva.com"]');
  for (const img of imgs) {
    if (img.src) urls.add(img.src);
  }
  const videos = document.querySelectorAll('video[src*="media.canva.com"]');
  for (const video of videos) {
    if (video.src) urls.add(video.src);
  }
  const sources = document.querySelectorAll('video source[src*="media.canva.com"]');
  for (const source of sources) {
    if (source.src) urls.add(source.src);
  }
  return Array.from(urls);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "getMedia") {
    sendResponse({ urls: getCanvaMediaUrls() });
    return true;
  }
});

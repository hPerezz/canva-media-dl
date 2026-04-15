# Canva Media Downloader

A lightweight Chrome extension to download images and videos you have access to from Canva pages.

## Why
Canva does not always provide a direct way to download every image visible inside a design page (outside of the standard export flow). This extension surfaces media URLs on the current Canva page and lets you download them.

## Features
- Lists Canva images and videos found on the current tab
- One-click download from the popup for both images and videos
- Right-click context menu download on Canva pages
- Supports Canva videos that are rendered as `blob:` sources inside the editor

## Installation (Chrome)
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select this folder:
   - `/Users/perez/Documents/Code/canva-image-downloader`

## Usage
1. Open a Canva page with your design.
2. Click the extension icon.
3. Click any image or video thumbnail to download the file.

Optional:
- Right-click a media item on Canva and select the download option.

## Video Tutorial
Use this flow when the Canva video appears in the popup as `VIDEO` with a name such as `IMG_9543.mov`:

1. Reload the extension in `chrome://extensions`.
2. Reload the Canva tab completely.
3. Open the design and play the video at least once inside Canva.
4. Open the extension popup.
5. Click the video card to save the file.

If the popup shows an error:
- Reload the extension again.
- Reload the Canva tab again.
- Play the video once more before clicking the card.

## Notes
- This extension grabs media URLs already loaded in your browser.
- Filenames are auto-generated; Chrome will prompt you to choose where to save.

## Disclaimer
You are solely responsible for how you use this tool. By using it, you agree that any risk, legal exposure, or violation of third-party terms is your responsibility and not the author’s. If you are unsure whether your use is permitted, do not use this tool.

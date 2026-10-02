# Continue Watching: Resume Any Video

A Chrome extension that tracks how far you have watched a video and offers to resume from the last saved timestamp.

## Features
- Watches any HTML5 video on any site
- Saves progress per page and per video key
- Prompts to resume when you come back
- Lets you pause tracking for a site
- Searchable saved history from the popup
- Clear all saved history with confirmation

## Installation
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select this project folder.

## Files
- `manifest.json` — Chrome extension manifest
- `content.js` — video detection, progress saving, resume prompt
- `popup.html` / `popup.css` / `popup.js` — popup UI for history and settings

## Notes
- The extension saves timestamps in `chrome.storage.local`.
- The popup does not include custom icon PNG assets by default; add your own `icons` files if you want branded launcher icons before publishing.

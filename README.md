# Continue Watching: Resume Any Video

A Chrome extension that remembers where you left off in a video and offers to resume from that timestamp when you return.

## Why it exists
Watching long-form video content across multiple sites often means losing your place. This extension makes it easy to continue from where you left off without manually scrubbing through the timeline.

## Features
- Tracks HTML5 video progress on supported pages
- Saves resume position per page and per video
- Shows a non-intrusive banner asking whether to continue
- Lets users pause tracking for a site
- Includes a popup with search, history, and cleanup tools
- Works with any site that uses standard HTML5 video elements

## Demo
A quick use flow:
1. Open any video page.
2. Watch for a while.
3. Leave the page.
4. Return and the extension asks whether to resume from the saved time.

## Screenshots
Add screenshots here once you have them.

## Installation
1. Clone or download this repository.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select the folder containing this project.

## Project structure
- `manifest.json` — Chrome extension manifest
- `content.js` — logic for detecting video playback and saving timestamps
- `popup.html` — popup UI shell
- `popup.css` — popup styling
- `popup.js` — popup behavior and saved history management
- `README.md` — project documentation
- `LICENSE` — MIT license

## Privacy note
The extension stores timestamps locally in Chrome storage. It does not transmit your watch history to a remote server.

## Roadmap
- Support more advanced detection for embedded players
- Add a cleaner onboarding UI
- Improve site filtering and resumption behavior
- Add optional export/import for saved history
- Publish to the Chrome Web Store

## Contributing
Contributions are welcome. Feel free to open an issue or submit a pull request.

## License
This project is licensed under the [MIT License](LICENSE).

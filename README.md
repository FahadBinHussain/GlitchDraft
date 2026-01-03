# Saved Messages

<img src="https://wakapi-qt1b.onrender.com/api/badge/fahad/interval:any/project:messenger-utils" 
     alt="Wakapi Time Tracking" 
     title="Spent more than that amount of time spent on this project">

A userscript that allows you to save draft messages, including images, for specific Facebook Messenger chat threads and send them later. This works like a personal note system that's contextual to each chat conversation.

## Features

- Save different messages for different chat threads (based on URL)
- Messages are saved per chat thread (identified by URL)
- Easily access and use saved messages with a single click
- Draggable interface that stays out of the way
- Works with end-to-end encrypted chats
- Keyboard shortcuts for faster workflow
- Timestamps to track when messages were saved
- Messages sorted with newest first
- Copy to clipboard functionality as a reliable fallback option
- Import/export functionality for backup and transfer between browsers
- Debug mode for troubleshooting
- Advanced text insertion methods for Facebook's Lexical editor

## Installation

1. Install a userscript manager extension for your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (recommended)
   - [Violentmonkey](https://violentmonkey.github.io/)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox only)

2. Install the userscript:
   - Click on the userscript manager icon in your browser
   - Select "Create a new script" or "Add new script"
   - Copy and paste the entire content of the `messenger-saved-messages.user.js` file
   - Save the script

## How to Use

1. Navigate to any supported messaging platform (messenger.com, facebook.com/messages)
2. Click the 📝 (notepad) button that appears in the bottom right corner of the page (or press `Alt+M`)
3. Type your message and paste images directly into the text box
4. Click the "+" button (or press `Alt+S`) to save your message (with images)
5. Your message will be saved specifically for this chat thread
6. When you want to use a saved message:
   - Click the 📝 button to open the saved messages panel
   - Click "Use" next to the message you want to use (automatically inserts into chat input)
   - OR click "Copy" to copy the message to clipboard for manual pasting
   - The message will be inserted into the chat input field and the panel will close
7. To delete a saved message, click "Delete" next to the message

## Keyboard Shortcuts

- `Alt+M`: Toggle the saved messages panel
- `Alt+S`: Save the current message (when textarea is focused)

## Import/Export Functionality

You can back up and transfer your saved messages between different browsers or computers:

- **Export**: Click the "Export All" button in the saved messages panel to download a JSON file containing all your saved messages
- **Import**: Click the "Import" button and select a previously exported JSON file to restore your saved messages

Note: The import function will merge the imported messages with any existing messages. It will not overwrite your current messages.

## Troubleshooting

### If the "Use" Button Doesn't Work

If clicking the "Use" button doesn't insert text into Messenger's input field:

1. Try the "Copy" button instead, which copies the message to your clipboard for manual pasting
2. Click the 🐞 (bug) toggle button in the saved messages panel to enable debug mode
3. Once debug mode is enabled, a "Debug" button will appear
4. Click the "Debug" button while in a Messenger chat
5. This will identify all possible text input fields and show them in the browser console
6. A test message will temporarily appear in what's believed to be the input field

### Advanced Solutions

The script now includes multiple methods to insert text into Messenger's input field:

1. **Direct Content Setting**: Inserts text using the most appropriate method for Facebook's editor
2. **React Integration Approach**: Attempts to work with Facebook's underlying React components
3. **Clipboard Paste Simulation**: Uses clipboard APIs to simulate pasting text
4. **Copy to Clipboard**: Reliable manual fallback that works regardless of Facebook's interface changes

These methods are automatically attempted in sequence when you click "Use", or you can use the "Copy" button directly.

### Fixed Issues

- **Character duplication issue**: Fixed an issue where the first character would appear twice
- **Input field detection**: Improved to work with Facebook's latest Lexical editor
- **Message insertion reliability**: Multiple approaches are now used for greater compatibility
- **Image handling**: Added support for saving and using messages with images

### Common Issues and Fixes

- **No input field detected**: Facebook may have changed their HTML structure. Use the "Copy" button instead of "Use".
- **Text appears but doesn't trigger Messenger's UI**: Try typing a character manually after using a saved message.
- **Debug mode doesn't find any input fields**: Make sure you're in an active Messenger chat when running the debug tool.
- **Nothing works**: Try these workarounds:
  1. Use the "Copy" button and paste manually with Ctrl+V
  2. Use the debug tool to identify the input field, then type manually
  3. Restart your browser or try a different browser
  4. Check the browser console for specific error messages with debug mode enabled

## How It Works

- The script uses the chat thread ID from the URL (e.g., `7990669924323622` in `https://www.messenger.com/e2ee/t/7990669924323622`) to store and retrieve messages specific to each conversation
- Messages are stored locally in your browser using the userscript storage API
- Messages are sorted by timestamp with newest first
- Each message displays when it was saved (today, yesterday, or specific date)
- The script uses multiple methods to detect and insert text into Facebook Messenger's input field
- No data is sent to any external server
- Messages persist between browser sessions

## Customization

You can modify the userscript to customize:
- The position and appearance of the UI
- The keyboard shortcuts
- Additional features as needed
- Input field selectors (if Facebook changes their HTML structure)

## Privacy and Security

- All saved messages are stored locally in your browser
- No data is sent to any external server
- The script only runs on supported messaging domains (see config.js for list)
- Import/export files are processed entirely client-side

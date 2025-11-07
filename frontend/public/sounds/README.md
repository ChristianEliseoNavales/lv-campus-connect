# Queue Notification Sounds

This directory contains audio files for queue notifications in the PortalQueue system.

## Required File

- **queue-notification.mp3** - The notification sound played when a user's queue number is called

## Adding a Custom Notification Sound

1. **Obtain an audio file** in MP3 format (recommended for best browser compatibility)
   - Suggested duration: 1-3 seconds
   - Suggested type: Pleasant notification tone, chime, or bell sound
   - Keep file size small (< 100KB) for fast loading

2. **Name the file** exactly as: `queue-notification.mp3`

3. **Place the file** in this directory (`frontend/public/sounds/`)

4. The notification service will automatically use this file when available

## Fallback Behavior

If `queue-notification.mp3` is not found, the system will automatically generate a beep sound using the Web Audio API. This ensures notifications always work even without a custom sound file.

## Free Sound Resources

You can find free notification sounds from:
- [Freesound.org](https://freesound.org/) - Search for "notification" or "bell"
- [Zapsplat.com](https://www.zapsplat.com/) - Free sound effects
- [Mixkit.co](https://mixkit.co/free-sound-effects/) - Free notification sounds

## Testing

After adding the sound file:
1. Open the PortalQueue page in a browser
2. Check the browser console for: `✅ Notification Service: Audio file loaded successfully`
3. Wait for your queue status to change to "serving" to hear the notification

## Supported Formats

While MP3 is recommended, modern browsers also support:
- **MP3** (best compatibility)
- **WAV** (larger file size)
- **OGG** (good compression, not supported in Safari)
- **M4A/AAC** (good quality, widely supported)

For maximum compatibility across all devices and browsers, use MP3 format.


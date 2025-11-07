# Queue Notification Sounds

This directory contains audio files for queue notifications in the PortalQueue system.

## Current Active File

✅ **queue-notification.mp3** - Custom notification sound (yo_phone_linging.mp3)
- **Volume Boost:** 3x amplification enabled via Web Audio API
- **Purpose:** Alert users when their queue number is called

## 🔊 Volume Boost Feature

The notification system uses **Web Audio API GainNode** to amplify the audio **3x louder** than normal:
- Standard HTML5 audio is limited to 100% volume (gain = 1.0)
- Our system uses a GainNode with gain = 3.0 (300% volume)
- This ensures notifications are heard even in noisy environments
- Adjustable in `notificationService.js` by changing the `volumeBoost` property

## Replacing the Notification Sound

To use a different notification sound:

1. **Obtain an audio file** in MP3 format (recommended for best browser compatibility)
   - Suggested duration: 1-3 seconds
   - Suggested type: Pleasant notification tone, chime, or bell sound
   - Keep file size small (< 100KB) for fast loading
   - **Don't worry about volume** - the system will automatically boost it 3x

2. **Replace the existing file** by naming your file exactly as: `queue-notification.mp3`

3. **Place the file** in this directory (`frontend/public/sounds/`)

4. The notification service will automatically use the new file (may need to refresh browser cache)

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


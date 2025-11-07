/**
 * Notification Service for Queue Alerts
 * Handles sound, haptic feedback, and visual notifications
 */

class NotificationService {
  constructor() {
    this.audio = null;
    this.audioContext = null;
    this.audioSource = null;
    this.gainNode = null;
    this.isInitialized = false;
    this.isUnlocked = false; // Track if audio is unlocked for iOS
    this.hasVibrationSupport = 'vibrate' in navigator;
    this.hasAudioSupport = 'Audio' in window;
    this.volumeBoost = 3.0; // Boost volume 3x (adjustable: 1.0 = normal, 3.0 = 3x louder)
  }

  /**
   * Generate a notification beep using Web Audio API
   * Fallback when audio file is not available
   */
  generateBeep() {
    try {
      // Use existing AudioContext if available, otherwise create new one
      const audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();

      // Store AudioContext for reuse
      if (!this.audioContext) {
        this.audioContext = audioContext;
      }

      // Resume if suspended (iOS requirement)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure beep sound (pleasant notification tone)
      oscillator.frequency.value = 800; // 800 Hz frequency
      oscillator.type = 'sine'; // Sine wave for smooth sound

      // Volume envelope (fade in and out)
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

      // Play beep
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log('🔊 Notification Service: Generated beep sound');
      return true;
    } catch (error) {
      console.error('❌ Notification Service: Beep generation failed', error);
      return false;
    }
  }

  /**
   * Initialize with user gesture (required for iOS)
   * This MUST be called from a user interaction (tap/click)
   * @returns {Promise<boolean>} Success status
   */
  async initializeWithUserGesture() {
    console.log('🔔 Initializing notifications with user gesture (iOS compatible)...');

    try {
      // Create AudioContext (required for iOS)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ AudioContext created');
      }

      // Resume AudioContext (required for iOS)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('✅ AudioContext resumed');
      }

      // Try to load and play audio file
      if (this.hasAudioSupport) {
        try {
          this.audio = new Audio('/sounds/queue-notification.mp3');
          this.audio.volume = 1.0;

          // Load the audio
          await new Promise((resolve, reject) => {
            this.audio.addEventListener('canplaythrough', resolve, { once: true });
            this.audio.addEventListener('error', reject, { once: true });
            this.audio.load();

            // Timeout after 3 seconds
            setTimeout(() => reject(new Error('Audio load timeout')), 3000);
          });

          console.log('✅ Audio file loaded successfully');
        } catch (audioError) {
          console.warn('⚠️ Audio file not available, will use generated beep', audioError);
          this.audio = null;
        }
      }

      this.isUnlocked = true;
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize with user gesture:', error);
      return false;
    }
  }

  /**
   * Initialize the notification service (basic initialization)
   * Note: On iOS, you still need to call initializeWithUserGesture() from a user interaction
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Basic initialization without user gesture
      // On iOS, audio won't work until initializeWithUserGesture() is called
      console.log('✅ Notification Service: Basic initialization complete');
      console.log('⚠️ iOS users: Tap "Enable Notifications" button to unlock audio');

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Notification Service: Initialization failed', error);
    }
  }

  /**
   * Play notification sound with volume boost using Web Audio API
   * @returns {Promise<boolean>} Success status
   */
  async playSound() {
    if (!this.hasAudioSupport) {
      console.warn('⚠️ Notification Service: Audio not supported');
      return false;
    }

    try {
      // Try to play audio file with volume boost if available
      if (this.audio) {
        try {
          // Ensure AudioContext is created
          if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          }

          // Resume AudioContext if suspended (iOS requirement)
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }

          // Create audio element source if not exists
          if (!this.audioSource) {
            this.audioSource = this.audioContext.createMediaElementSource(this.audio);

            // Create gain node for volume boosting
            this.gainNode = this.audioContext.createGain();

            // Set volume boost (3.0 = 3x louder than normal)
            this.gainNode.gain.value = this.volumeBoost;

            // Connect: audio -> gain -> destination (speakers)
            this.audioSource.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            console.log(`🔊 Volume boost enabled: ${this.volumeBoost}x`);
          }

          // Reset audio to start
          this.audio.currentTime = 0;

          // Play the sound (will be boosted by gainNode)
          await this.audio.play();
          console.log('🔊 Notification Service: Audio file played with volume boost');
          return true;
        } catch (playError) {
          console.warn('⚠️ Notification Service: Audio file playback failed, using beep fallback', playError);
          // Fall through to beep generation
        }
      }

      // Fallback to generated beep if audio file not available or failed
      return this.generateBeep();
    } catch (error) {
      console.error('❌ Notification Service: Sound playback failed', error);
      return false;
    }
  }

  /**
   * Trigger haptic feedback (vibration)
   * Pattern: Short-Long-Short for attention-grabbing effect
   * @returns {boolean} Success status
   */
  triggerHaptic() {
    if (!this.hasVibrationSupport) {
      console.warn('⚠️ Notification Service: Vibration not supported on this device');
      return false;
    }

    try {
      // Vibration pattern: [vibrate, pause, vibrate, pause, vibrate]
      // Pattern: 200ms vibrate, 100ms pause, 400ms vibrate, 100ms pause, 200ms vibrate
      const pattern = [200, 100, 400, 100, 200];
      
      navigator.vibrate(pattern);
      console.log('📳 Notification Service: Haptic feedback triggered');
      return true;
    } catch (error) {
      console.error('❌ Notification Service: Haptic feedback failed', error);
      return false;
    }
  }

  /**
   * Trigger all notifications (sound + haptic)
   * This is the main method to call when queue is called
   * @returns {Promise<Object>} Status of each notification type
   */
  async notifyQueueCalled() {
    console.log('🔔 Notification Service: Queue called - triggering all notifications');

    const results = {
      sound: false,
      haptic: false,
      timestamp: new Date().toISOString()
    };

    // Play sound
    results.sound = await this.playSound();

    // Trigger haptic feedback
    results.haptic = this.triggerHaptic();

    return results;
  }

  /**
   * Request user permission for notifications (for future Web Notifications API)
   * Currently not used but prepared for future enhancement
   */
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('🔔 Notification permission:', permission);
        return permission === 'granted';
      } catch (error) {
        console.error('❌ Notification permission request failed', error);
        return false;
      }
    }
    return Notification.permission === 'granted';
  }

  /**
   * Check if notification features are supported
   * @returns {Object} Support status for each feature
   */
  getSupport() {
    return {
      audio: this.hasAudioSupport,
      vibration: this.hasVibrationSupport,
      webNotifications: 'Notification' in window,
      initialized: this.isInitialized
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Disconnect audio nodes
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // Cleanup audio element
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    console.log('🧹 Notification Service: Cleaned up');
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;


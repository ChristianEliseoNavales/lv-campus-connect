/**
 * Session Service
 * Manages user session tracking via Socket.io connections
 * Tracks active user sessions: Map<userId, Set<socketId>>
 */
class SessionService {
  constructor() {
    // Map userId to Set of socket IDs
    // This allows multiple tabs/devices per user
    this.userSessions = new Map(); // Map<userId, Set<socketId>>
  }

  /**
   * Register a new session for a user
   * @param {string} userId - User ID
   * @param {string} socketId - Socket.io connection ID
   */
  registerSession(userId, socketId) {
    if (!userId || !socketId) {
      console.warn('⚠️ SessionService: Invalid userId or socketId provided');
      return;
    }

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(socketId);
    console.log(`👤 User ${userId} registered session: ${socketId}`);
    console.log(`📊 Total sessions for user ${userId}: ${this.userSessions.get(userId).size}`);
  }

  /**
   * Remove a session by socket ID
   * @param {string} socketId - Socket.io connection ID to remove
   * @returns {string|null} - userId if session was removed, null otherwise
   */
  removeSession(socketId) {
    if (!socketId) {
      return null;
    }

    for (const [userId, socketIds] of this.userSessions.entries()) {
      if (socketIds.has(socketId)) {
        socketIds.delete(socketId);
        if (socketIds.size === 0) {
          this.userSessions.delete(userId);
          console.log(`👤 Removed all sessions for user ${userId}`);
        } else {
          console.log(`👤 User ${userId} now has ${socketIds.size} active session(s)`);
        }
        return userId;
      }
    }
    return null;
  }

  /**
   * Get all active user IDs with their session counts
   * @returns {Array<{userId: string, sessionCount: number}>} - Array of active users
   */
  getActiveSessions() {
    const activeSessions = [];
    for (const [userId, socketIds] of this.userSessions.entries()) {
      if (socketIds.size > 0) {
        activeSessions.push({
          userId: userId.toString(), // Ensure string format
          sessionCount: socketIds.size
        });
      }
    }
    return activeSessions;
  }

  /**
   * Get socket IDs for a specific user
   * @param {string} userId - User ID
   * @returns {Set<string>|null} - Set of socket IDs or null if user has no active sessions
   */
  getUserSockets(userId) {
    return this.userSessions.get(userId) || null;
  }

  /**
   * Check if a user has active sessions
   * @param {string} userId - User ID
   * @returns {boolean} - True if user has active sessions
   */
  hasActiveSession(userId) {
    const sockets = this.userSessions.get(userId);
    return sockets && sockets.size > 0;
  }

  /**
   * Get total number of active users (unique users with active sessions)
   * @returns {number} - Number of active users
   */
  getActiveUserCount() {
    return this.userSessions.size;
  }

  /**
   * Get total number of active socket connections
   * @returns {number} - Total number of active connections
   */
  getTotalConnectionCount() {
    let total = 0;
    for (const socketIds of this.userSessions.values()) {
      total += socketIds.size;
    }
    return total;
  }
}

// Export singleton instance
module.exports = new SessionService();


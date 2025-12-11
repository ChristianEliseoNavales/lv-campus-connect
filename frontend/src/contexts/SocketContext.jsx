import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import API_CONFIG from '../config/api';
import { useAuth } from './AuthContext';
import { logError, getUserFriendlyMessage } from '../utils/errorHandler';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joinedRooms, setJoinedRooms] = useState(new Set());
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { user, isAuthenticated } = useAuth();

  // Initialize single Socket.io connection
  useEffect(() => {
    // Use dynamic Socket URL based on context (kiosk vs admin)
    const socketUrl = API_CONFIG.getSocketUrl();

    const newSocket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
      console.log('✅ Socket.io connected');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      setJoinedRooms(new Set()); // Clear joined rooms on disconnect

      // Log disconnect reason
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, need to manually reconnect
        console.warn('⚠️ Socket disconnected by server:', reason);
        setConnectionError('Connection lost. Attempting to reconnect...');
      } else if (reason === 'io client disconnect') {
        // Client disconnected intentionally
        console.log('ℹ️ Socket disconnected by client');
      } else {
        // Connection error
        console.error('❌ Socket disconnected:', reason);
        setConnectionError('Connection lost. Attempting to reconnect...');
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
      console.log(`✅ Socket.io reconnected after ${attemptNumber} attempts`);

      // Rejoin all previously joined rooms
      joinedRooms.forEach(room => {
        newSocket.emit('join-room', room);
      });
      // Note: User session re-registration is handled by the separate useEffect
      // that watches socket, isConnected, and user state
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      setReconnectAttempts(attemptNumber);
      console.log(`🔄 Socket.io reconnection attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Socket.io reconnection error:', error);
      setConnectionError('Reconnection failed. Please refresh the page if the problem persists.');
      logError(error, {
        type: 'socket_reconnect_error',
        attempt: reconnectAttempts
      });
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Socket.io reconnection failed after all attempts');
      setConnectionError('Unable to reconnect. Please refresh the page.');
      logError(new Error('Socket.io reconnection failed'), {
        type: 'socket_reconnect_failed'
      });
    });

    // Handle connection errors
    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
      setConnectionError('Unable to connect to server. Please check your internet connection.');
      logError(error, {
        type: 'socket_connection_error'
      });
    });

    // Handle general errors
    newSocket.on('error', (error) => {
      console.error('❌ Socket.io error:', error);
      logError(error instanceof Error ? error : new Error(String(error)), {
        type: 'socket_error'
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Register user session when authenticated and connected
  useEffect(() => {
    if (socket && isConnected && isAuthenticated && user) {
      const userId = user._id || user.id;
      if (userId) {
        socket.emit('register-user-session', { userId });
      }
    }
  }, [socket, isConnected, isAuthenticated, user]);

  // Join room function with tracking
  const joinRoom = useCallback((room) => {
    if (socket && isConnected && !joinedRooms.has(room)) {
      socket.emit('join-room', room);
      setJoinedRooms(prev => new Set([...prev, room]));
    }
  }, [socket, isConnected, joinedRooms]);

  // Leave room function with tracking
  const leaveRoom = useCallback((room) => {
    if (socket && joinedRooms.has(room)) {
      socket.emit('leave-room', room);
      setJoinedRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(room);
        return newSet;
      });
    }
  }, [socket, joinedRooms]);

  // Subscribe to events with automatic cleanup
  const subscribe = useCallback((event, handler) => {
    if (socket) {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    }
    return () => {};
  }, [socket]);

  // Emit events with error handling
  const emit = useCallback((event, data, callback) => {
    if (socket && isConnected) {
      try {
        if (callback) {
          socket.emit(event, data, (response) => {
            if (response && response.error) {
              const error = new Error(response.error);
              error.data = response;
              logError(error, {
                type: 'socket_emit_error',
                event,
                data
              });
              callback(error, null);
            } else {
              callback(null, response);
            }
          });
        } else {
          socket.emit(event, data);
        }
      } catch (error) {
        logError(error, {
          type: 'socket_emit_exception',
          event,
          data
        });
        if (callback) {
          callback(error, null);
        }
      }
    } else {
      const error = new Error('Socket not connected');
      logError(error, {
        type: 'socket_emit_not_connected',
        event,
        data
      });
      if (callback) {
        callback(error, null);
      }
    }
  }, [socket, isConnected]);

  const value = {
    socket,
    isConnected,
    joinedRooms: Array.from(joinedRooms),
    connectionError,
    reconnectAttempts,
    joinRoom,
    leaveRoom,
    subscribe,
    emit
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;

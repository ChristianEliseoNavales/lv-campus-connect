import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import API_CONFIG from '../config/api';
import { useAuth } from './AuthContext';

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
  const { user, isAuthenticated } = useAuth();

  // Initialize single Socket.io connection
  useEffect(() => {
    // Use dynamic Socket URL based on context (kiosk vs admin)
    const socketUrl = API_CONFIG.getSocketUrl();
    console.log('🔌 Initializing Socket.io connection to:', socketUrl);

    const newSocket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
      setJoinedRooms(new Set()); // Clear joined rooms on disconnect
    });

    newSocket.on('reconnect', () => {
      console.log('🔌 Socket reconnected');
      setIsConnected(true);
      // Rejoin all previously joined rooms
      joinedRooms.forEach(room => {
        newSocket.emit('join-room', room);
      });
      // Note: User session re-registration is handled by the separate useEffect
      // that watches socket, isConnected, and user state
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
        console.log(`👤 Registered user session for ${userId}`);
      }
    }
  }, [socket, isConnected, isAuthenticated, user]);

  // Join room function with tracking
  const joinRoom = useCallback((room) => {
    if (socket && isConnected && !joinedRooms.has(room)) {
      socket.emit('join-room', room);
      setJoinedRooms(prev => new Set([...prev, room]));
      console.log(`📡 Joined room: ${room}`);
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
      console.log(`📡 Left room: ${room}`);
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

  // Emit events
  const emit = useCallback((event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  }, [socket, isConnected]);

  const value = {
    socket,
    isConnected,
    joinedRooms: Array.from(joinedRooms),
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

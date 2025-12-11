const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { initializeQueueCleanup } = require('./services/queueCleanupService');
const sessionService = require('./services/sessionService');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const timeoutMiddleware = require('./middleware/timeoutMiddleware');
const { error: logError, fatal: logFatal } = require('./utils/logger');

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// CORS Configuration - Hybrid Architecture
// Allow both cloud frontend and local frontend
const allowedOrigins = [
  process.env.CLOUD_FRONTEND_URL || 'https://lv-campus-connect.pages.dev',
  process.env.LOCAL_FRONTEND_URL || 'http://localhost:5173',
  process.env.FRONTEND_URL || 'http://localhost:5173', // Legacy support
  'http://localhost:5173', // Always allow local development
  'http://127.0.0.1:5173'  // Alternative localhost
];

console.log('🌐 Allowed CORS origins:', allowedOrigins);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});
const PORT = process.env.PORT || 5000;

// Start server function - ensures database is connected first
const startServer = async () => {
  try {
    // Connect to MongoDB Atlas and wait for connection
    console.log('🔄 Connecting to MongoDB Atlas...');
    await connectDB();

    // Verify connection before starting server
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  MongoDB connection not ready, but starting server anyway...');
      console.warn('⚠️  Database operations may fail until connection is established');
    } else {
      console.log('✅ MongoDB connection verified before starting server');
    }
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    console.error('⚠️  Starting server without database connection');
    console.error('⚠️  Database operations will fail until connection is established');
  }

  // Start server regardless of database connection status
  // (allows server to start and handle requests, but DB ops will fail)
  server.listen(PORT, () => {
    console.log('🚀 LVCampusConnect Backend Server');
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔌 Socket.io enabled for real-time updates`);
    console.log(`💾 Database Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    console.log('✅ Server ready for connections');

    // Initialize queue cleanup service after server starts
    initializeQueueCleanup();
  });
};

// Global Error Handlers - Must be set before starting server
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logFatal('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      name: reason.name
    } : reason,
    promise: promise.toString()
  });

  // In production, you might want to exit the process
  // For now, we'll just log it
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️  Unhandled promise rejection detected. Server will continue running.');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logFatal('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  // Uncaught exceptions are more serious - exit the process
  console.error('❌ Uncaught exception detected. Shutting down gracefully...');
  process.exit(1);
});

// Start the server
startServer();

// Middleware - Dynamic CORS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      // CORS logging disabled to prevent spam
      // Only log blocked origins for security monitoring
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request Timeout Middleware (30 seconds default)
// Apply timeout to all routes except health checks
app.use((req, res, next) => {
  // Skip timeout for health check endpoints
  if (req.path === '/api/health' || req.path === '/api/ping' || req.path === '/') {
    return next();
  }
  timeoutMiddleware(30000)(req, res, next);
});

// Serve static files from public directory
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io connection handling with error handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Error event handler for this socket
  socket.on('error', (error) => {
    logError('Socket error', {
      socketId: socket.id,
      error: error.message,
      stack: error.stack
    });
  });

  // Register user session with error handling
  socket.on('register-user-session', (data) => {
    try {
      const { userId } = data;
      if (userId) {
        sessionService.registerSession(userId, socket.id);
      }
    } catch (error) {
      logError('Error registering user session', {
        socketId: socket.id,
        error: error.message,
        data
      });
    }
  });

  // Join room based on user type (admin or kiosk) with error handling
  socket.on('join-room', (room) => {
    try {
      socket.join(room);
      console.log(`📡 Socket ${socket.id} joined room: ${room}`);
    } catch (error) {
      logError('Error joining room', {
        socketId: socket.id,
        room,
        error: error.message
      });
    }
  });

  // Leave room with error handling
  socket.on('leave-room', (room) => {
    try {
      socket.leave(room);
      console.log(`📡 Socket ${socket.id} left room: ${room}`);
    } catch (error) {
      logError('Error leaving room', {
        socketId: socket.id,
        room,
        error: error.message
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);

    // Clean up user session tracking
    try {
      sessionService.removeSession(socket.id);
    } catch (error) {
      logError('Error removing session on disconnect', {
        socketId: socket.id,
        error: error.message
      });
    }
  });
});

// Socket.io server-level error handling
io.engine.on('connection_error', (error) => {
  logError('Socket.io connection error', {
    error: error.message,
    stack: error.stack,
    req: error.req ? {
      method: error.req.method,
      url: error.req.url,
      headers: error.req.headers
    } : null
  });
});

// Helper function to emit force-logout to a specific user
const emitForceLogout = (userId, reason) => {
  const socketIds = sessionService.getUserSockets(userId);
  if (socketIds && socketIds.size > 0) {
    const eventData = {
      reason,
      timestamp: new Date().toISOString()
    };

    socketIds.forEach(socketId => {
      io.to(socketId).emit('force-logout', eventData);
      console.log(`🚪 Emitted force-logout to socket ${socketId} for user ${userId}: ${reason}`);
    });

    return true;
  }
  console.log(`⚠️ No active sessions found for user ${userId}`);
  return false;
};

// Make emitForceLogout available to routes via app
app.set('emitForceLogout', emitForceLogout);

// Make io available to routes
app.set('io', io);

// Import routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const servicesRoutes = require('./routes/services');
const windowsRoutes = require('./routes/windows');
const publicRoutes = require('./routes/public');
const usersRoutes = require('./routes/users');
const transactionsRoutes = require('./routes/transactions');
const databaseRoutes = require('./routes/database');
const analyticsRoutes = require('./routes/analytics');
const auditRoutes = require('./routes/audit');
const ratingsRoutes = require('./routes/ratings');
const queueRatingsRoutes = require('./routes/queueRatings');
const bulletinRoutes = require('./routes/bulletin');
const faqRoutes = require('./routes/faq');
const chartsRoutes = require('./routes/charts');
const printerRoutes = require('./routes/printer');
const notificationRoutes = require('./routes/notifications');
const fixUsersRoutes = require('./routes/fixUsers');
const adminRoutes = require('./routes/admin');
const documentRequestRoutes = require('./routes/documentRequests');

// Use routes
app.use('/api/auth', authRoutes); // Authentication routes (no auth required)
app.use('/api/settings', settingsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/windows', windowsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/queue-ratings', queueRatingsRoutes);
app.use('/api/bulletin', bulletinRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/fix-users', fixUsersRoutes); // Temporary route to fix user pageAccess
app.use('/api', documentRequestRoutes); // Document request routes

// Basic API routes
app.get('/', (req, res) => {
  res.json({
    message: 'LVCampusConnect Backend API',
    status: 'Running',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Lightweight ping endpoint for keep-alive pings
app.get('/api/ping', (req, res) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.headers['user-agent'] || 'unknown';
  // Use console.error (STDERR) instead of console.log (STDOUT) for better visibility in Render logs
  console.error(`[Keep-Alive] Ping received at ${timestamp} from ${userAgent}`);
  // Also write to STDOUT for redundancy
  process.stdout.write(`[Keep-Alive] Ping received at ${timestamp} from ${userAgent}\n`);
  res.json({
    status: 'pong',
    timestamp: timestamp
  });
});

// 404 handler - Must be before error handler
app.use(notFoundHandler);

// Error handling middleware - Must be last
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});


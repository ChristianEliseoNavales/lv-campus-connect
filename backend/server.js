const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { initializeQueueCleanup } = require('./services/queueCleanupService');

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

// Connect to MongoDB Atlas
connectDB();

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

// Serve static files from public directory
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// User session tracking: Map userId to Set of socket IDs
// This allows multiple tabs/devices per user
const userSessions = new Map(); // Map<userId, Set<socketId>>

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Register user session
  socket.on('register-user-session', (data) => {
    const { userId } = data;
    if (userId) {
      if (!userSessions.has(userId)) {
        userSessions.set(userId, new Set());
      }
      userSessions.get(userId).add(socket.id);
      console.log(`👤 User ${userId} registered session: ${socket.id}`);
      console.log(`📊 Total sessions for user ${userId}: ${userSessions.get(userId).size}`);
    }
  });

  // Join room based on user type (admin or kiosk)
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`📡 Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    
    // Clean up user session tracking
    for (const [userId, socketIds] of userSessions.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          userSessions.delete(userId);
          console.log(`👤 Removed all sessions for user ${userId}`);
        } else {
          console.log(`👤 User ${userId} now has ${socketIds.size} active session(s)`);
        }
        break;
      }
    }
  });
});

// Helper function to emit force-logout to a specific user
const emitForceLogout = (userId, reason) => {
  const socketIds = userSessions.get(userId);
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

// Use routes
app.use('/api/auth', authRoutes); // Authentication routes (no auth required)
app.use('/api/settings', settingsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/windows', windowsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/transactions', transactionsRoutes);
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



// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

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

// Start server
server.listen(PORT, () => {
  console.log('🚀 LVCampusConnect Backend Server');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.io enabled for real-time updates`);
  console.log('✅ Server ready for connections');

  // Initialize queue cleanup service after server starts
  initializeQueueCleanup();
});

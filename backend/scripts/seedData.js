const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('🌱 MongoDB Atlas Database Seeding - Comprehensive Edition');
console.log('=========================================================');

// Use the exact same connection logic as the main server
const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("✅ MongoDB Atlas connected successfully!");
    console.log(`📍 Connected to database: ${mongoose.connection.name}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
};

// Complete schemas for seeding with ALL fields from models
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  password: { type: String, required: false },
  googleId: { type: String, sparse: true },
  accessLevel: { type: String, enum: ['super_admin', 'admin', 'admin_staff'], required: true },
  office: { type: String, enum: ['MIS', 'Registrar', 'Admissions', 'Senior Management'], required: true },
  role: {
    type: String,
    enum: [
      'MIS Super Admin',
      'MIS Admin',
      'MIS Admin Staff',
      'Registrar Admin',
      'Registrar Admin Staff',
      'Admissions Admin',
      'Admissions Admin Staff',
      'Senior Management Admin',
      'Senior Management Admin Staff'
    ],
    required: true
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  profilePicture: { type: String },
  permissions: [{ type: String }],
  pageAccess: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  office: { type: String, enum: ['registrar', 'admissions'], required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const windowSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  office: { type: String, enum: ['registrar', 'admissions'], required: true },
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isOpen: { type: Boolean, default: false },
  isServing: { type: Boolean, default: true },
  currentQueue: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const queueSchema = new mongoose.Schema({
  queueNumber: { type: Number, required: true, min: 1, max: 99 },
  office: { type: String, enum: ['registrar', 'admissions'], required: true },
  windowId: { type: String },
  serviceId: { type: String, required: true },
  visitationFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitationForm', required: false },
  idNumber: { type: String, trim: true, maxlength: 50 },
  role: { type: String, enum: ['Visitor', 'Student', 'Teacher', 'Alumni'], required: true },
  studentStatus: { type: String, enum: ['incoming_new', 'continuing'], required: false },
  isPriority: { type: Boolean, default: false },
  status: { type: String, enum: ['waiting', 'serving', 'completed', 'skipped', 'cancelled'], default: 'waiting' },
  isCurrentlyServing: { type: Boolean, default: false },
  queuedAt: { type: Date, default: Date.now },
  calledAt: { type: Date },
  servedAt: { type: Date },
  completedAt: { type: Date },
  skippedAt: { type: Date },
  estimatedWaitTime: { type: Number, default: 0 },
  rating: { type: Number, min: 1, max: 5 },
  remarks: { type: String, trim: true, maxlength: 500, default: '' },
  processedBy: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: false, default: null }
}, { timestamps: true });

const visitationFormSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 200 },
  contactNumber: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  idNumber: { type: String, trim: true, maxlength: 50, default: '' }
}, { timestamps: true });

const officeSchema = new mongoose.Schema({
  officeName: { type: String, required: true, unique: true, trim: true },
  officeEmail: { type: String, default: null, trim: true, lowercase: true }
}, { timestamps: true });

const ratingSchema = new mongoose.Schema({
  rating: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String, trim: true, maxlength: 1000 },
  ratingType: {
    type: String,
    enum: ['service', 'window', 'overall_experience', 'staff_performance', 'system_usability'],
    required: true
  },
  queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  windowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Window' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, lowercase: true },
  customerRole: {
    type: String,
    enum: ['Visitor', 'Student', 'Teacher', 'Alumni'],
    required: true
  },
  office: { type: String, enum: ['registrar', 'admissions'], required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved'
  }
}, { timestamps: true });

const settingsSchema = new mongoose.Schema({
  systemName: { type: String, default: 'LVCampusConnect System' },
  systemVersion: { type: String, default: '1.0.0' },
  queueSettings: {
    isEnabled: { type: Boolean, default: true },
    globalQueueNumbering: { type: Boolean, default: true },
    maxQueueNumber: { type: Number, default: 99, min: 1, max: 999 },
    resetQueueDaily: { type: Boolean, default: true },
    resetTime: { type: String, default: "00:00" },
    allowPriorityQueue: { type: Boolean, default: true },
    maxWaitTime: { type: Number, default: 120 }
  },
  kioskSettings: {
    idleTimeout: { type: Number, default: 300 },
    idleWarningTime: { type: Number, default: 30 },
    autoRefreshInterval: { type: Number, default: 30 },
    enableTextToSpeech: { type: Boolean, default: true },
    voiceSettings: {
      rate: { type: Number, default: 0.8, min: 0.1, max: 2.0 },
      pitch: { type: Number, default: 1.0, min: 0.0, max: 2.0 },
      volume: { type: Number, default: 1.0, min: 0.0, max: 1.0 },
      voice: { type: String, default: 'female' }
    }
  },
  displaySettings: {
    theme: {
      primaryColor: { type: String, default: '#1F3463' },
      secondaryColor: { type: String, default: '#FFE251' },
      backgroundColor: { type: String, default: '#FFFFFF' },
      textColor: { type: String, default: '#000000' }
    },
    layout: {
      orientation: { type: String, enum: ['landscape', 'portrait'], default: 'landscape' },
      aspectRatio: { type: String, default: '16:9' }
    },
    fonts: {
      primary: { type: String, default: 'SF Pro Rounded' },
      secondary: { type: String, default: 'Days One' }
    }
  },
  officeSettings: {
    registrar: {
      isEnabled: { type: Boolean, default: true },
      displayName: { type: String, default: "Registrar's Office" },
      description: { type: String, default: 'Student records, transcripts, enrollment verification' },
      location: { type: String, default: 'Ground Floor, Administration Building' },
      operatingHours: {
        start: { type: String, default: "08:00" },
        end: { type: String, default: "17:00" }
      },
      operatingDays: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
      maxWindows: { type: Number, default: 5, min: 1 }
    },
    admissions: {
      isEnabled: { type: Boolean, default: true },
      displayName: { type: String, default: 'Admissions Office' },
      description: { type: String, default: 'New student applications, admission requirements' },
      location: { type: String, default: 'Second Floor, Administration Building' },
      operatingHours: {
        start: { type: String, default: "08:00" },
        end: { type: String, default: "17:00" }
      },
      operatingDays: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
      maxWindows: { type: Number, default: 3, min: 1 }
    }
  },
  notificationSettings: {
    enableEmailNotifications: { type: Boolean, default: false },
    enableSMSNotifications: { type: Boolean, default: false },
    enablePushNotifications: { type: Boolean, default: true },
    queueCallNotification: { type: Boolean, default: true },
    reminderNotification: { type: Boolean, default: true },
    reminderTime: { type: Number, default: 5 }
  },
  securitySettings: {
    sessionTimeout: { type: Number, default: 60 },
    maxLoginAttempts: { type: Number, default: 5 },
    lockoutDuration: { type: Number, default: 15 },
    requirePasswordChange: { type: Boolean, default: false },
    passwordChangeInterval: { type: Number, default: 90 }
  },
  auditSettings: {
    enableAuditLog: { type: Boolean, default: true },
    retentionPeriod: { type: Number, default: 365 },
    logLevel: { type: String, enum: ['error', 'warn', 'info', 'debug'], default: 'info' }
  },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

async function seedDatabase() {
  try {
    // Connect to database
    await connectDB();

    // Create models
    const User = mongoose.model('User', userSchema);
    const Service = mongoose.model('Service', serviceSchema);
    const Window = mongoose.model('Window', windowSchema);
    const Queue = mongoose.model('Queue', queueSchema);
    const Office = mongoose.model('Office', officeSchema);
    const VisitationForm = mongoose.model('VisitationForm', visitationFormSchema);
    const Rating = mongoose.model('Rating', ratingSchema);
    const Settings = mongoose.model('Settings', settingsSchema);

    // Clear existing data and drop old indexes
    console.log('🧹 Clearing existing data and indexes...');
    await Promise.all([
      User.deleteMany({}),
      Service.deleteMany({}),
      Window.deleteMany({}),
      Queue.deleteMany({}),
      Office.deleteMany({}),
      VisitationForm.deleteMany({}),
      Rating.deleteMany({}),
      Settings.deleteMany({})
    ]);

    // Drop all indexes to remove old department-based indexes
    try {
      await Promise.all([
        mongoose.connection.collection('users').dropIndexes(),
        mongoose.connection.collection('services').dropIndexes(),
        mongoose.connection.collection('windows').dropIndexes(),
        mongoose.connection.collection('queues').dropIndexes(),
        mongoose.connection.collection('offices').dropIndexes(),
        mongoose.connection.collection('visitationforms').dropIndexes(),
        mongoose.connection.collection('ratings').dropIndexes(),
        mongoose.connection.collection('settings').dropIndexes()
      ]);
      console.log('✅ Old indexes dropped');
    } catch (error) {
      console.log('⚠️ Some indexes could not be dropped (may not exist yet)');
    }

    console.log('✅ Database cleared');

    // Seed Offices first (required for other data)
    console.log('🏢 Creating offices...');
    const offices = await Office.insertMany([
      { officeName: 'Admissions Office', officeEmail: 'admissions@lvcampusconnect.edu' },
      { officeName: 'Communications Office', officeEmail: 'communications@lvcampusconnect.edu' },
      { officeName: 'Data Privacy Office', officeEmail: 'privacy@lvcampusconnect.edu' },
      { officeName: 'HR Office', officeEmail: 'hr@lvcampusconnect.edu' },
      { officeName: 'MIS Office', officeEmail: 'mis@lvcampusconnect.edu' },
      { officeName: "Registrar's Office", officeEmail: 'registrar@lvcampusconnect.edu' },
      { officeName: 'Basic Education Office', officeEmail: 'basiced@lvcampusconnect.edu' },
      { officeName: 'Higher Education Office', officeEmail: 'highered@lvcampusconnect.edu' }
    ]);
    console.log(`✅ Created ${offices.length} offices`);

    // Seed Users with complete fields
    console.log('👥 Creating users...');
    const users = await User.insertMany([
      {
        email: 'admin@lvcampusconnect.edu',
        name: 'MIS Super Admin',
        password: 'Admin123!',
        accessLevel: 'super_admin',
        office: 'MIS',
        role: 'MIS Super Admin',
        isActive: true,
        lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        profilePicture: null,
        permissions: ['all'],
        pageAccess: [
          // MIS routes
          '/admin/mis',
          '/admin/mis/users',
          '/admin/mis/database-manager',
          '/admin/mis/audit-trail',
          '/admin/mis/bulletin',
          '/admin/mis/ratings',
          // Registrar routes
          '/admin/registrar',
          '/admin/registrar/queue',
          '/admin/registrar/transaction-logs',
          '/admin/registrar/settings',
          // Admissions routes
          '/admin/admissions',
          '/admin/admissions/queue',
          '/admin/admissions/transaction-logs',
          '/admin/admissions/settings',
          // Senior Management routes
          '/admin/seniormanagement/charts'
        ],
        createdBy: null
      },
      {
        email: 'registrar.admin@lvcampusconnect.edu',
        name: 'Registrar Administrator',
        password: 'Registrar123!',
        accessLevel: 'admin',
        office: 'Registrar',
        role: 'Registrar Admin',
        isActive: true,
        lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        profilePicture: null,
        permissions: ['queue_management', 'service_management', 'window_management', 'view_reports'],
        pageAccess: [
          '/admin/registrar',
          '/admin/registrar/queue',
          '/admin/registrar/transaction-logs',
          '/admin/registrar/settings'
        ],
        createdBy: null
      },
      {
        email: 'admissions.admin@lvcampusconnect.edu',
        name: 'Admissions Administrator',
        password: 'Admissions123!',
        accessLevel: 'admin',
        office: 'Admissions',
        role: 'Admissions Admin',
        isActive: true,
        lastLogin: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        profilePicture: null,
        permissions: ['queue_management', 'service_management', 'window_management', 'view_reports'],
        pageAccess: [
          '/admin/admissions',
          '/admin/admissions/queue',
          '/admin/admissions/transaction-logs',
          '/admin/admissions/settings'
        ],
        createdBy: null
      },
      {
        email: 'seniormanagement.admin@lvcampusconnect.edu',
        name: 'Senior Management Administrator',
        password: 'SeniorMgmt123!',
        accessLevel: 'admin',
        office: 'Senior Management',
        role: 'Senior Management Admin',
        isActive: true,
        lastLogin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        profilePicture: null,
        permissions: ['view_analytics', 'view_reports'],
        pageAccess: [
          '/admin/seniormanagement/charts'
        ],
        createdBy: null
      }
    ]);
    console.log(`✅ Created ${users.length} users`);

    // Seed Services with complete fields
    console.log('🔧 Creating services...');
    const superAdmin = users.find(u => u.role === 'MIS Super Admin');
    const registrarAdmin = users.find(u => u.role === 'Registrar Admin');
    const admissionsAdmin = users.find(u => u.role === 'Admissions Admin');

    const services = await Service.insertMany([
      {
        name: 'Transcript of Records',
        office: 'registrar',
        isActive: true,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Certificate of Enrollment',
        office: 'registrar',
        isActive: true,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Certificate of Grades',
        office: 'registrar',
        isActive: true,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Diploma Claim',
        office: 'registrar',
        isActive: true,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Enroll',
        office: 'registrar',
        isActive: true,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Application Inquiry',
        office: 'admissions',
        isActive: true,
        createdBy: admissionsAdmin._id,
        updatedBy: admissionsAdmin._id
      },
      {
        name: 'Document Submission',
        office: 'admissions',
        isActive: true,
        createdBy: admissionsAdmin._id,
        updatedBy: admissionsAdmin._id
      },
      {
        name: 'Entrance Exam Schedule',
        office: 'admissions',
        isActive: true,
        createdBy: admissionsAdmin._id,
        updatedBy: admissionsAdmin._id
      }
    ]);
    console.log(`✅ Created ${services.length} services`);

    // Seed Windows with complete fields
    console.log('🪟 Creating windows...');
    const registrarServices = services.filter(s => s.office === 'registrar');
    const admissionsServices = services.filter(s => s.office === 'admissions');

    const windows = await Window.insertMany([
      {
        name: 'Window 1',
        office: 'registrar',
        serviceIds: registrarServices.map(s => s._id),
        assignedAdmin: registrarAdmin._id,
        isOpen: true,
        isServing: true,
        currentQueue: null,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Window 2',
        office: 'registrar',
        serviceIds: registrarServices.map(s => s._id),
        assignedAdmin: registrarAdmin._id,
        isOpen: true,
        isServing: true,
        currentQueue: null,
        createdBy: registrarAdmin._id,
        updatedBy: registrarAdmin._id
      },
      {
        name: 'Window 1',
        office: 'admissions',
        serviceIds: admissionsServices.map(s => s._id),
        assignedAdmin: admissionsAdmin._id,
        isOpen: true,
        isServing: true,
        currentQueue: null,
        createdBy: admissionsAdmin._id,
        updatedBy: admissionsAdmin._id
      },
      {
        name: 'Window 2',
        office: 'admissions',
        serviceIds: admissionsServices.map(s => s._id),
        assignedAdmin: admissionsAdmin._id,
        isOpen: false,
        isServing: true,
        currentQueue: null,
        createdBy: admissionsAdmin._id,
        updatedBy: admissionsAdmin._id
      }
    ]);
    console.log(`✅ Created ${windows.length} windows`);

    // Seed Visitation Forms first
    console.log('📝 Creating visitation forms...');
    const visitationForms = await VisitationForm.insertMany([
      {
        customerName: 'John Doe',
        contactNumber: '09123456789',
        email: 'john.doe@student.lv.edu.ph',
        address: '123 Main St, Manila, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Jane Smith',
        contactNumber: '09987654321',
        email: 'jane.smith@gmail.com',
        address: '456 Oak Ave, Quezon City, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Maria Santos',
        contactNumber: '09111222333',
        email: 'maria.santos@yahoo.com',
        address: '789 Pine Rd, Makati, Philippines',
        idNumber: 'PWD-2024-001'
      },
      {
        customerName: 'Robert Cruz',
        contactNumber: '09444555666',
        email: 'robert.cruz@outlook.com',
        address: '321 Elm St, Pasig, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Anna Garcia',
        contactNumber: '09222333444',
        email: 'anna.garcia@gmail.com',
        address: '555 Maple Dr, Taguig, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Michael Reyes',
        contactNumber: '09333444555',
        email: 'michael.reyes@yahoo.com',
        address: '777 Cedar Ln, Mandaluyong, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Sarah Lim',
        contactNumber: '09555666777',
        email: 'sarah.lim@outlook.com',
        address: '999 Birch St, San Juan, Philippines',
        idNumber: 'SC-2024-002'
      },
      {
        customerName: 'David Tan',
        contactNumber: '09666777888',
        email: 'david.tan@gmail.com',
        address: '111 Willow Ave, Pasay, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Lisa Fernandez',
        contactNumber: '09777888999',
        email: 'lisa.fernandez@yahoo.com',
        address: '222 Spruce Rd, Paranaque, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Mark Villanueva',
        contactNumber: '09888999000',
        email: 'mark.villanueva@gmail.com',
        address: '333 Ash Blvd, Las Pinas, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Jennifer Aquino',
        contactNumber: '09999000111',
        email: 'jennifer.aquino@outlook.com',
        address: '444 Palm St, Muntinlupa, Philippines',
        idNumber: ''
      },
      {
        customerName: 'Carlos Mendoza',
        contactNumber: '09000111222',
        email: 'carlos.mendoza@yahoo.com',
        address: '666 Redwood Dr, Caloocan, Philippines',
        idNumber: ''
      }
    ]);
    console.log(`✅ Created ${visitationForms.length} visitation forms`);

    // Seed Sample Queues with complete fields
    console.log('📋 Creating sample queues...');
    const transcriptService = services.find(s => s.name === 'Transcript of Records');
    const enrollService = services.find(s => s.name === 'Enroll');
    const certEnrollmentService = services.find(s => s.name === 'Certificate of Enrollment');
    const certGradesService = services.find(s => s.name === 'Certificate of Grades');
    const applicationService = services.find(s => s.name === 'Application Inquiry');
    const requirementsService = services.find(s => s.name === 'Requirements Submission');

    const queues = await Queue.insertMany([
      // Completed queues with ratings - Registrar (past week)
      {
        queueNumber: 1,
        office: 'registrar',
        windowId: windows[0]._id.toString(),
        serviceId: transcriptService._id.toString(),
        visitationFormId: visitationForms[0]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        calledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
        servedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 15,
        rating: 5,
        remarks: 'Transaction completed successfully',
        processedBy: registrarAdmin._id
      },
      {
        queueNumber: 2,
        office: 'registrar',
        windowId: windows[0]._id.toString(),
        serviceId: certEnrollmentService._id.toString(),
        visitationFormId: visitationForms[1]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        servedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 18 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 12,
        rating: 4,
        remarks: 'Completed',
        processedBy: registrarAdmin._id
      },
      {
        queueNumber: 3,
        office: 'registrar',
        windowId: windows[1]._id.toString(),
        serviceId: certGradesService._id.toString(),
        visitationFormId: visitationForms[4]._id,
        idNumber: '',
        role: 'Alumni',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
        servedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 22 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 14,
        rating: 5,
        remarks: 'Completed',
        processedBy: registrarAdmin._id
      },
      {
        queueNumber: 4,
        office: 'registrar',
        windowId: windows[0]._id.toString(),
        serviceId: transcriptService._id.toString(),
        visitationFormId: visitationForms[5]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
        servedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
        completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 18,
        rating: 3,
        remarks: 'Completed',
        processedBy: registrarAdmin._id
      },
      {
        queueNumber: 5,
        office: 'registrar',
        windowId: windows[1]._id.toString(),
        serviceId: certEnrollmentService._id.toString(),
        visitationFormId: visitationForms[7]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 1000),
        servedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 1000),
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 14,
        rating: 4,
        remarks: 'Completed',
        processedBy: registrarAdmin._id
      },
      // Completed queues with ratings - Admissions (past week)
      {
        queueNumber: 1,
        office: 'admissions',
        windowId: windows[2]._id.toString(),
        serviceId: applicationService._id.toString(),
        visitationFormId: visitationForms[3]._id,
        idNumber: '',
        role: 'Visitor',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        servedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 20,
        rating: 5,
        remarks: 'Completed',
        processedBy: admissionsAdmin._id
      },
      {
        queueNumber: 2,
        office: 'admissions',
        windowId: windows[2]._id.toString(),
        serviceId: requirementsService._id.toString(),
        visitationFormId: visitationForms[8]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
        servedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 15,
        rating: 4,
        remarks: 'Completed',
        processedBy: admissionsAdmin._id
      },
      {
        queueNumber: 3,
        office: 'admissions',
        windowId: windows[2]._id.toString(),
        serviceId: applicationService._id.toString(),
        visitationFormId: visitationForms[9]._id,
        idNumber: '',
        role: 'Visitor',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
        servedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 28 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 20,
        rating: 5,
        remarks: 'Completed',
        processedBy: admissionsAdmin._id
      },
      {
        queueNumber: 4,
        office: 'admissions',
        windowId: windows[2]._id.toString(),
        serviceId: requirementsService._id.toString(),
        visitationFormId: visitationForms[10]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'completed',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        calledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
        servedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        skippedAt: null,
        estimatedWaitTime: 18,
        rating: 3,
        remarks: 'Completed',
        processedBy: admissionsAdmin._id
      },
      // Current active queues (no ratings yet)
      {
        queueNumber: 6,
        office: 'registrar',
        windowId: windows[0]._id.toString(),
        serviceId: transcriptService._id.toString(),
        visitationFormId: visitationForms[11]._id,
        idNumber: '',
        role: 'Student',
        studentStatus: null,
        isPriority: false,
        status: 'serving',
        isCurrentlyServing: true,
        queuedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        calledAt: new Date(Date.now() - 5 * 60 * 1000),
        servedAt: new Date(Date.now() - 5 * 60 * 1000),
        completedAt: null,
        skippedAt: null,
        estimatedWaitTime: 10,
        rating: null,
        remarks: '',
        processedBy: registrarAdmin._id
      },
      {
        queueNumber: 7,
        office: 'registrar',
        windowId: null,
        serviceId: transcriptService._id.toString(),
        visitationFormId: visitationForms[2]._id,
        idNumber: 'PWD-2024-001',
        role: 'Visitor',
        studentStatus: null,
        isPriority: true,
        status: 'waiting',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        calledAt: null,
        servedAt: null,
        completedAt: null,
        skippedAt: null,
        estimatedWaitTime: 20,
        rating: null,
        remarks: '',
        processedBy: null
      },
      {
        queueNumber: 5,
        office: 'admissions',
        windowId: null,
        serviceId: applicationService._id.toString(),
        visitationFormId: visitationForms[6]._id,
        idNumber: 'SC-2024-002',
        role: 'Visitor',
        studentStatus: null,
        isPriority: true,
        status: 'waiting',
        isCurrentlyServing: false,
        queuedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        calledAt: null,
        servedAt: null,
        completedAt: null,
        skippedAt: null,
        estimatedWaitTime: 25,
        rating: null,
        remarks: '',
        processedBy: null
      }
    ]);
    console.log(`✅ Created ${queues.length} queues`);

    // Seed Ratings for completed queues (matching real system behavior)
    console.log('⭐ Creating ratings for completed queues...');
    const completedQueuesWithRatings = queues.filter(q => q.status === 'completed' && q.rating);

    const ratings = [];
    for (const queue of completedQueuesWithRatings) {
      const visitationForm = visitationForms.find(vf => vf._id.equals(queue.visitationFormId));

      ratings.push({
        rating: queue.rating,
        ratingType: 'overall_experience', // Default type for kiosk submissions
        queueId: queue._id,
        customerName: visitationForm?.customerName || 'Anonymous Customer',
        customerEmail: visitationForm?.email || undefined,
        customerRole: queue.role,
        office: queue.office,
        status: 'approved', // Auto-approved for kiosk ratings
        createdAt: queue.completedAt, // Use queue completion time as rating time
        updatedAt: queue.completedAt
      });
    }

    await Rating.insertMany(ratings);
    console.log(`✅ Created ${ratings.length} ratings`);

    // Seed Settings (singleton)
    console.log('⚙️ Creating system settings...');
    const settings = await Settings.create({
      systemName: 'LVCampusConnect System',
      systemVersion: '1.0.0',
      queueSettings: {
        isEnabled: true,
        globalQueueNumbering: true,
        maxQueueNumber: 99,
        resetQueueDaily: true,
        resetTime: "00:00",
        allowPriorityQueue: true,
        maxWaitTime: 120
      },
      kioskSettings: {
        idleTimeout: 300,
        idleWarningTime: 30,
        autoRefreshInterval: 30,
        enableTextToSpeech: true,
        voiceSettings: {
          rate: 0.8,
          pitch: 1.0,
          volume: 1.0,
          voice: 'female'
        }
      },
      displaySettings: {
        theme: {
          primaryColor: '#1F3463',
          secondaryColor: '#FFE251',
          backgroundColor: '#FFFFFF',
          textColor: '#000000'
        },
        layout: {
          orientation: 'landscape',
          aspectRatio: '16:9'
        },
        fonts: {
          primary: 'SF Pro Rounded',
          secondary: 'Days One'
        }
      },
      officeSettings: {
        registrar: {
          isEnabled: true,
          displayName: "Registrar's Office",
          description: 'Student records, transcripts, enrollment verification',
          location: 'Ground Floor, Administration Building',
          operatingHours: {
            start: "08:00",
            end: "17:00"
          },
          operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          maxWindows: 5
        },
        admissions: {
          isEnabled: true,
          displayName: 'Admissions Office',
          description: 'New student applications, admission requirements',
          location: 'Second Floor, Administration Building',
          operatingHours: {
            start: "08:00",
            end: "17:00"
          },
          operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          maxWindows: 3
        }
      },
      notificationSettings: {
        enableEmailNotifications: false,
        enableSMSNotifications: false,
        enablePushNotifications: true,
        queueCallNotification: true,
        reminderNotification: true,
        reminderTime: 5
      },
      securitySettings: {
        sessionTimeout: 60,
        maxLoginAttempts: 5,
        lockoutDuration: 15,
        requirePasswordChange: false,
        passwordChangeInterval: 90
      },
      auditSettings: {
        enableAuditLog: true,
        retentionPeriod: 365,
        logLevel: 'info'
      },
      lastUpdatedBy: superAdmin._id
    });
    console.log('✅ Created system settings');

    console.log('');
    console.log('🎉 Database seeding completed successfully!');
    console.log('=========================================================');
    console.log('📊 Summary:');
    console.log(`   🏢 Offices: ${offices.length}`);
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🔧 Services: ${services.length}`);
    console.log(`   🪟 Windows: ${windows.length}`);
    console.log(`   📝 Visitation Forms: ${visitationForms.length}`);
    console.log(`   📋 Queues: ${queues.length}`);
    console.log(`   ⭐ Ratings: ${ratings.length}`);
    console.log(`   ⚙️ Settings: 1 (singleton)`);
    console.log('');
    console.log('📈 Queue Status Breakdown:');
    console.log(`   ✅ Completed (with ratings): ${queues.filter(q => q.status === 'completed' && q.rating).length}`);
    console.log(`   🔄 Currently Serving: ${queues.filter(q => q.status === 'serving').length}`);
    console.log(`   ⏳ Waiting: ${queues.filter(q => q.status === 'waiting').length}`);
    console.log('');
    console.log('🔐 Test Credentials:');
    console.log('   Super Admin: admin@lvcampusconnect.edu / Admin123!');
    console.log('   Registrar Admin: registrar.admin@lvcampusconnect.edu / Registrar123!');
    console.log('   Admissions Admin: admissions.admin@lvcampusconnect.edu / Admissions123!');
    console.log('   Senior Management Admin: seniormanagement.admin@lvcampusconnect.edu / SeniorMgmt123!');
    console.log('');
    console.log('✅ All models seeded with complete field data!');
    console.log('✅ Rating documents created matching real system behavior!');
    console.log('✅ MongoDB Atlas connection verified and working!');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seeding
seedDatabase();

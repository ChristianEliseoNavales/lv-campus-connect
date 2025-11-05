const mongoose = require('mongoose');
const Service = require('../models/Service');
const Window = require('../models/Window');
const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const User = require('../models/User');
const Settings = require('../models/Settings');

// Load environment variables
require('dotenv').config();

// MongoDB connection string from .env file
const MONGODB_URI = process.env.MONGODB_URI;

async function clearDatabase() {
  console.log('🗑️  Clearing existing database records...');
  
  try {
    // Clear all collections
    await Service.deleteMany({});
    await Window.deleteMany({});
    await Queue.deleteMany({});
    await VisitationForm.deleteMany({});
    await User.deleteMany({});
    await Settings.deleteMany({});
    
    console.log('✅ Database cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

async function seedUsers() {
  console.log('👥 Creating admin users...');
  
  const users = [
    {
      name: 'MIS Super Admin',
      email: 'admin@lvcampusconnect.edu',
      password: 'Admin123!', // Will be hashed by the User model pre-save hook
      role: 'super_admin',
      // No department required for super_admin
      isActive: true
    },
    {
      name: 'Registrar Admin',
      email: 'registrar@lvcampusconnect.edu',
      password: 'Registrar123!', // Will be hashed by the User model pre-save hook
      role: 'registrar_admin',
      department: 'Registrar', // Match User model enum
      isActive: true
    },
    {
      name: 'Admissions Admin',
      email: 'admissions@lvcampusconnect.edu',
      password: 'Admissions123!', // Will be hashed by the User model pre-save hook
      role: 'admissions_admin',
      department: 'Admissions', // Match User model enum
      isActive: true
    }
  ];
  
  const createdUsers = await User.insertMany(users);
  console.log(`✅ Created ${createdUsers.length} admin users`);
  return createdUsers;
}

async function seedServices() {
  console.log('🛠️  Creating services...');
  
  const services = [
    // Registrar Services
    {
      name: 'Transcript Request',
      department: 'registrar',
      isActive: true
    },
    {
      name: 'Enrollment Verification',
      department: 'registrar',
      isActive: true
    },
    {
      name: 'Grade Change Request',
      department: 'registrar',
      isActive: true
    },
    {
      name: 'Student Records Update',
      department: 'registrar',
      isActive: true
    },
    {
      name: 'Enroll',
      department: 'registrar',
      isActive: true
    },
    {
      name: 'Transfer Credit Evaluation',
      department: 'registrar',
      isActive: true
    },
    
    // Admissions Services
    {
      name: 'Application Assistance',
      department: 'admissions',
      isActive: true
    },
    {
      name: 'Admission Requirements',
      department: 'admissions',
      isActive: true
    },
    {
      name: 'Transfer Student Services',
      department: 'admissions',
      isActive: true
    },
    {
      name: 'International Student Services',
      department: 'admissions',
      isActive: true
    },
    {
      name: 'Campus Tour Request',
      department: 'admissions',
      isActive: true
    }
  ];
  
  const createdServices = await Service.insertMany(services);
  console.log(`✅ Created ${createdServices.length} services`);
  return createdServices;
}

async function seedWindows(users, services) {
  console.log('🪟 Creating windows...');
  
  // Find admin users
  const registrarAdmin = users.find(u => u.role === 'Registrar Admin');
  const admissionsAdmin = users.find(u => u.role === 'Admissions Admin');
  
  // Find services
  const registrarServices = services.filter(s => s.department === 'registrar');
  const admissionsServices = services.filter(s => s.department === 'admissions');
  
  const windows = [
    // Registrar Windows
    {
      name: 'Registrar Window 1',
      department: 'registrar',
      serviceId: registrarServices.find(s => s.name === 'Transcript Request')._id,
      assignedAdmin: registrarAdmin._id,
      isOpen: true // IMPORTANT: Window must be open
    },
    {
      name: 'Registrar Window 2',
      department: 'registrar',
      serviceId: registrarServices.find(s => s.name === 'Enroll')._id,
      assignedAdmin: registrarAdmin._id,
      isOpen: true // IMPORTANT: Window must be open
    },
    {
      name: 'Registrar Window 3',
      department: 'registrar',
      serviceId: registrarServices.find(s => s.name === 'Enrollment Verification')._id,
      assignedAdmin: registrarAdmin._id,
      isOpen: true // IMPORTANT: Window must be open
    },
    
    // Admissions Windows
    {
      name: 'Admissions Window 1',
      department: 'admissions',
      serviceId: admissionsServices.find(s => s.name === 'Application Assistance')._id,
      assignedAdmin: admissionsAdmin._id,
      isOpen: true // IMPORTANT: Window must be open
    },
    {
      name: 'Admissions Window 2',
      department: 'admissions',
      serviceId: admissionsServices.find(s => s.name === 'Admission Requirements')._id,
      assignedAdmin: admissionsAdmin._id,
      isOpen: true // IMPORTANT: Window must be open
    }
  ];
  
  const createdWindows = await Window.insertMany(windows);
  console.log(`✅ Created ${createdWindows.length} windows (all open and ready)`);
  return createdWindows;
}

async function seedSettings() {
  console.log('⚙️  Creating system settings...');

  // Settings model uses singleton pattern, so we create one settings document
  const settingsData = {
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
    departmentSettings: {
      registrar: {
        isEnabled: true,
        displayName: "Registrar's Office",
        description: 'Student records, transcripts, enrollment verification'
      },
      admissions: {
        isEnabled: true,
        displayName: 'Admissions Office',
        description: 'New student applications, admission requirements'
      }
    }
  };

  const settings = new Settings(settingsData);
  await settings.save();
  console.log('✅ Created system settings');
  return settings;
}

async function seedDatabase() {
  try {
    console.log('🚀 Starting LVCampusConnect Database Seeding...');
    console.log('📡 Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Clear existing data
    await clearDatabase();
    
    // Seed fresh data
    const users = await seedUsers();
    const services = await seedServices();
    const windows = await seedWindows(users, services);
    const settings = await seedSettings();
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🛠️  Services: ${services.length}`);
    console.log(`   🪟 Windows: ${windows.length} (all open)`);
    console.log(`   ⚙️  Settings: ${settings.length}`);
    console.log('\n✅ LVCampusConnect System is ready for testing!');
    console.log('🔗 You can now submit queue requests at: http://localhost:5173');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeding script
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, clearDatabase };

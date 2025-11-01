const mongoose = require('mongoose');
const Queue = require('../models/Queue');
const VisitationForm = require('../models/VisitationForm');
const Service = require('../models/Service');
const Window = require('../models/Window');
require('dotenv').config();

// Connect to MongoDB
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

// Sample customer data for realistic queue entries
const sampleCustomers = [
  { name: 'Juan Dela Cruz', contact: '+639171234567', email: 'juan.delacruz@email.com' },
  { name: 'Maria Santos', contact: '+639281234567', email: 'maria.santos@email.com' },
  { name: 'Jose Rizal', contact: '+639391234567', email: 'jose.rizal@email.com' },
  { name: 'Ana Garcia', contact: '+639451234567', email: 'ana.garcia@email.com' },
  { name: 'Carlos Mendoza', contact: '+639561234567', email: 'carlos.mendoza@email.com' },
  { name: 'Elena Rodriguez', contact: '+639671234567', email: 'elena.rodriguez@email.com' },
  { name: 'Miguel Torres', contact: '+639781234567', email: 'miguel.torres@email.com' },
  { name: 'Sofia Reyes', contact: '+639891234567', email: 'sofia.reyes@email.com' },
  { name: 'David Morales', contact: '+639901234567', email: 'david.morales@email.com' },
  { name: 'Isabella Cruz', contact: '+639011234567', email: 'isabella.cruz@email.com' },
  { name: 'Gabriel Flores', contact: '+639121234567', email: 'gabriel.flores@email.com' },
  { name: 'Camila Herrera', contact: '+639231234567', email: 'camila.herrera@email.com' },
  { name: 'Adrian Castillo', contact: '+639341234567', email: 'adrian.castillo@email.com' },
  { name: 'Valentina Jimenez', contact: '+639451234567', email: 'valentina.jimenez@email.com' },
  { name: 'Sebastian Vargas', contact: '+639561234567', email: 'sebastian.vargas@email.com' },
  { name: 'Natalia Ruiz', contact: '+639671234567', email: 'natalia.ruiz@email.com' },
  { name: 'Diego Ortega', contact: '+639781234567', email: 'diego.ortega@email.com' },
  { name: 'Lucia Guerrero', contact: '+639891234567', email: 'lucia.guerrero@email.com' },
  { name: 'Mateo Ramos', contact: '+639901234567', email: 'mateo.ramos@email.com' },
  { name: 'Emilia Medina', contact: '+639011234567', email: 'emilia.medina@email.com' }
];

const roles = ['Visitor', 'Student', 'Teacher', 'Alumni'];
const studentStatuses = ['incoming_new', 'continuing'];
const queueStatuses = ['completed', 'cancelled', 'skipped']; // Historical data should be completed
const addresses = [
  'Manila, Philippines',
  'Quezon City, Philippines', 
  'Makati, Philippines',
  'Pasig, Philippines',
  'Taguig, Philippines',
  'Mandaluyong, Philippines',
  'San Juan, Philippines',
  'Marikina, Philippines',
  'Caloocan, Philippines',
  'Malabon, Philippines'
];

// Utility functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomBoolean = (probability = 0.5) => Math.random() < probability;

// Generate random date within the last 3 months
const getRandomDateInLast3Months = () => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const randomTime = threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime());
  return new Date(randomTime);
};

// Generate realistic business hours timestamp (8 AM - 5 PM, Monday-Friday)
const getBusinessHoursDate = (baseDate) => {
  const date = new Date(baseDate);
  
  // Skip weekends
  if (date.getDay() === 0 || date.getDay() === 6) {
    // Move to next Monday
    const daysToAdd = date.getDay() === 0 ? 1 : 2;
    date.setDate(date.getDate() + daysToAdd);
  }
  
  // Set random business hour (8 AM - 5 PM)
  const hour = getRandomInt(8, 17);
  const minute = getRandomInt(0, 59);
  date.setHours(hour, minute, 0, 0);
  
  return date;
};

// Create visitation form for queue entry
const createVisitationForm = async (customer) => {
  const visitationForm = new VisitationForm({
    customerName: customer.name,
    contactNumber: customer.contact,
    email: customer.email,
    address: getRandomElement(addresses),
    idNumber: getRandomBoolean(0.3) ? `ID${getRandomInt(100000, 999999)}` : ''
  });

  return await visitationForm.save();
};

// Generate queue entry
const generateQueueEntry = async (services, windows, queueDate, queueNumber) => {
  try {
    // Select service using weighted selection for bias
    const service = weightedServiceSelection(services);
    const department = service.department;

    // Find windows for this department
    const departmentWindows = windows.filter(w => w.department === department);
    if (departmentWindows.length === 0) {
      console.warn(`⚠️ No windows found for department: ${department}`);
      return null;
    }

    const window = getRandomElement(departmentWindows);
    const customer = getRandomElement(sampleCustomers);
    const role = getRandomElement(roles);

    // Create visitation form (skip for Enroll service as per requirements)
    let visitationForm = null;
    if (service.name !== 'Enroll') {
      visitationForm = await createVisitationForm(customer);
    }

    // Generate timestamps
    const queuedAt = getBusinessHoursDate(queueDate);
    const calledAt = new Date(queuedAt.getTime() + getRandomInt(5, 30) * 60000); // 5-30 minutes later
    const servedAt = new Date(calledAt.getTime() + getRandomInt(2, 10) * 60000); // 2-10 minutes later
    const completedAt = new Date(servedAt.getTime() + getRandomInt(5, 45) * 60000); // 5-45 minutes later

    // Create queue entry
    const queueEntry = new Queue({
      queueNumber,
      department,
      windowId: window._id.toString(),
      serviceId: service._id.toString(),
      visitationFormId: visitationForm ? visitationForm._id : null,
      idNumber: getRandomBoolean(0.2) ? `STU${getRandomInt(100000, 999999)}` : '',
      role,
      studentStatus: role === 'Student' ? getRandomElement(studentStatuses) : undefined,
      isPriority: getRandomBoolean(0.15), // 15% priority queues
      status: getRandomElement(queueStatuses),
      isCurrentlyServing: false,
      queuedAt,
      calledAt,
      servedAt,
      completedAt: getRandomElement(queueStatuses) === 'completed' ? completedAt : undefined,
      skippedAt: getRandomElement(queueStatuses) === 'skipped' ? servedAt : undefined,
      estimatedWaitTime: getRandomInt(10, 60),
      rating: getRandomBoolean(0.7) ? getRandomInt(3, 5) : undefined, // 70% provide ratings
      remarks: getRandomBoolean(0.1) ? 'Historical queue entry' : '',
      processedBy: null
    });

    return await queueEntry.save();
  } catch (error) {
    console.error('Error generating queue entry:', error);
    return null;
  }
};

// Generate realistic daily queue count with weighted distribution (targeting ~1000 queues/year)
const generateRealisticQueueCount = () => {
  const random = Math.random();

  // Adjusted distribution to target ~4 queues per working day (1000 queues / ~250 working days)
  // But with realistic fluctuations for better chart visualization
  if (random < 0.20) {
    // 20% chance of very slow days (0-2 queues)
    return getRandomInt(0, 2);
  } else if (random < 0.60) {
    // 40% chance of normal days (2-6 queues)
    return getRandomInt(2, 6);
  } else if (random < 0.85) {
    // 25% chance of busy days (6-12 queues)
    return getRandomInt(6, 12);
  } else {
    // 15% chance of very busy days (12-20 queues)
    return getRandomInt(12, 20);
  }
};

// Weighted service selection to create strong bias for pie chart testing
const weightedServiceSelection = (services) => {
  // Create strong bias towards certain services for clear pie chart visualization
  const random = Math.random();

  // Find common services to bias towards
  const transcriptService = services.find(s => s.name.includes('Transcript'));
  const enrollService = services.find(s => s.name === 'Enroll');
  const admissionService = services.find(s => s.name.includes('Admission') || s.name.includes('Requirements'));
  const recordsService = services.find(s => s.name.includes('Records') || s.name.includes('Update'));

  // Strong bias distribution for clear pie chart differences
  if (random < 0.40 && transcriptService) {
    return transcriptService; // 40% chance for transcript requests (most common)
  } else if (random < 0.65 && enrollService) {
    return enrollService; // 25% chance for enrollment (second most common)
  } else if (random < 0.80 && admissionService) {
    return admissionService; // 15% chance for admission services (third most common)
  } else if (random < 0.90 && recordsService) {
    return recordsService; // 10% chance for records services (fourth most common)
  } else {
    return getRandomElement(services); // 10% chance for other services
  }
};

// Generate daily queue data
const generateDailyQueues = async (services, windows, date) => {
  const dailyQueueCount = generateRealisticQueueCount();
  const queues = [];

  console.log(`📅 Generating ${dailyQueueCount} queues for ${date.toDateString()}`);

  // Skip if no queues for this day
  if (dailyQueueCount === 0) {
    return queues;
  }

  for (let i = 1; i <= dailyQueueCount; i++) {
    const queueNumber = i; // Sequential numbering for the day
    const queue = await generateQueueEntry(services, windows, date, queueNumber);
    if (queue) {
      queues.push(queue);
    }
  }

  return queues;
};

// Main seeding function
const seedQueueData = async () => {
  try {
    console.log('🚀 Starting LVCampusConnect Queue Data Seeding...');
    console.log('📡 Connecting to MongoDB...');

    await connectDB();

    // Fetch existing services and windows
    console.log('📋 Fetching services and windows...');
    const services = await Service.find({ isActive: true });
    const windows = await Window.find({ isOpen: true });

    if (services.length === 0) {
      console.error('❌ No active services found. Please run seedDatabase.js first.');
      process.exit(1);
    }

    if (windows.length === 0) {
      console.error('❌ No open windows found. Please run seedDatabase.js first.');
      process.exit(1);
    }

    console.log(`✅ Found ${services.length} services and ${windows.length} windows`);
    console.log('Services:', services.map(s => `${s.name} (${s.department})`).join(', '));
    console.log('Windows:', windows.map(w => `${w.name} (${w.department})`).join(', '));

    // Clear existing queue and visitation form data
    console.log('🗑️ Clearing existing queue and visitation form data...');
    await Queue.deleteMany({});
    await VisitationForm.deleteMany({});
    console.log('✅ Existing data cleared');

    // Generate 1 year of data (target: 1000 queues)
    console.log('📊 Generating 1 year of historical queue data (target: 1000 queues)...');
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    let totalQueues = 0;
    let currentDate = new Date(oneYearAgo);
    let workingDaysCount = 0;

    // Count working days first to calculate average queues per day
    let tempDate = new Date(oneYearAgo);
    while (tempDate <= now) {
      if (tempDate.getDay() !== 0 && tempDate.getDay() !== 6) {
        workingDaysCount++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    console.log(`📅 Working days in year: ${workingDaysCount}`);
    console.log(`🎯 Target average: ${Math.round(1000 / workingDaysCount)} queues per day`);

    while (currentDate <= now) {
      // Skip weekends for business data
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const dailyQueues = await generateDailyQueues(services, windows, new Date(currentDate));
        totalQueues += dailyQueues.length;
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('\n🎉 Queue data seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   📋 Total queues generated: ${totalQueues}`);
    console.log(`   📅 Date range: ${oneYearAgo.toDateString()} to ${now.toDateString()}`);
    console.log(`   🛠️ Services used: ${services.length}`);
    console.log(`   🪟 Windows used: ${windows.length}`);
    console.log(`   📈 Average per working day: ${Math.round(totalQueues / workingDaysCount)}`);
    console.log('\n✅ LVCampusConnect System now has 1 year of historical data for charts!');

  } catch (error) {
    console.error('❌ Queue data seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seeding script
if (require.main === module) {
  seedQueueData();
}

module.exports = { seedQueueData };

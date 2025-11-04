const mongoose = require('mongoose');
const { Window, Service } = require('../models');
require('dotenv').config();

/**
 * Script to create Priority Windows for both Registrar and Admissions offices
 * Priority Windows should have ALL services assigned to them
 */
async function createPriorityWindows() {
  try {
    console.log('🚀 Creating Priority Windows...');
    console.log('📡 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check for existing Priority Windows
    const existingRegistrarPriority = await Window.findOne({
      office: 'registrar',
      name: 'Priority'
    });

    const existingAdmissionsPriority = await Window.findOne({
      office: 'admissions',
      name: 'Priority'
    });

    // Get all services for each office
    const registrarServices = await Service.find({
      office: 'registrar',
      isActive: true
    });

    const admissionsServices = await Service.find({
      office: 'admissions',
      isActive: true
    });

    console.log(`\n📋 Found ${registrarServices.length} registrar services`);
    console.log(`📋 Found ${admissionsServices.length} admissions services`);

    // Create or update Registrar Priority Window
    if (existingRegistrarPriority) {
      console.log('\n⚠️  Registrar Priority Window already exists');
      console.log('   Updating services to include ALL registrar services...');
      
      existingRegistrarPriority.serviceIds = registrarServices.map(s => s._id);
      existingRegistrarPriority.isOpen = true;
      await existingRegistrarPriority.save();
      
      console.log('✅ Updated Registrar Priority Window');
      console.log(`   Services: ${registrarServices.map(s => s.name).join(', ')}`);
    } else {
      console.log('\n➕ Creating new Registrar Priority Window...');
      
      const registrarPriorityWindow = new Window({
        name: 'Priority',
        office: 'registrar',
        serviceIds: registrarServices.map(s => s._id),
        isOpen: true,
        isServing: true
      });
      
      await registrarPriorityWindow.save();
      console.log('✅ Created Registrar Priority Window');
      console.log(`   Services: ${registrarServices.map(s => s.name).join(', ')}`);
    }

    // Create or update Admissions Priority Window
    if (existingAdmissionsPriority) {
      console.log('\n⚠️  Admissions Priority Window already exists');
      console.log('   Updating services to include ALL admissions services...');
      
      existingAdmissionsPriority.serviceIds = admissionsServices.map(s => s._id);
      existingAdmissionsPriority.isOpen = true;
      await existingAdmissionsPriority.save();
      
      console.log('✅ Updated Admissions Priority Window');
      console.log(`   Services: ${admissionsServices.map(s => s.name).join(', ')}`);
    } else {
      console.log('\n➕ Creating new Admissions Priority Window...');
      
      const admissionsPriorityWindow = new Window({
        name: 'Priority',
        office: 'admissions',
        serviceIds: admissionsServices.map(s => s._id),
        isOpen: true,
        isServing: true
      });
      
      await admissionsPriorityWindow.save();
      console.log('✅ Created Admissions Priority Window');
      console.log(`   Services: ${admissionsServices.map(s => s.name).join(', ')}`);
    }

    // Verify Priority Windows
    console.log('\n🔍 Verifying Priority Windows...');
    const allPriorityWindows = await Window.find({ name: 'Priority' })
      .populate('serviceIds', 'name office');
    
    console.log(`\n✅ Found ${allPriorityWindows.length} Priority Windows:`);
    allPriorityWindows.forEach(window => {
      console.log(`\n   📍 ${window.office.toUpperCase()} Priority Window:`);
      console.log(`      - Name: ${window.name}`);
      console.log(`      - Office: ${window.office}`);
      console.log(`      - Is Open: ${window.isOpen}`);
      console.log(`      - Services (${window.serviceIds.length}):`);
      window.serviceIds.forEach(service => {
        console.log(`        * ${service.name}`);
      });
    });

    console.log('\n🎉 Priority Windows setup completed successfully!');
    console.log('✅ Priority queues will now be assigned to Priority Windows');

  } catch (error) {
    console.error('❌ Error creating Priority Windows:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  createPriorityWindows();
}

module.exports = { createPriorityWindows };


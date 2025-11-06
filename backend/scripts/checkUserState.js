const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User } = require('../models');

async function checkUserState() {
  try {
    console.log('🔍 Checking User State...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find the Super Admin user
    const user = await User.findOne({ email: 'christianeliseoisip@student.laverdad.edu.ph' });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('📋 User Record:');
    console.log('=====================================');
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Role:', user.role);
    console.log('Access Level:', user.accessLevel);
    console.log('Office:', user.office);
    console.log('Is Active:', user.isActive);
    console.log('Page Access:', JSON.stringify(user.pageAccess, null, 2));
    console.log('Google ID:', user.googleId ? 'Set' : 'Not Set');
    console.log('Profile Picture:', user.profilePicture ? 'Set' : 'Not Set');
    console.log('=====================================\n');
    
    // Check if role format is correct
    console.log('🔍 Role Format Validation:');
    const validRoles = [
      'MIS Super Admin',
      'MIS Admin',
      'MIS Admin Staff',
      'Registrar Admin',
      'Registrar Admin Staff',
      'Admissions Admin',
      'Admissions Admin Staff',
      'Senior Management Admin',
      'Senior Management Admin Staff'
    ];
    
    if (validRoles.includes(user.role)) {
      console.log('✅ Role format is CORRECT:', user.role);
    } else {
      console.log('❌ Role format is INCORRECT:', user.role);
      console.log('   Expected one of:', validRoles.join(', '));
    }
    
    // Check if accessLevel is set
    if (user.accessLevel) {
      console.log('✅ Access Level is set:', user.accessLevel);
    } else {
      console.log('❌ Access Level is NOT set');
    }
    
    // Check if office is set
    if (user.office) {
      console.log('✅ Office is set:', user.office);
    } else {
      console.log('❌ Office is NOT set');
    }
    
    // Check if pageAccess is populated
    if (user.pageAccess && user.pageAccess.length > 0) {
      console.log('✅ Page Access is populated with', user.pageAccess.length, 'pages');
    } else {
      console.log('❌ Page Access is EMPTY or NOT set');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 MongoDB connection closed');
  }
}

checkUserState();


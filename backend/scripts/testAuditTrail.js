const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { AuditTrail } = require('../models');
const AuditService = require('../services/auditService');

async function testAuditTrail() {
  try {
    console.log('🧪 Testing Audit Trail System...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Mock user and request objects
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@admin.com',
      name: 'Test Admin',
      role: 'super_admin'
    };
    
    const mockReq = {
      ip: '127.0.0.1',
      get: (header) => header === 'User-Agent' ? 'Test-Agent/1.0' : null,
      method: 'POST',
      originalUrl: '/api/test',
      url: '/api/test'
    };
    
    // Test 1: Basic audit logging
    console.log('\n📝 Test 1: Basic audit logging');
    const auditEntry1 = await AuditService.logAction({
      user: mockUser,
      action: 'TEST_ACTION',
      actionDescription: 'Testing audit trail system',
      resourceType: 'Test',
      resourceId: '507f1f77bcf86cd799439012',
      resourceName: 'Test Resource',
      req: mockReq,
      statusCode: 200,
      success: true,
      severity: 'LOW',
      tags: ['test', 'audit']
    });
    
    if (auditEntry1) {
      console.log('✅ Basic audit entry created:', auditEntry1._id);
    } else {
      console.log('❌ Failed to create basic audit entry');
    }
    
    // Test 2: CRUD operation logging
    console.log('\n📝 Test 2: CRUD operation logging');
    const auditEntry2 = await AuditService.logCRUD({
      user: mockUser,
      action: 'CREATE',
      resourceType: 'User',
      resourceId: '507f1f77bcf86cd799439013',
      resourceName: 'John Doe (john@example.com)',
      req: mockReq,
      success: true,
      newValues: {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'registrar_admin'
      }
    });
    
    if (auditEntry2) {
      console.log('✅ CRUD audit entry created:', auditEntry2._id);
    } else {
      console.log('❌ Failed to create CRUD audit entry');
    }
    
    // Test 3: Queue operation logging
    console.log('\n📝 Test 3: Queue operation logging');
    const auditEntry3 = await AuditService.logQueue({
      user: mockUser,
      action: 'QUEUE_CALL',
      queueId: '507f1f77bcf86cd799439014',
      queueNumber: 42,
      department: 'registrar',
      req: mockReq,
      success: true,
      metadata: {
        windowId: '507f1f77bcf86cd799439015',
        windowName: 'Window 1',
        customerName: 'Jane Smith'
      }
    });
    
    if (auditEntry3) {
      console.log('✅ Queue audit entry created:', auditEntry3._id);
    } else {
      console.log('❌ Failed to create queue audit entry');
    }
    
    // Test 4: Settings operation logging
    console.log('\n📝 Test 4: Settings operation logging');
    const auditEntry4 = await AuditService.logSettings({
      user: mockUser,
      action: 'SETTINGS_UPDATE',
      settingName: 'Registrar Queue Toggle',
      req: mockReq,
      success: true,
      oldValues: { isEnabled: false },
      newValues: { isEnabled: true }
    });
    
    if (auditEntry4) {
      console.log('✅ Settings audit entry created:', auditEntry4._id);
    } else {
      console.log('❌ Failed to create settings audit entry');
    }
    
    // Test 5: Authentication logging
    console.log('\n📝 Test 5: Authentication logging');
    const auditEntry5 = await AuditService.logAuth({
      user: mockUser,
      action: 'LOGIN',
      req: mockReq,
      success: true
    });
    
    if (auditEntry5) {
      console.log('✅ Auth audit entry created:', auditEntry5._id);
    } else {
      console.log('❌ Failed to create auth audit entry');
    }
    
    // Verify all entries were created
    console.log('\n📊 Verification: Checking audit trail entries');
    const totalEntries = await AuditTrail.countDocuments();
    console.log(`Total audit entries in database: ${totalEntries}`);
    
    // Show recent entries
    const recentEntries = await AuditTrail.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('action actionDescription resourceType success createdAt');
    
    console.log('\n📋 Recent audit entries:');
    recentEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.action} - ${entry.actionDescription} (${entry.success ? 'SUCCESS' : 'FAILED'}) - ${entry.createdAt}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Audit trail test completed successfully!');
    
  } catch (error) {
    console.error('❌ Audit trail test error:', error);
    process.exit(1);
  }
}

testAuditTrail();

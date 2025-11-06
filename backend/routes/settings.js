const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const Settings = require('../models/Settings');
const { AuditService } = require('../middleware/auditMiddleware');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Helper function to read settings
const readSettings = async () => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading settings:', error);
    throw new Error('Failed to read settings');
  }
};

// Helper function to write settings
const writeSettings = async (settings) => {
  try {
    settings.lastUpdated = new Date().toISOString();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return settings;
  } catch (error) {
    console.error('Error writing settings:', error);
    throw new Error('Failed to write settings');
  }
};

// GET /api/settings - Get all settings
router.get('/', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/queue/:department - Get queue settings for specific department
router.get('/queue/:department', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
  try {
    const { department } = req.params;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    // Try to read from MongoDB first (for cloud deployment)
    try {
      const mongoSettings = await Settings.getCurrentSettings();

      // Ensure officeSettings exists
      if (mongoSettings.officeSettings && mongoSettings.officeSettings[department]) {
        return res.json({
          isEnabled: mongoSettings.officeSettings[department].isEnabled || false,
          lastUpdated: mongoSettings.officeSettings[department].lastUpdated || new Date().toISOString()
        });
      }
    } catch (mongoError) {
      console.warn('MongoDB settings not available, falling back to JSON file:', mongoError.message);
    }

    // Fallback to JSON file (for local development)
    try {
      const settings = await readSettings();

      if (!settings.queueSystem[department]) {
        return res.status(404).json({ error: 'Department not found' });
      }

      res.json(settings.queueSystem[department]);
    } catch (fileError) {
      console.error('Error reading settings from file:', fileError);

      // If both MongoDB and file fail, return default values
      return res.json({
        isEnabled: false,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error in /queue/:department endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/queue/:department/toggle - Toggle queue system for department
router.put('/queue/:department/toggle', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const { department } = req.params;
    const { isEnabled } = req.body;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      await AuditService.logSettings({
        user: req.user,
        action: 'SETTINGS_UPDATE',
        settingName: `${department} Queue Toggle`,
        req,
        success: false,
        errorMessage: 'Invalid department'
      });

      return res.status(400).json({ error: 'Invalid department' });
    }

    if (typeof isEnabled !== 'boolean') {
      await AuditService.logSettings({
        user: req.user,
        action: 'SETTINGS_UPDATE',
        settingName: `${department} Queue Toggle`,
        req,
        success: false,
        errorMessage: 'isEnabled must be a boolean'
      });

      return res.status(400).json({ error: 'isEnabled must be a boolean' });
    }

    const timestamp = new Date().toISOString();
    let oldValue = false;

    // Update MongoDB Settings model (primary storage for cloud deployment)
    let mongoSettings = await Settings.findOne();
    if (!mongoSettings) {
      mongoSettings = new Settings();
    }

    // Ensure officeSettings exists
    if (!mongoSettings.officeSettings) {
      mongoSettings.officeSettings = {};
    }

    // Update the specific office's isEnabled status
    if (!mongoSettings.officeSettings[department]) {
      mongoSettings.officeSettings[department] = {};
    }

    // Store old value for audit trail
    oldValue = mongoSettings.officeSettings[department].isEnabled || false;

    mongoSettings.officeSettings[department].isEnabled = isEnabled;
    mongoSettings.officeSettings[department].lastUpdated = timestamp;

    await mongoSettings.save();

    // Update JSON file (for backward compatibility with local development)
    try {
      const settings = await readSettings();

      if (settings.queueSystem && settings.queueSystem[department]) {
        settings.queueSystem[department].isEnabled = isEnabled;
        settings.queueSystem[department].lastUpdated = timestamp;
        await writeSettings(settings);
      }
    } catch (fileError) {
      console.warn('Could not update JSON file (this is normal for cloud deployment):', fileError.message);
    }

    // Log successful settings update
    await AuditService.logSettings({
      user: req.user,
      action: 'SETTINGS_UPDATE',
      settingName: `${department} Queue Toggle`,
      req,
      success: true,
      oldValues: { isEnabled: oldValue },
      newValues: { isEnabled: isEnabled }
    });

    // Prepare response data
    const responseData = {
      isEnabled: isEnabled,
      lastUpdated: timestamp
    };

    // Emit real-time update to specific rooms
    const io = req.app.get('io');
    io.to(`admin-${department}`).emit('settings-updated', {
      department,
      type: 'queue-toggle',
      data: responseData
    });

    // Also emit to kiosk room for public interface updates
    io.to('kiosk').emit('settings-updated', {
      department,
      type: 'queue-toggle',
      data: responseData
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error toggling queue system:', error);

    await AuditService.logSettings({
      user: req.user,
      action: 'SETTINGS_UPDATE',
      settingName: `${req.params.department} Queue Toggle`,
      req,
      success: false,
      errorMessage: error.message
    });

    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings - Update settings
router.put('/', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const updates = req.body;
    const settings = await readSettings();
    
    // Merge updates with existing settings
    const updatedSettings = { ...settings, ...updates };
    const result = await writeSettings(updatedSettings);
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('settings-updated', {
      type: 'general',
      data: result
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/location/:department - Update department location
router.put('/location/:department', verifyToken, requireRole(['MIS Super Admin', 'Registrar Admin', 'Admissions Admin']), async (req, res) => {
  try {
    const { department } = req.params;
    const { location } = req.body;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    // Validate location
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return res.status(400).json({ error: 'Location is required and must be a non-empty string' });
    }

    if (location.trim().length > 200) {
      return res.status(400).json({ error: 'Location must be less than 200 characters' });
    }

    // Get current settings
    const settings = await Settings.getCurrentSettings();

    // Ensure office settings exist
    if (!settings.officeSettings || !settings.officeSettings[department]) {
      return res.status(400).json({ error: 'Office settings not found' });
    }

    // Update location for the specific office
    settings.officeSettings[department].location = location.trim();
    await settings.save();

    // Emit real-time update to specific rooms
    const io = req.app.get('io');
    io.to(`admin-${department}`).emit('settings-updated', {
      department,
      type: 'location-updated',
      data: {
        location: settings.officeSettings[department].location
      }
    });

    // Also emit to kiosk room for public interface updates
    io.to('kiosk').emit('settings-updated', {
      department,
      type: 'location-updated',
      data: {
        location: settings.officeSettings[department].location
      }
    });

    res.json({
      location: settings.officeSettings[department].location
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/location/:department - Get department location
router.get('/location/:department', verifyToken, requireRole(['MIS Super Admin', 'MIS Admin', 'Registrar Admin', 'Registrar Admin Staff', 'Admissions Admin', 'Admissions Admin Staff']), async (req, res) => {
  try {
    const { department } = req.params;

    // Validate department
    if (!['registrar', 'admissions'].includes(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    // Get current settings
    const settings = await Settings.getCurrentSettings();

    // Ensure office settings exist
    if (!settings.officeSettings || !settings.officeSettings[department]) {
      return res.json({ location: '' });
    }

    res.json({
      location: settings.officeSettings[department].location || ''
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

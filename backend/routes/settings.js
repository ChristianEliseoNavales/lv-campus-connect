const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const Settings = require('../models/Settings');
const { AuditService } = require('../middleware/auditMiddleware');

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
router.get('/', async (req, res) => {
  try {
    const settings = await readSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/queue/:department - Get queue settings for specific department
router.get('/queue/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const settings = await readSettings();
    
    if (!settings.queueSystem[department]) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json(settings.queueSystem[department]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/queue/:department/toggle - Toggle queue system for department
router.put('/queue/:department/toggle', async (req, res) => {
  try {
    const { department } = req.params;
    const { isEnabled } = req.body;

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

    // Update JSON file (for backward compatibility)
    const settings = await readSettings();

    if (!settings.queueSystem[department]) {
      await AuditService.logSettings({
        user: req.user,
        action: 'SETTINGS_UPDATE',
        settingName: `${department} Queue Toggle`,
        req,
        success: false,
        errorMessage: 'Department not found'
      });

      return res.status(404).json({ error: 'Department not found' });
    }

    // Store old value for audit trail
    const oldValue = settings.queueSystem[department].isEnabled;

    settings.queueSystem[department].isEnabled = isEnabled;
    settings.queueSystem[department].lastUpdated = new Date().toISOString();

    const updatedSettings = await writeSettings(settings);

    // Update MongoDB Settings model (for public kiosk interface)
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
    mongoSettings.officeSettings[department].isEnabled = isEnabled;

    await mongoSettings.save();

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

    // Emit real-time update to specific rooms
    const io = req.app.get('io');
    io.to(`admin-${department}`).emit('settings-updated', {
      department,
      type: 'queue-toggle',
      data: settings.queueSystem[department]
    });

    // Also emit to kiosk room for public interface updates
    io.to('kiosk').emit('settings-updated', {
      department,
      type: 'queue-toggle',
      data: settings.queueSystem[department]
    });

    res.json(updatedSettings.queueSystem[department]);
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
router.put('/', async (req, res) => {
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
router.put('/location/:department', async (req, res) => {
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
router.get('/location/:department', async (req, res) => {
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

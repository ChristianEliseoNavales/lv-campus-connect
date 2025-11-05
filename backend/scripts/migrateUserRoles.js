/**
 * Migration Script: Update User Roles to New RBAC Structure
 * 
 * This script migrates existing users from the old role structure to the new structure:
 * - Adds accessLevel field
 * - Updates role field to combined format (e.g., "MIS Super Admin")
 * - Ensures office field is properly set
 * 
 * Run this script ONCE after deploying the new RBAC changes.
 * 
 * Usage: node backend/scripts/migrateUserRoles.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User } = require('../models');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

/**
 * Map old role values to new structure
 */
const roleMapping = {
  // Old role -> { accessLevel, office, newRole }
  'super_admin': {
    accessLevel: 'super_admin',
    office: 'MIS',
    role: 'MIS Super Admin'
  },
  'registrar_admin': {
    accessLevel: 'admin',
    office: 'Registrar',
    role: 'Registrar Admin'
  },
  'admissions_admin': {
    accessLevel: 'admin',
    office: 'Admissions',
    role: 'Admissions Admin'
  },
  'senior_management_admin': {
    accessLevel: 'admin',
    office: 'Senior Management',
    role: 'Senior Management Admin'
  },
  'admin': {
    // Generic admin - need to determine office from context
    accessLevel: 'admin',
    office: null, // Will be determined from existing office field or pageAccess
    role: null // Will be computed
  },
  'admin_staff': {
    // Generic admin staff - need to determine office from context
    accessLevel: 'admin_staff',
    office: null, // Will be determined from existing office field or pageAccess
    role: null // Will be computed
  }
};

/**
 * Determine office from pageAccess array
 */
const getOfficeFromPageAccess = (pageAccess) => {
  if (!pageAccess || pageAccess.length === 0) return null;

  // Count routes per office
  const officeCounts = {
    'MIS': 0,
    'Registrar': 0,
    'Admissions': 0,
    'Senior Management': 0
  };

  pageAccess.forEach(route => {
    if (route.startsWith('/admin/mis')) officeCounts['MIS']++;
    else if (route.startsWith('/admin/registrar')) officeCounts['Registrar']++;
    else if (route.startsWith('/admin/admissions')) officeCounts['Admissions']++;
    else if (route.startsWith('/admin/seniormanagement')) officeCounts['Senior Management']++;
  });

  // Return office with most routes
  let maxOffice = null;
  let maxCount = 0;
  for (const [office, count] of Object.entries(officeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxOffice = office;
    }
  }

  return maxOffice;
};

/**
 * Compute combined role from office and accessLevel
 */
const computeRole = (office, accessLevel) => {
  if (!office || !accessLevel) return null;

  const accessLevelMap = {
    'super_admin': 'Super Admin',
    'admin': 'Admin',
    'admin_staff': 'Admin Staff'
  };

  return `${office} ${accessLevelMap[accessLevel]}`;
};

/**
 * Main migration function
 */
async function migrateUsers() {
  try {
    console.log(`${colors.cyan}${colors.bright}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}║     User Role Migration Script - New RBAC Structure       ║${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    // Connect to MongoDB
    console.log(`${colors.blue}📡 Connecting to MongoDB...${colors.reset}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}\n`);

    // Fetch all users
    console.log(`${colors.blue}👥 Fetching all users...${colors.reset}`);
    const users = await User.find({});
    console.log(`${colors.green}✅ Found ${users.length} users${colors.reset}\n`);

    if (users.length === 0) {
      console.log(`${colors.yellow}⚠️  No users found. Nothing to migrate.${colors.reset}`);
      return;
    }

    // Migration statistics
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`${colors.cyan}${colors.bright}Starting migration...${colors.reset}\n`);

    // Process each user
    for (const user of users) {
      try {
        console.log(`${colors.blue}Processing: ${user.email} (${user.role})${colors.reset}`);

        // Check if user already has new structure
        if (user.accessLevel && user.role && (
          user.role === 'MIS Super Admin' ||
          user.role === 'MIS Admin' ||
          user.role === 'MIS Admin Staff' ||
          user.role === 'Registrar Admin' ||
          user.role === 'Registrar Admin Staff' ||
          user.role === 'Admissions Admin' ||
          user.role === 'Admissions Admin Staff' ||
          user.role === 'Senior Management Admin' ||
          user.role === 'Senior Management Admin Staff'
        )) {
          console.log(`${colors.yellow}  ⏭️  Already migrated - skipping${colors.reset}\n`);
          skipped++;
          continue;
        }

        // Get mapping for old role
        const mapping = roleMapping[user.role];
        
        let newAccessLevel, newOffice, newRole;

        if (mapping) {
          newAccessLevel = mapping.accessLevel;
          
          // Determine office
          if (mapping.office) {
            newOffice = mapping.office;
          } else {
            // Try to get from existing office field
            newOffice = user.office || getOfficeFromPageAccess(user.pageAccess);
            
            if (!newOffice) {
              console.log(`${colors.red}  ❌ Cannot determine office - skipping${colors.reset}\n`);
              errors++;
              continue;
            }
          }

          // Compute new role
          newRole = mapping.role || computeRole(newOffice, newAccessLevel);
        } else {
          // Unknown old role - try to infer from existing data
          console.log(`${colors.yellow}  ⚠️  Unknown role format, attempting to infer...${colors.reset}`);
          
          newOffice = user.office || getOfficeFromPageAccess(user.pageAccess);
          
          if (!newOffice) {
            console.log(`${colors.red}  ❌ Cannot determine office - skipping${colors.reset}\n`);
            errors++;
            continue;
          }

          // Default to admin_staff if we can't determine
          newAccessLevel = 'admin_staff';
          newRole = computeRole(newOffice, newAccessLevel);
        }

        // Update user
        user.accessLevel = newAccessLevel;
        user.office = newOffice;
        user.role = newRole;

        await user.save();

        console.log(`${colors.green}  ✅ Migrated to: ${newRole} (${newOffice} - ${newAccessLevel})${colors.reset}\n`);
        migrated++;

      } catch (error) {
        console.log(`${colors.red}  ❌ Error: ${error.message}${colors.reset}\n`);
        errors++;
      }
    }

    // Print summary
    console.log(`${colors.cyan}${colors.bright}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}║                    Migration Summary                       ║${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
    console.log(`${colors.green}✅ Successfully migrated: ${migrated}${colors.reset}`);
    console.log(`${colors.yellow}⏭️  Skipped (already migrated): ${skipped}${colors.reset}`);
    console.log(`${colors.red}❌ Errors: ${errors}${colors.reset}`);
    console.log(`${colors.blue}📊 Total users: ${users.length}${colors.reset}\n`);

    if (migrated > 0) {
      console.log(`${colors.green}${colors.bright}🎉 Migration completed successfully!${colors.reset}\n`);
    } else if (skipped === users.length) {
      console.log(`${colors.yellow}${colors.bright}ℹ️  All users already migrated. No changes needed.${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}${colors.bright}⚠️  Migration completed with some issues. Please review errors above.${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`${colors.red}${colors.bright}❌ Migration failed:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log(`${colors.blue}📡 MongoDB connection closed${colors.reset}`);
  }
}

// Run migration
migrateUsers();


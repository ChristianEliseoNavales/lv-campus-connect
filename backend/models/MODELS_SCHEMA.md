# LVCampusConnect System - Database Models Reference

This document provides a comprehensive overview of all database models in the LVCampusConnect System backend. It serves as a living document for schema management, planning, and reference.

---

## Table of Contents

1. [Queue Model](#queue-model)
2. [VisitationForm Model](#visitationform-model)
3. [User Model](#user-model)
4. [Service Model](#service-model)
5. [Window Model](#window-model)
6. [Settings Model](#settings-model)
7. [Rating Model](#rating-model)
8. [Bulletin Model](#bulletin-model)
9. [AuditTrail Model](#audittrail-model)

---

## Queue Model
**File:** `backend/models/Queue.js`
**Purpose:** Manages queue entries for both Registrar and Admissions departments with normalized customer information via VisitationForm reference.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `queueNumber` | Number | Required, min: 1, max: 99 | - | Sequential queue number (1-99, cycles daily) |
| `department` | String | Required, enum: ['registrar', 'admissions'] | - | Department handling the queue |
| `windowId` | String | - | - | Assigned service window (hybrid compatibility) |
| `serviceId` | String | Required | - | Requested service (hybrid compatibility) |
| `visitationFormId` | ObjectId | Optional, Ref: 'VisitationForm' | - | Reference to customer form data (optional for Enroll service) |
| `idNumber` | String | Optional, trim, maxlength: 50 | - | Student/Employee ID for priority users |
| `role` | String | Required, enum: ['Visitor', 'Student', 'Teacher', 'Alumni'] | - | Customer role |
| `studentStatus` | String | enum: ['incoming_new', 'continuing'], required if role='Student' | - | Student enrollment status |
| `isPriority` | Boolean | - | false | Priority queue flag |
| `status` | String | enum: ['waiting', 'serving', 'completed', 'skipped', 'cancelled', 'no-show'] | 'waiting' | Current queue status |
| `isCurrentlyServing` | Boolean | - | false | Currently being served flag |
| `queuedAt` | Date | - | Date.now | Queue creation timestamp |
| `calledAt` | Date | - | - | When customer was called |
| `servedAt` | Date | - | - | When service started |
| `completedAt` | Date | - | - | When service completed |
| `skippedAt` | Date | - | - | When queue was skipped |
| `estimatedWaitTime` | Number | - | 0 | Estimated wait time (minutes) |
| `rating` | Number | min: 1, max: 5 | - | Service rating |
| `processedBy` | Mixed | Ref: 'User' | null | Admin who processed queue (flexible type for compatibility) |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ department: 1, status: 1 }`
- `{ queueNumber: 1, department: 1 }`
- `{ status: 1, queuedAt: 1 }`
- `{ windowId: 1, status: 1 }`
- `{ isCurrentlyServing: 1 }`
- `{ visitationFormId: 1 }`

### Static Methods
- `getNextQueueNumber(department)`: Get next available queue number
- `getCurrentServingNumber(department, windowId)`: Get currently serving number
- `getWaitingQueue(department, windowId)`: Get waiting queue list

### Instance Methods
- `markAsServing(windowId, processedBy)`: Mark queue as being served
- `markAsCompleted(rating, feedback)`: Mark queue as completed

### Relationships
- **Queue** → **VisitationForm** (visitationFormId): References customer form data (normalized schema)
- **Queue** → **Service** (serviceId): References requested service
- **Queue** → **Window** (windowId): References assigned window
- **Queue** → **User** (processedBy): References admin who processed queue

---

## VisitationForm Model
**File:** `backend/models/VisitationForm.js`
**Purpose:** Stores customer information separately from queue entries for normalized database schema. Referenced by Queue model via foreign key.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `customerName` | String | Required, trim, maxlength: 200 | - | Customer's full name |
| `contactNumber` | String | Required, trim, Philippine phone validation | - | Contact number (+63 or 0 format) |
| `email` | String | Required, email validation, lowercase | - | Customer email address |
| `address` | String | Optional, trim, maxlength: 500 | '' | Customer address (optional field) |
| `idNumber` | String | Optional, trim, maxlength: 50 | '' | ID number for priority users (PWD/Senior Citizen/Pregnant) |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ customerName: 1 }`
- `{ email: 1 }`
- `{ contactNumber: 1 }`

### Static Methods
- `createForm(formData)`: Create visitation form with validation

### Instance Methods
- `getCustomerInfo()`: Get formatted customer information object

### Validation Rules
- **contactNumber**: Must match Philippine phone format: `^(\+63|0)[0-9]{10}$`
- **email**: Must be valid email format: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- **customerName**: Required, max 200 characters
- **address**: Optional, max 500 characters
- **idNumber**: Optional, max 50 characters

### Usage Notes
- This model implements normalized database design by separating customer form data from queue entries
- Queue model references VisitationForm via `visitationFormId` foreign key
- Enables data integrity and reduces redundancy
- Supports real-time Socket.io updates between public kiosk submissions and admin dashboard

---

## User Model
**File:** `backend/models/User.js`  
**Purpose:** Manages admin users with role-based access control and Google OAuth integration.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `email` | String | Required, unique, lowercase, email validation | - | User email address |
| `name` | String | Required, trim | - | User full name |
| `password` | String | Required if no googleId | - | Hashed password (bcrypt) |
| `googleId` | String | Sparse index | - | Google OAuth ID |
| `role` | String | Required, enum: ['super_admin', 'registrar_admin', 'admissions_admin', 'hr_admin'] | - | User role |
| `isActive` | Boolean | - | true | Account active status |
| `lastLogin` | Date | - | - | Last login timestamp |
| `profilePicture` | String | - | - | Profile picture URL |
| `department` | String | enum: ['MIS', 'Registrar', 'Admissions', 'HR'], required if not super_admin | - | User department |
| `permissions` | [String] | - | [] | Additional permissions |
| `createdBy` | ObjectId | Ref: 'User' | - | User who created this account |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ email: 1 }`
- `{ role: 1 }`
- `{ isActive: 1 }`

### Pre-save Middleware
- Password hashing with bcrypt (salt rounds from env or default 10)

### Instance Methods
- `comparePassword(candidatePassword)`: Compare password with hash
- `updateLastLogin()`: Update last login timestamp
- `toJSON()`: Remove sensitive data (password, googleId) from JSON output

### API Endpoints
- `GET /api/users` - Fetch all users with optional filtering (role, department, isActive, search)
- `GET /api/users/by-role/:role` - Fetch active users by specific role (for dropdowns)
- `GET /api/users/:id` - Fetch single user by ID
- `POST /api/users` - Create new user with validation and role-based department requirements
- `PUT /api/users/:id` - Update existing user with validation
- `DELETE /api/users/:id` - Soft delete user (sets isActive to false)

### Validation Rules
- **Email**: Must be unique, valid email format, automatically normalized to lowercase
- **Password**: Required for non-OAuth users, minimum 6 characters, automatically hashed with bcrypt
- **Role**: Required, must be one of the defined enum values
- **Department**: Required for non-super_admin roles, must match role context
- **Name**: Required, 2-100 characters, automatically trimmed

### Real-time Features
- Socket.io events emitted on user creation, updates, and deletion
- Real-time updates to admin interfaces when user data changes
- Integration with admin assignment dropdowns for live data fetching

---

## Service Model
**File:** `backend/models/Service.js`
**Purpose:** Manages available services for each department with simplified schema for basic service management.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `name` | String | Required, trim, maxlength: 200 | - | Service name |
| `department` | String | Required, enum: ['registrar', 'admissions'] | - | Department offering service |
| `isActive` | Boolean | - | true | Service active status |
| `createdBy` | ObjectId | Ref: 'User' | - | Creator user |
| `updatedBy` | ObjectId | Ref: 'User' | - | Last updater user |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ department: 1, isActive: 1 }`
- `{ name: 1, department: 1 }` (unique constraint)

### Static Methods
- `getByDepartment(department, activeOnly)`: Get services by department

### Key Features
- **Simplified Schema**: Removed complex fields like description, scheduling, statistics for streamlined service management
- **Unique Constraint**: Service names must be unique within each department
- **Basic Status Management**: Simple active/inactive status control

---

## Window Model
**File:** `backend/models/Window.js`
**Purpose:** Manages service windows with support for multiple service assignments and admin management.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `name` | String | Required, trim | - | Window display name |
| `department` | String | Required, enum: ['registrar', 'admissions'] | - | Department |
| `serviceIds` | [ObjectId] | Ref: 'Service' | [] | Array of assigned services |
| `assignedAdmin` | ObjectId | Ref: 'User' | - | Assigned admin user |
| `isOpen` | Boolean | - | false | Window operational status |
| `isServing` | Boolean | - | true | Window serving status |
| `currentQueue` | ObjectId | Ref: 'Queue' | - | Currently serving queue |
| `createdBy` | ObjectId | Ref: 'User' | - | Creator user |
| `updatedBy` | ObjectId | Ref: 'User' | - | Last updater user |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ department: 1, isOpen: 1 }`
- `{ assignedAdmin: 1 }`
- `{ serviceIds: 1 }`
- `{ name: 1, department: 1 }` (unique constraint)

### Static Methods
- `getByDepartment(department, openOnly)`: Get windows by department
- `getAvailableForService(serviceId)`: Get available windows for service
- `getVisibleServices(department)`: Get all visible services for a department

### Key Features
- **Multiple Service Assignment**: Each window can serve multiple services via serviceIds array
- **Dual Status Control**: Both isOpen (operational) and isServing (serving customers) status flags
- **User Reference**: assignedAdmin properly references User model
- **Unique Constraint**: Window names must be unique within each department
- **Service Aggregation**: Advanced aggregation methods for service visibility

---

## Settings Model
**File:** `backend/models/Settings.js`
**Purpose:** Singleton model for system-wide configuration settings with nested objects for different setting categories.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `systemName` | String | - | 'University Kiosk System' | System display name |
| `systemVersion` | String | - | '1.0.0' | Current system version |

### Queue Settings (`queueSettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `isEnabled` | Boolean | - | true | Queue system enabled |
| `globalQueueNumbering` | Boolean | - | true | Global numbering across departments |
| `maxQueueNumber` | Number | min: 1, max: 999 | 99 | Maximum queue number |
| `resetQueueDaily` | Boolean | - | true | Reset queue numbers daily |
| `resetTime` | String | HH:MM format | "00:00" | Daily reset time |
| `allowPriorityQueue` | Boolean | - | true | Allow priority queuing |
| `maxWaitTime` | Number | - | 120 | Maximum wait time (minutes) |

### Kiosk Settings (`kioskSettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `idleTimeout` | Number | - | 300 | Idle timeout (seconds) |
| `idleWarningTime` | Number | - | 30 | Idle warning time (seconds) |
| `autoRefreshInterval` | Number | - | 30 | Auto refresh interval (seconds) |
| `enableTextToSpeech` | Boolean | - | true | Enable TTS announcements |

### Voice Settings (`kioskSettings.voiceSettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `rate` | Number | min: 0.1, max: 2.0 | 0.8 | Speech rate |
| `pitch` | Number | min: 0.0, max: 2.0 | 1.0 | Speech pitch |
| `volume` | Number | min: 0.0, max: 1.0 | 1.0 | Speech volume |
| `voice` | String | - | 'female' | Voice type |

### Display Settings (`displaySettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `theme.primaryColor` | String | - | '#1F3463' | Primary theme color |
| `theme.secondaryColor` | String | - | '#FFE251' | Secondary theme color |
| `theme.backgroundColor` | String | - | '#FFFFFF' | Background color |
| `theme.textColor` | String | - | '#000000' | Text color |
| `layout.orientation` | String | enum: ['landscape', 'portrait'] | 'landscape' | Display orientation |
| `layout.aspectRatio` | String | - | '16:9' | Display aspect ratio |
| `fonts.primary` | String | - | 'SF Pro Rounded' | Primary font |
| `fonts.secondary` | String | - | 'Days One' | Secondary font |

### Department Settings (`departmentSettings`)
Each department (registrar, admissions) has:
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `isEnabled` | Boolean | - | true | Department enabled |
| `displayName` | String | - | Department name | Display name |
| `description` | String | - | Department description | Description |
| `operatingHours.start` | String | HH:MM | "08:00" | Operating start time |
| `operatingHours.end` | String | HH:MM | "17:00" | Operating end time |
| `operatingDays` | [String] | weekdays | Mon-Fri | Operating days |
| `maxWindows` | Number | min: 1 | varies | Maximum windows |

### Notification Settings (`notificationSettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `enableEmailNotifications` | Boolean | - | false | Email notifications |
| `enableSMSNotifications` | Boolean | - | false | SMS notifications |
| `enablePushNotifications` | Boolean | - | true | Push notifications |
| `queueCallNotification` | Boolean | - | true | Queue call notifications |
| `reminderNotification` | Boolean | - | true | Reminder notifications |
| `reminderTime` | Number | - | 5 | Reminder time (minutes) |

### Security Settings (`securitySettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `sessionTimeout` | Number | - | 60 | Session timeout (minutes) |
| `maxLoginAttempts` | Number | - | 5 | Max login attempts |
| `lockoutDuration` | Number | - | 15 | Lockout duration (minutes) |
| `requirePasswordChange` | Boolean | - | false | Require password change |
| `passwordChangeInterval` | Number | - | 90 | Password change interval (days) |

### Audit Settings (`auditSettings`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `enableAuditLog` | Boolean | - | true | Enable audit logging |
| `retentionPeriod` | Number | - | 365 | Log retention (days) |
| `logLevel` | String | enum: ['error', 'warn', 'info', 'debug'] | 'info' | Logging level |

### Additional Fields
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `lastUpdatedBy` | ObjectId | Ref: 'User' | - | Last updater user |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ _id: 1 }` (unique, singleton pattern)

### Static Methods
- `getCurrentSettings()`: Get current settings (creates if not exists)
- `updateSettings(updates, updatedBy)`: Update settings with deep merge

---

## Rating Model
**File:** `backend/models/Rating.js`
**Purpose:** Comprehensive feedback and rating system with sentiment analysis and moderation capabilities.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `rating` | Number | Required, min: 1, max: 5 | - | Overall rating |
| `feedback` | String | trim, maxlength: 1000 | - | Written feedback |
| `ratingType` | String | Required, enum: ['service', 'window', 'overall_experience', 'staff_performance', 'system_usability'] | - | Type of rating |
| `queueId` | ObjectId | Required, Ref: 'Queue' | - | Related queue entry |
| `serviceId` | ObjectId | Ref: 'Service' | - | Related service |
| `windowId` | ObjectId | Ref: 'Window' | - | Related window |
| `staffId` | ObjectId | Ref: 'User' | - | Related staff member |
| `customerName` | String | Required, trim | - | Customer name |
| `customerEmail` | String | trim, lowercase | - | Customer email |
| `customerRole` | String | Required, enum: ['Visitor', 'Student', 'Teacher', 'Alumni'] | - | Customer role |
| `department` | String | Required, enum: ['registrar', 'admissions'] | - | Department |

### Rating Categories (`categories`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `serviceQuality` | Number | min: 1, max: 5 | - | Service quality rating |
| `staffCourtesy` | Number | min: 1, max: 5 | - | Staff courtesy rating |
| `waitTime` | Number | min: 1, max: 5 | - | Wait time rating |
| `facilityCondition` | Number | min: 1, max: 5 | - | Facility condition rating |
| `systemEaseOfUse` | Number | min: 1, max: 5 | - | System usability rating |

### Additional Feedback
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `suggestions` | String | trim, maxlength: 500 | - | Improvement suggestions |
| `wouldRecommend` | Boolean | - | - | Would recommend service |
| `sentiment` | String | enum: ['positive', 'neutral', 'negative'] | 'neutral' | Sentiment analysis result |
| `sentimentScore` | Number | min: -1, max: 1 | 0 | Sentiment score |

### Status and Moderation
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `status` | String | enum: ['pending', 'approved', 'rejected', 'flagged'] | 'approved' | Moderation status |
| `isPublic` | Boolean | - | true | Public visibility |
| `isAnonymous` | Boolean | - | false | Anonymous feedback |
| `moderatedBy` | ObjectId | Ref: 'User' | - | Moderator user |
| `moderatedAt` | Date | - | - | Moderation timestamp |
| `moderationReason` | String | trim | - | Moderation reason |

### Response System (`response`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `content` | String | trim, maxlength: 500 | - | Response content |
| `respondedBy` | ObjectId | Ref: 'User' | - | Responder user |
| `respondedAt` | Date | - | - | Response timestamp |

### Metadata and Follow-up
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `ipAddress` | String | - | - | Client IP address |
| `userAgent` | String | trim | - | Client user agent |
| `followUpRequired` | Boolean | - | false | Requires follow-up |
| `followUpCompleted` | Boolean | - | false | Follow-up completed |
| `followUpNotes` | String | trim | - | Follow-up notes |
| `tags` | [String] | trim, lowercase | [] | Categorization tags |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ department: 1, createdAt: -1 }`
- `{ serviceId: 1, rating: -1 }`
- `{ windowId: 1, rating: -1 }`
- `{ staffId: 1, rating: -1 }`
- `{ queueId: 1 }`
- `{ rating: -1, createdAt: -1 }`
- `{ ratingType: 1, department: 1 }`
- `{ status: 1, isPublic: 1 }`
- `{ sentiment: 1, createdAt: -1 }`

### Static Methods
- `getServiceAverageRating(serviceId)`: Get service rating statistics
- `getWindowAverageRating(windowId)`: Get window rating statistics
- `getDepartmentSummary(department, startDate, endDate)`: Get department rating summary

### Instance Methods
- `analyzeSentiment()`: Analyze feedback sentiment (keyword-based)

### Pre-save Middleware
- Automatic sentiment analysis when feedback is modified

---

## Bulletin Model
**File:** `backend/models/Bulletin.js`
**Purpose:** Content management system for announcements, news, and bulletins with approval workflow and versioning.

### Schema Fields

| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `title` | String | Required, trim, maxlength: 200 | - | Bulletin title |
| `content` | String | Required, trim | - | Bulletin content |
| `summary` | String | trim, maxlength: 500 | - | Brief summary |

### Image Information (`image`)
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `filename` | String | trim | - | Image filename |
| `originalName` | String | trim | - | Original filename |
| `path` | String | trim | - | File path |
| `size` | Number | - | - | File size in bytes |
| `mimeType` | String | trim | - | MIME type |

### Publication Details
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `status` | String | enum: ['draft', 'published', 'archived'] | 'draft' | Publication status |
| `publishedAt` | Date | - | - | Publication timestamp |
| `expiresAt` | Date | - | - | Expiration timestamp |

### Categorization
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `category` | String | enum: ['General', 'Academic', 'Administrative', 'Events', 'Announcements', 'Emergency', 'Other'] | 'General' | Content category |
| `priority` | String | enum: ['low', 'normal', 'high', 'urgent'] | 'normal' | Priority level |
| `targetAudience` | [String] | enum: ['all', 'students', 'faculty', 'staff', 'visitors', 'alumni'] | [] | Target audience |

### Visibility Settings
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `isVisible` | Boolean | - | true | General visibility |
| `showOnHomepage` | Boolean | - | false | Show on homepage |
| `showOnBulletinBoard` | Boolean | - | true | Show on bulletin board |

### Display Settings
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `displayOrder` | Number | - | 0 | Display order priority |
| `featuredUntil` | Date | - | - | Featured until date |

### Engagement Metrics
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `views` | Number | - | 0 | View count |
| `likes` | Number | - | 0 | Like count |

### Tags and Author
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `tags` | [String] | trim, lowercase | [] | Search tags |
| `author` | ObjectId | Required, Ref: 'User' | - | Author user |
| `authorName` | String | Required, trim | - | Author name |
| `authorEmail` | String | Required, trim, lowercase | - | Author email |

### Approval Workflow
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `approvalStatus` | String | enum: ['pending', 'approved', 'rejected'] | 'pending' | Approval status |
| `approvedBy` | ObjectId | Ref: 'User' | - | Approver user |
| `approvedAt` | Date | - | - | Approval timestamp |
| `rejectionReason` | String | trim | - | Rejection reason |

### Version Control
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `version` | Number | - | 1 | Current version number |
| `previousVersions` | [Object] | - | [] | Version history |

### Previous Version Sub-schema
- `version`: Number
- `title`: String
- `content`: String
- `updatedAt`: Date
- `updatedBy`: ObjectId (Ref: 'User')

### SEO and Metadata
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `slug` | String | unique, sparse, trim, lowercase | - | URL slug |
| `metaDescription` | String | trim, maxlength: 160 | - | Meta description |
| `keywords` | [String] | trim, lowercase | [] | SEO keywords |

### Scheduling
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `scheduledPublishAt` | Date | - | - | Scheduled publish time |
| `autoArchiveAt` | Date | - | - | Auto archive time |

### Comments System
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `allowComments` | Boolean | - | false | Allow comments |
| `comments` | [Object] | - | [] | Comments array |

### Comment Sub-schema
- `author`: ObjectId (Ref: 'User')
- `content`: String, required, trim
- `createdAt`: Date, default: Date.now
- `isApproved`: Boolean, default: false

### Audit Fields
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `lastUpdatedBy` | ObjectId | Ref: 'User' | - | Last updater user |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ status: 1, publishedAt: -1 }`
- `{ category: 1, status: 1 }`
- `{ priority: 1, publishedAt: -1 }`
- `{ author: 1, createdAt: -1 }`
- `{ tags: 1 }`
- `{ slug: 1 }`
- `{ expiresAt: 1 }`
- `{ showOnHomepage: 1, status: 1 }`
- `{ displayOrder: 1, publishedAt: -1 }`

### Pre-save Middleware
- Auto-generate slug from title if not provided

### Static Methods
- `getPublished(limit, skip)`: Get published bulletins
- `getHomepageBulletins(limit)`: Get homepage bulletins
- `getByCategory(category, limit, skip)`: Get bulletins by category

### Instance Methods
- `publish(publishedBy)`: Publish bulletin
- `archive()`: Archive bulletin
- `incrementViews()`: Increment view count
- `addComment(authorId, content)`: Add comment
- `createNewVersion(updates, updatedBy)`: Create new version

---

## AuditTrail Model
**File:** `backend/models/AuditTrail.js`
**Purpose:** Comprehensive audit logging system for tracking all user actions and system events with detailed metadata.

### Schema Fields

### User Information
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `userId` | ObjectId | Required, Ref: 'User' | - | User who performed action |
| `userEmail` | String | Required, trim, lowercase | - | User email |
| `userName` | String | Required, trim | - | User name |
| `userRole` | String | Required | - | User role |

### Action Details
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `action` | String | Required, enum: [extensive list] | - | Action type performed |
| `actionDescription` | String | Required, trim | - | Human-readable action description |

### Action Types (enum values)
**Authentication:** LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGE
**User Management:** USER_CREATE, USER_UPDATE, USER_DELETE, USER_ACTIVATE, USER_DEACTIVATE
**Queue Management:** QUEUE_CREATE, QUEUE_CALL, QUEUE_SERVE, QUEUE_COMPLETE, QUEUE_SKIP, QUEUE_CANCEL
**Service Management:** SERVICE_CREATE, SERVICE_UPDATE, SERVICE_DELETE, SERVICE_ACTIVATE, SERVICE_DEACTIVATE
**Window Management:** WINDOW_CREATE, WINDOW_UPDATE, WINDOW_DELETE, WINDOW_OPEN, WINDOW_CLOSE
**Settings:** SETTINGS_UPDATE, SYSTEM_CONFIG_CHANGE
**Bulletin:** BULLETIN_CREATE, BULLETIN_UPDATE, BULLETIN_DELETE, BULLETIN_PUBLISH, BULLETIN_UNPUBLISH
**System:** SYSTEM_BACKUP, SYSTEM_RESTORE, DATA_EXPORT, DATA_IMPORT
**Other:** OTHER

### Resource Information
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `resourceType` | String | Required, enum: ['User', 'Queue', 'Service', 'Window', 'Settings', 'Bulletin', 'Rating', 'System', 'Other'] | - | Type of resource affected |
| `resourceId` | ObjectId | Required if not System/Other | - | ID of affected resource |
| `resourceName` | String | trim | - | Name of affected resource |

### Request Details
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `ipAddress` | String | Required | - | Client IP address |
| `userAgent` | String | trim | - | Client user agent |
| `requestMethod` | String | Required, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] | - | HTTP method |
| `requestUrl` | String | Required, trim | - | Request URL |

### Response Details
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `statusCode` | Number | Required | - | HTTP status code |
| `success` | Boolean | Required | - | Operation success flag |

### Data Changes
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `oldValues` | Mixed | - | - | Previous values (for updates) |
| `newValues` | Mixed | - | - | New values (for updates) |

### Additional Context
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `department` | String | enum: ['MIS', 'Registrar', 'Admissions', 'HR'] | - | Department context |
| `sessionId` | String | trim | - | Session identifier |

### Error Information
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `errorMessage` | String | trim | - | Error message (if failed) |
| `errorStack` | String | trim | - | Error stack trace |

### Severity and Metadata
| Field | Type | Validation | Default | Description |
|-------|------|------------|---------|-------------|
| `severity` | String | enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] | 'LOW' | Severity level |
| `tags` | [String] | trim | [] | Categorization tags |
| `metadata` | Mixed | - | - | Additional metadata |

### Timestamps
- `createdAt`: Auto-generated
- `updatedAt`: Auto-generated

### Indexes
- `{ userId: 1, createdAt: -1 }`
- `{ action: 1, createdAt: -1 }`
- `{ resourceType: 1, resourceId: 1 }`
- `{ department: 1, createdAt: -1 }`
- `{ success: 1, createdAt: -1 }`
- `{ severity: 1, createdAt: -1 }`
- `{ createdAt: -1 }` (general time-based queries)
- `{ ipAddress: 1, createdAt: -1 }`

### TTL Index
- `{ createdAt: 1 }` with `expireAfterSeconds: 31536000` (1 year retention)

### Static Methods
- `logAction(actionData)`: Log an audit action (safe, won't throw)
- `getUserAuditTrail(userId, limit, skip)`: Get user's audit trail
- `getResourceAuditTrail(resourceType, resourceId, limit, skip)`: Get resource audit trail
- `getByAction(action, limit, skip)`: Get audit trail by action type
- `getByDepartment(department, limit, skip)`: Get audit trail by department
- `getFailedActions(limit, skip)`: Get failed actions
- `getHighSeverityActions(limit, skip)`: Get high severity actions
- `getStatistics(startDate, endDate)`: Get audit statistics

---

## Model Relationships

### Primary Relationships
- **Queue** → **VisitationForm** (visitationFormId): Each queue entry references customer form data (normalized schema)
- **Queue** → **Service** (serviceId): Each queue entry belongs to a service
- **Queue** → **Window** (windowId): Queue can be assigned to a window
- **Queue** → **User** (processedBy): Admin who processed the queue
- **Window** → **Service** (serviceIds): Each window can serve multiple services
- **Window** → **User** (assignedAdmin): Optional admin assigned to window
- **Window** → **Queue** (currentQueue): Currently serving queue
- **Rating** → **Queue** (queueId): Rating belongs to a queue entry
- **Rating** → **Service** (serviceId): Rating for a service
- **Rating** → **Window** (windowId): Rating for a window
- **Rating** → **User** (staffId): Rating for staff member
- **Bulletin** → **User** (author, approvedBy, lastUpdatedBy): User relationships
- **AuditTrail** → **User** (userId): User who performed action
- **Service** → **User** (createdBy, updatedBy): Audit trail
- **Window** → **User** (createdBy, updatedBy): Audit trail
- **Settings** → **User** (lastUpdatedBy): Last modifier

### Data Flow
1. **Queue Creation**: VisitationForm (created) → Queue (references form) → Service → Window (assignment)
2. **Queue Processing**: Queue → Window → User (admin) → Rating
3. **Audit Logging**: Any action → AuditTrail
4. **Content Management**: User → Bulletin (with approval workflow)
5. **System Configuration**: User → Settings (singleton pattern)
6. **Real-time Updates**: Public kiosk submission → VisitationForm + Queue → Socket.io → Registrar Admin dashboard

---

## Usage Notes

### For AI Assistant Reference
- This document serves as the single source of truth for database schema
- Use this for planning schema changes and understanding relationships
- All models use Mongoose with MongoDB
- Timestamps are automatically managed by Mongoose
- Most models include audit fields (createdBy, updatedBy)
- **Normalized Schema**: VisitationForm model stores customer data separately from Queue entries

### For Development Planning
- Models follow consistent patterns for validation and indexing
- Enum values are strictly defined for data integrity
- Relationships use ObjectId references with population support
- Static and instance methods provide business logic
- Pre-save middleware handles data transformation
- **Database Normalization**: Queue model references VisitationForm via foreign key for data integrity

### Schema Evolution
- Document any schema changes in this file
- Update validation rules and enum values as needed
- Add new models following established patterns
- Maintain backward compatibility when possible
- **Recent Changes**:
  - Added VisitationForm model for normalized database schema (2025-01-11)
  - Updated Window model to support multiple services via serviceIds array (2025-01-14)
  - Simplified Service model schema - removed complex scheduling and statistics fields (2025-01-14)
  - Made Queue.visitationFormId optional to support Enroll service flow (2025-01-14)
  - Added skippedAt timestamp field to Queue model (2025-01-14)
  - Changed Queue.processedBy to Mixed type for system compatibility (2025-01-14)
  - Implemented comprehensive User management API with CRUD operations (2025-01-12)
  - Added role-based user filtering endpoints for admin assignment dropdowns (2025-01-12)
  - Enhanced User model with real-time Socket.io integration for live updates (2025-01-12)

### Key Architecture Decisions
- **Normalized Database Design**: Customer form data separated into VisitationForm model
- **Hybrid Compatibility**: Queue model uses String types for windowId/serviceId for system compatibility
- **Real-time Integration**: Socket.io updates between public kiosk and admin modules
- **Window-specific Queue Management**: Each window manages its own queue with service filtering
- **Multiple Service Support**: Windows can now serve multiple services via serviceIds array
- **Simplified Service Schema**: Removed complex fields for streamlined service management
- **Flexible Queue Processing**: Optional visitation forms and flexible processedBy field types
- **Comprehensive User Management**: Full CRUD API with role-based access and dynamic dropdown integration
- **Required Admin Assignment**: Admin dropdowns now require selection with real-time database integration

### Admin Interface Features
- **MIS Users Management**: Complete user management interface at `/admin/mis/users`
- **Dynamic Admin Dropdowns**: Real-time fetching of admin users for window assignments
- **Role-based Filtering**: API endpoints filter users by role for specific admin assignments
- **Form Validation**: Required field validation for admin assignments in Registrar Settings
- **Live Data Updates**: Socket.io integration ensures admin dropdowns reflect current database state

---

*Last Updated: 2025-01-14*
*Total Models: 9*
*Database: MongoDB with Mongoose ODM*
*Architecture: Normalized schema with VisitationForm → Queue relationship*
*User Management: Complete CRUD API with real-time admin interface integration*
*Window Management: Multiple service assignment support with dual status control*
*Service Management: Simplified schema for streamlined service operations*


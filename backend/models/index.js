// Central export file for all models
const User = require('./User');
const Queue = require('./Queue');
const Service = require('./Service');
const Window = require('./Window');
const Settings = require('./Settings');
const AuditTrail = require('./AuditTrail');
const Bulletin = require('./Bulletin');
const Rating = require('./Rating');
const VisitationForm = require('./VisitationForm');
const Office = require('./Office');
const Chart = require('./Chart');
const Notification = require('./Notification');
const DocumentRequest = require('./DocumentRequest');

module.exports = {
  User,
  Queue,
  Service,
  Window,
  Settings,
  AuditTrail,
  Bulletin,
  Rating,
  VisitationForm,
  Office,
  Chart,
  Notification,
  DocumentRequest
};

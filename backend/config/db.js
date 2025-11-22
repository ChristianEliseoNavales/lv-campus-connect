const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Use the working connection configuration from successful tests
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10, // Maximum connections in pool
      minPoolSize: 2   // Minimum connections to maintain
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("✅ MongoDB Atlas connected successfully!");
    console.log(`📍 Connected to database: ${mongoose.connection.name}`);
    console.log(`🔗 Connection ready for LVCampusConnect`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("🔍 Connection troubleshooting:");
    console.error("   - Verify IP address is whitelisted in MongoDB Atlas");
    console.error("   - Check database credentials are correct");
    console.error("   - Ensure MongoDB Atlas cluster is running");
    console.error("   - Connection string format should include database name");
    console.error("⚠️  Server will continue running without database connection");
    // Don't exit the process - let the server run without database
  }
};

module.exports = connectDB;

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[SYSTEM] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[ERROR] Database Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

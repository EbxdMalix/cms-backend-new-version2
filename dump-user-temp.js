const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {}

const mongoose = require("mongoose");
require("dotenv").config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "construction-system" });
  console.log("Connected to DB");
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const user = await User.findOne({ email: "ebadmalik@gmail.com" });
  console.log("User details:", JSON.stringify(user, null, 2));
  process.exit(0);
};

run();

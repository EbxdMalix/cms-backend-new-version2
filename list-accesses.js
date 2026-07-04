const mongoose = require("mongoose");
require("dotenv").config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");
    
    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
    const UserPortalAccess = mongoose.model("UserPortalAccess", new mongoose.Schema({}, { strict: false }));
    const Tenant = mongoose.model("Tenant", new mongoose.Schema({}, { strict: false }));

    const users = await User.find({});
    console.log("USERS:", users.map(u => ({ id: u._id, email: u.email, role: u.role })));

    const accesses = await UserPortalAccess.find({});
    console.log("ACCESSES:", accesses.map(a => ({ userId: a.userId, tenantId: a.tenantId, role: a.role, isDefault: a.isDefaultPortal })));

    const tenants = await Tenant.find({});
    console.log("TENANTS:", tenants.map(t => ({ tenantId: t.tenantId, portalName: t.portalName })));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();

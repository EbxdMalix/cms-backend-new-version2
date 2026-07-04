require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Tenant = require("./models/Tenant");
const User = require("./models/User");
const UserPortalAccess = require("./models/UserPortalAccess");

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
  console.error("❌ MONGODB_URI or MONGO_URI is missing in environment variables.");
  process.exit(1);
}

async function cleanAndSeed() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("✓ Connected to MongoDB");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // 1. Drop all collections
    console.log("\n🗑️ Dropping existing collections...");
    for (const col of collections) {
      try {
        await db.dropCollection(col.name);
        console.log(`   ✓ Dropped collection: ${col.name}`);
      } catch (err) {
        console.log(`   ⚠ Could not drop ${col.name}: ${err.message}`);
      }
    }

    console.log("\n🌱 Seeding new portals (tenants)...");

    // 2. Seed the 3 default Tenants
    const tenants = [
      {
        tenantId: "bunyan-al-marsoos",
        portalName: "Bunyan Al Marsoos",
        email: "bunyan@company.com",
        password: "securepassword123", // Will be hashed by mongoose pre-save
        adminName: "Bunyan Admin",
      },
      {
        tenantId: "ym-constructions-pvt-ltd",
        portalName: "YM Constructions PVT-LTD",
        email: "ym-requests@company.com",
        password: "securepassword123",
        adminName: "YM Admin",
      },
      {
        tenantId: "ym-construction-pvt-ltd",
        portalName: "YM Construction PVT-LTD",
        email: "ym-purchase@company.com",
        password: "securepassword123",
        adminName: "YM Purchase Admin",
      },
    ];

    const seededTenants = [];
    for (const tenantData of tenants) {
      const t = new Tenant(tenantData);
      await t.save();
      seededTenants.push(t);
      console.log(`   ✓ Seeded Tenant: ${t.portalName} (${t.tenantId})`);
    }

    console.log("\n👤 Seeding Super Admin User...");

    // 3. Seed the single Super Admin User
    // We do not hash the password manually here because the User model's pre-save hook hashes it automatically.
    const user = new User({
      tenantId: "bunyan-al-marsoos", // Default starting tenant
      name: "Ebad Malik",
      email: "ebadmalik@gmail.com",
      password: "password", // Raw password, pre-save hook handles hashing
      role: "admin",
      isActive: true,
    });

    await user.save();
    console.log(`   ✓ Seeded User: ${user.name} (${user.email})`);

    console.log("\n🔑 Mapping portal accesses...");

    // 4. Seed UserPortalAccess entries mapping the super admin to all 3 portal tenants
    const accesses = [
      {
        userId: user._id,
        tenantId: "bunyan-al-marsoos",
        role: "admin",
        isDefaultPortal: true,
        customPermissions: null,
      },
      {
        userId: user._id,
        tenantId: "ym-constructions-pvt-ltd",
        role: "operator",
        isDefaultPortal: false,
        customPermissions: null,
      },
      {
        userId: user._id,
        tenantId: "ym-construction-pvt-ltd",
        role: "custom",
        isDefaultPortal: false,
        customPermissions: {
          dashboard: false,
          projects: true,
          plots: false,
          customers: false,
          suppliers: true,
          items: false,
          chartOfAccounts: false,
          salesInvoice: true,
          purchaseEntry: false,
          cashPayment: false,
          bankPayment: false,
          reports: false,
        },
      },
    ];

    for (const accessData of accesses) {
      const access = new UserPortalAccess(accessData);
      await access.save();
      console.log(`   ✓ Mapped Portal: ${access.tenantId} as role '${access.role}'`);
    }

    console.log("\n✅ Database cleared and seeded successfully!");
    console.log("\nCredentials:");
    console.log("   - Email: ebadmalik@gmail.com");
    console.log("   - Password: password");

  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanAndSeed();

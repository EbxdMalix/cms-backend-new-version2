const Tenant = require("../models/Tenant");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Register new portal/tenant (called from Users page when creating Admin)
exports.registerTenant = async (req, res) => {
  try {
    const {
      portalName,
      email,
      password,
      adminName,
      phoneNumber,
      address,
      city,
      country,
    } = req.body;

    // Validation
    if (!portalName || !email || !password || !adminName) {
      return res.status(400).json({
        success: false,
        message: "Portal name, email, password, and admin name are required",
      });
    }

    // Check if email already exists as tenant
    const existingTenant = await Tenant.findOne({ email });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: "Email already registered as a portal",
      });
    }

    // Check if email already exists as user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists in the system",
      });
    }

    // Generate tenant ID from portal name
    const tenantId = portalName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Check if tenant ID already exists
    const existingTenantId = await Tenant.findOne({ tenantId });
    if (existingTenantId) {
      return res.status(400).json({
        success: false,
        message: "Portal with similar name already exists",
      });
    }

    // Create tenant - password will be hashed by pre-save hook
    const tenant = new Tenant({
      tenantId,
      portalName,
      email,
      password, // NOT hashed - let pre-save hook handle it
      adminName,
      phoneNumber,
      address,
      city,
      country,
    });

    await tenant.save();

    // Create admin user for this tenant - password will be hashed by pre-save hook
    const adminUser = new User({
      tenantId,
      name: adminName,
      email,
      password, // NOT hashed - let pre-save hook handle it
      role: "admin",
    });

    await adminUser.save();

    res.status(201).json({
      success: true,
      message: "Portal registered successfully",
      data: {
        tenantId: tenant.tenantId,
        portalName: tenant.portalName,
        email: tenant.email,
        adminName: tenant.adminName,
      },
    });
  } catch (error) {
    console.error("Tenant registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering portal",
      error: error.message,
    });
  }
};

// Get all active tenants (for login dropdown)
exports.getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find({ isActive: true }).select(
      "tenantId portalName"
    );
    res.json({
      success: true,
      data: tenants,
    });
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching portals",
      error: error.message,
    });
  }
};

// Get tenant by ID (for UI branding)
exports.getTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ tenantId: req.tenantId }).select(
      "-password"
    );
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Portal not found",
      });
    }
    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching portal",
      error: error.message,
    });
  }
};

// Get tenant by tenantId (public route for checking if tenant exists)
exports.getTenantById = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await Tenant.findOne({ tenantId, isActive: true }).select(
      "tenantId portalName"
    );
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Portal not found",
      });
    }
    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching portal",
      error: error.message,
    });
  }
};

// Update tenant settings (Admin only)
exports.updateTenant = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators can update portal settings.",
      });
    }

    const { portalName, adminName, phoneNumber, address, city, country, branding } = req.body;

    const tenant = await Tenant.findOne({ tenantId: req.tenantId });
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Portal not found",
      });
    }

    if (portalName) tenant.portalName = portalName;
    if (adminName) tenant.adminName = adminName;
    if (phoneNumber !== undefined) tenant.phoneNumber = phoneNumber;
    if (address !== undefined) tenant.address = address;
    if (city !== undefined) tenant.city = city;
    if (country !== undefined) tenant.country = country;
    if (branding) {
      tenant.branding = {
        logoUrl: branding.logoUrl !== undefined ? branding.logoUrl : (tenant.branding?.logoUrl || null),
        primaryColor: branding.primaryColor || (tenant.branding?.primaryColor || "#c5630c"),
        secondaryColor: branding.secondaryColor || (tenant.branding?.secondaryColor || "#a47f6f"),
      };
    }

    await tenant.save();

    res.status(200).json({
      success: true,
      message: "Portal settings updated successfully",
      data: tenant,
    });
  } catch (error) {
    console.error("Error updating tenant settings:", error);
    res.status(500).json({
      success: false,
      message: "Error updating portal settings",
      error: error.message,
    });
  }
};


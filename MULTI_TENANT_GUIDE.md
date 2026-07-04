# Multi-Tenant Data Isolation Implementation Guide

## Overview

All controllers must filter queries by `tenantId` to ensure complete data isolation between portals.

## Pattern to Follow

### 1. GET All Records

```javascript
// BEFORE
const records = await Model.find();

// AFTER
const records = await Model.find({ tenantId: req.tenantId });
```

### 2. GET Single Record

```javascript
// BEFORE
const record = await Model.findById(id);

// AFTER
const record = await Model.findOne({
  _id: id,
  tenantId: req.tenantId,
});
```

### 3. CREATE Record

```javascript
// BEFORE
const record = await Model.create({
  name: req.body.name,
  // ... other fields
});

// AFTER
const record = await Model.create({
  tenantId: req.tenantId, // Always add this
  name: req.body.name,
  // ... other fields
});
```

### 4. UPDATE Record

```javascript
// BEFORE
const record = await Model.findByIdAndUpdate(id, updateData);

// AFTER
const record = await Model.findOneAndUpdate(
  { _id: id, tenantId: req.tenantId },
  updateData,
  { new: true }
);
```

### 5. DELETE Record

```javascript
// BEFORE
await Model.findByIdAndDelete(id);

// AFTER
await Model.findOneAndDelete({
  _id: id,
  tenantId: req.tenantId,
});
```

### 6. Check for Duplicates

```javascript
// BEFORE
const existing = await Model.findOne({ email });

// AFTER - check only within same tenant
const existing = await Model.findOne({
  tenantId: req.tenantId,
  email,
});
```

## Controllers to Update (Priority Order)

1. ✅ chartOfAccountController.js - DONE
2. ⏳ customerController.js
3. ⏳ supplierController.js
4. ⏳ projectController.js
5. ⏳ plotController.js
6. ⏳ itemController.js
7. ⏳ salesInvoiceController.js
8. ⏳ purchaseController.js
9. ⏳ bankPaymentController.js
10. ⏳ cashPaymentController.js
11. ⏳ journalEntryController.js
12. ⏳ generalLedgerController.js
13. ⏳ dashboardController.js
14. ⏳ reportController.js

## Routes to Update

All routes that need data isolation must use the `protect` middleware:

```javascript
// Already has authMiddleware in most routes
router.get("/", protect, controller.getAll);
router.post("/", protect, controller.create);
router.put("/:id", protect, controller.update);
router.delete("/:id", protect, controller.delete);
```

The `protect` middleware now extracts `tenantId` from `req.user.tenantId` and makes it available as `req.tenantId`.

## Models Already Updated

- ✅ User.js (has tenantId)
- ✅ Tenant.js (core tenant model)
- ✅ ChartOfAccount.js (added tenantId)
- ✅ Customer.js (added tenantId)
- ✅ Supplier.js (added tenantId)

## Models Still Need tenantId

- Plot.js
- Project.js
- Item.js
- SalesInvoice.js
- Purchase.js
- BankPayment.js
- CashPayment.js
- JournalEntry.js
- GeneralLedger.js
- etc.

## Key Points

1. **Always filter by tenantId** in every query
2. **Automatically add tenantId** when creating records
3. **Use compound indexes** for tenantId + other fields
4. **Never remove unique constraints** - just add tenantId to compound index
5. **Test with multiple tenants** to ensure data isolation works
6. **Check security** - ensure one tenant can't access another's data

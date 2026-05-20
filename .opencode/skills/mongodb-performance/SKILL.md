# MongoDB Performance — N+1 Query Prevention & Schema Validation

## When to Apply

Whenever writing or reviewing Mongoose queries that involve:
- `.populate()` with nested paths (2+ levels deep)
- Multiple `.populate()` calls on the same query
- `.find()` inside a `for`/`forEach`/`map` loop
- Sequential dependent queries (query B depends on query A result)
- Read-only queries that don't need Mongoose document methods
- Creating or modifying Mongoose schemas

## Anti-Patterns & Solutions

### 1. Nested Populate (N+1)

**BAD — 3 cấp populate → 1 + N + N*M queries:**
```javascript
Ads.find(filter)
  .populate('created_by', 'full_name email')
  .populate({
    path: 'set_id',
    populate: { path: 'campaign_id', select: 'name shop_id' }
  });
// 100 ads → 1 (Ads) + 100 (AdsSet) + 100 (AdsCampaign) = 201 queries
```

**GOOD — Aggregation `$lookup` (single pipeline):**
```javascript
Ads.aggregate([
  { $match: filter },
  { $lookup: { from: 'users', localField: 'created_by', foreignField: '_id', as: 'created_by_doc' } },
  { $lookup: { from: 'adssets', localField: 'set_id', foreignField: '_id', as: 'set_doc' } },
  { $lookup: { from: 'adscampaigns', localField: 'set_doc.campaign_id', foreignField: '_id', as: 'campaign_doc' } },
  { $addFields: {
      created_by: { $arrayElemAt: ['$created_by_doc', 0] },
      set_id: { $arrayElemAt: ['$set_doc', 0] },
      campaign: { $arrayElemAt: ['$campaign_doc', 0] }
    }
  },
  { $project: { created_by_doc: 0, set_doc: 0, campaign_doc: 0 } }
]);
// 100 ads → 1 query total
```

**Pagination with aggregation:**
```javascript
const skip = (page - 1) * limit;
const pipeline = [
  { $match: filter },
  // ... $lookups ...
  { $skip: skip },
  { $limit: limit }
];
const [items, total] = await Promise.all([
  Model.aggregate(pipeline),
  Model.countDocuments(filter)
]);
```

### 2. N+1 Inside Loop

**BAD — Query trong loop:**
```javascript
for (const shop of shopsOwned) {
  const role = await Role.findOne({ role_name: "Shop Owner" }); // N queries!
  shopsWithRoles.push({ shop: shop.name, role: role.role_name });
}
```

**GOOD — Fetch once outside loop:**
```javascript
const shopOwnerRole = await Role.findOne({ role_name: "Shop Owner" }).lean();
for (const shop of shopsOwned) {
  shopsWithRoles.push({ shop: shop.name, role: shopOwnerRole?.role_name });
}
```

### 3. Sequential Dependent Queries

**BAD — Sequential reads:**
```javascript
const adsets = await AdsSet.find({ campaign_id: campaign._id });
const adsetIds = adsets.map(a => a._id);
const ads = await Ads.find({ set_id: { $in: adsetIds } });
```

**GOOD — Add `.lean()` (already optimal for 2-step dependency):**
```javascript
const adsets = await AdsSet.find({ campaign_id: campaign._id }).lean();
const adsetIds = adsets.map(a => a._id);
const ads = await Ads.find({ set_id: { $in: adsetIds } }).lean();
```

Note: 2-step dependency cannot be fully parallelized (need IDs from step 1). `.lean()` reduces memory overhead by ~70%.

### 4. Single Document with Relations

**BAD — Populate for single doc:**
```javascript
const ad = await Ads.findById(id).populate({
  path: 'set_id',
  populate: { path: 'campaign_id', select: 'shop_id' }
});
```

**GOOD — Aggregation for single doc:**
```javascript
const [ad] = await Ads.aggregate([
  { $match: { _id: new mongoose.Types.ObjectId(id) } },
  { $lookup: { from: 'adssets', localField: 'set_id', foreignField: '_id', as: 'set_doc' } },
  { $lookup: { from: 'adscampaigns', localField: 'set_doc.campaign_id', foreignField: '_id', as: 'campaign_doc' } },
  { $addFields: {
      set_id: { $arrayElemAt: ['$set_doc', 0] },
      campaign: { $arrayElemAt: ['$campaign_doc', 0] }
    }
  },
  { $project: { set_doc: 0, campaign_doc: 0 } }
]);
```

### 5. Multiple Populates on Same Query

**BAD — 3 separate populates:**
```javascript
UserRole.find()
  .populate("user_id", "full_name email")
  .populate("role_id", "role_name description")
  .populate("shop_id", "shop_name");
```

**GOOD — Add `.lean()` (acceptable for admin ops, low frequency):**
```javascript
UserRole.find()
  .populate("user_id", "full_name email")
  .populate("role_id", "role_name description")
  .populate("shop_id", "shop_name")
  .lean();
```

For high-frequency endpoints, use aggregation `$lookup` instead.

## Schema Validation — Prevent Schema Drift

NoSQL flexibility means old and new documents can have different shapes. Without validation, data corruption accumulates silently.

### Critical Checklist for Every Schema Field

| Rule | Example | Why |
|------|---------|-----|
| **Always use `required`** for business-critical fields | `name: { type: String, required: true }` | Prevents null/undefined documents |
| **Always use `enum`** for status/type fields | `status: { type: String, enum: ["active", "inactive"] }` | Prevents typos like "Active" vs "active" |
| **Always use `min`/`max`** for numeric fields | `price: { type: Number, min: 0 }` | Prevents negative prices |
| **Always use `trim`** for string fields | `email: { type: String, trim: true }` | Prevents " user@email.com " issues |
| **Always use `maxlength`** for user input | `name: { type: String, maxlength: 100 }` | Prevents storage bloat |
| **Never use `require`** (typo) | `required: true` NOT `require: true` | `require` is silently ignored by Mongoose |
| **Validate ref names** | `ref: "AdsCampaign"` NOT `ref: "Campaign"` | Wrong ref name → populate returns null |
| **Use consistent types** | `conversations: Number` NOT `String "∞"` | String "∞" breaks numeric comparisons |

### Cross-Field Validation

Use `pre("save")` hooks for rules that span multiple fields:

```javascript
shopPackageSchema.pre("save", function (next) {
  if (this.from_date && this.to_date && this.to_date <= this.from_date) {
    return next(new Error("to_date phải sau from_date"));
  }
  next();
});
```

### Mixed Type Safety

`mongoose.Schema.Types.Mixed` accepts ANY value. Limit damage:

```javascript
// BAD — no constraints
meta: { type: mongoose.Schema.Types.Mixed },

// GOOD — validate size
meta: {
  type: mongoose.Schema.Types.Mixed,
  default: {},
  validate: {
    validator: (v) => JSON.stringify(v).length <= 5000,
    message: "Meta data quá lớn (>5KB)",
  },
},
```

### Subdocument Schema Validation

Define subdocuments as separate schemas for reuse and validation:

```javascript
const permissionSchema = new mongoose.Schema({
  module: { type: String, required: true, trim: true },
  actions: {
    type: [String],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.every(a => typeof a === "string"),
      message: "Actions phải là mảng chuỗi",
    },
  },
}, { _id: false });
```

### Common Schema Drift Bugs Found in This Project

| File | Bug | Impact |
|------|-----|--------|
| `paymentTransaction.model.js` | `require: true` (typo) | Validation disabled, null package_id |
| `analyticsSnapshot.model.js` | `ref: "Campaign"` (wrong) | Populate returns null |
| `package.model.js` | `conversations: String "∞"` | Cannot compare numerically |
| `ads.model.js` | `name` not required | Ads without names |
| `creative.model.js` | `creative_type` no enum | Any string accepted |
| `userPackage.model.js` | `from_date` not required | Packages with no dates |

## Collection Name Mapping

Mongoose pluralizes model names for collection names. Common mappings in this project:

| Model | Collection Name |
|-------|----------------|
| `User` | `users` |
| `Ads` | `ads` |
| `AdsSet` | `adssets` |
| `AdsCampaign` | `adscampaigns` |
| `AdsAccount` | `adsaccounts` |
| `Shop` | `shops` |
| `Role` | `roles` |
| `UserRole` | `userroles` |
| `ShopUser` | `shopusers` |
| `Creative` | `creatives` |
| `AdPerformance` | `adperformances` |

Verify with `Model.collection.name` if unsure.

## Rules of Thumb

1. **Always use `.lean()`** for read-only queries (no `.save()`, no virtuals needed)
2. **Never `.populate()` 2+ levels deep** — use aggregation `$lookup`
3. **Never query inside a loop** — fetch all IDs first, then batch query with `$in`
4. **Use `Promise.all`** for independent queries
5. **Use aggregation `$lookup`** for list endpoints with relations
6. **Use aggregation for single doc** when it needs 2+ relation lookups
7. **Keep `.populate()`** only for: single-level, low-frequency, admin-only endpoints
8. **Always validate schemas** — `required`, `enum`, `min`/`max`, `trim`, `maxlength`
9. **Never use `require`** — it's a typo, must be `required`
10. **Cross-field validation** via `pre("save")` hooks

## Performance Impact

| Pattern | 100 records | 1000 records |
|---------|------------|--------------|
| Nested populate (3 levels) | ~201 queries | ~2001 queries |
| Aggregation `$lookup` | 1 query | 1 query |
| Loop query (N+1) | 101 queries | 1001 queries |
| Batch `$in` query | 2 queries | 2 queries |

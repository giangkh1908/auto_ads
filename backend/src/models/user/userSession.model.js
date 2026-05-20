import mongoose from "mongoose";

const userSessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true, unique: true },
    family_id: { type: String, required: true, index: true },
    device: {
      fingerprint: { type: String, default: null },
      userAgent: { type: String, default: null },
      ip: { type: String, default: null },
      os: { type: String, default: null },
      browser: { type: String, default: null },
    },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

userSessionSchema.index({ user_id: 1, isActive: 1 });

userSessionSchema.statics.createSession = async function ({ userId, jti, familyId, device }) {
  return this.create({
    user_id: userId,
    jti,
    family_id: familyId,
    device,
    isActive: true,
  });
};

userSessionSchema.statics.revokeByJti = async function (jti) {
  return this.findOneAndUpdate({ jti }, { isActive: false, revokedAt: new Date() });
};

userSessionSchema.statics.revokeByFamily = async function (familyId) {
  return this.updateMany({ family_id: familyId }, { isActive: false, revokedAt: new Date() });
};

userSessionSchema.statics.revokeAllExcept = async function (userId, excludeJti) {
  return this.updateMany(
    { user_id: userId, jti: { $ne: excludeJti }, isActive: true },
    { isActive: false, revokedAt: new Date() }
  );
};

const UserSession = mongoose.model("UserSession", userSessionSchema);
export default UserSession;

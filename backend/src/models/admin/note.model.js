import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    // Loại entity (User, Lead, PaymentTransaction, ShopPackage, UserPackage, Transaction)
    target_type: {
      type: String,
      required: true,
      enum: ["User", "Lead", "PaymentTransaction", "ShopPackage", "UserPackage", "Transaction"],
      index: true,
    },

    // ID của entity (ObjectId)
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Nội dung note
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, "Note không được quá 1000 ký tự"],
    },

    // Người tạo note
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Người cập nhật note lần cuối
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Soft delete
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound indexes để query nhanh
noteSchema.index({ target_type: 1, target_id: 1, deleted_at: 1 });
noteSchema.index({ created_by: 1, created_at: -1 });
noteSchema.index({ created_at: -1 });

const Note = mongoose.model("Note", noteSchema);
export default Note;


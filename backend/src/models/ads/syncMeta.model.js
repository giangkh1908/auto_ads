import mongoose from "mongoose";

const syncMetaSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdsAccount",
      required: true,
    },
    sync_type: {
      type: String,
      enum: ["backfill"],
      required: true,
    },
    date_range_start: {
      type: String,
      required: true,
    },
    date_range_end: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "failed"],
      default: "pending",
    },
    records_processed: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: null,
    },
    started_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const SyncMeta = mongoose.model("SyncMeta", syncMetaSchema);
export default SyncMeta;



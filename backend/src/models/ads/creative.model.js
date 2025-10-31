import mongoose from "mongoose";

const creativeSchema = new mongoose.Schema(
  {
    external_id: { type: String, trim: true, default: null },
    ads_id: { type: mongoose.Schema.Types.ObjectId, ref: "Ads" },

    // 🧱 Cấu trúc nội dung
    name: { type: String, trim: true },
    title: { type: String, trim: true },
    body: { type: String },
    creative_type: { type: String, trim: true }, // LINK, VIDEO, CAROUSEL, IMAGE
    page_id: { type: String, default: null },
    object_story_spec: { type: mongoose.Schema.Types.Mixed, default: {} },
    image_hash: { type: String },
    video_id: { type: String },
    thumbnail_url: { type: String },
    cta: { type: String, trim: true },

    generated_by_ai: { type: Boolean, default: false },
    generator_info: { type: mongoose.Schema.Types.Mixed, default: {} },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

creativeSchema.index(
  { external_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      external_id: { $exists: true, $ne: null },
    },
  }
);
creativeSchema.index({ creative_type: 1 });

const Creative = mongoose.model("Creative", creativeSchema);
export default Creative;

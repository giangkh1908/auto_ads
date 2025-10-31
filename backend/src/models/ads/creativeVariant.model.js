import mongoose from "mongoose";

const creativeVariantSchema = new mongoose.Schema(
  {
    creative_id: { type: mongoose.Schema.Types.ObjectId, ref: "Creative", required: true },
    variant_text: { type: String },
    media_url: { type: String },
    ab_tag: { type: String, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

creativeVariantSchema.index({ creative_id: 1 });
creativeVariantSchema.index({ ab_tag: 1 });

const CreativeVariant = mongoose.model("CreativeVariant", creativeVariantSchema);
export default CreativeVariant;

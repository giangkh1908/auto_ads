import mongoose from "mongoose";

const promptEmbeddingSchema = new mongoose.Schema(
  {
    example: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    module_type: {
      type: String,
      enum: ["PERF", "COMPARE", "TREND", "AUDIENCE"],
      required: true,
      index: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

promptEmbeddingSchema.index({ module_type: 1 });
promptEmbeddingSchema.index({ example: 1 }, { unique: true });

const PromptEmbedding = mongoose.model("PromptEmbedding", promptEmbeddingSchema);

export default PromptEmbedding;


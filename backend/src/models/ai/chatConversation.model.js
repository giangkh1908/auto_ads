import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    message_id: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    // Metadata cho AI messages
    type: {
      type: String,
      enum: ["ANALYTICS_QUERY", "GENERAL_CHAT"],
    },
    tool_used: String,
    data: mongoose.Schema.Types.Mixed,
    chart: mongoose.Schema.Types.Mixed,
    needs_clarification: Boolean,
    suggestions: [String],
  },
  { _id: false }
);

const chatConversationSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: String,
      required: true,
      unique: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    account_id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: "New Conversation",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    last_activity_at: {
      type: Date,
      default: Date.now,
    },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    // Context summary để giữ ngữ cảnh
    context_summary: {
      current_intent: String,
      partial_params: mongoose.Schema.Types.Mixed,
      date_range: {
        from: Date,
        to: Date,
      },
      last_updated: Date,
    },
    // Messages array
    messages: [messageSchema],
    // Stats
    message_count: {
      type: Number,
      default: 0,
    },
    total_tokens_used: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chatConversationSchema.index({ conversation_id: 1 }, { unique: true });
chatConversationSchema.index({ user_id: 1 });
chatConversationSchema.index({ last_activity_at: -1 });

// Compound indexes
chatConversationSchema.index({ user_id: 1, last_activity_at: -1 });
chatConversationSchema.index({ account_id: 1, last_activity_at: -1 });

// TTL index để tự động xóa conversations cũ
chatConversationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const ChatConversation = mongoose.model(
  "ChatConversation",
  chatConversationSchema
);

export default ChatConversation;

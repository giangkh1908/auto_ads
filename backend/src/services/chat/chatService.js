import ChatConversation from "../../models/ai/chatConversation.model.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Get or create a conversation
 */
export async function getOrCreateConversation(
  user_id,
  account_id,
  conversation_id = null
) {
  let conversation;

  if (conversation_id) {
    conversation = await ChatConversation.findOne({
      conversation_id,
      user_id,
    });
  }

  if (!conversation) {
    const newConversationId = conversation_id || uuidv4();
    conversation = new ChatConversation({
      conversation_id: newConversationId,
      user_id,
      account_id,
      messages: [],
      context_summary: {},
    });
    await conversation.save();
  }

  return conversation;
}

/**
 * Add message to conversation
 */
export async function addMessage(conversation, role, content, metadata = {}) {
  conversation.messages.push({
    message_id: uuidv4(),
    role,
    content,
    timestamp: new Date(),
    ...metadata,
  });

  conversation.last_activity_at = new Date();

  // Sliding window: keep only last 20 messages
  if (conversation.messages.length > 20) {
    conversation.messages = conversation.messages.slice(-20);
  }

  await conversation.save();
  return conversation;
}

/**
 * Update context summary
 */
export async function updateContextSummary(conversation, summary) {
  conversation.context_summary = {
    ...conversation.context_summary,
    ...summary,
    updated_at: new Date(),
  };

  await conversation.save();
  return conversation;
}

/**
 * Get chat history for LLM context
 */
export function getChatHistory(conversation, limit = 10) {
  const messages = conversation.messages.slice(-limit);
  return messages
    .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
    .join("\n");
}

/**
 * Delete old conversations (TTL cleanup)
 */
export async function cleanupOldConversations(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await ChatConversation.deleteMany({
    last_activity_at: { $lt: cutoffDate },
  });

  return result.deletedCount;
}

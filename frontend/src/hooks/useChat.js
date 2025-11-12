import { useState, useCallback } from "react";
import chatService from "../services/chatService";
import { useToast } from "./useToast";

export function useChat(accountId) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const sendMessage = useCallback(
    async (message) => {
      if (!message.trim() || !accountId) return;

      const userMessage = {
        id: Date.now(),
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await chatService.sendMessage({
          message,
          account_id: accountId,
          conversation_id: conversationId,
        });

        if (response.success) {
          if (!conversationId && response.conversation_id) {
            setConversationId(response.conversation_id);
          }

          const aiMessage = {
            id: Date.now() + 1,
            role: "assistant",
            content: response.response,
            timestamp: new Date().toISOString(),
            intent: response.intent,
            date_range: response.date_range,
            meta: response.meta || null,
            raw_data: response.raw_data || null,
          };

          setMessages((prev) => [...prev, aiMessage]);
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        toast.error(error.message || "Đã xảy ra lỗi khi gửi tin nhắn");

        const errorMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: "⚠️ Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.",
          timestamp: new Date().toISOString(),
          isError: true,
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [accountId, conversationId, toast]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages,
    conversationId,
    isLoading,
    sendMessage,
    clearMessages,
  };
}

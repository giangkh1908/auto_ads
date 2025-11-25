import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import chatService from "../services/chatService";
import { STORAGE_KEYS } from "../constants/app.constants";
import { useToast } from "./useToast";
import { useAuth } from "./useAuth";

export function useChat(accountId) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const userId = user?._id || user?.id || null;

  const sessionKey = useMemo(() => {
    if (!userId || !accountId) return null;
    return `chat_session_${userId}_${accountId}`;
  }, [userId, accountId]);

  // Dùng ref để lưu lại sessionKey hợp lệ cuối cùng
  // CHỈ cập nhật ref khi sessionKey không phải null
  const sessionKeyRef = useRef(sessionKey);
  useEffect(() => {
    if (sessionKey) {
      sessionKeyRef.current = sessionKey;
    }
  }, [sessionKey]);

  const loadSessionState = useCallback(() => {
    if (!sessionKey) return null;
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [sessionKey]);

  const persistSessionState = useCallback(
    (state) => {
      if (!sessionKey) return;
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(state));
      } catch {
        /* ignore storage errors */
      }
    },
    [sessionKey]
  );

  useEffect(() => {
    let isMounted = true;

    const initConversation = async () => {
      if (!sessionKey) {
        setMessages([]);
        setConversationId(null);
        return;
      }

      const cached = loadSessionState();
      if (cached?.conversation_id) {
        if (isMounted) {
          setConversationId(cached.conversation_id);
          setMessages(cached.messages || []);
        }
        return;
      }

      setIsInitializing(true);
      try {
        const response = await chatService.startConversation({ account_id: accountId });
        if (isMounted && response?.success && response.conversation_id) {
          setConversationId(response.conversation_id);
          setMessages([]);
          persistSessionState({
            conversation_id: response.conversation_id,
            messages: [],
          });
        }
      } catch (error) {
        if (isMounted) {
          toast.error(
            error.message || "Không thể khởi tạo phiên trò chuyện. Vui lòng thử lại."
          );
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    initConversation();

    return () => {
      isMounted = false;
    };
  }, [sessionKey, accountId, toast, loadSessionState, persistSessionState]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    // Lấy key từ ref để đảm bảo xóa đúng session cũ
    const keyToRemove = sessionKeyRef.current;
    if (keyToRemove) {
      sessionStorage.removeItem(keyToRemove);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      resetChat();
    }
  }, [isAuthenticated, resetChat]);

  const sendMessage = useCallback(
    async (message) => {
      if (!message.trim() || !accountId || isInitializing) return;

      const userMessage = {
        id: uuidv4(),
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);

      try {
        // Luôn sử dụng conversationId từ state, được khởi tạo từ sessionStorage
        const response = await chatService.sendMessage({
          message,
          account_id: accountId,
          conversation_id: conversationId,
        });

        if (response.success) {
          // Backend sẽ tạo conversation_id mới nếu nó null
          if (!conversationId && response.conversation_id) {
            setConversationId(response.conversation_id);
          }

          const aiMessage = {
            id: uuidv4(),
            role: "assistant",
            content: response.response,
            timestamp: new Date().toISOString(),
            intent: response.intent,
            date_range: response.date_range,
            meta: response.meta || null,
            raw_data: response.raw_data || null,
            suggestions: response.suggestions || [], // Save suggestions
          };

          setMessages((prev) => [...prev, aiMessage]);
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        toast.error(error.message || "Đã xảy ra lỗi khi gửi tin nhắn");

        const errorMessage = {
          id: uuidv4(),
          role: "assistant",
          content: "⚠️ Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.",
          timestamp: new Date().toISOString(),
          isError: true,
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsSending(false);
      }
    },
    [accountId, conversationId, toast, isInitializing]
  );

  useEffect(() => {
    if (!sessionKey || !conversationId) return;
    persistSessionState({
      conversation_id: conversationId,
      messages,
    });
  }, [sessionKey, conversationId, messages, persistSessionState]);

  return {
    messages,
    conversationId,
    isLoading: isSending || isInitializing,
    sendMessage,
    resetChat,
  };
}

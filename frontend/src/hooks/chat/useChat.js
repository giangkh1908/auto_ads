import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import chatService from "../../services/chat/chatService";
import { STORAGE_KEYS } from "../../constants/app.constants";
import { useToast } from "../common/useToast";
import { useAuth } from "../auth/useAuth";

export function useChat(accountId) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [contextEntities, setContextEntities] = useState([]);
  
  // Use ref to track current messages (for conversationHistory)
  const messagesRef = useRef([]);
  
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
        messagesRef.current = [];
        setConversationId(null);
        return;
      }

      const cached = loadSessionState();
      if (cached?.conversation_id) {
        if (isMounted) {
          setConversationId(cached.conversation_id);
          const cachedMessages = cached.messages || [];
          setMessages(cachedMessages);
          messagesRef.current = cachedMessages;
        }
        return;
      }

      setIsInitializing(true);
      try {
        const response = await chatService.startConversation({ account_id: accountId });
        if (isMounted && response?.success && response.conversation_id) {
          setConversationId(response.conversation_id);
          setMessages([]);
          messagesRef.current = [];
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
    messagesRef.current = [];
    setConversationId(null);
    setContextEntities([]);
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

      // Build conversationHistory from current messages in ref (BEFORE adding new message)
      // Limit to last 20 messages to avoid huge payloads
      const recentMessages = messagesRef.current.slice(-20);
      const conversationHistory = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.timestamp,
        data: msg.raw_data || null
      }));

      // Update state and ref
      setMessages((prev) => {
        const newMessages = [...prev, userMessage];
        messagesRef.current = newMessages;
        return newMessages;
      });
      
      setIsSending(true);

      try {
        // Luôn sử dụng conversationId từ state, được khởi tạo từ sessionStorage
        const response = await chatService.sendMessage({
          message,
          account_id: accountId,
          conversation_id: conversationId,
          conversationHistory, // Send history from ref (previous messages only)
          context: {
            entities: contextEntities, // Send tracked entities
          },
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

          setMessages((prev) => {
            const newMessages = [...prev, aiMessage];
            messagesRef.current = newMessages;
            return newMessages;
          });
          
          // Update context entities from response
          if (response.entities && response.entities.length > 0) {
            setContextEntities(response.entities);
          }
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

        setMessages((prev) => {
          const newMessages = [...prev, errorMessage];
          messagesRef.current = newMessages;
          return newMessages;
        });
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

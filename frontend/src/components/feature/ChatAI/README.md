# Chat AI Analytics - Frontend Integration

## ✅ Đã hoàn thành

### 1. **Services**
- ✅ `chatService.js`: API service cho chat analytics
  - `sendMessage()`: Gửi message đến AI
  - `getConversations()`: Lấy danh sách conversations
  - `getConversationDetail()`: Lấy chi tiết conversation
  - `deleteConversation()`: Xóa conversation

### 2. **Custom Hooks**
- ✅ `useChat.js`: Hook quản lý chat state
  - `messages`: Danh sách messages
  - `conversationId`: ID của conversation hiện tại
  - `isLoading`: Trạng thái loading
  - `sendMessage()`: Gửi message
  - `loadConversation()`: Load lịch sử
  - `clearConversation()`: Xóa conversation
  - `deleteConversation()`: Xóa conversation khỏi DB

### 3. **Components**
- ✅ `ChatAIPage.jsx`: Main chat page (đã có sẵn)
  - Tích hợp với `useChat` hook
  - Auto-scroll khi có message mới
  - Load account_id từ localStorage
  - Validate account trước khi gửi
  
- ✅ `ChatAIInput.jsx`: Input component (đã có sẵn)
- ✅ `ChatAITopicsPanel.jsx`: Topics panel (đã có sẵn)
- ✅ `ChatAIDetailPanel.jsx`: Prompts panel (đã có sẵn)
- ✅ `AccountBadge.jsx`: Hiển thị account đang chọn

### 4. **Styling**
- ✅ `ChatAI.styles.css`: Enhanced styling
  - User/Assistant message bubbles
  - Loading animation
  - Error states
  - Responsive design

## 🎯 Cách sử dụng

### Chọn Account
Trước khi sử dụng Chat AI, user phải chọn account quảng cáo:

```javascript
// Trong page khác (AdsManagement, etc.)
localStorage.setItem('selected_account_id', accountId)
localStorage.setItem('selected_account_name', accountName)
```

### Navigate to Chat AI
```javascript
import { ROUTES } from './constants/app.constants'

// Navigate
navigate(ROUTES.CHAT_AI)
```

### Message Flow
1. User chọn topic (PERF, COMPARE, TREND, etc.)
2. User chọn prompt hoặc tự nhập
3. User nhấn Enter hoặc click Send
4. Message gửi đến backend `/api/ai/chat/analyze`
5. Backend phân tích intent, gọi tools, trả về response
6. Frontend hiển thị response với styling

## 📡 API Integration

### POST `/api/ai/chat/analyze`
```javascript
const response = await chatService.sendMessage({
  message: "Chi phí quảng cáo 7 ngày qua",
  account_id: "act_123456789",
  conversation_id: "uuid-optional"
})

// Response
{
  success: true,
  conversation_id: "uuid",
  response: "📊 Trong 7 ngày qua, chi phí quảng cáo của bạn là 5,234,000đ...",
  intent: "ANALYTICS_QUERY",
  date_range: {
    date_from: "2025-11-02",
    date_to: "2025-11-09"
  }
}
```

## 🎨 Message Types

### User Message
```jsx
<div className="chat-ai-msg user">
  <div className="chat-ai-msg-role">👤 Bạn</div>
  <div className="chat-ai-msg-content">Chi phí quảng cáo hôm nay?</div>
  <div className="chat-ai-msg-time">10:30 SA</div>
</div>
```

### Assistant Message
```jsx
<div className="chat-ai-msg assistant">
  <div className="chat-ai-msg-role">🤖 AI Assistant</div>
  <div className="chat-ai-msg-content">
    📊 Hôm nay chi phí quảng cáo của bạn là 234,000đ...
  </div>
  <div className="chat-ai-msg-time">10:30 SA</div>
</div>
```

### Error Message
```jsx
<div className="chat-ai-msg assistant error">
  <div className="chat-ai-msg-content">
    ⚠️ Xin lỗi, đã xảy ra lỗi...
  </div>
</div>
```

## 🔧 Configuration

### Environment Variables
```env
# .env
VITE_API_URL=http://localhost:5001
```

### Routes
```javascript
// app.constants.js
export const ROUTES = {
  CHAT_AI: '/chat-ai',
  // ...
}
```

## 📊 State Management

### useChat Hook State
```javascript
const {
  messages,        // Array of message objects
  conversationId,  // UUID of current conversation
  isLoading,       // Boolean loading state
  sendMessage,     // Function(message: string)
  loadConversation, // Function(convId: string)
  clearConversation, // Function()
  deleteConversation // Function(convId: string)
} = useChat(accountId)
```

### Message Object
```javascript
{
  id: 1731159234567,
  role: "user" | "assistant",
  content: "Message text",
  timestamp: "2025-11-09T10:30:00.000Z",
  intent?: "ANALYTICS_QUERY" | "GENERAL_CHAT",
  date_range?: { date_from, date_to },
  isError?: boolean
}
```

## 🚀 Testing

### 1. Test kết nối
- Mở DevTools > Network
- Gửi message
- Check request: `POST /api/ai/chat/analyze`
- Check response: `200 OK`

### 2. Test without account
- Clear localStorage: `selected_account_id`
- Reload page
- Nhấn Send → Alert "Vui lòng chọn tài khoản..."

### 3. Test with account
- Set account: `localStorage.setItem('selected_account_id', 'act_123')`
- Reload page
- Gửi message → Nhận response từ AI

### 4. Test topics & prompts
- Click topic "Phân tích tổng quan hiệu suất"
- Click prompt "Tổng quan hiệu suất quảng cáo hôm nay"
- Prompt tự động fill vào input
- Enter để gửi

## 🐛 Troubleshooting

### Error: "Vui lòng chọn tài khoản..."
→ Set `selected_account_id` in localStorage

### Error: "401 Unauthorized"
→ Check auth token in localStorage: `accessToken`

### Error: "Account not found"
→ Check account_id format (act_xxx) và tồn tại trong DB

### Message không hiển thị
→ Check console logs, verify API response structure

### Auto-scroll không work
→ Verify `messagesEndRef` được attach vào DOM

## 📝 Future Enhancements

- [ ] Streaming responses (SSE)
- [ ] Chart rendering (Chart.js/Recharts)
- [ ] Export conversation to PDF
- [ ] Voice input (Web Speech API)
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Conversation history sidebar
- [ ] Share conversation link

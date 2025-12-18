import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react'
import { useChat } from '../../../hooks/chat/useChat'
import './ChatAIWidget.css'

function ChatAIWidget({ accountId, accountName }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const { messages, isLoading, sendMessage } = useChat(accountId)

  // Auto-scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized])

  // Thêm useEffect để auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height để tính toán lại
      textareaRef.current.style.height = 'auto'
      // Set height theo scrollHeight
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = `${Math.min(scrollHeight, 100)}px` // Max 100px
    }
  }, [inputValue])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !accountId) return
    const messageToSend = inputValue.trim()
    setInputValue('')
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = '24px' // Reset to min height
    }
    await sendMessage(messageToSend)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="chat-widget-button" onClick={() => setIsOpen(true)}>
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`chat-widget-window ${isMinimized ? 'minimized' : ''}`}>
          <div className="chat-widget-header">
            <div className="chat-widget-header-left">
              <MessageCircle size={20} />
              <div className="chat-widget-header-info">
                <div className="chat-widget-title">AI Analytics</div>
                {accountName && <div className="chat-widget-subtitle">{accountName}</div>}
              </div>
            </div>
            <div className="chat-widget-header-actions">
              <button className="chat-widget-icon-button" onClick={() => setIsMinimized(!isMinimized)}>
                <Minimize2 size={18} />
              </button>
              <button className="chat-widget-icon-button" onClick={() => setIsOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="chat-widget-body">
            {messages.length === 0 && !isLoading && (
              <div className="chat-widget-welcome">
                <h3>Chào mừng đến với AI Analytics! 👋</h3>
                <p>Bạn có thể hỏi bất kỳ câu hỏi nào về quảng cáo:</p>
                <ul className="chat-widget-welcome-examples">
                  <li onClick={() => setInputValue("Chi tiêu hôm nay thế nào?")}>📊 Chi tiêu hôm nay thế nào?</li>
                  <li onClick={() => setInputValue("Có bao nhiêu chiến dịch?")}>🔢 Có bao nhiêu chiến dịch?</li>
                  <li onClick={() => setInputValue("Xu hướng CTR 7 ngày qua")}>📈 Xu hướng CTR 7 ngày qua</li>
                  <li onClick={() => setInputValue("Campaign nào hiệu quả nhất?")}>🏆 Campaign nào hiệu quả nhất?</li>
                </ul>
              </div>
            )}

            {(messages.length > 0 || isLoading) && (
              <div className="chat-widget-messages">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-widget-message ${m.role === 'user' ? 'user' : 'assistant'} ${m.isError ? 'error' : ''}`}>
                    <div className="chat-widget-message-role">{m.role === 'user' ? '👤' : '🤖'}</div>
                    <div
                      className="chat-widget-message-content"
                      dangerouslySetInnerHTML={{ __html: m.content }}
                    />
                    {m.timestamp && (
                      <div className="chat-widget-message-time">
                        {new Date(m.timestamp).toLocaleTimeString('vi-VN')}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="chat-widget-message assistant">
                    <div className="chat-widget-message-role">🤖</div>
                    <div className="chat-widget-message-content loading">
                      <div className="chat-widget-loading-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="chat-widget-footer">
            <div className="chat-widget-input-wrapper">
              <textarea
                ref={textareaRef}
                className="chat-widget-input"
                placeholder="Nhập câu hỏi..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  // Auto-resize on change
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto'
                    const scrollHeight = textareaRef.current.scrollHeight
                    textareaRef.current.style.height = `${Math.min(scrollHeight, 100)}px`
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !accountId}
                rows={1}
              />
              <button className="chat-widget-send-button" onClick={handleSend} disabled={isLoading || !inputValue.trim() || !accountId}>
                <Send size={18} />
              </button>
            </div>
            {!accountId && <div className="chat-widget-warning">⚠️ Vui lòng chọn tài khoản quảng cáo</div>}
          </div>
        </div>
      )}
    </>
  )
}

export default ChatAIWidget

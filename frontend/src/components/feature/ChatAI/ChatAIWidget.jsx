import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Minimize2, ArrowLeft } from 'lucide-react'
import ChatAIModuleSelector from './ChatAIModuleSelector.jsx'
import { useChat } from '../../../hooks/useChat'
import PROMPTS from './mock/prompts.json'
import './ChatAIWidget.css'

const MODULE_ICONS = {
  PERF: '📊',
  COMPARE: '⚖️',
  AUDIENCE: '👥',
  TREND: '📈',
}

const MODULE_WELCOME = {
  PERF: 'Phân tích hiệu suất quảng cáo của bạn với các chỉ số chi tiết',
  COMPARE: 'So sánh chiến dịch, nhóm quảng cáo để tìm ra giải pháp tối ưu',
  AUDIENCE: 'Khám phá đối tượng mục tiêu hiệu quả nhất cho quảng cáo',
  TREND: 'Theo dõi xu hướng và biến động hiệu suất theo thời gian',
}

function withModuleContext(text, moduleType) {
  if (!moduleType) return text
  const prefixByModule = {
    PERF: 'Module PERF (hiệu suất tổng quan):',
    COMPARE: 'Module COMPARE (so sánh chiến dịch):',
    AUDIENCE: 'Module AUDIENCE (phân tích đối tượng):',
    TREND: 'Module TREND (xu hướng theo thời gian):',
  }
  const prefix = prefixByModule[moduleType] || ''
  return prefix ? `${prefix} ${text}` : text
}

function ChatAIWidget({ accountId, accountName }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [selectedModule, setSelectedModule] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)

  const { messages, isLoading, sendMessage, clearMessages } = useChat(accountId, selectedModule?.module_type)

  // Auto-scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, isMinimized])

  const handleSelectModule = (module) => {
    setSelectedModule(module)
    clearMessages()
  }

  const handleChangeModule = () => {
    setSelectedModule(null)
    clearMessages()
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !accountId) return
    const messageToSend = withModuleContext(inputValue, selectedModule?.module_type)
    setInputValue('')
    await sendMessage(messageToSend)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptClick = (prompt) => {
    setInputValue(prompt)
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
                <div className="chat-widget-title">
                  {selectedModule ? selectedModule.name : 'AI Analytics'}
                </div>
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
            {!selectedModule ? (
              <ChatAIModuleSelector onSelectModule={handleSelectModule} />
            ) : (
              <>
                {messages.length === 0 && !isLoading ? (
                  <div className="chat-widget-welcome">
                    <button className="chat-widget-back-to-modules" onClick={handleChangeModule}>
                      <ArrowLeft size={16} />
                      <span>Chọn tính năng khác</span>
                    </button>
                    
                    <div className="chat-widget-welcome-icon">
                      {MODULE_ICONS[selectedModule.module_type]}
                    </div>
                    <h3>{selectedModule.name}</h3>
                    <p>{MODULE_WELCOME[selectedModule.module_type]}</p>
                    
                    <div className="chat-widget-quick-prompts">
                      <p className="chat-widget-quick-prompts-title">💡 Câu hỏi gợi ý:</p>
                      {(PROMPTS[selectedModule.module_type] || []).slice(0, 4).map((prompt, idx) => (
                        <button
                          key={idx}
                          className="chat-widget-quick-prompt"
                          onClick={() => handlePromptClick(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="chat-widget-messages">
                    <button className="chat-widget-back-in-chat" onClick={handleChangeModule}>
                      <ArrowLeft size={14} />
                      <span>Chọn tính năng khác</span>
                    </button>
                    
                    {messages.map((m) => (
                      <div key={m.id} className={`chat-widget-message ${m.role === 'user' ? 'user' : 'assistant'} ${m.isError ? 'error' : ''}`}>
                        <div className="chat-widget-message-role">{m.role === 'user' ? '👤' : '🤖'}</div>
                        <div className="chat-widget-message-content">{m.content}</div>
                        {m.timestamp && (
                          <div className="chat-widget-message-time">
                            {new Date(m.timestamp).toLocaleTimeString('vi-VN')}
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
                
                {isLoading && (
                  <div className="chat-widget-loading">
                    <div className="chat-widget-loading-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <span>AI đang phân tích...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {selectedModule && (
            <div className="chat-widget-footer">
              <div className="chat-widget-input-wrapper">
                <textarea
                  className="chat-widget-input"
                  placeholder="Nhập câu hỏi..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
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
          )}
        </div>
      )}
    </>
  )
}

export default ChatAIWidget

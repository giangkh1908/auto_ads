import { useState, useEffect, useRef } from 'react'
import ChatAIModuleSelector from './ChatAIModuleSelector.jsx'
import ChatAIInput from './ChatAIInput.jsx'
import AccountBadge from '../../common/AccountBadge/AccountBadge.jsx'
import { useChat } from '../../../hooks/useChat'
import './ChatAI.styles.css'

const MODULE_ICONS = {
  PERF: '📊',
  COMPARE: '⚖️',
  AUDIENCE: '👥',
  TREND: '📈',
}

function ChatAIPage() {
  const [selectedModule, setSelectedModule] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [accountId, setAccountId] = useState(null)
  const messagesEndRef = useRef(null)
  
  // Use chat hook with module type
  const { messages, isLoading, sendMessage, clearMessages } = useChat(accountId, selectedModule?.module_type)

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load account_id from localStorage on mount
  useEffect(() => {
    const storedAccountId = localStorage.getItem('selected_account_id')
    if (storedAccountId) {
      setAccountId(storedAccountId)
    }
  }, [])

  const handleSelectModule = (module) => {
    setSelectedModule(module)
    clearMessages()
  }

  const handleChangeModule = () => {
    setSelectedModule(null)
    clearMessages()
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    
    if (!accountId) {
      alert('Vui lòng chọn tài khoản quảng cáo trước khi sử dụng Chat AI')
      return
    }

    const messageToSend = inputValue
    setInputValue('')
    await sendMessage(messageToSend)
  }

  return (
    <div className="chat-ai-page-centered">
      <div className="chat-ai-window">
        <div className="chat-ai-header">
          <div className="chat-ai-title">AAMS Ads AI Chatbot</div>
          <AccountBadge />
        </div>

        <div className="chat-ai-body">
          {!selectedModule ? (
            <ChatAIModuleSelector onSelectModule={handleSelectModule} />
          ) : (
            <>
              <div className="chat-ai-module-header">
                <div className="chat-ai-module-header-icon">
                  {MODULE_ICONS[selectedModule.module_type] || '📦'}
                </div>
                <div className="chat-ai-module-header-info">
                  <div className="chat-ai-module-header-name">{selectedModule.name}</div>
                  <div className="chat-ai-module-header-desc">{selectedModule.description}</div>
                </div>
                <button 
                  className="chat-ai-module-change" 
                  onClick={handleChangeModule}
                  aria-label="Đổi module"
                >
                  Đổi module
                </button>
              </div>

              {messages.length > 0 && (
                <div className="chat-ai-messages">
                  {messages.map((m) => (
                    <div 
                      key={m.id} 
                      className={`chat-ai-msg ${m.role === 'user' ? 'user' : 'assistant'} ${m.isError ? 'error' : ''}`}
                    >
                      <div className="chat-ai-msg-role">
                        {m.role === 'user' ? '👤 Bạn' : '🤖 AI Assistant'}
                      </div>
                      <div className="chat-ai-msg-content">{m.content}</div>
                      {m.timestamp && (
                        <div className="chat-ai-msg-time">
                          {new Date(m.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {isLoading && (
                <div className="chat-ai-loading">
                  <div className="chat-ai-loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>AI đang phân tích...</span>
                </div>
              )}
            </>
          )}
        </div>

        {selectedModule && (
          <>
            <ChatAIInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              disabled={isLoading || !accountId}
            />
            <div className="chat-ai-hintbar">
              {accountId 
                ? 'Enter để gửi • Shift+Enter để xuống dòng' 
                : '⚠️ Vui lòng chọn tài khoản quảng cáo trước'
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ChatAIPage


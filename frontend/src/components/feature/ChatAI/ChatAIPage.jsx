import { useState } from 'react'
import ChatAITopicsPanel from './ChatAITopicsPanel.jsx'
import ChatAIDetailPanel from './ChatAIDetailPanel.jsx'
import ChatAIInput from './ChatAIInput.jsx'
import './ChatAI.styles.css'

const DEFAULT_TOPIC = null

function ChatAIPage() {
  const [view, setView] = useState('menu') // 'menu' | 'detail'
  const [selectedTopic, setSelectedTopic] = useState(DEFAULT_TOPIC)
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState([])

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic)
    setView('detail')
  }

  const handleBack = () => {
    setView('menu')
  }

  const handlePromptPick = (fullPrompt) => {
    setInputValue(fullPrompt)
    const inputEl = document.getElementById('chat-ai-input')
    if (inputEl) inputEl.focus()
  }

  const handleSend = () => {
    if (!inputValue.trim()) return
    const newMsg = { id: Date.now(), role: 'user', content: inputValue }
    setMessages((prev) => [...prev, newMsg])
    setInputValue('')
  }

  return (
    <div className="chat-ai-page-centered">
      <div className="chat-ai-window">
        <div className="chat-ai-header">
          {view === 'detail' && (
            <button className="chat-ai-back" onClick={handleBack} aria-label="Quay lại">
              ←
            </button>
          )}
          <div className="chat-ai-title">AAMS Ads AI Chatbot</div>
        </div>

        <div className="chat-ai-body">
          {view === 'menu' ? (
            <div className="chat-ai-menu">
              <div className="chat-ai-menu-title">Bạn muốn xem nội dung nào?</div>
              <ChatAITopicsPanel value={selectedTopic} onChange={handleSelectTopic} />
            </div>
          ) : (
            <ChatAIDetailPanel topic={selectedTopic} onPickPrompt={handlePromptPick} />
          )}

          {messages.length > 0 && (
            <div className="chat-ai-messages">
              {messages.map((m) => (
                <div key={m.id} className="chat-ai-msg">
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>

        <ChatAIInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          disabled={view !== 'detail' || !selectedTopic}
        />
        <div className="chat-ai-hintbar">Enter để gửi • Shift+Enter để xuống dòng</div>
      </div>
    </div>
  )
}

export default ChatAIPage



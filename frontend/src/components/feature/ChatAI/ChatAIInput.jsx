import { useEffect, useRef } from 'react'
import { Send } from 'lucide-react'

function ChatAIInput({ value, onChange, onSend, disabled = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = ref.current.scrollHeight + 'px'
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled) onSend && onSend()
    }
  }

  return (
    <div className={`chat-ai-input ${disabled ? 'disabled' : ''}`}>
      <textarea
        id="chat-ai-input"
        ref={ref}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Chọn một chủ đề để bắt đầu...' : 'Nhập tin nhắn...'}
        rows={1}
        disabled={disabled}
      />
      <button
        className="chat-ai-send"
        onClick={() => !disabled && onSend && onSend()}
        disabled={disabled || !value.trim()}
        aria-label="Gửi"
      >
        <Send size={16} />
      </button>
    </div>
  )
}

export default ChatAIInput



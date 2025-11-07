import { Circle, BarChart2, Users, Image as ImageIcon, CalendarRange } from 'lucide-react'

const TOPICS = [
  { key: 'PERF', label: 'Phân tích tổng quan hiệu suất', icon: BarChart2 },
  { key: 'COMPARE', label: 'So sánh chiến dịch / nhóm quảng cáo', icon: Circle },
  { key: 'AUDIENCE', label: 'Phân tích theo đối tượng', icon: Users },
  { key: 'TREND', label: 'Theo dõi xu hướng thời gian', icon: CalendarRange },
]

function ChatAITopicsPanel({ value, onChange }) {
  return (
    <div className="chat-ai-topics">
      <div className="chat-ai-topics-title">Chọn chủ đề</div>
      <div className="chat-ai-topics-list">
        {TOPICS.map((t) => {
          const Icon = t.icon
          const active = value === t.key
          return (
            <button
              key={t.key}
              className={`chat-ai-topic ${active ? 'active' : ''}`}
              onClick={() => onChange && onChange(t.key)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ChatAITopicsPanel



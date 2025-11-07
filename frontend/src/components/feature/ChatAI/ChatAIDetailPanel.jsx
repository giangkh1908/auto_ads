import prompts from './mock/prompts.json'

const TITLE_BY_TOPIC = {
  PERF: 'Performance Overview',
  COMPARE: 'Compare Campaign / Ad Set',
  AUDIENCE: 'Audience Insight',
  CREATIVE: 'Creative Performance',
  TREND: 'Daily / Weekend Trend',
}

function ChatAIDetailPanel({ topic, onPickPrompt }) {
  const list = prompts[topic] || []
  const title = TITLE_BY_TOPIC[topic] || ''

  return (
    <div className="chat-ai-detail">
      <div className="chat-ai-detail-header">{title}</div>
      <div className="chat-ai-prompts">
        {list.map((p, idx) => (
          <button
            key={idx}
            className="chat-ai-prompt"
            title={p}
            onClick={() => onPickPrompt && onPickPrompt(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ChatAIDetailPanel



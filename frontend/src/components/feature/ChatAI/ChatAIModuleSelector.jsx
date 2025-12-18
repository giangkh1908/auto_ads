import { useState, useEffect } from 'react';
import { chatService } from '../../../services/chat/chatService';
import './ChatAIModuleSelector.css';

const MODULE_ICONS = {
  PERF: '📊',
  COMPARE: '⚖️',
  AUDIENCE: '👥',
  TREND: '📈',
};

const MODULE_COLORS = {
  PERF: '#3b82f6',
  COMPARE: '#8b5cf6',
  AUDIENCE: '#ec4899',
  TREND: '#10b981',
};

function ChatAIModuleSelector({ onSelectModule }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const response = await chatService.getModules();
      if (response.success) {
        setModules(response.modules);
      } else {
        setError('Không thể tải danh sách module');
      }
    } catch (err) {
      console.error('Error loading modules:', err);
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="chat-ai-module-selector">
        <div className="chat-ai-module-loading">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-ai-module-selector">
        <div className="chat-ai-module-error">{error}</div>
        <button onClick={loadModules} className="chat-ai-module-retry">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="chat-ai-module-selector">
      <h2 className="chat-ai-module-title">Chọn Module Phân Tích</h2>
      <p className="chat-ai-module-subtitle">
        Mỗi module chuyên về một loại phân tích. Chọn module phù hợp với nhu cầu của bạn.
      </p>

      <div className="chat-ai-module-grid">
        {modules.map((module) => (
          <div
            key={module.module_type}
            className="chat-ai-module-card"
            onClick={() => onSelectModule(module)}
            style={{ borderColor: MODULE_COLORS[module.module_type] }}
          >
            <div
              className="chat-ai-module-icon"
              style={{ backgroundColor: MODULE_COLORS[module.module_type] }}
            >
              {MODULE_ICONS[module.module_type] || '📦'}
            </div>
            <h3 className="chat-ai-module-name">{module.name}</h3>
            <p className="chat-ai-module-description">{module.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatAIModuleSelector;

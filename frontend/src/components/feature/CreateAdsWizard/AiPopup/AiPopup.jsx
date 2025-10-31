import React, { useState } from 'react';
import axiosInstance from '../../../../utils/axios'; // Import axios instance

const AiPopup = ({ isOpen, onClose, onConfirm }) => {
  const [aiConfig, setAiConfig] = useState({
    language: 'Tiếng Việt',
    tone: 'Chuyên Nghiệp',
    personalization: '',
    mainKeywords: '',
    synonymousKeywords: '',
    aiModel: 'openai'
  });

  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);

  if (!isOpen) return null;

  // Hàm tạo từ khóa cùng nghĩa - SỬ DỤNG AXIOS INSTANCE
  const handleGenerateKeywords = async () => {
    if (!aiConfig.mainKeywords.trim()) {
      alert('Vui lòng nhập từ khóa chính trước');
      return;
    }

    setIsGeneratingKeywords(true);
    try {
      // ✅ Sử dụng axiosInstance thay vì fetch
      const response = await axiosInstance.post('/api/ai/keywords/suggest', {
        main_keywords: aiConfig.mainKeywords.split(',').map(k => k.trim()).filter(Boolean),
        language: aiConfig.language === 'Tiếng Việt' ? 'vi' : aiConfig.language === 'English' ? 'en' : 'zh',
        ai_provider: aiConfig.aiModel
      }, {
        timeout: 60000 // 60 giây
      });

      const data = response.data;
      
      if (data.success && data.related_keywords) {
        // Cập nhật từ khóa cùng nghĩa
        setAiConfig(prev => ({
          ...prev,
          synonymousKeywords: data.related_keywords.join(', ')
        }));
      } else {
        alert('Không thể tạo từ khóa cùng nghĩa: ' + (data.message || 'Lỗi không xác định'));
      }
    } catch (error) {
      console.error('Error generating keywords:', error);
      alert('Lỗi khi tạo từ khóa cùng nghĩa: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const handleConfirm = () => {
    // Chuẩn bị dữ liệu cho backend
    const configData = {
      language: aiConfig.language === 'Tiếng Việt' ? 'vi' : aiConfig.language === 'English' ? 'en' : 'zh',
      tone: aiConfig.tone.toLowerCase().replace(/\s+/g, '_'),
      personalization: aiConfig.personalization,
      main_keywords: [
        ...aiConfig.mainKeywords.split(',').map(k => k.trim()).filter(Boolean),
        ...aiConfig.synonymousKeywords.split(',').map(k => k.trim()).filter(Boolean)
      ],
      ai_provider: aiConfig.aiModel
    };
    
    onConfirm(configData);
    onClose();
  };

  return (
    <div className="ai-config-modal-overlay" onClick={onClose}>
      <div className="ai-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-config-header">
          <h3>Auto Ads AI</h3>
          <button 
            className="ai-config-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="ai-config-form">
          {/* Ngôn Ngữ */}
          <div className="ai-config-field">
            <label className="ai-config-label">Ngôn Ngữ</label>
            <select 
              className="ai-config-select"
              value={aiConfig.language}
              onChange={(e) => setAiConfig(prev => ({ ...prev, language: e.target.value }))}
            >
              <option value="Tiếng Việt">Tiếng Việt</option>
              <option value="English">English</option>
              <option value="中文">中文</option>
            </select>
          </div>

          {/* Giọng Điệu */}
          <div className="ai-config-field">
            <label className="ai-config-label">Phong Cách</label>
            <select 
              className="ai-config-select"
              value={aiConfig.tone}
              onChange={(e) => setAiConfig(prev => ({ ...prev, tone: e.target.value }))}
            >
              <option value="Chuyên Nghiệp">Chuyên Nghiệp</option>
              <option value="Thân Thiện">Thân Thiện</option>
              <option value="Vui Vẻ">Vui Vẻ</option>
              <option value="Trang Trọng">Trang Trọng</option>
            </select>
          </div>

          {/* Model AI */}
          <div className="ai-config-field">
            <label className="ai-config-label">Model AI</label>
            <select 
              className="ai-config-select"
              value={aiConfig.aiModel}
              onChange={(e) => setAiConfig(prev => ({ ...prev, aiModel: e.target.value }))}
            >
              <option value="openai">OpenAI GPT-4o-mini</option>
              <option value="gemini">Google Gemini 2.5 Flash</option>
            </select>
          </div>

          {/* Cá nhân hóa */}
          <div className="ai-config-field">
            <label className="ai-config-label">Mô tả quảng cáo</label>
            <textarea
              className="ai-config-textarea"
              value={aiConfig.personalization}
              onChange={(e) => setAiConfig(prev => ({ ...prev, personalization: e.target.value }))}
              placeholder="Công ty, sản phẩm, cá nhân, hashtag,... bạn muốn đưa vào bài viết"
              rows={3}
            />
          </div>

          {/* Từ khóa chính */}
          <div className="ai-config-field">
            <label className="ai-config-label">Từ khóa chính</label>
            <input
              type="text"
              className="ai-config-input"
              value={aiConfig.mainKeywords}
              onChange={(e) => setAiConfig(prev => ({ ...prev, mainKeywords: e.target.value }))}
              placeholder="nhà, quán quen"
            />
            <button 
              className="ai-config-button"
              onClick={handleGenerateKeywords}
              disabled={isGeneratingKeywords || !aiConfig.mainKeywords.trim()}
              style={{
                marginTop: '8px',
                padding: '8px 16px',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isGeneratingKeywords || !aiConfig.mainKeywords.trim() ? 'not-allowed' : 'pointer',
                opacity: isGeneratingKeywords || !aiConfig.mainKeywords.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isGeneratingKeywords ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span> Đang tạo...
                </>
              ) : (
                '🪄 Tạo từ khóa cùng nghĩa'
              )}
            </button>
          </div>

          {/* Từ khóa cùng nghĩa */}
          <div className="ai-config-field">
            <label className="ai-config-label">Từ khóa cùng nghĩa</label>
            <div className="keywords-container" style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '8px',
              minHeight: '32px',
              padding: '8px',
              border: '1px solid #e1e5e9',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa'
            }}>
              {aiConfig.synonymousKeywords.split(',').filter(k => k.trim()).map((keyword, index) => (
                <span key={index} className="keyword-tag" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {keyword.trim()}
                  <button
                    className="keyword-remove"
                    onClick={() => {
                      const keywords = aiConfig.synonymousKeywords.split(',').filter(k => k.trim());
                      keywords.splice(index, 1);
                      setAiConfig(prev => ({ ...prev, synonymousKeywords: keywords.join(', ') }));
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      padding: '0',
                      marginLeft: '4px',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {/* <input
              type="text"
              className="ai-config-input"
              value={aiConfig.synonymousKeywords}
              onChange={(e) => setAiConfig(prev => ({ ...prev, synonymousKeywords: e.target.value }))}
              placeholder="Từ khóa cùng nghĩa sẽ xuất hiện ở đây"
            /> */}
          </div>

          {/* Confirm Button */}
          <div className="ai-config-actions">
            <button 
              className="ai-config-confirm"
              onClick={handleConfirm}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500'
              }}
            >
              Xác Nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPopup;

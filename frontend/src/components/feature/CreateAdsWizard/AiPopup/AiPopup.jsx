import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye } from 'lucide-react';
import axiosInstance from '../../../../utils/axios';
import { aiConfigService } from '../../../../services/aiConfigService';
import { useToast } from '../../../../hooks/useToast';
import PromptPreviewModal from '../PromptPreview/PromptPreviewModal';

const AiPopup = ({
  isOpen,
  onClose,
  onConfirm,
  defaultConfigId = null,
  initialPersonalization = '',
  initialMainKeywords = '',
  initialSynonymousKeywords = '',
  onPersistInputs = null,
}) => {
  const toast = useToast();
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState(defaultConfigId || '');
  const [selectedConfigModel, setSelectedConfigModel] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    language: 'Tiếng Việt',
    tone: 'Chuyên Nghiệp',
    personalization: '',
    mainKeywords: '',
    synonymousKeywords: '',
    aiModel: 'openai'
  });

  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [showSaveConfig, setShowSaveConfig] = useState(false);
  const [configName, setConfigName] = useState('');
  // Track if user manually changed language/tone/aiModel to preserve selections
  const userModifiedRef = useRef(false);

  

  // Ensure persisted values are restored when popup opens
  useEffect(() => {
    if (!isOpen) return;
    setAiConfig((prev) => ({
      ...prev,
      personalization:
        typeof initialPersonalization === 'string'
          ? initialPersonalization
          : prev.personalization,
      mainKeywords:
        typeof initialMainKeywords === 'string'
          ? initialMainKeywords
          : prev.mainKeywords,
      synonymousKeywords:
        typeof initialSynonymousKeywords === 'string'
          ? initialSynonymousKeywords
          : prev.synonymousKeywords,
    }));
  }, [isOpen, initialPersonalization, initialMainKeywords, initialSynonymousKeywords]);

  const loadConfig = useCallback(async (configId) => {
    try {
      const response = await aiConfigService.getConfig(configId);
      if (response.success && response.config) {
        const config = response.config;
        const model = config.model || 'gpt-4o-mini';
        setSelectedConfigModel(model);
        setSelectedConfig(config);
        setAiConfig({
          language: config.metadata?.language === 'vi' ? 'Tiếng Việt' : 
                   config.metadata?.language === 'en' ? 'English' : '中文',
          tone: config.metadata?.tone?.replace(/_/g, ' ') || 'Chuyên Nghiệp',
          personalization: initialPersonalization || '',
          mainKeywords: initialMainKeywords || '',
          synonymousKeywords: initialSynonymousKeywords || '',
          aiModel: model.includes('gemini') ? 'gemini' : 'openai'
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Không thể tải config');
    }
  }, [toast, initialPersonalization, initialMainKeywords, initialSynonymousKeywords]);

  const loadConfigs = useCallback(async () => {
    setIsLoadingConfigs(true);
    try {
      const response = await aiConfigService.getConfigs('own,templates');
      if (response.success) {
        setSavedConfigs(response.configs || []);
        const defaultConfig = response.configs?.find(c => c.is_default);
        // Only auto-load default config if parent didn't provide defaultConfigId
        // and the user hasn't manually changed language/tone/model in this popup.
        if (defaultConfig && !defaultConfigId && !userModifiedRef.current) {
          setSelectedConfigId(defaultConfig._id);
          loadConfig(defaultConfig._id);
        }
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setIsLoadingConfigs(false);
    }
  }, [defaultConfigId, loadConfig]);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      // If a defaultConfigId prop exists, only load it if user hasn't modified
      if (defaultConfigId && !userModifiedRef.current) {
        loadConfig(defaultConfigId);
      }
    }
  }, [isOpen, defaultConfigId, loadConfig, loadConfigs]);

  const handleConfigSelect = (e) => {
    const configId = e.target.value;
    setSelectedConfigId(configId);
    setSelectedConfigModel(null);
    setSelectedConfig(null);
    if (configId) {
      loadConfig(configId);
    } else {
      setAiConfig({
        language: 'Tiếng Việt',
        tone: 'Chuyên Nghiệp',
        personalization: initialPersonalization || '',
        mainKeywords: initialMainKeywords || '',
        synonymousKeywords: initialSynonymousKeywords || '',
        aiModel: 'openai'
      });
    }
  };

  const handleSaveConfig = async () => {
    if (!configName.trim()) {
      toast.warning('Vui lòng nhập tên config');
      return;
    }

    try {
      const languageMap = {
        'Tiếng Việt': 'vi',
        'English': 'en',
        '中文': 'zh'
      };

      await aiConfigService.createConfig({
        name: configName,
        character: 'Bạn là 1 chuyên gia marketing quảng cáo Facebook với nhiều năm kinh nghiệm.',
        skills: [
          'Bạn có kỹ năng viết nội dung quảng cáo hấp dẫn và hiệu quả',
          'Bạn có kỹ năng tối ưu hóa từ khóa cho Facebook Ads',
        ],
        limitations: [
          'Chỉ trả lời những câu hỏi liên quan đến quảng cáo Facebook',
          'Giữ kết luận trong khoảng 100 từ',
        ],
        model: aiConfig.aiModel === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini',
        metadata: {
          language: languageMap[aiConfig.language] || 'vi',
          tone: aiConfig.tone.toLowerCase().replace(/\s+/g, '_'),
          personalization: aiConfig.personalization,
        },
      });

      toast.success('Đã lưu config thành công');
      setShowSaveConfig(false);
      setConfigName('');
      loadConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Không thể lưu config');
    }
  };

  // Khi click vào tag từ khóa cùng nghĩa: chuyển từ đó lên Từ khóa chính
  const handleSynonymClick = useCallback((keyword) => {
    if (!keyword) return;
    setAiConfig(prev => {
      const prevMain = String(prev.mainKeywords || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      // Thêm nếu chưa tồn tại
      if (!prevMain.includes(keyword)) prevMain.push(keyword);

      const remaining = String(prev.synonymousKeywords || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(k => k !== keyword);

      return {
        ...prev,
        mainKeywords: prevMain.join(', '),
        synonymousKeywords: remaining.join(', ')
      };
    });
  }, []);

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
    const toArray = (v) =>
      Array.isArray(v)
        ? v
        : String(v || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
    
    const mainKeywords = [
      ...toArray(aiConfig.mainKeywords),
      ...toArray(aiConfig.synonymousKeywords),
    ];

    if (mainKeywords.length === 0) {
      toast.warning('Vui lòng nhập ít nhất một từ khóa chính');
      return;
    }

    // Nếu có selectedConfigId, gửi config_id, nếu không gửi prompt fields
    const configData = selectedConfigId
      ? { 
          config_id: selectedConfigId, 
          main_keywords: mainKeywords,
          ai_provider: selectedConfigModel?.includes('gemini') ? 'gemini' : 'openai'
        }
      : {
          language: aiConfig.language === 'Tiếng Việt' ? 'vi' : aiConfig.language === 'English' ? 'en' : 'zh',
          tone: aiConfig.tone.toLowerCase().replace(/\s+/g, '_'),
          personalization: aiConfig.personalization,
          main_keywords: mainKeywords,
          ai_provider: aiConfig.aiModel
        };
    
    // Persist latest inputs back to parent if requested
    if (typeof onPersistInputs === 'function') {
      onPersistInputs({
        personalization: aiConfig.personalization,
        mainKeywords: aiConfig.mainKeywords,
        synonymousKeywords: aiConfig.synonymousKeywords,
      });
    }

    onConfirm(configData);
    onClose();
  };

  return (
    <div className="ai-config-modal-overlay">
      <div className="ai-config-modal">
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
          {/* Chọn Config đã lưu */}
          <div className="ai-config-field">
            <label className="ai-config-label">Chọn config đã lưu (tùy chọn)</label>
            <select
              className="ai-config-select"
              value={selectedConfigId}
              onChange={handleConfigSelect}
              disabled={isLoadingConfigs}
            >
              <option value="">-- Tạo mới --</option>
              {savedConfigs.map(config => (
                <option key={config._id} value={config._id}>
                  {config.is_system_template ? '📋 ' : config.is_default ? '⭐ ' : ''}
                  {config.name}
                </option>
              ))}
            </select>
          </div>

          {selectedConfigId && selectedConfig && (
            <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <strong>Đang sử dụng config: {selectedConfig.name}</strong>
                  {selectedConfig.character && (
                    <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px' }}>
                      ✨ Custom Prompt
                    </span>
                  )}
                  {!selectedConfig.character && (
                    <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '4px', fontSize: '11px' }}>
                      📝 Default Prompt
                    </span>
                  )}
                </div>
                {selectedConfig.character && (
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={14} />
                    Xem prompt
                  </button>
                )}
              </div>
              {selectedConfig.character && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: 'white', borderRadius: '4px', fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>
                  <strong>Character:</strong> {selectedConfig.character.substring(0, 100)}
                  {selectedConfig.character.length > 100 ? '...' : ''}
                </div>
              )}
            </div>
          )}

          {/* Ngôn Ngữ */}
          <div className="ai-config-field">
            <label className="ai-config-label">Ngôn Ngữ</label>
            <select 
              className="ai-config-select"
              value={aiConfig.language}
              onChange={(e) => {
                userModifiedRef.current = true;
                setAiConfig(prev => ({ ...prev, language: e.target.value }));
              }}
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
              onChange={(e) => {
                userModifiedRef.current = true;
                setAiConfig(prev => ({ ...prev, tone: e.target.value }));
              }}
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
              onChange={(e) => {
                userModifiedRef.current = true;
                setAiConfig(prev => ({ ...prev, aiModel: e.target.value }));
              }}
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
                <span
                  key={index}
                  className="keyword-tag"
                  onClick={() => handleSynonymClick(keyword.trim())}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {keyword.trim()}
                  <button
                    className="keyword-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      const keywords = aiConfig.synonymousKeywords.split(',').map(k => k.trim()).filter(k => k);
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

          {/* Save Config */}
          {!selectedConfigId && (
            <div className="ai-config-field">
              <button
                type="button"
                onClick={() => setShowSaveConfig(!showSaveConfig)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6f42c1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                💾 {showSaveConfig ? 'Ẩn' : 'Lưu config này'}
              </button>
              {showSaveConfig && (
                <div style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    className="ai-config-input"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="Nhập tên config"
                    style={{ marginBottom: '8px' }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Lưu
                  </button>
                </div>
              )}
            </div>
          )}

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

      <PromptPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        configId={selectedConfig?._id}
        config={selectedConfig}
      />
    </div>
  );
};

export default AiPopup;

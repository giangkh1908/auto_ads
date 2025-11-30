import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { aiConfigService } from '../../../../services/aiConfigService';
import { useToast } from '../../../../hooks/useToast';
import './AiPromptConfig.css';

const AiPromptConfig = ({ isOpen, onClose, onSave, initialConfig = {}, configId = null }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('configuration');
  const [activePromptTab, setActivePromptTab] = useState('headline');
  const [character, setCharacter] = useState(initialConfig.character || 'Bạn là 1 chuyên gia marketing quảng cáo Facebook với nhiều năm kinh nghiệm.');
  const [skills, setSkills] = useState(initialConfig.skills || [
    'Bạn có kỹ năng viết nội dung quảng cáo hấp dẫn và hiệu quả',
    'Bạn có kỹ năng tối ưu hóa từ khóa cho Facebook Ads',
    'Bạn có kỹ năng phân tích đối tượng mục tiêu'
  ]);
  const [limitations, setLimitations] = useState(initialConfig.limitations || [
    'Chỉ trả lời những câu hỏi liên quan đến quảng cáo Facebook',
    'Giữ kết luận trong khoảng 100 từ',
    'Cung cấp thông tin chính xác và tin cậy',
    'Không đưa ra các lời khuyên ngoài phạm vi quảng cáo Facebook'
  ]);
  const [selectedModel, setSelectedModel] = useState(initialConfig.model || 'gpt-4o-mini');
  const [openingQuestion, setOpeningQuestion] = useState(initialConfig.openingQuestion || '');
  const [autoSuggestions, setAutoSuggestions] = useState(initialConfig.autoSuggestions || false);
  
  // Prompt templates state
  const [promptTemplateHeadline, setPromptTemplateHeadline] = useState(initialConfig.prompt_template_headline || '');
  const [promptTemplateBody, setPromptTemplateBody] = useState(initialConfig.prompt_template_body || '');
  const [promptTemplateDescription, setPromptTemplateDescription] = useState(initialConfig.prompt_template_description || '');
  const [useCustomTemplates, setUseCustomTemplates] = useState(initialConfig.use_custom_templates || false);
  
  const [expandedSections, setExpandedSections] = useState({
    model: false,
    knowledge: true,
    zalo: true,
    fanpage: false,
    openingQuestion: true,
    autoSuggestions: false,
    promptTemplates: false
  });

  useEffect(() => {
    if (initialConfig.character) {
      setCharacter(initialConfig.character);
      setSkills(initialConfig.skills || []);
      setLimitations(initialConfig.limitations || []);
      setSelectedModel(initialConfig.model || 'gpt-4o-mini');
      setOpeningQuestion(initialConfig.openingQuestion || '');
      setAutoSuggestions(initialConfig.autoSuggestions || false);
      setPromptTemplateHeadline(initialConfig.prompt_template_headline || '');
      setPromptTemplateBody(initialConfig.prompt_template_body || '');
      setPromptTemplateDescription(initialConfig.prompt_template_description || '');
      setUseCustomTemplates(initialConfig.use_custom_templates || false);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const addSkill = () => {
    setSkills([...skills, '']);
  };

  const updateSkill = (index, value) => {
    const newSkills = [...skills];
    newSkills[index] = value;
    setSkills(newSkills);
  };

  const removeSkill = (index) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const addLimitation = () => {
    setLimitations([...limitations, '']);
  };

  const updateLimitation = (index, value) => {
    const newLimitations = [...limitations];
    newLimitations[index] = value;
    setLimitations(newLimitations);
  };

  const removeLimitation = (index) => {
    setLimitations(limitations.filter((_, i) => i !== index));
  };

  // Default templates
  const getDefaultTemplate = (target) => {
    const formatInstruction = "\n\nQUAN TRỌNG: Chỉ trả về nội dung quảng cáo thuần túy. KHÔNG giải thích, KHÔNG markdown (**), KHÔNG 'Lý do chọn' hay 'Tuyệt vời!'. Format: Chỉ text thuần, không có phần mở đầu hay kết luận. Trả về ngay nội dung, không nói thêm gì.";
    
    const basePrompt = `{character}

Kỹ năng:
{skills}

Giới hạn:
{limitations}

Ngữ cảnh: {personalization}. Từ khóa: {keywords}. Giọng: {tone}. Ngôn ngữ: {language}.

`;

    switch (target) {
      case 'headline':
        return `${basePrompt}Viết 1 tiêu đề quảng cáo Facebook ({language}) theo AIDA, tối đa {maxLen} ký tự. Yêu cầu: 1 dòng duy nhất, nêu lợi ích cụ thể, có yếu tố khẩn trương hợp lý.${formatInstruction}`;
      case 'body':
        return `${basePrompt}Viết nội dung chính quảng cáo Facebook ({language}) theo AIDA, tối đa {maxLen} ký tự. Cấu trúc: 1) Attention: 1 câu mở đầu chạm vấn đề/mong muốn. 2) Interest/Desire: 2-3 ý lợi ích cụ thể, có bằng chứng ngắn. 3) Action: 1 CTA rõ. Kết thúc bằng CTA ngắn. Viết thành đoạn mạch lạc.${formatInstruction}`;
      case 'description':
        return `${basePrompt}Viết 1 mô tả ngắn quảng cáo Facebook ({language}) bổ trợ tiêu đề, tối đa {maxLen} ký tự. Yêu cầu: Nêu điểm khác biệt/cụ thể hóa lợi ích, tránh lặp lại nguyên văn tiêu đề.${formatInstruction}`;
      default:
        return '';
    }
  };

  const generateDefaultPrompt = (target) => {
    const template = getDefaultTemplate(target);
    const skillsText = skills.filter(s => s.trim()).map(s => `- ${s}`).join('\n');
    const limitationsText = limitations.filter(l => l.trim()).map(l => `- ${l}`).join('\n');
    
    const maxLen = target === 'headline' ? '60' : target === 'description' ? '90' : '125';
    
    let prompt = template
      .replace(/{character}/g, character || '')
      .replace(/{skills}/g, skillsText || '')
      .replace(/{limitations}/g, limitationsText || '')
      .replace(/{language}/g, 'vi')
      .replace(/{tone}/g, 'chuyen_nghiep')
      .replace(/{personalization}/g, 'Quảng cáo sản phẩm/dịch vụ')
      .replace(/{keywords}/g, '')
      .replace(/{maxLen}/g, maxLen);

    switch (target) {
      case 'headline':
        setPromptTemplateHeadline(prompt);
        break;
      case 'body':
        setPromptTemplateBody(prompt);
        break;
      case 'description':
        setPromptTemplateDescription(prompt);
        break;
    }
    toast.success('Đã generate prompt mặc định');
  };

  const resetToDefault = (target) => {
    const template = getDefaultTemplate(target);
    switch (target) {
      case 'headline':
        setPromptTemplateHeadline(template);
        break;
      case 'body':
        setPromptTemplateBody(template);
        break;
      case 'description':
        setPromptTemplateDescription(template);
        break;
    }
    toast.success('Đã reset về template mặc định');
  };

  const handleSave = () => {
    const config = {
      character,
      skills: skills.filter(s => s.trim()),
      limitations: limitations.filter(l => l.trim()),
      model: selectedModel,
      openingQuestion,
      autoSuggestions,
      prompt_template_headline: promptTemplateHeadline.trim(),
      prompt_template_body: promptTemplateBody.trim(),
      prompt_template_description: promptTemplateDescription.trim(),
      use_custom_templates: useCustomTemplates
    };
    onSave(config);
  };

  return (
    <div className="ai-prompt-config-overlay" onClick={onClose}>
      <div className="ai-prompt-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-prompt-config-header">
          <h3>Cấu hình AI Prompt</h3>
          <button className="ai-prompt-config-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="ai-prompt-config-content">
          <div className="ai-prompt-left">
            <div className="ai-prompt-section">
              <h4 className="ai-prompt-section-title">Prompt</h4>
              
              <div className="ai-prompt-subsection">
                <h5 className="ai-prompt-subsection-title" 
                title="Cấu hình nhân vật giả tưởng cho prompt">
                  # Nhân vật
                </h5>
                <textarea
                  className="ai-prompt-textarea"
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                  placeholder="Bạn là 1 chuyên gia..."
                  rows={3}
                />
              </div>

              <div className="ai-prompt-subsection">
                <h5 className="ai-prompt-subsection-title" 
                title="Cấu hình kỹ năng mà nhân vật ấy sử dụng cho prompt">
                  ## Kỹ năng
                </h5>
                <div className="ai-prompt-list">
                  {skills.map((skill, index) => (
                    <div key={index} className="ai-prompt-list-item">
                      <span className="ai-prompt-bullet">-</span>
                      <input
                        type="text"
                        className="ai-prompt-list-input"
                        value={skill}
                        onChange={(e) => updateSkill(index, e.target.value)}
                        placeholder="Bạn có kỹ năng..."
                      />
                      <button
                        className="ai-prompt-remove-btn"
                        onClick={() => removeSkill(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="ai-prompt-add-btn" onClick={addSkill}>
                    <Plus size={14} />
                    Thêm kỹ năng
                  </button>
                </div>
              </div>

              <div className="ai-prompt-subsection">
                <h5 className="ai-prompt-subsection-title" 
                title="Có giới hạn nào mà không cho phép nhân vật vượt quá?">
                  ## Giới hạn
                </h5>
                <div className="ai-prompt-list">
                  {limitations.map((limitation, index) => (
                    <div key={index} className="ai-prompt-list-item">
                      <span className="ai-prompt-bullet">-</span>
                      <input
                        type="text"
                        className="ai-prompt-list-input"
                        value={limitation}
                        onChange={(e) => updateLimitation(index, e.target.value)}
                        placeholder="Chỉ trả lời những câu hỏi..."
                      />
                      <button
                        className="ai-prompt-remove-btn"
                        onClick={() => removeLimitation(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="ai-prompt-add-btn" onClick={addLimitation}>
                    <Plus size={14} />
                    Thêm giới hạn
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="ai-prompt-right">
            <div className="ai-prompt-tabs">
              <button
                className={`ai-prompt-tab ${activeTab === 'configuration' ? 'active' : ''}`}
                onClick={() => setActiveTab('configuration')}
              >
                Cấu hình
              </button>
            </div>

            {activeTab === 'configuration' && (
              <div className="ai-prompt-config-sections">
                <div className="ai-prompt-config-section">
                  <button
                    className="ai-prompt-config-section-header"
                    onClick={() => toggleSection('model')}
                  >
                    <span>Mô hình</span>
                    {expandedSections.model ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {expandedSections.model && (
                    <div className="ai-prompt-config-section-content">
                      <select
                        className="ai-prompt-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      >
                        <option value="gpt-4o-mini">GPT-4o-mini</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="ai-prompt-config-section">
                  <button
                    className="ai-prompt-config-section-header"
                    onClick={() => toggleSection('knowledge')}
                  >
                    <span>Kiến thức</span>
                    {expandedSections.knowledge ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Plus size={16} className="ai-prompt-section-icon" />
                  </button>
                  {expandedSections.knowledge && (
                    <div className="ai-prompt-config-section-content">
                      <p className="ai-prompt-section-placeholder">Chưa có kiến thức nào</p>
                    </div>
                  )}
                </div>

                <div className="ai-prompt-config-section">
                  <div className="ai-prompt-config-section-header">
                    <span>Nâng cao</span>
                  </div>
                  <div className="ai-prompt-plugin-subsection">
                    <button
                      className="ai-prompt-config-section-header"
                      onClick={() => toggleSection('openingQuestion')}
                    >
                      <div className="ai-prompt-section-title-with-icon">
                        <div className="ai-prompt-icon-circle">A</div>
                        <span>Câu hỏi mở đầu</span>
                      </div>
                      {expandedSections.openingQuestion ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {expandedSections.openingQuestion && (
                      <div className="ai-prompt-config-section-content">
                        <input
                          type="text"
                          className="ai-prompt-input"
                          value={openingQuestion}
                          onChange={(e) => setOpeningQuestion(e.target.value)}
                          placeholder="Nhập câu hỏi mở đầu"
                        />
                        {openingQuestion && (
                          <button
                            className="ai-prompt-remove-btn-inline"
                            onClick={() => setOpeningQuestion('')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ai-prompt-plugin-subsection">
                    <button
                      className="ai-prompt-config-section-header"
                      onClick={() => toggleSection('autoSuggestions')}
                    >
                      <span>Gợi ý tự động</span>
                      {expandedSections.autoSuggestions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <label className="ai-prompt-toggle">
                        <input
                          type="checkbox"
                          checked={autoSuggestions}
                          onChange={(e) => setAutoSuggestions(e.target.checked)}
                        />
                        <span className="ai-prompt-toggle-slider"></span>
                      </label>
                    </button>
                  </div>
                </div>

                <div className="ai-prompt-config-section">
                  <button
                    className="ai-prompt-config-section-header"
                    onClick={() => toggleSection('promptTemplates')}
                  >
                    <span>Prompt Templates</span>
                    {expandedSections.promptTemplates ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {expandedSections.promptTemplates && (
                    <div className="ai-prompt-config-section-content">
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={useCustomTemplates}
                            onChange={(e) => setUseCustomTemplates(e.target.checked)}
                          />
                          <span>Sử dụng Custom Templates</span>
                        </label>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '10px'}}>
                          Khi bật, hệ thống sẽ dùng các template tùy chỉnh thay vì tự động build từ Character/Skills/Limitations
                        </div>
                        <div style={{ fontSize: '12px', color: '#666'}}>
                          Các placeholders có thể dùng: {'{character}'}, {'{skills}'}, {'{limitations}'}, {'{language}'}, {'{tone}'}, {'{personalization}'}, {'{keywords}'}, {'{maxLen}'}
                        </div>
                      </div>

                      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className={`ai-prompt-tab ${activePromptTab === 'headline' ? 'active' : ''}`}
                            onClick={() => setActivePromptTab('headline')}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                          >
                            Headline
                          </button>
                          <button
                            className={`ai-prompt-tab ${activePromptTab === 'body' ? 'active' : ''}`}
                            onClick={() => setActivePromptTab('body')}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                          >
                            Body
                          </button>
                          <button
                            className={`ai-prompt-tab ${activePromptTab === 'description' ? 'active' : ''}`}
                            onClick={() => setActivePromptTab('description')}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                          >
                            Description
                          </button>
                        </div>
                      </div>

                      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => generateDefaultPrompt(activePromptTab)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Generate từ Character/Skills/Limitations
                        </button>
                        <button
                          onClick={() => resetToDefault(activePromptTab)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Reset về Default
                        </button>
                      </div>

                      <textarea
                        value={activePromptTab === 'headline' ? promptTemplateHeadline : activePromptTab === 'body' ? promptTemplateBody : promptTemplateDescription}
                        onChange={(e) => {
                          if (activePromptTab === 'headline') {
                            setPromptTemplateHeadline(e.target.value);
                          } else if (activePromptTab === 'body') {
                            setPromptTemplateBody(e.target.value);
                          } else {
                            setPromptTemplateDescription(e.target.value);
                          }
                        }}
                        placeholder="Nhập prompt template với placeholders..."
                        style={{
                          width: '100%',
                          minHeight: '400px',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ai-prompt-config-footer">
          <button className="ai-prompt-config-cancel" onClick={onClose}>
            Hủy
          </button>
          <button className="ai-prompt-config-save" onClick={handleSave}>
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiPromptConfig;


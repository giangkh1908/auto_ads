import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Star, StarOff, Settings, Eye, FileText } from 'lucide-react';
import { aiConfigService } from '../../../../services/chat/aiConfigService';
import { useToast } from '../../../../hooks/common/useToast';
import AiPromptConfig from '../AiPromptConfig/AiPromptConfig';
import PromptPreviewModal from '../PromptPreview/PromptPreviewModal';
import './AiConfigManager.css';

const AiConfigManager = ({ isOpen, onClose, onConfigSelect = null }) => {
  const toast = useToast();
  const [configs, setConfigs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewConfig, setPreviewConfig] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    character: 'Bạn là 1 chuyên gia marketing quảng cáo Facebook với nhiều năm kinh nghiệm.',
    skills: [''],
    limitations: [''],
    model: 'gpt-4o-mini',
  });

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const response = await aiConfigService.getConfigs('own,templates');
      if (response.success) {
        setConfigs(response.configs || []);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('Không thể tải danh sách configs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc muốn xóa config "${name}"?`)) {
      return;
    }

    try {
      const response = await aiConfigService.deleteConfig(id);
      if (response.success) {
        toast.success('Đã xóa config thành công');
        loadConfigs();
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Không thể xóa config');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      const response = await aiConfigService.setDefaultConfig(id);
      if (response.success) {
        toast.success('Đã đặt làm config mặc định');
        loadConfigs();
      }
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Không thể đặt config mặc định');
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      character: config.character || '',
      skills: config.skills && config.skills.length > 0 ? config.skills : [''],
      limitations: config.limitations && config.limitations.length > 0 ? config.limitations : [''],
      model: config.model || 'gpt-4o-mini',
    });
    setShowCreateForm(true);
  };

  const handleEditPrompt = (config) => {
    setEditingConfig(config);
    setShowPromptConfig(true);
  };

  const handlePreviewPrompt = (config) => {
    setPreviewConfig(config);
    setShowPreviewModal(true);
  };

  const handlePromptConfigSave = async (configData) => {
    if (!editingConfig) return;

    try {
      console.log('Saving prompt config with data:', configData);
      const response = await aiConfigService.updateConfig(editingConfig._id, {
        character: configData.character,
        skills: configData.skills,
        limitations: configData.limitations,
        model: configData.model || editingConfig.model,
        prompt_template_headline: configData.prompt_template_headline || '',
        prompt_template_body: configData.prompt_template_body || '',
        prompt_template_description: configData.prompt_template_description || '',
        use_custom_templates: configData.use_custom_templates || false,
      });

      console.log('Config saved successfully:', response);
      toast.success('Đã cập nhật prompt config thành công');

      // Reload config từ DB để có data mới nhất
      const updatedConfigResponse = await aiConfigService.getConfig(editingConfig._id);
      if (updatedConfigResponse.success && updatedConfigResponse.config) {
        const updatedConfig = updatedConfigResponse.config;
        console.log('Reloaded config from DB:', updatedConfig);

        // Update editingConfig với config mới
        setEditingConfig(updatedConfig);

        // Update previewConfig nếu đang được set
        if (previewConfig && previewConfig._id === editingConfig._id) {
          setPreviewConfig(updatedConfig);
        }

        // Update config trong list
        setConfigs(prevConfigs =>
          prevConfigs.map(c => c._id === editingConfig._id ? updatedConfig : c)
        );
      }

      setShowPromptConfig(false);
      loadConfigs();
    } catch (error) {
      console.error('Error saving prompt config:', error);
      toast.error('Không thể lưu prompt config');
    }
  };

  const handleCreateNew = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      character: 'Bạn là 1 chuyên gia marketing quảng cáo Facebook với nhiều năm kinh nghiệm.',
      skills: [''],
      limitations: [''],
      model: 'gpt-4o-mini',
    });
    setShowCreateForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.warning('Vui lòng nhập tên config');
      return;
    }

    if (!formData.character.trim()) {
      toast.warning('Vui lòng nhập Character');
      return;
    }

    try {
      const configToSave = {
        name: formData.name.trim(),
        character: formData.character.trim(),
        skills: formData.skills.filter(s => s.trim()),
        limitations: formData.limitations.filter(l => l.trim()),
        model: formData.model,
      };

      if (editingConfig) {
        await aiConfigService.updateConfig(editingConfig._id, configToSave);
        toast.success('Đã cập nhật config thành công');
      } else {
        await aiConfigService.createConfig(configToSave);
        toast.success('Đã tạo config thành công');
      }

      setShowCreateForm(false);
      setEditingConfig(null);
      loadConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Không thể lưu config');
    }
  };

  const handleSelectConfig = (config) => {
    if (onConfigSelect) {
      onConfigSelect(config);
      onClose();
    }
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      skills: [...formData.skills, ''],
    });
  };

  const updateSkill = (index, value) => {
    const newSkills = [...formData.skills];
    newSkills[index] = value;
    setFormData({ ...formData, skills: newSkills });
  };

  const removeSkill = (index) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index),
    });
  };

  const addLimitation = () => {
    setFormData({
      ...formData,
      limitations: [...formData.limitations, ''],
    });
  };

  const updateLimitation = (index, value) => {
    const newLimitations = [...formData.limitations];
    newLimitations[index] = value;
    setFormData({ ...formData, limitations: newLimitations });
  };

  const removeLimitation = (index) => {
    setFormData({
      ...formData,
      limitations: formData.limitations.filter((_, i) => i !== index),
    });
  };

  const filteredConfigs = configs.filter((config) => {
    if (filter === 'own') {
      return !config.is_system_template;
    }
    if (filter === 'templates') {
      return config.is_system_template;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="ai-config-manager-overlay" onClick={onClose}>
      <div className="ai-config-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-config-manager-header">
          <h3>Quản lý AI Configs</h3>
          <button className="ai-config-manager-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {!showCreateForm ? (
          <div className="ai-config-manager-content">
            <div className="ai-config-manager-toolbar">
              <div className="ai-config-manager-filters">
                <button
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  Tất cả
                </button>
                <button
                  className={`filter-btn ${filter === 'own' ? 'active' : ''}`}
                  onClick={() => setFilter('own')}
                >
                  Configs của tôi
                </button>
                <button
                  className={`filter-btn ${filter === 'templates' ? 'active' : ''}`}
                  onClick={() => setFilter('templates')}
                >
                  Templates
                </button>
              </div>
              <button className="create-config-btn" onClick={handleCreateNew}>
                <Plus size={16} />
                Tạo config mới
              </button>
            </div>

            {isLoading ? (
              <div className="loading-state">Đang tải...</div>
            ) : (
              <div className="configs-list">
                {filteredConfigs.length === 0 ? (
                  <div className="empty-state">
                    <p>Chưa có config nào</p>
                    <button className="create-config-btn" onClick={handleCreateNew}>
                      <Plus size={16} />
                      Tạo config đầu tiên
                    </button>
                  </div>
                ) : (
                  filteredConfigs.map((config) => (
                    <div key={config._id} className="config-item">
                      <div className="config-item-header">
                        <div className="config-item-title">
                          {config.is_system_template && <span className="template-badge">📋 Template</span>}
                          {config.is_default && !config.is_system_template && (
                            <span className="default-badge">⭐ Mặc định</span>
                          )}
                          {config.character && (
                            <span className="custom-prompt-badge">✨ Custom Prompt</span>
                          )}
                          {!config.character && (
                            <span className="default-prompt-badge">📝 Default Prompt</span>
                          )}
                          <h4>{config.name}</h4>
                        </div>
                        <div className="config-item-actions">
                          <button
                            className="action-btn"
                            onClick={() => handlePreviewPrompt(config)}
                            title="Xem prompt"
                          >
                            <Eye size={16} />
                          </button>
                          {!config.is_system_template && (
                            <>
                              <button
                                className="action-btn"
                                onClick={() => handleEditPrompt(config)}
                                title="Chỉnh prompt"
                              >
                                <FileText size={16} />
                              </button>
                              {!config.is_default && (
                                <button
                                  className="action-btn"
                                  onClick={() => handleSetDefault(config._id)}
                                  title="Đặt làm mặc định"
                                >
                                  <Star size={16} />
                                </button>
                              )}
                              <button
                                className="action-btn"
                                onClick={() => handleEdit(config)}
                                title="Chỉnh sửa"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="action-btn delete-btn"
                                onClick={() => handleDelete(config._id, config.name)}
                                title="Xóa"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          {onConfigSelect && (
                            <button
                              className="action-btn select-btn"
                              onClick={() => handleSelectConfig(config)}
                              title="Chọn config này"
                            >
                              Chọn
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="config-item-info">
                        {config.character && (
                          <div className="config-character-preview">
                            <span className="info-label">Character:</span>
                            <span className="character-text">
                              {config.character.substring(0, 80)}
                              {config.character.length > 80 ? '...' : ''}
                            </span>
                          </div>
                        )}
                        <div className="config-info-row">
                          <span className="info-label">Model:</span>
                          <span className="info-value">{config.model}</span>
                        </div>
                        {config.skills && config.skills.length > 0 && (
                          <div className="config-info-row">
                            <span className="info-label">Skills:</span>
                            <span className="info-value">{config.skills.length} kỹ năng</span>
                          </div>
                        )}
                        {config.limitations && config.limitations.length > 0 && (
                          <div className="config-info-row">
                            <span className="info-label">Limitations:</span>
                            <span className="info-value">{config.limitations.length} giới hạn</span>
                          </div>
                        )}
                        <div className="config-info-row">
                          <span className="info-label">Sử dụng:</span>
                          <span className="info-value">{config.usage_count || 0} lần</span>
                        </div>
                        {config.last_used_at && (
                          <div className="config-info-row">
                            <span className="info-label">Lần cuối:</span>
                            <span className="info-value">
                              {new Date(config.last_used_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="ai-config-manager-form">
            <div className="form-header">
              <h4>{editingConfig ? 'Chỉnh sửa Config' : 'Tạo Config Mới'}</h4>
              <button
                className="back-btn"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingConfig(null);
                }}
              >
                ← Quay lại
              </button>
            </div>

            <div className="form-content">
              <div className="form-field">
                <label>Tên config *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nhập tên config"
                />
              </div>

              <div className="form-field">
                <label>Character (Nhân vật) *</label>
                <textarea
                  value={formData.character}
                  onChange={(e) => setFormData({ ...formData, character: e.target.value })}
                  placeholder="Bạn là 1 chuyên gia..."
                  rows={3}
                />
              </div>

              <div className="form-field">
                <label>Kỹ năng</label>
                {formData.skills.map((skill, index) => (
                  <div key={index} className="list-item-input">
                    <input
                      type="text"
                      value={skill}
                      onChange={(e) => updateSkill(index, e.target.value)}
                      placeholder="Bạn có kỹ năng..."
                    />
                    <button
                      className="remove-item-btn"
                      onClick={() => removeSkill(index)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button className="add-item-btn" onClick={addSkill} type="button">
                  <Plus size={14} />
                  Thêm kỹ năng
                </button>
              </div>

              <div className="form-field">
                <label>Giới hạn</label>
                {formData.limitations.map((limitation, index) => (
                  <div key={index} className="list-item-input">
                    <input
                      type="text"
                      value={limitation}
                      onChange={(e) => updateLimitation(index, e.target.value)}
                      placeholder="Chỉ trả lời những câu hỏi..."
                    />
                    <button
                      className="remove-item-btn"
                      onClick={() => removeLimitation(index)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button className="add-item-btn" onClick={addLimitation} type="button">
                  <Plus size={14} />
                  Thêm giới hạn
                </button>
              </div>

              <div className="form-field">
                <label>Model AI</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                >
                  <option value="gpt-4o-mini">GPT-4o-mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>

              <div className="form-actions">
                <button className="cancel-btn" onClick={() => setShowCreateForm(false)}>
                  Hủy
                </button>
                <button className="save-btn" onClick={handleSave}>
                  {editingConfig ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </div>
          </div>
        )}

        <AiPromptConfig
          isOpen={showPromptConfig}
          onClose={() => {
            setShowPromptConfig(false);
            setEditingConfig(null);
          }}
          onSave={handlePromptConfigSave}
          initialConfig={editingConfig || {}}
        />

        <PromptPreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewConfig(null);
          }}
          configId={previewConfig?._id}
          config={previewConfig}
        />
      </div>
    </div>
  );
};

export default AiConfigManager;


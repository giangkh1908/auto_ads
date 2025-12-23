import React, { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { aiConfigService } from '../../../../services/chat/aiConfigService';
import { useToast } from '../../../../hooks/common/useToast';
import './PromptPreviewModal.css';

const PromptPreviewModal = ({ isOpen, onClose, configId, config = null }) => {
  const toast = useToast();
  const [previewData, setPreviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [target, setTarget] = useState('headline');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && (configId || config)) {
      loadPreview();
    }
  }, [isOpen, configId, config, target]);

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const maxLen = target === 'headline' ? 60 : target === 'description' ? 90 : 125;
      const configIdToUse = configId || (config && config._id);

      if (!configIdToUse) {
        console.error('No configId available for preview');
        toast.error('Không có config ID để preview');
        return;
      }

      // console.log('Loading preview for configId:', configIdToUse, 'target:', target);
      const response = await aiConfigService.previewPrompt(
        configIdToUse,
        target,
        maxLen
      );

      // console.log('Preview API response:', response);
      if (response.success) {
        setPreviewData(response);
      } else {
        console.error('Preview API returned error:', response);
        toast.error('Không thể tải preview prompt: ' + (response.message || 'Lỗi không xác định'));
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      toast.error('Không thể tải preview prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (previewData?.preview_prompt) {
      navigator.clipboard.writeText(previewData.preview_prompt);
      setCopied(true);
      toast.success('Đã copy prompt');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="prompt-preview-overlay" onClick={onClose}>
      <div className="prompt-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-preview-header">
          <h3>Preview Prompt</h3>
          <button className="prompt-preview-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="prompt-preview-content">
          <div className="prompt-preview-target-selector">
            <label>Xem prompt cho:</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="headline">Headline</option>
              <option value="body">Body (Primary Text)</option>
              <option value="description">Description</option>
            </select>
          </div>

          {isLoading ? (
            <div className="prompt-preview-loading">Đang tải...</div>
          ) : previewData ? (
            <>
              <div className="prompt-preview-info">
                {previewData.is_using_custom_template && (
                  <div className="custom-prompt-badge"> Custom Template</div>
                )}
                {previewData.has_custom_prompt && !previewData.is_using_custom_template && (
                  <div className="custom-prompt-badge"> Custom Prompt (from Character/Skills)</div>
                )}
                {!previewData.has_custom_prompt && (
                  <div className="default-prompt-badge">Default Prompt</div>
                )}
              </div>

              {previewData.is_using_custom_template && previewData.prompt_template && (
                <div className="prompt-preview-section">
                  <h4>Custom Template (trước khi replace placeholders):</h4>
                  <div className="prompt-preview-text" style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                    {previewData.prompt_template}
                  </div>
                </div>
              )}

              {previewData.character && (
                <div className="prompt-preview-section">
                  <h4>Character (Nhân vật):</h4>
                  <div className="prompt-preview-text">{previewData.character}</div>
                </div>
              )}

              {previewData.skills && previewData.skills.length > 0 && (
                <div className="prompt-preview-section">
                  <h4>Skills (Kỹ năng):</h4>
                  <ul className="prompt-preview-list">
                    {previewData.skills.map((skill, idx) => (
                      <li key={idx}>{skill}</li>
                    ))}
                  </ul>
                </div>
              )}

              {previewData.limitations && previewData.limitations.length > 0 && (
                <div className="prompt-preview-section">
                  <h4>Limitations (Giới hạn):</h4>
                  <ul className="prompt-preview-list">
                    {previewData.limitations.map((limitation, idx) => (
                      <li key={idx}>{limitation}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="prompt-preview-section">
                <div className="prompt-preview-section-header">
                  <h4>Full Prompt (Được gửi đến AI):</h4>
                  <button className="copy-button" onClick={handleCopy}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Đã copy' : 'Copy'}
                  </button>
                </div>
                <div className="prompt-preview-full-prompt">
                  {previewData.preview_prompt}
                </div>
              </div>
            </>
          ) : (
            <div className="prompt-preview-empty">Không có dữ liệu</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptPreviewModal;


import React from 'react';
import { AlertTriangle, Trash2, Archive, X, Play, Pause, Save } from 'lucide-react';
import './ConfirmationPopup.css';

const ConfirmationPopup = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onDiscard, // ✅ THÊM MỚI: Callback cho nút "Không lưu"
  title, 
  message, 
  confirmText = "Xác nhận", 
  cancelText = "Hủy",
  discardText = "Không lưu", // ✅ THÊM MỚI
  type = "delete", // "delete" | "archive" | "activate" | "deactivate" | "save-draft"
  isLoading = false 
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'delete':
        return <Trash2 size={24} className="confirmation-icon delete-icon" />;
      case 'archive':
        return <Archive size={24} className="confirmation-icon archive-icon" />;
      case 'activate':
        return <Play size={24} className="confirmation-icon activate-icon" />;
      case 'deactivate':
        return <Pause size={24} className="confirmation-icon deactivate-icon" />;
      case 'save-draft': // ✅ THÊM MỚI
        return <Save size={24} className="confirmation-icon save-draft-icon" />;
      default:
        return <AlertTriangle size={24} className="confirmation-icon warning-icon" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case 'delete':
        return 'btn-confirm-delete';
      case 'archive':
        return 'btn-confirm-archive';
      case 'activate':
        return 'btn-confirm-activate';
      case 'deactivate':
        return 'btn-confirm-deactivate';
      case 'save-draft': // ✅ THÊM MỚI
        return 'btn-confirm-save-draft';
      default:
        return 'btn-confirm-default';
    }
  };

  // ✅ THÊM: Kiểm tra có hiển thị 3 buttons không
  const hasThreeButtons = type === 'save-draft' && onDiscard;

  return (
    <div className="confirmation-overlay" onClick={handleBackdropClick}>
      <div className="confirmation-popup">
        <div className="confirmation-header">
          <div className="confirmation-icon-container">
            {getIcon()}
          </div>
          <button 
            className="confirmation-close-btn" 
            onClick={onClose}
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="confirmation-content">
          <h3 className="confirmation-title">{title}</h3>
          <p className="confirmation-message">{message}</p>
        </div>
        
        <div className={`confirmation-footer ${hasThreeButtons ? 'three-buttons' : ''}`}>
          {/* ✅ Button "Không lưu" (chỉ hiển thị khi type = save-draft) */}
          {hasThreeButtons && (
            <button 
              className="btn-discard" 
              onClick={onDiscard}
              disabled={isLoading}
            >
              {discardText}
            </button>
          )}
          
          <button 
            className="btn-cancel" 
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          
          <button 
            className={`btn-confirm ${getConfirmButtonClass()}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loading-spinner-popup">
                <div className="spinner-popup"></div>
                <span>Đang xử lý...</span>
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPopup;

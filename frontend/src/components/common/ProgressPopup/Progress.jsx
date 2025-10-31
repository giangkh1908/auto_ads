import React, { useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  X,
  Upload,
  Download,
  Trash2,
  Edit3
} from 'lucide-react';
import './Progress.css';

/**
 * ProgressPopup - Component hiển thị tiến trình xử lý
 * 
 * @param {boolean} isOpen - Hiển thị popup hay không
 * @param {string} type - Loại thao tác: 'create' | 'update' | 'delete' | 'load' | 'sync'
 * @param {string} title - Tiêu đề popup
 * @param {object} progress - Object chứa thông tin tiến trình
 * @param {function} onClose - Callback khi đóng (chỉ cho phép khi hoàn thành/lỗi)
 * @param {function} onRetry - Callback khi retry (optional)
 * @param {function} onCancel - Callback khi cancel (optional)
 * @param {boolean} cancellable - Cho phép cancel hay không
 */
const ProgressPopup = ({
  isOpen,
  type = 'create', // 'create' | 'update' | 'delete' | 'load' | 'sync'
  title,
  progress = {
    status: 'idle', // 'idle' | 'loading' | 'success' | 'error' | 'partial'
    current: 0,
    total: 0,
    percentage: 0,
    message: '',
    details: [], // Array of step details
    errors: [], // Array of errors
    successCount: 0,
    errorCount: 0,
  },
  onClose,
  // onRetry,
  // onCancel,
  // cancellable = false,
}) => {
  // ✅ Auto-close sau 2-3 giây cho tất cả trạng thái kết thúc
  useEffect(() => {
    if (progress.status === 'success' || progress.status === 'error' || progress.status === 'partial') {
      const delay = progress.status === 'error' ? 3000 : 2000; // Error delay lâu hơn
      const timer = setTimeout(() => {
        onClose?.();
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [progress.status, onClose]);

  if (!isOpen) return null;

  // Prevent close khi đang loading
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && progress.status !== 'loading') {
      onClose?.();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'create':
        return <Upload size={24} className="progress-type-icon create" />;
      case 'update':
        return <Edit3 size={24} className="progress-type-icon update" />;
      case 'delete':
        return <Trash2 size={24} className="progress-type-icon delete" />;
      case 'load':
      case 'sync':
        return <Download size={24} className="progress-type-icon load" />;
      default:
        return <Loader2 size={24} className="progress-type-icon" />;
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'loading':
        return <Loader2 size={32} className="status-icon loading spin" />;
      case 'success':
        return <CheckCircle size={32} className="status-icon success" />;
      case 'error':
        return <XCircle size={32} className="status-icon error" />;
      case 'partial':
        return <AlertCircle size={32} className="status-icon warning" />;
      default:
        return null;
    }
  };

  const getActionText = () => {
    const actions = {
      create: 'Đang tạo',
      update: 'Đang cập nhật',
      delete: 'Đang xóa',
      load: 'Đang tải',
      sync: 'Đang đồng bộ',
    };
    return actions[type] || 'Đang xử lý';
  };

  return (
    <div className="progress-overlay" onClick={handleBackdropClick}>
      <div className={`progress-popup ${progress.status}`}>
        {/* Header */}
        <div className="progress-header">
          <div className="progress-header-left">
            {getIcon()}
            <h3 className="progress-title">{title}</h3>
          </div>
          {progress.status !== 'loading' && (
            <button 
              className="progress-close-btn" 
              onClick={onClose}
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Status Icon */}
        <div className="progress-status-container">
          {getStatusIcon()}
        </div>

        {/* Progress Bar (hiện khi loading hoặc có progress) */}
        {(progress.status === 'loading' || progress.percentage > 0) && (
          <div className="progress-bar-container">
            <div className="progress-bar-header">
              <span className="progress-text">
                {getActionText()} {progress.current}/{progress.total}
              </span>
              <span className="progress-percentage">{Math.round(progress.percentage)}%</span>
            </div>
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            {progress.message && (
              <p className="progress-message">{progress.message}</p>
            )}
          </div>
        )}

        {/* Success State */}
        {progress.status === 'success' && (
          <div className="progress-result success">
            <p className="result-title">Hoàn thành!</p>
            {/* <p className="result-message">
              {progress.successCount > 0 && `✅ Thành công: ${progress.successCount}`}
            </p> */}
          </div>
        )}

        {/* Partial Success State */}
        {progress.status === 'partial' && (
          <div className="progress-result partial">
            <p className="result-title">Hoàn thành với lỗi</p>
            {/* <div className="result-summary">
              <p className="result-success">✅ Thành công: {progress.successCount}</p>
              <p className="result-error">❌ Thất bại: {progress.errorCount}</p>
            </div> */}
          </div>
        )}

        {/* Error State */}
        {progress.status === 'error' && (
          <div className="progress-result error">
            <p className="result-title">Có lỗi xảy ra</p>
            {/* <p className="result-message">{progress.message}</p> */}
          </div>
        )}

        {/* Error Details (nếu có) */}
        {/* {progress.errors && progress.errors.length > 0 && (
          <div className="progress-errors">
            <details className="error-details">
              <summary className="error-summary">
                Chi tiết lỗi ({progress.errors.length})
              </summary>
              <div className="error-list">
                {progress.errors.map((error, index) => (
                  <div key={index} className="error-item">
                    <span className="error-index">#{index + 1}</span>
                    <div className="error-content">
                      <p className="error-name">{error.name || 'Unknown'}</p>
                      <p className="error-message">{error.error || error.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )} */}

        {/* Step Details (optional - cho các thao tác phức tạp) */}
        {progress.details && progress.details.length > 0 && (
          <div className="progress-steps">
            {progress.details.map((step, index) => (
              <div key={index} className={`step-item ${step.status}`}>
                <div className="step-icon">
                  {step.status === 'completed' && <CheckCircle size={16} />}
                  {step.status === 'loading' && <Loader2 size={16} className="spin" />}
                  {step.status === 'error' && <XCircle size={16} />}
                  {step.status === 'pending' && <div className="step-dot" />}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            ))}
          </div>
        )}  

        {/* Footer Actions */}
        {/* <div className="progress-footer">
          {progress.status === 'loading' && cancellable && (
            <button 
              className="btn-cancel-progress" 
              onClick={onCancel}
            >
              Hủy bỏ
            </button>
          )}
          
          {(progress.status === 'error' || progress.status === 'partial') && onRetry && (
            <button 
              className="btn-retry" 
              onClick={onRetry}
            >
              <RefreshCw size={16} />
              Thử lại
            </button>
          )}
          
          {progress.status !== 'loading' && (
            <button 
              className="btn-close-progress" 
              onClick={onClose}
            >
              {progress.status === 'success' ? 'Xong' : 'Đóng'}
            </button>
          )}
        </div> */}
      </div>
    </div>
  );
};

export default ProgressPopup;


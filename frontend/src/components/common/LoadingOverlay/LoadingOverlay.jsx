import { RefreshCw } from 'lucide-react';
import PropTypes from 'prop-types';
import './LoadingOverlay.css';

/**
 * LoadingOverlay - Component hiển thị overlay loading toàn màn hình
 * @param {boolean} isLoading - Có đang loading hay không
 * @param {string} message - Thông báo hiển thị (mặc định: "Đang tải...")
 */
function LoadingOverlay({ isLoading, message = "Đang tải..." }) {
    if (!isLoading) return null;

    return (
        <div className="loading-overlay">
            <div className="loading-overlay-spinner">
                <div className="loading-overlay-icon">
                    <RefreshCw size={20} />
                </div>
                <div className="loading-overlay-text">{message}</div>
            </div>
        </div>
    );
}

LoadingOverlay.propTypes = {
    isLoading: PropTypes.bool.isRequired,
    message: PropTypes.string,
};

export default LoadingOverlay;

// src/utils/formatters/statusUtils.js
import i18n from '../../i18n';

/**
 * Translates status code to localized text
 * @param {string} status - Status code (e.g., 'ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED')
 * @returns {string} - Translated status text
 */
export const translateStatus = (status) => {
  // Try to get translation from i18n
  const translationKey = `ads:status.${status}`;
  const translated = i18n.t(translationKey);
  
  // If translation exists and is not the same as the key, return it
  if (translated && translated !== translationKey) {
    return translated;
  }
  
  // Fallback mappings for backwards compatibility
  const fallbackMap = {
    'ACTIVE': 'Hoạt động',
    'PAUSED': 'Tạm dừng',
    'DELETED': 'Đã xóa',
    'ARCHIVED': 'Đã lưu trữ',
    'DRAFT': 'Bản nháp',
    'FAILED': 'Thất bại',
    'WITH_ISSUES': 'Có vấn đề',
    'CAMPAIGN_PAUSED': 'Tạm dừng',
    'CAMPAIGN_ACTIVE': 'Hoạt động',
    'ADSET_ACTIVE': 'Hoạt động',
    'ADSET_PAUSED': 'Tạm dừng',
    'ADSET_DELETED': 'Đã xóa',
    'ADSET_ARCHIVED': 'Đã lưu trữ',
    'ADSET_IN_PROCESS': 'Đang xử lý',
    'AD_ACTIVE': 'Hoạt động',
    'AD_PAUSED': 'Tạm dừng',
    'AD_DELETED': 'Đã xóa',
    'AD_ARCHIVED': 'Đã lưu trữ',
    'AD_IN_PROCESS': 'Đang xử lý',
    'AD_PENDING_REVIEW': 'Chờ duyệt',
    'AD_DISAPPROVED': 'Không được duyệt',
    'AD_PREAPPROVED': 'Đã duyệt trước',
    'EFFECTIVE_STATUS_ACTIVE': 'Hoạt động',
    'EFFECTIVE_STATUS_PAUSED': 'Tạm dừng',
    'EFFECTIVE_STATUS_DELETED': 'Đã xóa',
    'EFFECTIVE_STATUS_PENDING_REVIEW': 'Chờ duyệt',
    'EFFECTIVE_STATUS_DISAPPROVED': 'Không được duyệt',
    'EFFECTIVE_STATUS_PREAPPROVED': 'Đã duyệt trước',
    'EFFECTIVE_STATUS_PENDING_BILLING_INFO': 'Chờ thông tin thanh toán',
    'EFFECTIVE_STATUS_CAMPAIGN_PAUSED': 'Chiến dịch tạm dừng',
    'EFFECTIVE_STATUS_ADSET_PAUSED': 'Nhóm quảng cáo tạm dừng',
    'EFFECTIVE_STATUS_WITH_ISSUES': 'Có vấn đề',
    // Vietnamese fallbacks
    'Hoạt động': 'Hoạt động',
    'Đang tắt': 'Tạm dừng',
    'Tạm dừng': 'Tạm dừng',
    'Đã xóa': 'Đã xóa',
    'Đã lưu trữ': 'Đã lưu trữ'
  };

  return fallbackMap[status] || status;
};

/**
 * Gets CSS class for a given status
 * @param {string} status - Status code
 * @returns {string} - CSS class name
 */
export const getStatusClass = (status) => {
  // Check status CODE directly instead of translated text for consistency
  const statusUpper = status.toUpperCase();
  
  // Active statuses
  if (
    statusUpper === 'ACTIVE' ||
    statusUpper === 'CAMPAIGN_ACTIVE' ||
    statusUpper === 'ADSET_ACTIVE' ||
    statusUpper === 'AD_ACTIVE' ||
    statusUpper === 'EFFECTIVE_STATUS_ACTIVE' ||
    statusUpper.includes('ACTIVE')
  ) {
    return 'status-active';
  }
  
  // Paused statuses
  if (
    statusUpper === 'PAUSED' ||
    statusUpper === 'CAMPAIGN_PAUSED' ||
    statusUpper === 'ADSET_PAUSED' ||
    statusUpper === 'AD_PAUSED' ||
    statusUpper === 'EFFECTIVE_STATUS_PAUSED' ||
    statusUpper === 'EFFECTIVE_STATUS_CAMPAIGN_PAUSED' ||
    statusUpper === 'EFFECTIVE_STATUS_ADSET_PAUSED' ||
    statusUpper.includes('PAUSED')
  ) {
    return 'status-paused';
  }
  
  // Deleted statuses
  if (
    statusUpper === 'DELETED' ||
    statusUpper === 'ADSET_DELETED' ||
    statusUpper === 'AD_DELETED' ||
    statusUpper === 'EFFECTIVE_STATUS_DELETED' ||
    statusUpper.includes('DELETED')
  ) {
    return 'status-deleted';
  }
  
  // Archived statuses
  if (
    statusUpper === 'ARCHIVED' ||
    statusUpper === 'ADSET_ARCHIVED' ||
    statusUpper === 'AD_ARCHIVED' ||
    statusUpper.includes('ARCHIVED')
  ) {
    return 'status-archived';
  }
  
  // Pending/Review statuses
  if (
    statusUpper.includes('PENDING') ||
    statusUpper.includes('REVIEW') ||
    statusUpper === 'AD_PENDING_REVIEW' ||
    statusUpper === 'EFFECTIVE_STATUS_PENDING_REVIEW' ||
    statusUpper === 'EFFECTIVE_STATUS_PENDING_BILLING_INFO'
  ) {
    return 'status-pending';
  }
  
  // Disapproved statuses
  if (
    statusUpper.includes('DISAPPROVED') ||
    statusUpper === 'AD_DISAPPROVED' ||
    statusUpper === 'EFFECTIVE_STATUS_DISAPPROVED'
  ) {
    return 'status-disapproved';
  }
  
  // Issues/In Process
  if (
    statusUpper.includes('ISSUES') ||
    statusUpper.includes('IN_PROCESS') ||
    statusUpper === 'WITH_ISSUES' ||
    statusUpper === 'EFFECTIVE_STATUS_WITH_ISSUES' ||
    statusUpper === 'ADSET_IN_PROCESS' ||
    statusUpper === 'AD_IN_PROCESS'
  ) {
    return 'status-inactive';
  }
  
  // Failed statuses
  if (statusUpper === 'FAILED' || statusUpper.includes('FAILED')) {
    return 'status-failed';
  }
  
  // Draft statuses
  if (statusUpper === 'DRAFT' || statusUpper.includes('DRAFT')) {
    return 'status-draft';
  }

  return 'status-inactive';
};
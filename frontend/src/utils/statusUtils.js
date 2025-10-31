// src/utils/statusUtils.js

// Dịch trạng thái sang tiếng Việt
export const translateStatus = (status) => {
    const statusMap = {
      // Campaign statuses
      'ACTIVE': 'Hoạt động',
      'PAUSED': 'Tạm dừng',
      'DELETED': 'Đã xóa',
      'ARCHIVED': 'Đã lưu trữ',
      'DRAFT': 'Bản nháp',
      'FAILED': 'Thất bại',
      'WITH_ISSUES': 'Có vấn đề',
      'CAMPAIGN_PAUSED': 'Tạm dừng',
      'CAMPAIGN_ACTIVE': 'Hoạt động',
  
      // AdSet statuses
      'ADSET_ACTIVE': 'Hoạt động',
      'ADSET_PAUSED': 'Tạm dừng',
      'ADSET_DELETED': 'Đã xóa',
      'ADSET_ARCHIVED': 'Đã lưu trữ',
      'ADSET_IN_PROCESS': 'Đang xử lý',
      
  
      // Ad statuses
      'AD_ACTIVE': 'Hoạt động',
      'AD_PAUSED': 'Tạm dừng',
      'AD_DELETED': 'Đã xóa',
      'AD_ARCHIVED': 'Đã lưu trữ',
      'AD_IN_PROCESS': 'Đang xử lý',
      'AD_PENDING_REVIEW': 'Chờ duyệt',
      'AD_DISAPPROVED': 'Không được duyệt',
      'AD_PREAPPROVED': 'Đã duyệt trước',
  
      // Effective statuses
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
  
      // Fallback
      'Hoạt động': 'Hoạt động',
      'Đang tắt': 'Tạm dừng',
      'Tạm dừng': 'Tạm dừng',
      'Đã xóa': 'Đã xóa',
      'Đã lưu trữ': 'Đã lưu trữ'
    };
  
    return statusMap[status] || status;
  };
  
  // Lấy class CSS tương ứng với trạng thái
  export const getStatusClass = (status) => {
    const translatedStatus = translateStatus(status);
  
    switch (translatedStatus) {
      case 'Hoạt động':
        return 'status-active';
      case 'Tạm dừng':
        return 'status-paused';
      case 'Đã xóa':
        return 'status-deleted';
      case 'Đã lưu trữ':
        return 'status-archived';
      case 'Chờ duyệt':
      case 'Chờ thông tin thanh toán':
        return 'status-pending';
      case 'Không được duyệt':
        return 'status-disapproved';
      case 'Đang xử lý':
      case 'Có vấn đề':
        return 'status-inactive';
      default:
        return 'status-inactive';
    }
  };
  
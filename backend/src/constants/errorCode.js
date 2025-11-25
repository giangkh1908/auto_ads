export const ErrorCode = Object.freeze ({
    // ==================== COMMON ====================
    COMMON_001: 'COMMON_001', // Validation error
    COMMON_002: 'COMMON_002', // Invalid request
    COMMON_003: 'COMMON_003', // Resource not found
    COMMON_004: 'COMMON_004', // Action not allowed
    COMMON_999: 'COMMON_999', // Internal server error

    // ==================== AUTH & ROLE ====================
    AUTH_001: 'AUTH_001', // Unauthorized
    AUTH_002: 'AUTH_002', // Invalid token
    AUTH_003: 'AUTH_003', // Token expired
    AUTH_004: 'AUTH_004', // Refresh token expired
    AUTH_005: 'AUTH_005', // Invalid credentials
    AUTH_006: 'AUTH_006', // Account locked
    AUTH_007: 'AUTH_007', // Not verified
    AUTH_008: 'AUTH_008', // Permission denied
    AUTH_009: 'AUTH_009', // Role not allowed for this action
    AUTH_010: 'AUTH_010', // Account inactive
    AUTH_011: 'AUTH_011', // Account banned

    // ==================== USER ROLE ====================
    ROLE_001: 'ROLE_001', // Role not found
    ROLE_002: 'ROLE_002', // Cannot delete default role
    ROLE_003: 'ROLE_003', // Cannot modify super admin role
    ROLE_004: 'ROLE_004', // Role already exists
    ROLE_005: 'ROLE_005', // Employee must have a role
    ROLE_006: 'ROLE_006', // Cannot assign higher role than your own

    // ==================== EMPLOYEE ====================
    EMP_001: 'EMP_001', // Employee not found
    EMP_002: 'EMP_002', // Email already in use
    EMP_003: 'EMP_003', // Cannot delete yourself
    EMP_004: 'EMP_004', // Cannot remove last admin
    EMP_005: 'EMP_005', // Employee not in your shop
    EMP_006: 'EMP_006', // Invite expired
    EMP_007: 'EMP_007', // Invite already accepted
    EMP_008: 'EMP_008', // Reach employee limit

    // ==================== SHOP ====================
    SHOP_001: 'SHOP_001', // Shop not found
    SHOP_002: 'SHOP_002', // Shop name already exists
    SHOP_003: 'SHOP_003', // Cannot delete shop with active campaigns
    SHOP_004: 'SHOP_004', // Shop suspended
    SHOP_005: 'SHOP_005', // Shop not verified
    SHOP_006: 'SHOP_006', // Reach shop limit (per user)

    // ==================== AD ACCOUNT ====================
    ADACC_001: 'ADACC_001', // Ad account not found
    ADACC_002: 'ADACC_002', // Ad account not linked to shop
    ADACC_003: 'ADACC_003', // Ad account suspended
    ADACC_004: 'ADACC_004', // Daily budget too low
    ADACC_005: 'ADACC_005', // Lifetime budget too low
    ADACC_006: 'ADACC_006', // Ad account not approved
    ADACC_007: 'ADACC_007', // Billing info missing
    ADACC_008: 'ADACC_008', // Reach ad account limit per shop

    // ==================== CAMPAIGN ====================
    CAMP_001: 'CAMP_001', // Campaign not found
    CAMP_002: 'CAMP_002', // Campaign name already exists
    CAMP_003: 'CAMP_003', // Cannot delete active campaign
    CAMP_004: 'CAMP_004', // Invalid objective
    CAMP_005: 'CAMP_005', // Start date must be in future
    CAMP_006: 'CAMP_006', // End date must be after start date
    CAMP_007: 'CAMP_007', // Budget too low for objective
    CAMP_008: 'CAMP_008', // Daily spend cap reached
    CAMP_009: 'CAMP_009', // Campaign paused by system (policy/violation)

    // ==================== AD SET ====================
    ADSET_001: 'ADSET_001', // Ad set not found
    ADSET_002: 'ADSET_002', // Ad set name already exists
    ADSET_003: 'ADSET_003', // Targeting too narrow
    ADSET_004: 'ADSET_004', // Audience size too small
    ADSET_005: 'ADSET_005', // Bid amount too low
    ADSET_006: 'ADSET_006', // Schedule conflict
    ADSET_007: 'ADSET_007', // Location not supported
    ADSET_008: 'ADSET_008', // Age range invalid
    ADSET_009: 'ADSET_009', // Cannot edit active ad set

    // ==================== AD ====================
    AD_001: 'AD_001', // Ad not found
    AD_002: 'AD_002', // Ad name already exists
    AD_003: 'AD_003', // Creative missing
    AD_004: 'AD_004', // Image ratio not supported
    AD_005: 'AD_005', // Video too long
    AD_006: 'AD_006', // Call-to-action missing
    AD_007: 'AD_007', // URL invalid
    AD_008: 'AD_008', // Ad rejected (policy violation)
    AD_009: 'AD_009', // Ad under review
    AD_010: 'AD_010', // Primary text too long
    AD_011: 'AD_011', // Headline too long
    AD_012: 'AD_012', // Duplicate ad in ad set

    // ==================== BUDGET & SPENDING ====================
    BUDGET_001: 'BUDGET_001', // Insufficient balance
    BUDGET_002: 'BUDGET_002', // Payment method declined
    BUDGET_003: 'BUDGET_003', // Top-up failed
    BUDGET_004: 'BUDGET_004', // Minimum top-up amount

    // ==================== INSIGHT & REPORT ====================
    INSIGHT_001: 'INSIGHT_001', // Data not ready
    INSIGHT_002: 'INSIGHT_002', // Date range too long

    // ==================== RATE LIMIT ====================
    RATE_001: 'RATE_001', // Too many requests
    RATE_002: 'RATE_002', // Too many login attempts
    RATE_003: 'RATE_003', // Too many campaigns created today
});

// Type cho TypeScript
// export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Error Message - Tiếng Việt + Tiếng Anh
 */
export const ErrorMessage = Object.freeze ({
    // COMMON
    [ErrorCode.COMMON_001]: { vi: 'Dữ liệu không hợp lệ', en: 'Validation error' },
    [ErrorCode.COMMON_002]: { vi: 'Yêu cầu không hợp lệ', en: 'Invalid request' },
    [ErrorCode.COMMON_003]: { vi: 'Không tìm thấy tài nguyên', en: 'Resource not found' },
    [ErrorCode.COMMON_004]: { vi: 'Hành động không được phép', en: 'Action not allowed' },
    [ErrorCode.COMMON_999]: { vi: 'Lỗi máy chủ nội bộ', en: 'Internal server error' },

    // AUTH & ROLE
    [ErrorCode.AUTH_001]: { vi: 'Không có quyền truy cập', en: 'Unauthorized' },
    [ErrorCode.AUTH_002]: { vi: 'Token không hợp lệ', en: 'Invalid token' },
    [ErrorCode.AUTH_003]: { vi: 'Token đã hết hạn', en: 'Token expired' },
    [ErrorCode.AUTH_004]: { vi: 'Refresh token đã hết hạn', en: 'Refresh token expired' },
    [ErrorCode.AUTH_005]: { vi: 'Thông tin đăng nhập không hợp lệ', en: 'Invalid credentials' },
    [ErrorCode.AUTH_006]: { vi: 'Tài khoản đã bị khóa', en: 'Account locked' },
    [ErrorCode.AUTH_007]: { vi: 'Tài khoản chưa được xác minh', en: 'Not verified' },
    [ErrorCode.AUTH_008]: { vi: 'Bạn không có quyền thực hiện hành động này', en: 'Permission denied' },
    [ErrorCode.AUTH_009]: { vi: 'Vai trò không được phép', en: 'Role not allowed' },
    [ErrorCode.AUTH_010]: { vi: 'Tài khoản của bạn đã bị vô hiệu hoá', en: 'Your account has been deactivated' },
    [ErrorCode.AUTH_011]: { vi: 'Tài khoản của bạn đã bị cấm', en: 'Your account has been banned' },

    // USER ROLE
    [ErrorCode.ROLE_001]: { vi: 'Vai trò không tồn tại', en: 'Role not found' },
    [ErrorCode.ROLE_002]: { vi: 'Không thể xóa vai trò mặc định', en: 'Cannot delete default role' },
    [ErrorCode.ROLE_003]: { vi: 'Không thể sửa vai trò Super Admin', en: 'Cannot modify super admin role' },
    [ErrorCode.ROLE_004]: { vi: 'Vai trò đã tồn tại', en: 'Role already exists' },
    [ErrorCode.ROLE_005]: { vi: 'Nhân viên phải có vai trò', en: 'Employee must have a role' },
    [ErrorCode.ROLE_006]: { vi: 'Không thể gán vai trò cao hơn vai trò của bạn', en: 'Cannot assign higher role than your own' },

    // EMPLOYEE
    [ErrorCode.EMP_001]: { vi: 'Nhân viên không tồn tại', en: 'Employee not found' },
    [ErrorCode.EMP_002]: { vi: 'Email đã được sử dụng', en: 'Email already in use' },
    [ErrorCode.EMP_003]: { vi: 'Không thể tự xóa tài khoản của bạn', en: 'Cannot delete yourself' },
    [ErrorCode.EMP_004]: { vi: 'Không thể xóa admin cuối cùng', en: 'Cannot remove last admin' },
    [ErrorCode.EMP_005]: { vi: 'Nhân viên không thuộc cửa hàng của bạn', en: 'Employee not in your shop' },
    [ErrorCode.EMP_006]: { vi: 'Lời mời đã hết hạn', en: 'Invite expired' },
    [ErrorCode.EMP_007]: { vi: 'Lời mời đã được chấp nhận', en: 'Invite already accepted' },
    [ErrorCode.EMP_008]: { vi: 'Đã đạt giới hạn số lượng nhân viên. Vui lòng nâng cấp gói dịch vụ để thêm nhân viên.', en: 'Reach employee limit. Please upgrade your package to add more employees.' },

    // SHOP
    [ErrorCode.SHOP_001]: { vi: 'Cửa hàng không tồn tại', en: 'Shop not found' },
    [ErrorCode.SHOP_002]: { vi: 'Tên cửa hàng đã tồn tại', en: 'Shop name already exists' },
    [ErrorCode.SHOP_003]: { vi: 'Không thể xóa cửa hàng đang có chiến dịch chạy', en: 'Cannot delete shop with active campaigns' },
    [ErrorCode.SHOP_004]: { vi: 'Cửa hàng đã bị tạm khóa', en: 'Shop suspended' },
    [ErrorCode.SHOP_005]: { vi: 'Cửa hàng chưa được xác minh', en: 'Shop not verified' },
    [ErrorCode.SHOP_006]: { vi: 'Đã đạt giới hạn số lượng cửa hàng cho mỗi người dùng', en: 'Reach shop limit (per user)' },

    // AD ACCOUNT
    [ErrorCode.ADACC_001]: { vi: 'Tài khoản quảng cáo không tồn tại', en: 'Ad account not found' },
    [ErrorCode.ADACC_002]: { vi: 'Tài khoản quảng cáo không liên kết với cửa hàng', en: 'Ad account not linked to shop' },
    [ErrorCode.ADACC_003]: { vi: 'Tài khoản quảng cáo bị tạm khóa', en: 'Ad account suspended' },
    [ErrorCode.ADACC_004]: { vi: 'Ngân sách hàng ngày quá thấp', en: 'Daily budget too low' },
    [ErrorCode.ADACC_005]: { vi: 'Ngân sách trọn đời quá thấp', en: 'Lifetime budget too low' },
    [ErrorCode.ADACC_006]: { vi: 'Tài khoản quảng cáo chưa được duyệt', en: 'Ad account not approved' },
    [ErrorCode.ADACC_007]: { vi: 'Thiếu thông tin thanh toán', en: 'Billing info missing' },
    [ErrorCode.ADACC_008]: { vi: 'Đã đạt giới hạn tài khoản quảng cáo cho mỗi cửa hàng', en: 'Reach ad account limit per shop' },

    // CAMPAIGN
    [ErrorCode.CAMP_001]: { vi: 'Chiến dịch không tồn tại', en: 'Campaign not found' },
    [ErrorCode.CAMP_002]: { vi: 'Tên chiến dịch đã tồn tại', en: 'Campaign name already exists' },
    [ErrorCode.CAMP_003]: { vi: 'Không thể xóa chiến dịch đang hoạt động', en: 'Cannot delete active campaign' },
    [ErrorCode.CAMP_004]: { vi: 'Mục tiêu chiến dịch không hợp lệ', en: 'Invalid objective' },
    [ErrorCode.CAMP_005]: { vi: 'Ngày bắt đầu phải ở tương lai', en: 'Start date must be in future' },
    [ErrorCode.CAMP_006]: { vi: 'Ngày kết thúc phải sau ngày bắt đầu', en: 'End date must be after start date' },
    [ErrorCode.CAMP_007]: { vi: 'Ngân sách quá thấp cho mục tiêu này', en: 'Budget too low for objective' },
    [ErrorCode.CAMP_008]: { vi: 'Đã đạt giới hạn chi tiêu hàng ngày', en: 'Daily spend cap reached' },
    [ErrorCode.CAMP_009]: { vi: 'Chiến dịch bị tạm dừng bởi hệ thống (vi phạm/chính sách)', en: 'Campaign paused by system (policy/violation)' },

    // AD SET
    [ErrorCode.ADSET_001]: { vi: 'Nhóm quảng cáo không tồn tại', en: 'Ad set not found' },
    [ErrorCode.ADSET_002]: { vi: 'Tên nhóm quảng cáo đã tồn tại', en: 'Ad set name already exists' },
    [ErrorCode.ADSET_003]: { vi: 'Đối tượng quá hẹp', en: 'Targeting too narrow' },
    [ErrorCode.ADSET_004]: { vi: 'Kích thước đối tượng quá nhỏ (< 1000)', en: 'Audience size too small' },
    [ErrorCode.ADSET_005]: { vi: 'Giá thầu quá thấp', en: 'Bid amount too low' },
    [ErrorCode.ADSET_006]: { vi: 'Lịch chạy bị trùng', en: 'Schedule conflict' },
    [ErrorCode.ADSET_007]: { vi: 'Khu vực không được hỗ trợ', en: 'Location not supported' },
    [ErrorCode.ADSET_008]: { vi: 'Khoảng tuổi không hợp lệ', en: 'Age range invalid' },
    [ErrorCode.ADSET_009]: { vi: 'Không thể chỉnh sửa nhóm quảng cáo đang hoạt động', en: 'Cannot edit active ad set' },

    // AD
    [ErrorCode.AD_001]: { vi: 'Quảng cáo không tồn tại', en: 'Ad not found' },
    [ErrorCode.AD_002]: { vi: 'Tên quảng cáo đã tồn tại', en: 'Ad name already exists' },
    [ErrorCode.AD_003]: { vi: 'Thiếu nội dung quảng cáo', en: 'Creative missing' },
    [ErrorCode.AD_004]: { vi: 'Tỉ lệ ảnh không được hỗ trợ', en: 'Image ratio not supported' },
    [ErrorCode.AD_005]: { vi: 'Video quá dài', en: 'Video too long' },
    [ErrorCode.AD_006]: { vi: 'Thiếu nút kêu gọi hành động', en: 'Call-to-action missing' },
    [ErrorCode.AD_007]: { vi: 'URL không hợp lệ', en: 'URL invalid' },
    [ErrorCode.AD_008]: { vi: 'Quảng cáo bị từ chối do vi phạm chính sách', en: 'Ad rejected - policy violation' },
    [ErrorCode.AD_009]: { vi: 'Quảng cáo đang được duyệt', en: 'Ad under review' },
    [ErrorCode.AD_010]: { vi: 'Nội dung chính quá dài (> 200 ký tự)', en: 'Primary text too long' },
    [ErrorCode.AD_011]: { vi: 'Tiêu đề quá dài', en: 'Headline too long' },
    [ErrorCode.AD_012]: { vi: 'Quảng cáo trùng lặp trong nhóm quảng cáo', en: 'Duplicate ad in ad set' },

    // BUDGET & SPENDING
    [ErrorCode.BUDGET_001]: { vi: 'Số dư không đủ để chạy quảng cáo', en: 'Insufficient balance' },
    [ErrorCode.BUDGET_002]: { vi: 'Phương thức thanh toán bị từ chối', en: 'Payment method declined' },
    [ErrorCode.BUDGET_003]: { vi: 'Nạp tiền thất bại', en: 'Top-up failed' },
    [ErrorCode.BUDGET_004]: { vi: 'Số tiền nạp tối thiểu', en: 'Minimum top-up amount' },

    // INSIGHT & REPORT
    [ErrorCode.INSIGHT_001]: { vi: 'Dữ liệu chưa sẵn sàng', en: 'Data not ready' },
    [ErrorCode.INSIGHT_002]: { vi: 'Khoảng thời gian quá dài', en: 'Date range too long' },

    // RATE LIMIT
    [ErrorCode.RATE_001]: { vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút', en: 'Too many requests' },
    [ErrorCode.RATE_002]: { vi: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau', en: 'Too many login attempts' },
    [ErrorCode.RATE_003]: { vi: 'Quá nhiều chiến dịch được tạo hôm nay', en: 'Too many campaigns created today' },
});

// Helper lấy message theo ngôn ngữ (dùng trong controller/middleware)
export const getErrorMessage = (code, lang = 'vi') => {
    return ErrorMessage[code]?.[lang] || ErrorMessage[ErrorCode.COMMON_999][lang];
};
import rateLimit from 'express-rate-limit';

// Rate limiter cho login
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Tăng lên để test (mặc định là 5)
    message: {
        success: false,
        message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho register
export const registerLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 phút
    max: 10000, // Tăng lên để test (mặc định là 3)
    message: {
        success: false,
        message: 'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho forgot password
export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Tăng lên để test (mặc định là 3)
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho re-send mail 
export const resendMailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Tăng lên để test (mặc định là 5)
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu gửi lại email xác nhận. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
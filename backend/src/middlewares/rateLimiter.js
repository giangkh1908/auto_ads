import rateLimit from 'express-rate-limit';

// Rate limiter cho login — 5 lần / 15 phút theo IP
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho register — 3 lần / giờ theo IP
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: 'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 giờ.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho forgot password — 2 lần / giờ theo IP
export const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 2,
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho re-send mail — 2 lần / giờ theo IP
export const resendMailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 2,
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu gửi lại email xác nhận. Vui lòng thử lại sau 1 giờ.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
import rateLimit from 'express-rate-limit';

// Rate limiter cho login
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho register
export const registerLimiter = rateLimit({
    windowMs: 60, // 1 phút
    max: 100, // Limit each IP to 3 registration attempts per hour
    message: {
        success: false,
        message: 'Quá nhiều lần đăng ký. Vui lòng thử lại sau 1 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho forgot password
export const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 forgot password requests per hour
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter cho re-send mail 
export const resendMailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 1 IP được re-send 5 lần trong 15p
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu gửi lại email xác nhận. Vui lòng thử lại sau 15 phút.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
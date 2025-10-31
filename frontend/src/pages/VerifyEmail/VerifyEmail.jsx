import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './VerifyEmail.css'

function VerifyEmail() {
    const { token } = useParams()
    const navigate = useNavigate()
    const { verifyEmail, resendVerificationEmail } = useAuth()
    
    const [status, setStatus] = useState('verifying') // verifying, success, error
    const [message, setMessage] = useState('')
    const [email, setEmail] = useState('')
    const [showResend, setShowResend] = useState(false)
    const hasVerified = useRef(false)

    useEffect(() => {
        if (token && !hasVerified.current) {
            hasVerified.current = true
            handleVerifyEmail()
        }
    }, [token])

    const handleVerifyEmail = async () => {
        try {
            const result = await verifyEmail(token)
            
            if (result.success) {
                setStatus('success')
                setMessage('Email đã được xác nhận thành công! Tài khoản của bạn đã được kích hoạt.')
                // Navigation is handled by AuthContext
            }
        } catch (error) {
            setStatus('error')
            
            // Handle different error types based on error response
            if (error.response?.data?.code) {
                const { code, message } = error.response.data
                
                switch (code) {
                    case 'TOKEN_EXPIRED':
                        setMessage(message)
                        setShowResend(true)
                        break
                    case 'TOKEN_ALREADY_USED':
                        setMessage(message + ' Bạn có thể đăng nhập ngay bây giờ.')
                        setShowResend(false)
                        break
                    case 'TOKEN_INVALID':
                        setMessage(message)
                        setShowResend(true)
                        break
                    default:
                        setMessage('Liên kết xác nhận không hợp lệ hoặc đã hết hạn.')
                        setShowResend(true)
                }
            } else {
                setMessage('Liên kết xác nhận không hợp lệ hoặc đã hết hạn.')
                setShowResend(true)
            }
        }
    }

    const handleResendEmail = async () => {
        if (!email.trim()) {
            alert('Vui lòng nhập email')
            return
        }
        
        const result = await resendVerificationEmail(email)
        if (result.success) {
            setShowResend(false)
            setMessage('Email xác nhận mới đã được gửi!')
        }
    }

    return (
        <div className="verify-email-page">
            <div className="verify-email-container">
                {status === 'verifying' && (
                    <div className="verify-status">
                        <div className="loading-spinner"></div>
                        <h2>Đang xác nhận email...</h2>
                        <p>Vui lòng đợi trong giây lát</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="verify-status success">
                        <div className="success-icon">✅</div>
                        <h2>Xác nhận thành công!</h2>
                        <p>{message}</p>
                        <p>Bạn sẽ được chuyển hướng đến trang quản lý tài khoản trong giây lát...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="verify-status error">
                        <div className="error-icon">❌</div>
                        <h2>Xác nhận thất bại</h2>
                        <p>{message}</p>
                        
                        {showResend && (
                            <div className="resend-section">
                                <h3>Gửi lại email xác nhận</h3>
                                <div className="input-group">
                                    <input
                                        type="email"
                                        placeholder="Nhập email của bạn"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                    <button onClick={handleResendEmail}>
                                        Gửi lại
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <button 
                            className="btn-home"
                            onClick={() => navigate('/')}
                        >
                            Về trang chủ
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default VerifyEmail

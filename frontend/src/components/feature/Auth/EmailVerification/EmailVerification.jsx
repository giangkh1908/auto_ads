import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useAuth } from '../../../../hooks/useAuth'
import './EmailVerification.css'

function EmailVerification({ email, onBack, title = "Xác nhận email của bạn" }) {
    const [resendLoading, setResendLoading] = useState(false)
    const { resendVerificationEmail } = useAuth()

    //Nút này gửi lại email xác nhận
    const handleResendEmail = async () => {
        try {
            setResendLoading(true)
            const result = await resendVerificationEmail(email)
            if (result.success) {
                // Toast message sẽ được hiển thị từ AuthContext
            }
        } catch (error) {
            console.error('Error resending verification email:', error)
        } finally {
            setResendLoading(false)
        }
    }

    return (
        <div className="email-verification-form">
            <div className="verification-content">
                <div className="verification-icon"><Mail size={32} /></div>
                <h3>{title}</h3>
                <p>
                    Chúng tôi đã gửi một email xác nhận đến <strong>{email}</strong>. 
                    Vui lòng kiểm tra hộp thư và nhấp vào liên kết để kích hoạt tài khoản.
                </p>
                <p className="verification-note">
                    Nếu bạn không thấy email, hãy kiểm tra thư mục spam hoặc nhấn nút bên dưới để gửi lại.
                </p>
                
                <div className="verification-actions">
                    <button 
                        type="button" 
                        className="btn-resend" 
                        onClick={handleResendEmail}
                        disabled={resendLoading}
                    >
                        {resendLoading ? 'Đang gửi...' : 'Gửi lại email'}
                    </button>
                    
                    <button 
                        type="button" 
                        className="btn-back" 
                        onClick={onBack}
                    >
                        Quay lại
                    </button>
                </div>
            </div>
        </div>
    )
}

export default EmailVerification

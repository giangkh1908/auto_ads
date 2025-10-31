import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../../hooks/useAuth';
import './ResetForm.css';

function ResetForm({ onSwitchLogin }) {
    const { t } = useTranslation()
    const [email, setEmail] = useState('')
    const [errors, setErrors] = useState({})
    const [isSubmitted, setIsSubmitted] = useState(false)
    
    const { forgotPassword, loading } = useAuth()

    const validateForm = () => {
        const newErrors = {}
        
        if (!email.trim()) {
            newErrors.email = t('validation.email_required')
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = t('validation.email_invalid')
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    //Gửi email reset
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (loading) return
        
        if (!validateForm()) return
        
        const result = await forgotPassword(email)
        
        if (result.success) {
            setIsSubmitted(true)
        }
    }

    //Gửi lại email reset
    const handleResendEmail = async () => {
        const result = await forgotPassword(email)
        
        if (result.success) {
            setIsSubmitted(true)
        }
    }

    if (isSubmitted) {
        return (
            //Form reset lại account
            <div className="auth-form">
                <div className="success-message">
                    <div className="success-icon"><CheckCircle size={20} /></div>
                    <h3>{t('auth.email_sent')}</h3>
                    <p>{t('auth.reset_email_sent', { email })}</p>
                    <p>{t('auth.check_inbox')}</p>
                    <button 
                        type="button" 
                        className="btn-login-form" 
                        onClick={handleResendEmail}
                        disabled={loading}
                    >
                        {loading ? t('auth.sending') : t('auth.resend_email')}
                    </button>
                </div>
                <div className="form-switch">
                    <span className="link" onClick={onSwitchLogin}>{t('auth.back_to_login')}</span>
                </div>
            </div>
        )
    }

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-header">
                <h3>{t('auth.reset_password_title')}</h3>
                <p>{t('auth.reset_instruction')}</p>
            </div>
            
            <div className="input-group-auth">
                <div className="input-icon-auth"><Mail size={16} /></div>
                <input 
                    type="email" 
                    placeholder={t('auth.email_placeholder')} 
                    value={email} 
                    onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors(prev => ({...prev, email: ''}))
                    }}
                    className={errors.email ? 'error' : ''}
                />
                {errors.email && <div className="error-message">{errors.email}</div>}
            </div>
            
            <button type="submit" className="btn-login-form" disabled={loading}>
                {loading ? t('auth.processing') : t('common.confirm')}
            </button>
            
            <div className="form-switch">
                {t('auth.remember_password')} <span className="link" onClick={onSwitchLogin}>{t('auth.login_now')}</span>
            </div>
        </form>
    )
}

export default ResetForm



import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../../../hooks/useAuth'
import EmailVerification from '../EmailVerification/EmailVerification'
import { validateFullName, validateEmail, validatePhone, validatePassword, buildErrors } from '../../../../utils/validation'
import './Register.css'
import ReCAPTCHA from 'react-google-recaptcha'
import {toast} from 'sonner'

function Register({ onSwitchLogin }) {
    const { t } = useTranslation()
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        password: ''
    })
    const [showPwd, setShowPwd] = useState(false)
    const [errors, setErrors] = useState({})
    const [showVerificationForm, setShowVerificationForm] = useState(false)
    const [registeredEmail, setRegisteredEmail] = useState('')
    const [captchaToken, setCaptchaToken] = useState(null)
    const [captchaKey, setCaptchaKey] = useState(0) // Key để reset CAPTCHA component

    const { register, loading } = useAuth()

    const validateForm = () => {
        const checks = [
            { key: 'full_name', valid: validateFullName(formData.full_name), message: t('validation.fullname_min_length') },
            { key: 'email', valid: validateEmail(formData.email), message: t('validation.email_invalid') },
            { key: 'phone', valid: validatePhone(formData.phone), message: t('validation.phone_invalid') },
            { key: 'password', valid: validatePassword(formData.password, { minLength: 6 }), message: t('validation.password_min_length') },
        ]
        const newErrors = buildErrors(checks)
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (loading) return
        
        if (!validateForm()) return
        
        // Kiểm tra reCAPTCHA
        if (!captchaToken) {
            toast.warning(t('auth.captcha_required'));
            return
        }

        // Gửi kèm token qua backend để verify
        const result = await register({ ...formData, captchaToken }, onSwitchLogin)
        
        if (result.success) {
            // Hiển thị form xác thực email thay vì chuyển sang login
            setRegisteredEmail(formData.email)
            setShowVerificationForm(true)
        } else if (result.error && result.error.includes('CAPTCHA')) {
            // Xử lý lỗi CAPTCHA từ backend
            setErrors(prev => ({ ...prev, captcha: result.error }))
            setCaptchaToken(null) // Reset CAPTCHA để user có thể thử lại
            setCaptchaKey(prev => prev + 1) // Force re-render CAPTCHA component
        }
    }

    const handleBackToLogin = () => {
        setShowVerificationForm(false)
        setRegisteredEmail('')
        // Chuyển sang form login
        if (onSwitchLogin) {
            onSwitchLogin()
        }
    }

    // Nếu đang hiển thị form xác thực email
    if (showVerificationForm) {
        return (
            <EmailVerification 
                email={registeredEmail}
                onBack={handleBackToLogin}
                title={t('auth.email_verification_title')}
            />
        )
    }   
        return (
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="input-group-auth">
                    <div className="input-icon-auth"><User size={16} /></div>
                    <input 
                        placeholder={t('auth.fullname_placeholder')} 
                        value={formData.full_name} 
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        className={errors.full_name ? 'error' : ''}
                    />
                    {errors.full_name && <div className="error-message">{errors.full_name}</div>}
                </div>
                
                <div className="input-group-auth">
                    <div className="input-icon-auth"><Mail size={16} /></div>
                    <input 
                        type="email" 
                        placeholder={t('auth.email_placeholder')} 
                        value={formData.email} 
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={errors.email ? 'error' : ''}
                    />
                    {errors.email && <div className="error-message">{errors.email}</div>}
                </div>
                
                <div className="input-group-auth">
                    <div className="input-icon-auth"><Phone size={16} /></div>
                    <input 
                        placeholder={t('auth.phone_placeholder')} 
                        value={formData.phone} 
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={errors.phone ? 'error' : ''}
                    />
                    {errors.phone && <div className="error-message">{errors.phone}</div>}
                </div>
                
                <div className="input-group-auth">
                    <div className="input-icon-auth" aria-hidden="true"><Lock size={16} /></div>
                    <input 
                        type={showPwd ? 'text' : 'password'} 
                        placeholder={t('auth.password_placeholder')} 
                        value={formData.password} 
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className={errors.password ? 'error' : ''}
                    />
                    <div className="input-action" onClick={() => setShowPwd(v => !v)}>
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </div>
                    {errors.password && <div className="error-message">{errors.password}</div>}
                </div>
    
                {/* Google reCAPTCHA */}
            <div className="captcha-box">
                <ReCAPTCHA
                    key={captchaKey}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                    onChange={token => {
                        setCaptchaToken(token)
                        if (errors.captcha) {
                            setErrors(prev => ({ ...prev, captcha: '' }))
                        }
                    }}
                    onExpired={() => setCaptchaToken(null)}
                />
                {errors.captcha && <div className="error-message">{errors.captcha}</div>}
            </div>

                <button type="submit" className="btn-login-form" disabled={loading}>
                    {loading ? t('auth.processing') : t('auth.register_button')}
                </button>
    
                <div className="form-switch">
                    {t('auth.has_account')} <span className="link" onClick={onSwitchLogin}>{t('auth.login_now')}</span>
                </div>
            </form>
        )
}

export default Register



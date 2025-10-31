import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../constants/app.constants'
import './ResetPassword.css'

function ResetPassword() {
    const { t } = useTranslation()
    const { token } = useParams()
    const navigate = useNavigate()
    const { resetPassword } = useAuth()
    
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    })
    
    const [showPassword, setShowPassword] = useState(false)
    const [errors, setErrors] = useState({})
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [tokenError, setTokenError] = useState(null)

    const validateForm = () => {
        const newErrors = {}
        
        if (!formData.password.trim()) {
            newErrors.password = t('validation.password_required')
        } else if (formData.password.length < 6) {
            newErrors.password = t('validation.password_min_length')
        }
        
        if (!formData.confirmPassword.trim()) {
            newErrors.confirmPassword = t('validation.confirm_password_required')
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = t('validation.password_mismatch')
        }
        
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
        
        if (!validateForm()) return
        
        const result = await resetPassword(token, formData.password)
        
        if (result.success) {
            setIsSubmitted(true)
            
            // Redirect to home after 2 seconds
            setTimeout(() => {
                navigate(ROUTES.HOME)
            }, 2000)
        } else if (result.error) {
            // Handle token-related errors
            if (result.error.includes('hết hạn') || result.error.includes('expired')) {
                setTokenError(t('auth.reset_token_expired'))
            } else if (result.error.includes('đã được sử dụng') || result.error.includes('used')) {
                setTokenError(t('auth.reset_token_used'))
            } else {
                setTokenError(t('auth.reset_token_invalid'))
            }
        }
    }

    if (isSubmitted) {
        return (
            <div className="reset-password-page">
                <div className="reset-password-container">
                    <div className="success-status">
                        <div className="success-icon">✅</div>
                        <h2>{t('auth.reset_password_success')}</h2>
                        <p>{t('auth.password_updated')}</p>
                        <p>{t('auth.redirecting_home')}</p>
                    </div>
                </div>
            </div>
        )
    }

    // Show token error if exists
    if (tokenError) {
        return (
            <div className="reset-password-page">
                <div className="reset-password-container">
                    <div className="error-status">
                        <div className="error-icon">❌</div>
                        <h2>{t('auth.invalid_link')}</h2>
                        <p>{tokenError}</p>
                        <button 
                            className="btn-home"
                            onClick={() => navigate(ROUTES.HOME)}
                        >
                            {t('errors.go_home')}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="reset-password-page">
            <div className="reset-password-container">
                <div className="form-header">
                    <h2>{t('auth.reset_password_title')}</h2>
                    <p>{t('auth.enter_new_password')}</p>
                </div>

                <form onSubmit={handleSubmit} className="reset-form">
                    <div className="input-group">
                        <div className="input-icon" aria-hidden="true">🔒</div>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('auth.new_password')}
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            className={errors.password ? 'error' : ''}
                        />
                        <div 
                            className="input-action" 
                            onClick={() => setShowPassword(v => !v)}
                        >
                            {showPassword ? '🙈' : '👁️'}
                        </div>
                        {errors.password && <div className="error-message">{errors.password}</div>}
                    </div>

                    <div className="input-group">
                        <div className="input-icon" aria-hidden="true">🔒</div>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('auth.confirm_password')}
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            className={errors.confirmPassword ? 'error' : ''}
                        />
                        {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
                    </div>

                    <button type="submit" className="btn-reset">
                        {t('auth.reset_password_button')}
                    </button>
                </form>

                <div className="form-footer">
                    <span className="link" onClick={() => navigate('/')}>
                        {t('auth.back_to_home')}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default ResetPassword
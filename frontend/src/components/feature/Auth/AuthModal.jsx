import { useCallback, useEffect } from 'react'
import LoginForm from './LoginForm/LoginForm'
import Register from './RegisterForm/Register'
import ResetForm from './ResetForm/ResetForm'

/**
 * AuthModal
 * - Controls which auth form is visible: 'login' | 'register' | 'reset'
 * - Props:
 *   - visible: boolean
 *   - mode: 'login' | 'register' | 'reset'
 *   - onClose: () => void
 *   - onChangeMode: (mode) => void
 */
function AuthModal({ visible, mode = 'login', onClose, onChangeMode }) {
    const handleClose = useCallback(() => {
        if (onClose) onClose()
    }, [onClose])

    // Lock background scroll while modal is visible (avoid conditional hook usage)
    useEffect(() => {
        if (!visible) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [visible])

    if (!visible) return null

    return (
        <div className="auth-modal-overlay" role="dialog" aria-modal="true">
            <div className="auth-modal">
                <div className="auth-header">
                    <div className="auth-title">
                        {mode === 'login' && 'Đăng nhập'}
                        {mode === 'register' && 'Đăng ký tài khoản'}
                        {mode === 'reset' && 'Quên mật khẩu'}
                    </div>
                    <button className="auth-close" onClick={handleClose}>✕</button>
                </div>

                <div className="auth-body">
                    {mode === 'login' && (
                        <LoginForm
                            onSuccess={handleClose}
                            onSwitchRegister={() => onChangeMode && onChangeMode('register')}
                            onSwitchReset={() => onChangeMode && onChangeMode('reset')}
                        />
                    )}
                    {mode === 'register' && (
                        <Register
                            onSwitchLogin={() => onChangeMode && onChangeMode('login')}
                        />
                    )}
                    {mode === 'reset' && (
                        <ResetForm
                            onSuccess={() => onChangeMode && onChangeMode('login')}
                            onSwitchLogin={() => onChangeMode && onChangeMode('login')}
                        />
                    )}
                </div>
            </div>

            {/* Inline styles local to modal to avoid global CSS dependency */}
            <style>{`
                .auth-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 1200; }
                .auth-modal { width: 550px; max-width: 95vw; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 12px 28px rgba(0,0,0,.25); }
                .auth-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eee; }
                .auth-title { font-weight: 700; font-size: 20px; color: #111827; }
                .auth-close { border: none; background: transparent; font-size: 18px; cursor: pointer; color: #6b7280; }
                .auth-body { padding: 20px; }
            `}</style>
        </div>
    )
}

export default AuthModal



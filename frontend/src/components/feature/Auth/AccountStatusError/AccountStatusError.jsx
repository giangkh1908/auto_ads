import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Mail, X } from 'lucide-react';
import './AccountStatusError.css';
import ContactAdmin from '../../../common/ContactAdmin/ContactAdmin';

function AccountStatusError({ status, onBack }) {
    const { t } = useTranslation();
    const [showContactModal, setShowContactModal] = useState(false);

    const isBanned = status === 'banned';
    const message = isBanned 
        ? t('auth.account_banned_message')
        : t('auth.account_inactive_message');

    return (
        <>
            <div className="account-status-error-form">
                <div className="account-status-error-content">
                    <div className="account-status-error-icon">
                        <AlertTriangle size={48} color={isBanned ? "#dc3545" : "#ff9800"} />
                    </div>
                    <h3 className="account-status-error-title">{message}</h3>
                    <p className="account-status-error-description">
                        {t('auth.contact_admin_if_error')}
                    </p>
                    <h4 className="account-status-error-phone">Hotline: 089 898 6008</h4>
                    
                    <div className="account-status-error-actions">
                        {/* <button 
                            type="button" 
                            className="btn-contact-admin" 
                            onClick={() => setShowContactModal(true)}
                        >
                            <Mail size={16} />
                            {t('auth.contact_admin_button')}
                        </button> */}
                        
                        {onBack && (
                            <button 
                                type="button" 
                                className="btn-back-to-login" 
                                onClick={onBack}
                            >
                                {t('auth.back_to_login')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Contact Admin Modal */}
            <ContactAdmin
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                status={status}
            />
        </>
    );
}

export default AccountStatusError;


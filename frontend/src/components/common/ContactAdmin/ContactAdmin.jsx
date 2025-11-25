import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
// import axiosInstance from '../../../utils/axios';
import './ContactAdmin.css';

function ContactAdmin({ isOpen, onClose, status }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        email: '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
            resetForm();
        }
    };

    const resetForm = () => {
        setFormData({
            email: '',
            subject: '',
            message: ''
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.email || !formData.subject || !formData.message) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }

        setIsSubmitting(true);
        try {
            // Gửi email trực tiếp qua mailto link
            const subject = encodeURIComponent(`[Account ${status === 'banned' ? 'Banned' : 'Inactive'}] ${formData.subject}`);
            const body = encodeURIComponent(
                `Email: ${formData.email}\n\nStatus: ${status}\n\nMessage:\n${formData.message}`
            );
            // Lấy email support từ translation
            const supportEmail = 'cskh@fchat.vn'; // Email từ footer
            window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
            
            toast.success(t('auth.contact_admin_success'));
            // Đợi một chút trước khi đóng modal để user thấy toast
            setTimeout(() => {
                onClose();
                resetForm();
            }, 1000);
            
            // Option 2: Gửi qua API (nếu có endpoint)
            // const response = await axiosInstance.post('/api/support/contact', {
            //     email: formData.email,
            //     subject: formData.subject,
            //     message: formData.message,
            //     status: status
            // });
            // if (response.data.success) {
            //     toast.success(t('auth.contact_admin_success'));
            //     onClose();
            //     resetForm();
            // }
        } catch (error) {
            console.error('Contact admin error:', error);
            toast.error(t('auth.contact_admin_error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        onClose();
        resetForm();
    };

    return (
        <div className="contact-admin-overlay" onClick={handleBackdropClick}>
            <div className="contact-admin-modal" onClick={(e) => e.stopPropagation()}>
                <div className="contact-admin-header">
                    <h3>{t('auth.contact_admin_title')}</h3>
                    <button className="contact-admin-close" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <form className="contact-admin-form" onSubmit={handleSubmit}>
                    <div className="contact-admin-field">
                        <label>{t('auth.contact_admin_email_label')}</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder={t('auth.email_placeholder')}
                            required
                        />
                    </div>

                    <div className="contact-admin-field">
                        <label>{t('auth.contact_admin_subject_label')}</label>
                        <input
                            type="text"
                            name="subject"
                            value={formData.subject}
                            onChange={handleInputChange}
                            placeholder={`Account ${status === 'banned' ? 'banned' : 'inactive'} - Need assistance`}
                            required
                        />
                    </div>

                    <div className="contact-admin-field">
                        <label>{t('auth.contact_admin_message_label')}</label>
                        <textarea
                            name="message"
                            value={formData.message}
                            onChange={handleInputChange}
                            rows={5}
                            placeholder="Vui lòng mô tả chi tiết vấn đề của bạn..."
                            required
                        />
                    </div>

                    <div className="contact-admin-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            {t('auth.contact_admin_cancel_button')}
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner"></span>
                                    {t('auth.sending')}
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    {t('auth.contact_admin_submit_button')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ContactAdmin;


import { useTranslation } from 'react-i18next'
import './Footer.css'

function Footer() {
    const { t } = useTranslation()
    
    return (
        <footer className="app-footer">
            <div className="footer-inner">
                <div className="footer-col brand-col">
                    <div className="brand">
                        <span className="brand-logo">{t('footer.brand')}</span>
                    </div>
                    <ul className="contact-list">
                        <li><span className="icon">📍</span> {t('footer.address')}</li>
                        <li><span className="icon">📞</span> {t('footer.support')}</li>
                        <li><span className="icon">☎</span> {t('footer.complaint')}</li>
                        <li><span className="icon">✉</span> {t('footer.email')}</li>
                        <li><span className="icon">⏰</span> {t('footer.working_hours')}</li>
                    </ul>
                </div>

                <div className="footer-col links-col">
                    <h4>{t('footer.help_center')}</h4>
                    <ul>
                        <li><a href="#pricing">{t('footer.pricing')}</a></li>
                        <li><a href="#guide">{t('footer.guide')}</a></li>
                        <li><a href="#faq">{t('footer.faq')}</a></li>
                        <li><a href="#activate">{t('footer.activate')}</a></li>
                        <li><a href="#agency">{t('footer.agency')}</a></li>
                        <li><a href="#affiliate">{t('footer.affiliate')}</a></li>
                    </ul>
                </div>

                <div className="footer-col links-col">
                    <h4>{t('footer.policy')}</h4>
                    <ul>
                        <li><a href="#group">{t('footer.support_group')}</a></li>
                        <li><a href="#terms">{t('footer.terms')}</a></li>
                        <li><a href="#privacy">{t('footer.privacy')}</a></li>
                        <li><a href="#payment">{t('footer.payment')}</a></li>
                        <li><a href="#tools">{t('footer.facebook_tools')}</a></li>
                        <li><a href="#blog">{t('footer.blog')}</a></li>
                    </ul>
                </div>

                <div className="footer-col store-col">
                    <h4>{t('footer.download_app')}</h4>
                    <div className="store-badges">
                        <a className="store-badge play" href="#play" aria-label="Google Play">{t('footer.google_play')}</a>
                        <a className="store-badge app" href="#appstore" aria-label="App Store">{t('footer.app_store')}</a>
                    </div>
                    <h4>{t('footer.connect_fchat')}</h4>
                    <div className="socials">
                        <a className="social fb" href="#facebook" aria-label="Facebook">f</a>
                        <a className="social yt" href="#youtube" aria-label="YouTube">▶</a>
                    </div>
                    <div className="partner-badges">
                        <div className="badge notify">{t('footer.announced')}</div>
                        <div className="badge meta">{t('footer.meta_partner')}</div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
export default Footer;
import { useEffect, useState } from 'react'
import { Save, HelpCircle } from 'lucide-react'
import './Setting.css'
import profileService from '../../services/profileService'
import shopService from '../../services/shopService'

function Settings() {
    const [formData, setFormData] = useState({
        shopName: '',
        domain: 'khác',
        email: '',
        phone: '',
        currency: 'VND',
        timezone: 'UTC+7',
        receiveNotifications: true
    })

    const [shopId, setShopId] = useState(null)

    useEffect(() => {
        const load = async () => {
            try {
                const resp = await profileService.getCurrentProfile()
                const user = resp?.data?.user || resp?.user
                const shop = resp?.data?.shop || resp?.shop
                setShopId(shop?._id || null)
                setFormData(prev => ({
                    ...prev,
                    shopName: shop?.shop_name || user?.full_name || '',
                    domain: shop?.industry || 'khác',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    currency: shop?.settings?.currency || 'VND',
                    timezone: shop?.settings?.timezone ? (shop.settings.timezone.includes('Asia') ? 'UTC+7' : 'UTC+7') : 'UTC+7',
                }))
            } catch (e) {
                console.error('Load settings error:', e)
            }
        }
        load()
    }, [])

    const [activeTab, setActiveTab] = useState('info')

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (shopId) {
                await shopService.updateShop(shopId, {
                    shop_name: formData.shopName,
                    industry: formData.domain,
                    settings: {
                        currency: formData.currency,
                        timezone: formData.timezone === 'UTC+7' ? 'Asia/Ho_Chi_Minh' : 'Asia/Ho_Chi_Minh',
                        language: 'vi'
                    }
                })
            }
            // Optionally update user profile phone/email if changed
            await profileService.updateProfile({
                full_name: formData.shopName,
                phone: formData.phone,
            })
        } catch (err) {
            console.error('Save settings error:', err)
        }
    }

    const tabs = [
        { id: 'info', label: 'Thông tin' },
        { id: 'staff', label: 'Nhân viên' },
        { id: 'livechat', label: 'Livechat' },
        { id: 'messages', label: 'Tin nhắn mẫu' },
        { id: 'api', label: 'API' },
        { id: 'sale', label: 'Sale' },
        { id: 'history', label: 'Lịch hẹn' },
        { id: 'history2', label: 'History' },
        { id: 'payment', label: 'Thanh toán' },
    ]

    return (
        <div className="settings-border">
            <div className="settings-page">

            <div className="settings-tabs-header">
                <div className="settings-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="settings-container">
                {activeTab === 'info' && (
                    <div className="settings-content">
                        <form className="settings-form" onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-field">
                                    <label htmlFor="shopName">Tên shop</label>
                                    <input
                                        type="text"
                                        id="shopName"
                                        name="shopName"
                                        value={formData.shopName}
                                        onChange={handleInputChange}
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-field">
                                    <label htmlFor="domain">Lĩnh vực</label>
                                    <select
                                        id="domain"
                                        name="domain"
                                        value={formData.domain}
                                        onChange={handleInputChange}
                                        className="form-select"
                                    >
                                        <option value="khác">khác</option>
                                        <option value="fashion">Thời trang</option>
                                        <option value="food">Ẩm thực</option>
                                        <option value="tech">Công nghệ</option>
                                        <option value="beauty">Làm đẹp</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-field">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-field">
                                    <label htmlFor="phone">Phone</label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-field">
                                    <label htmlFor="currency">Currency</label>
                                    <select
                                        id="currency"
                                        name="currency"
                                        value={formData.currency}
                                        onChange={handleInputChange}
                                        className="form-select"
                                    >
                                        <option value="VND">VND - Vietnamese dong</option>
                                        <option value="USD">USD - US Dollar</option>
                                        <option value="EUR">EUR - Euro</option>
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label htmlFor="timezone">Timezone</label>
                                    <select
                                        id="timezone"
                                        name="timezone"
                                        value={formData.timezone}
                                        onChange={handleInputChange}
                                        className="form-select"
                                    >
                                        <option value="UTC+7">[UTC + 7] Viet Nam</option>
                                        <option value="UTC+8">[UTC + 8] Singapore</option>
                                        <option value="UTC+9">[UTC + 9] Japan</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-checkbox">
                                <input
                                    type="checkbox"
                                    id="receiveNotifications"
                                    name="receiveNotifications"
                                    checked={formData.receiveNotifications}
                                    onChange={handleInputChange}
                                />
                                <label htmlFor="receiveNotifications">
                                    Nhận email thông báo từ AAMS
                                </label>
                            </div>

                            <button type="submit" className="btn-save-settings">
                                <Save size={16} />
                                Lưu thiết lập
                            </button>
                        </form>

                        <div className="settings-footer">
                            <button className="btn-delete-shop">
                                Xóa shop này
                                <HelpCircle size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {activeTab !== 'info' && (
                    <div className="settings-content">
                        <div className="placeholder-content">
                            <p>Nội dung của tab {tabs.find(t => t.id === activeTab)?.label} đang được phát triển...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
    )
}

export default Settings
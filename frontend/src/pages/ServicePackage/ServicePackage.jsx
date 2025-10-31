import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './ServicePackage.css';

function ServicePackage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('3months');

  const pricingPlans = {
    '3months': [
      {
        name: 'Miễn Phí',
        badge: 'FREE',
        badgeColor: 'cyan',
        price: '0đ',
        period: '3 Tháng',
        pages: '3',
        conversations: '1,000',
        contacts: '2,000',
        features: ['3 Nhân viên', 'LiveFail'],
        buttonText: 'Miễn phí',
        buttonVariant: 'secondary',
        popular: false
      },
      {
        name: 'LiveChat',
        badge: 'LIVECHAT',
        badgeColor: 'green',
        price: '98,000đ',
        period: '3 Tháng',
        pages: '5',
        conversations: '10,000',
        contacts: '20,000',
        features: ['Không giới hạn số lần đăng', '3 Nhân viên'],
        buttonText: 'Mua Ngay',
        buttonVariant: 'primary',
        popular: false
      },
      {
        name: 'Chatbot',
        badge: 'CHATBOT',
        badgeColor: 'blue',
        price: '290,000đ',
        period: '3 Tháng',
        pages: '15',
        conversations: '15,000',
        contacts: '30,000',
        features: ['Không giới hạn số lần đăng', '3 Nhân viên', 'LiveFail', 'ChatBot'],
        buttonText: 'Mua Ngay',
        buttonVariant: 'primary',
        popular: false
      },
      {
        name: 'Chatbot AI',
        badge: 'CHATBOT AI',
        badgeColor: 'purple',
        price: '980,000đ',
        period: '3 Tháng',
        pages: '∞',
        conversations: '20,000',
        contacts: '40,000',
        features: ['Không giới hạn số lần đăng', '5 Nhân viên', 'LiveFail', 'ChatBot', 'OpenAI', 'API & CRM', 'Tùy chỉnh nâng cao'],
        buttonText: 'Mua Ngay',
        buttonVariant: 'primary',
        popular: true
      }
    ],
    '1year': [
      {
        name: 'Miễn Phí',
        badge: 'FREE',
        badgeColor: 'cyan',
        price: '0đ',
        period: '1 Năm',
        pages: '3',
        conversations: '1,000',
        contacts: '2,000',
        features: ['3 Nhân viên', 'LiveFail'],
        buttonText: 'Miễn phí',
        buttonVariant: 'secondary',
        popular: false
      },
      {
        name: 'LiveChat',
        badge: 'LIVECHAT',
        badgeColor: 'green',
        price: '350,000đ',
        period: '1 Năm',
        pages: '5',
        conversations: '10,000',
        contacts: '20,000',
        features: ['Không giới hạn số lần đăng', '3 Nhân viên'],
        buttonText: 'Mua Ngay',
        buttonVariant: 'primary',
        popular: false
      },
      {
        name: 'Chatbot',
        badge: 'CHATBOT',
        badgeColor: 'blue',
        price: '1,050,000đ',
        period: '1 Năm',
        pages: '15',
        conversations: '15,000',
        contacts: '30,000',
        features: ['Không giới hạn số lần đăng', '3 Nhân viên', 'LiveFail', 'ChatBot'],
        buttonText: 'Mua Ngay',
        buttonVariant: 'primary',
        popular: false
      },
      {
        name: 'Chatbot AI',
        badge: 'CHATBOT AI',
        badgeColor: 'purple',
        price: '3,500,000đ',
        period: '1 Năm',
        pages: '∞',
        conversations: '20,000',
        contacts: '40,000',
        features: ['Không giới hạn số lần đăng', '5 Nhân viên', 'LiveFail', 'ChatBot', 'OpenAI', 'API & CRM', 'Tùy chỉnh nâng cao'],
        buttonText: 'Mua Ngay',
        buttonVariant: 'primary',
        popular: true
      }
    ]
  };

  const features = [
    { name: 'Tự động trả lời comment và video', free: '✓', livechat: '✓', chatbot: '✓', chatbotai: '✓' },
    { name: 'Tự động tin nhắn hàng loạt cuộc khách', free: '✓', livechat: '✓', chatbot: '✓', chatbotai: '✓' },
    { name: 'Livechat đa kênh ®', free: '-', livechat: '✓', chatbot: '✓', chatbotai: '✓' },
    { name: 'Google Sheets ®', free: '1', livechat: '1', chatbot: '✓', chatbotai: '✓' },
    { name: 'Kiểm tra Popup', free: '1', livechat: '1', chatbot: '✓', chatbotai: '✓' },
    { name: 'User Input - Nút nhập từ ®', free: '1', livechat: '1', chatbot: '✓', chatbotai: '✓' },
    { name: 'Webform - form đăng ký', free: '1', livechat: '1', chatbot: '✓', chatbotai: '✓' },
    { name: 'AMT - api mua hàng nông cộng', free: '1', livechat: '-', chatbot: '✓', chatbotai: '✓' },
    { name: 'SMIT - hàng web có giỏ hàng', free: '1', livechat: '-', chatbot: '✓', chatbotai: '✓' },
    { name: 'Link ref', free: '10', livechat: '10', chatbot: '✓', chatbotai: '✓' },
    { name: 'QR Code', free: '10', livechat: '10', chatbot: '✓', chatbotai: '✓' },
    { name: 'Socks tin nhắn', free: '10', livechat: '10', chatbot: '✓', chatbotai: '✓' },
    { name: 'Dòng tin nhắn', free: '5', livechat: '5', chatbot: '✓', chatbotai: '✓' },
    { name: 'Keyword ®', free: '1', livechat: '1', chatbot: '✓', chatbotai: '✓' },
    { name: 'Discounts ®', free: '1', livechat: '1', chatbot: '✓', chatbotai: '✓' },
    { name: 'Chăm dịch ®', free: '5', livechat: '5', chatbot: '✓', chatbotai: '✓' },
  ];

  const additionalServices = [
    { name: '+1 Page', duration: 'Thêm', price: '20K', period: 'Tháng' },
    { name: '+1 Tài khoản Nhân viên', duration: 'Thêm', price: '20K', period: 'Tháng' },
    { name: '+3,000 Cuộc trò chuyện Thêm', duration: 'Thêm', price: '150K', period: 'Tháng' },
    { name: '+500 Liên hệ', duration: 'Thêm', price: '40K', period: 'Tháng' },
    { name: '+2 API CHATGPT', duration: 'Thêm', price: '1,500K', period: 'Năm' },
    { name: '+1,000 Aura', duration: 'Thêm', price: '80K', period: 'Tháng' },
  ];

  // Handle buy button click
  const handleBuyClick = (plan) => {
    if (!isAuthenticated) {
      alert('Vui lòng đăng nhập để mua gói dịch vụ');
      return;
    }

    // Map plan data to order format
    const orderData = {
      name: plan.badge,
      pages: plan.pages === '∞' ? 999 : parseInt(plan.pages),
      customers: parseInt(plan.conversations.replace(/,/g, '')),
      duration: plan.period
    };

    // Navigate to order page with selected package data
    navigate('/order', { state: { selectedPackage: orderData } });
  };

  return (
    <div className="sp-page-wrapper">
      {/* Hero Section */}
      <section className="sp-hero">
        <div className="sp-hero-content">
          <h1 className="sp-hero-title">BẢNG GIÁ PHẦN MỀM FCHAT</h1>
          <p className="sp-hero-subtitle">
            Fchat Miễn Phí Trọn Đời! Bạn chỉ trả tiền khi thấy hiệu quả!
          </p>
          <p className="sp-hero-description">
            Bạn sẽ được tặng thêm 30 ngày để sử dụng thử!
          </p>
          <button className="sp-hero-cta">Dùng thử</button>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="sp-pricing">
        <div className="sp-container">
          {/* Tab Navigation */}
          <div className="sp-tabs">
            <button
              className={`sp-tab-btn ${activeTab === '3months' ? 'sp-tab-active' : ''}`}
              onClick={() => setActiveTab('3months')}
            >
              3 Tháng
            </button>
            <button
              className={`sp-tab-btn ${activeTab === '1year' ? 'sp-tab-active' : ''}`}
              onClick={() => setActiveTab('1year')}
            >
              {/* <Check size={16} className="sp-tab-check" /> */}
              1 Năm
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="sp-cards-grid">
            {pricingPlans[activeTab].map((plan, index) => (
              <div
                key={index}
                className={`sp-card ${plan.popular ? 'sp-card-popular' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`sp-badge sp-badge-${plan.badgeColor}`}>
                  {plan.badge}
                </div>
                
                <div className="sp-card-header">
                  <h3 className="sp-card-name">{plan.name}</h3>
                  <div className="sp-card-price">
                    <span className="sp-price-value">{plan.price}</span>
                    <span className="sp-price-label">/ {plan.period}</span>
                  </div>
                </div>

                <div className="sp-card-stats">
                  <div className="sp-stat">
                    <span className="sp-stat-num">{plan.pages}</span>
                    <span className="sp-stat-text">Pages</span>
                  </div>
                </div>

                <div className="sp-card-features">
                  <div className="sp-feature">
                    <span className="sp-feature-text">{plan.conversations} Hội thoại</span>
                  </div>
                  <div className="sp-feature">
                    <span className="sp-feature-text">{plan.contacts} Khách hàng</span>
                  </div>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="sp-feature">
                      <span className="sp-feature-text">{feature}</span>
                    </div>
                  ))}
                </div>

                <button 
                  className={`sp-card-btn sp-btn-${plan.buttonVariant}`}
                  onClick={() => plan.buttonVariant === 'primary' ? handleBuyClick(plan) : null}
                >
                  {plan.buttonText}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison Table */}
      <section className="sp-features">
        <div className="sp-container">
          <h2 className="sp-section-title">TÍNH NĂNG</h2>
          <div className="sp-table-wrapper">
            <table className="sp-table">
              <thead>
                <tr>
                  <th className="sp-th-name"></th>
                  <th className="sp-th">FREE</th>
                  <th className="sp-th">LIVECHAT</th>
                  <th className="sp-th">CHATBOT</th>
                  <th className="sp-th">CHATBOT AI</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr key={index} className="sp-tr" style={{ animationDelay: `${index * 0.05}s` }}>
                    <td className="sp-td-name">{feature.name}</td>
                    <td className="sp-td">
                      {feature.free === '✓' ? <Check size={18} className="sp-check" /> : feature.free}
                    </td>
                    <td className="sp-td">
                      {feature.livechat === '✓' ? <Check size={18} className="sp-check" /> : feature.livechat}
                    </td>
                    <td className="sp-td">
                      {feature.chatbot === '✓' ? <Check size={18} className="sp-check" /> : feature.chatbot}
                    </td>
                    <td className="sp-td">
                      {feature.chatbotai === '✓' ? <Check size={18} className="sp-check" /> : feature.chatbotai}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="sp-services">
        <div className="sp-container">
          <h2 className="sp-section-title">MUA THÊM DỊCH VỤ CHO GÓI TRẢ PHÍ</h2>
          <div className="sp-services-grid">
            {additionalServices.map((service, index) => (
              <div
                key={index}
                className="sp-service-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="sp-service-name">{service.name}</div>
                <div className="sp-service-duration">{service.duration}</div>
                <div className="sp-service-price">
                  <span className="sp-service-amount">{service.price}</span>
                  <span className="sp-service-period">/ {service.period}</span>
                </div>
                <button className="sp-service-btn">MUA NGAY</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Usage Table */}
      <section className="sp-usage">
        <div className="sp-container">
          <h2 className="sp-section-title">Mức thêm dung lượng lưu trữ khách hàng</h2>
          <div className="sp-usage-wrapper">
            <table className="sp-usage-table">
              <thead>
                <tr>
                  <th className="sp-usage-th-name">Khách hàng</th>
                  <th className="sp-usage-th">5K</th>
                  <th className="sp-usage-th">10K</th>
                  <th className="sp-usage-th">20K</th>
                  <th className="sp-usage-th">30K</th>
                  <th className="sp-usage-th">50K</th>
                  <th className="sp-usage-th">100K</th>
                  <th className="sp-usage-th">Hơn nữa</th>
                </tr>
              </thead>
              <tbody>
                <tr className="sp-usage-tr">
                  <td className="sp-usage-td-name">Giá / tháng</td>
                  <td className="sp-usage-td">100</td>
                  <td className="sp-usage-td">150</td>
                  <td className="sp-usage-td">200</td>
                  <td className="sp-usage-td">300</td>
                  <td className="sp-usage-td">500</td>
                  <td className="sp-usage-td">1,000</td>
                  <td className="sp-usage-td">2,500</td>
                </tr>
                <tr className="sp-usage-tr">
                  <td className="sp-usage-td-name">Giá năm (Tiết kiệm)</td>
                  <td className="sp-usage-td">1,200</td>
                  <td className="sp-usage-td">1,800</td>
                  <td className="sp-usage-td">2,400</td>
                  <td className="sp-usage-td">3,600</td>
                  <td className="sp-usage-td">6,000</td>
                  <td className="sp-usage-td">12,000</td>
                  <td className="sp-usage-td">30,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ServicePackage;

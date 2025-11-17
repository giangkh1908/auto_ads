import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './ServicePackage.css';
import axiosInstance from '../../utils/axios';
import { toast } from 'sonner';

function ServicePackage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('3months');
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await axiosInstance.get(`/api/package?planType=${activeTab}`);
        const data = res.data;

        if (data.success) {
          setPackages(data.data);
        } else {
          console.error("Failed to load packages:", data.message);
          toast.error(data.message || "Không thể tải danh sách packages");
          setPackages([]);
        }
      } catch (e) {
        console.error("Load packages error:", e);
        toast.error("Lỗi khi tải danh sách packages");
        setPackages([]);
      }
    };

    fetchPackages();
  }, [activeTab]);

  // Handle buy button click
  const handleBuyClick = (plan) => {
    if (!isAuthenticated) {
      alert('Vui lòng đăng nhập để mua gói dịch vụ');
      return;
    }

    // Map plan data to order format
    const orderData = {
      name: plan.name,
      pages: plan.pages === '∞' ? 999 : parseInt(plan.pages),
      employees: plan.employees,
      customers: parseInt(plan.conversations.replace(/,/g, '')),
      packagePricing: plan.price,
      duration: plan.planType
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
              className={`sp-tab-btn ${activeTab === '12months' ? 'sp-tab-active' : ''}`}
              onClick={() => setActiveTab('12months')}
            >
              {/* <Check size={16} className="sp-tab-check" /> */}
              1 Năm
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="sp-cards-grid">
            {packages.map((plan, index) => (
              <div key={index} className="sp-card">
                <div className={`sp-badge sp-badge-blue`}>
                  {plan.name}
                </div>

                <div className="sp-card-header">
                  <h3 className="sp-card-name">{plan.name}</h3>
                  <div className="sp-card-price">
                    <span className="sp-price-value">{plan.price.toLocaleString()}đ</span>
                    <span className="sp-price-label">
                      {/* / {plan.planType === '3months' ? "Tháng" : "Năm"} */}
                      / Tháng
                    </span>
                  </div>
                </div>

                <div className="sp-card-stats">
                  <div className="sp-stat">
                    <span className="sp-stat-num">{plan.pages}</span>
                    <span className="sp-stat-text">Pages</span>
                  </div>
                </div>

                <div className="sp-card-features">
                  {/* <div className="sp-feature">
                    <span className="sp-feature-text">
                      {plan.conversations} Hội thoại
                    </span>
                  </div>

                  <div className="sp-feature">
                    <span className="sp-feature-text">
                      {plan.contacts} Khách hàng
                    </span>
                  </div> */}

                  <div className="sp-feature">
                    <span className="sp-feature-text">
                      {plan.pages} Pages
                    </span>
                  </div>

                  <div className="sp-feature">
                    <span className="sp-feature-text">
                      {plan.employees} Nhân viên
                    </span>
                  </div>

                  <div className="sp-feature">
                    <span className="sp-feature-text">
                      {plan.shops} Shop
                    </span>
                  </div>

                  {plan.features.map((f, i) => (
                    <div key={i} className="sp-feature">
                      <span className="sp-feature-text">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  className="sp-card-btn sp-btn-primary"
                  onClick={() => handleBuyClick(plan)}
                >
                  Mua Ngay
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison Table */}
      {/* <section className="sp-features">
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
      </section> */}

      {/* Additional Services */}
      {/* <section className="sp-services">
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
      </section> */}

      {/* Usage Table */}
      {/* <section className="sp-usage">
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
      </section> */}
    </div>
  );
}

export default ServicePackage;
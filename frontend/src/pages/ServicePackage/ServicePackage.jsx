import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../../hooks/auth/useAuth';
import { useTranslation } from 'react-i18next';
import './ServicePackage.css';
import axiosInstance from '../../utils/api/axios';
import { toast } from 'sonner';
import { getFeatureLabel } from '../../constants/app.constants';
import { useShopPackage } from '../../hooks/shop/useShopPackage';

function ServicePackage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { shopPkg } = useShopPackage();
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
          toast.error(data.message || t("servicePackage.messages.loadError"));
          setPackages([]);
        }
      } catch (e) {
        console.error("Load packages error:", e);
        toast.error(t("servicePackage.messages.loadErrorGeneric"));
        setPackages([]);
      }
    };

    fetchPackages();
  }, [activeTab, t]);

  // Check if a plan is the current shop owner's package
  const isCurrentPackage = (plan) => {
    if (!shopPkg || !shopPkg.package) return false;

    // So sánh tên gói (case-insensitive)
    const currentPackageName = shopPkg.package.name?.toLowerCase() || '';
    const planName = plan.name?.toLowerCase() || '';

    // So sánh planType (chuẩn hóa: "12months" = "1year")
    const currentPlanType = shopPkg.package.planType;
    const planPlanType = plan.planType;

    // Chuẩn hóa planType để so sánh
    const normalizePlanType = (pt) => {
      if (!pt) return null;
      if (pt === "1year" || pt === "12months") return "12months";
      if (pt === "3months") return "3months";
      return pt;
    };

    const normalizedCurrent = normalizePlanType(currentPlanType);
    const normalizedPlan = normalizePlanType(planPlanType);

    // So sánh cả name và planType
    return currentPackageName === planName && normalizedCurrent === normalizedPlan;
  };

  // Handle buy button click
  const handleBuyClick = (plan) => {
    if (!isAuthenticated) {
      toast.error(t("servicePackage.messages.loginRequired"));
      return;
    }

    // Không cho phép mua lại gói đang sử dụng
    if (isCurrentPackage(plan)) {
      toast.error(t("servicePackage.messages.alreadyUsing"));
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
          <h1 className="sp-hero-title">{t("servicePackage.title")}</h1>
          <p className="sp-hero-subtitle">
            {t("servicePackage.subtitle")}
          </p>
          {shopPkg?.package ? (
            <p style={{ marginTop: '20px' }}>
              Bạn đang sử dụng gói <strong>{shopPkg.package.name}</strong> | Thời hạn: <strong>{shopPkg.package.planType === '3months' ? '3 tháng' : shopPkg.package.planType === '12months' ? '1 năm' : 'N/A'}</strong>
            </p>
          ) : (
            <p style={{ marginTop: '20px' }}>
              Chưa có gói
            </p>
          )}
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
              {t("servicePackage.tabs.3months")}
            </button>
            <button
              className={`sp-tab-btn ${activeTab === '12months' ? 'sp-tab-active' : ''}`}
              onClick={() => setActiveTab('12months')}
            >
              1 Năm <span className="sp-tab-discount">-33%</span>
            </button>
          </div>

          {/* Pricing Cards */}
          <div className="sp-cards-grid">
            {packages.map((plan, index) => {
              // Xác định badge class dựa trên tên package
              const getBadgeClass = (packageName) => {
                if (!packageName) return 'sp-badge-purple';
                const name = packageName.toLowerCase();
                if (name.includes('chatbot ai')) return 'sp-badge-chatbot-ai';
                if (name.includes('chatbot')) return 'sp-badge-chatbot';
                return 'sp-badge-purple';
              };

              return (
                <div key={index} className="sp-card">
                  <div className={`sp-badge ${getBadgeClass(plan.name)}`}>
                    {plan.name}
                  </div>

                  <div className="sp-card-header">
                    <h3 className="sp-card-name">{plan.name}</h3>
                    <div className="sp-card-price">
                      <span className="sp-price-value">{plan.price.toLocaleString()}đ</span>
                      <span className="sp-price-label">
                        {plan.planType === '3months' ? t("servicePackage.price.perMonth") : t("servicePackage.price.perMonth")}
                      </span>
                    </div>
                  </div>

                  <div className="sp-card-stats">
                    <div className="sp-stat">
                      <span className="sp-stat-num">{plan.pages}</span>
                      <span className="sp-stat-text">{t("servicePackage.stats.pages")}</span>
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
                        {plan.pages} {t("servicePackage.stats.pages")}
                      </span>
                    </div>

                    <div className="sp-feature">
                      <span className="sp-feature-text">
                        {plan.employees} {t("servicePackage.stats.employees")}
                      </span>
                    </div>

                    <div className="sp-feature">
                      <span className="sp-feature-text">
                        {plan.shops} {t("servicePackage.stats.shops")}
                      </span>
                    </div>

                    {plan.features.map((f, i) => (
                      <div key={i} className="sp-feature">
                        <span className="sp-feature-text">{getFeatureLabel(f)}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className={`sp-card-btn ${isCurrentPackage(plan) ? 'sp-btn-disabled' : 'sp-btn-primary'}`}
                    onClick={() => handleBuyClick(plan)}
                  // disabled={isCurrentPackage(plan)}
                  >
                    {isCurrentPackage(plan) ? t("servicePackage.buttons.inUse") : t("servicePackage.buttons.buyNow")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default ServicePackage;
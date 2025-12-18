import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircle, Globe, Settings, ShoppingCart, DollarSign, Package, TrendingUp, Users, Briefcase, Calendar, Megaphone,
  MessageSquare, Reply, Bell, Key, List, ShoppingBag, Truck, Play, Mail, ArrowRight, Sparkles, Phone, User,
} from "lucide-react";
import "./Home.css";
import laptop_white from "../../assets/home/macbook-white.png";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/auth/useAuth";
import { ROUTES } from "../../constants/app.constants";
import leadService from "../../services/leads/leadService";
import { useToast } from "../../hooks/common/useToast";
import shop_icon from "../../assets/home/shop.png";
import meta_icon from "../../assets/home/meta.png";
import website_icon from "../../assets/home/AAMS_2.png";
import tryai_icon from "../../assets/home/chatbot.png";
import review_1 from "../../assets/home/review_1.png";
import review_2 from "../../assets/home/review_2.png";
import review_3 from "../../assets/home/review_3.png";
import review_4 from "../../assets/home/review_4.png";
import review_5 from "../../assets/home/review_5.png";
import review_6 from "../../assets/home/review_6.png";
import review_7 from "../../assets/home/review_7.png";
import review_8 from "../../assets/home/review_8.png";
import review_9 from "../../assets/home/review_9.png";

function Home({ onLoginClick }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  // Format phone number (Vietnamese format: 0xxx xxx xxx or +84xxx xxx xxx)
  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, "");

    // Limit to 11 digits (for Vietnamese phone numbers)
    const limitedNumber = phoneNumber.slice(0, 11);

    // Format: 0xxx xxx xxx
    if (limitedNumber.length <= 4) {
      return limitedNumber;
    } else if (limitedNumber.length <= 7) {
      return `${limitedNumber.slice(0, 4)} ${limitedNumber.slice(4)}`;
    } else {
      return `${limitedNumber.slice(0, 4)} ${limitedNumber.slice(4, 7)} ${limitedNumber.slice(7)}`;
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    if (!name.trim() || !phone.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setIsSubmitting(true);

    try {
      // Remove spaces from phone for API call
      const phoneNumber = phone.replace(/\s/g, "");

      const response = await leadService.createLead({
        lead_name: name.trim(),
        phone: phoneNumber,
      });

      if (response.success) {
        toast.success(
          response.message || "Đăng ký tư vấn thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất."
        );
        // Reset form
        setName("");
        setPhone("");
      } else {
        toast.error(response.message || "Có lỗi xảy ra khi đăng ký");
      }
    } catch (error) {
      const errorMessage = error.message || "Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleButtonClick = () => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD);
    } else {
      onLoginClick();
    }
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                {t("home.hero_title")}
              </h1>
              <p className="hero-description">
                {t("home.hero_description")}
              </p>
              {!user?.internal_role && (
                <button className="cta-button-home" onClick={handleButtonClick}>
                  {isAuthenticated && user?.avatar && (
                    <img
                      src={user.avatar}
                      alt={user?.full_name || "Avatar"}
                      className="cta-avatar"
                    />
                  )}
                  {isAuthenticated ? (
                    <span>SỬ DỤNG NGAY</span>
                  ) : (
                    <span>{t("home.get_started")}</span>
                  )}
                  {/* <ArrowRight size={20} /> */}
                </button>
              )}
            </div>
            <div className="hero-visual">
              <img
                src={laptop_white}
                alt="Modern laptop computer displaying chatbot dashboard - Vincent Tint on Unsplash"
                className="laptop-mockup"
              />
              <iframe
                className="youtube-video"
                src="https://www.youtube.com/embed/9U53xR0fhqI"
                title="Video Trailer"
                allow="autoplay; encrypted-media"
              ></iframe>
            </div>
          </div>
        </div>
        <div className="wave-divider">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
          </svg>
        </div>
      </section>

      {/* Platform Integration Section */}
      <section className="platform-section">
        <div className="container">
          <h2 className="section-title">{t("home.platform_title")}</h2>
          <p className="section-subtitle">
            {t("home.platform_subtitle")}
          </p>
          <div className="platform-grid">
            <div className="platform-card">
              <div className="platform-icon shop">
                <img
                  src={shop_icon}
                  alt="Shop"
                  className="platform-icon-image"
                />
              </div>
              <h3>{t("platforms.shop")}</h3>
            </div>
            <div className="platform-card">
              <div className="platform-icon meta">
                <img
                  src={meta_icon}
                  alt="Meta"
                  className="platform-icon-image"
                />
              </div>
              <h3>{t("platforms.meta")}</h3>
            </div>
            <div className="platform-card">
              <div className="platform-icon website">
                <img
                  src={website_icon}
                  alt="Website"
                  className="platform-icon-image"
                />
              </div>
              <h3>{t("platforms.website")}</h3>
            </div>
            <div className="platform-card">
              <div className="platform-icon tryai">
                <img
                  src={tryai_icon}
                  alt="AI Chatbot"
                  className="platform-icon-image"
                />
              </div>
              <h3>{t("platforms.tryai")}</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Chatbot Templates Section */}
      <section className="templates-section">
        <div className="container">
          <h2 className="section-title">{t("home.templates_title")}</h2>
          <p className="section-subtitle">
            {t("home.templates_subtitle")}
          </p>
          <div className="templates-grid">
            <div className="template-card">
              <div className="template-icon">
                <ShoppingCart size={28} />
              </div>
              <h4>{t("home.buy_product")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <DollarSign size={28} />
              </div>
              <h4>{t("home.recharge")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Package size={28} />
              </div>
              <h4>{t("home.order_tracking")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <TrendingUp size={28} />
              </div>
              <h4>{t("home.sales_capability")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Users size={28} />
              </div>
              <h4>{t("home.sales_consulting")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Briefcase size={28} />
              </div>
              <h4>{t("home.recruitment")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Calendar size={28} />
              </div>
              <h4>{t("home.booking")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Sparkles size={28} />
              </div>
              <h4>{t("home.viral")}</h4>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <ShoppingBag size={28} />
              </div>
              <h4>{t("home.order_management")}</h4>
            </div>
          </div>
          <p className="templates-footer">{t("home.templates_footer")}</p>
        </div>
      </section>

      {/* Automation Features Section */}
      {/* <section className="automation-section">
        <div className="container">
          <h2 className="section-title">
            {t("home.automation_title")}
          </h2>
          <p className="section-subtitle">
            {t("home.automation_subtitle")}
          </p>
          <div className="automation-grid">
            <div className="automation-card">
              <div className="automation-icon">
                <Megaphone size={32} />
              </div>
              <h4>{t("home.campaign")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <MessageSquare size={32} />
              </div>
              <h4>{t("home.livechat")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Reply size={32} />
              </div>
              <h4>{t("home.auto_reply")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Bell size={32} />
              </div>
              <h4>{t("home.reminder")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Key size={32} />
              </div>
              <h4>{t("home.keyword")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <List size={32} />
              </div>
              <h4>{t("home.sequence")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <ShoppingBag size={32} />
              </div>
              <h4>{t("home.order")}</h4>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Truck size={32} />
              </div>
              <h4>{t("home.shipping")}</h4>
            </div>
          </div>
        </div>
      </section> */}

      {/* Mini Game Promotion Section */}
      <section className="minigame-section">
        <div className="container">
          <h2 className="section-title">
            {t("home.minigame_title")}
          </h2>
          <p className="section-subtitle">
            {t("home.minigame_subtitle")}
          </p>
          <div className="minigame-carousel">
            <div className="carousel-track">
              <div className="minigame-card">
                <img
                  src={review_1}
                  alt="Dashboard Screen 1"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_2}
                  alt="Dashboard Screen 2"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_3}
                  alt="Dashboard Screen 3"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_4}
                  alt="Dashboard Screen 4"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_5}
                  alt="Dashboard Screen 5"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_6}
                  alt="Dashboard Screen 6"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_7}
                  alt="Dashboard Screen 7"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_8}
                  alt="Dashboard Screen 8"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src={review_9}
                  alt="Dashboard Screen 9"
                  className="minigame-image"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial Videos Section */}
      <section className="tutorial-section">
        <div className="container">
          <h2 className="section-title">{t("home.tutorial_title")}</h2>
          <p className="section-subtitle">
            {t("home.tutorial_subtitle")}
          </p>
          <div className="tutorial-grid">
            <div className="tutorial-card">
              <div className="tutorial-thumbnail">
                <img
                  src="https://images.unsplash.com/photo-1636819488524-1f019c4e1c44?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw3fHxjaGF0Ym90JTIwcm9ib3QlMjB0ZWNobm9sb2d5JTIwdHV0b3JpYWwlMjBlZHVjYXRpb258ZW58MHwwfHxibHVlfDE3NjAwMTEyMjN8MA&ixlib=rb-4.1.0&q=85"
                  alt="Chatbot tutorial - Andy Hermawan on Unsplash"
                />
                <div className="play-button">
                  <Play size={32} fill="white" />
                </div>
              </div>
            </div>
            <div className="tutorial-card">
              <div className="tutorial-thumbnail">
                <img
                  src="https://images.unsplash.com/photo-1617791160588-241658c0f566?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwzfHx0dXRvcmlhbCUyMHNldHVwJTIwaW50ZXJmYWNlJTIwY29sb3JmdWwlMjBndWlkZXxlbnwwfDB8fHB1cnBsZXwxNzYwMDExMjI3fDA&ixlib=rb-4.1.0&q=85"
                  alt="Setup tutorial - Milad Fakurian on Unsplash"
                />
                <div className="play-button">
                  <Play size={32} fill="white" />
                </div>
              </div>
            </div>
            <div className="tutorial-card">
              <div className="tutorial-thumbnail">
                <img
                  src="https://images.unsplash.com/photo-1656821991475-86b1b2ba3c32?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwxfHxnaWZ0cyUyMHNhbGVzJTIwYXV0b21hdGlvbiUyMGNvbG9yZnVsJTIwdHV0b3JpYWx8ZW58MHwwfHxyZWR8MTc2MDAxMTIyOXww&ixlib=rb-4.1.0&q=85"
                  alt="Sales automation tutorial - Scarlett Alt on Unsplash"
                />
                <div className="play-button">
                  <Play size={32} fill="white" />
                </div>
              </div>
            </div>
            <div className="tutorial-card">
              <div className="tutorial-thumbnail">
                <img
                  src="https://images.unsplash.com/photo-1657192809008-729aa92d1228?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwzfHxnYW1lJTIwd2hlZWwlMjBwcml6ZXMlMjBjZWxlYnJhdGlvbiUyMGNvbG9yZnVsfGVufDB8MHx8b3JhbmdlfDE3NjAwMTEyMjh8MA&ixlib=rb-4.1.0&q=85"
                  alt="Game features tutorial - Maxim Berg on Unsplash"
                />
                <div className="play-button">
                  <Play size={32} fill="white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration CTA Section */}
      <section className="registration-section">
        <div className="container">
          <h2 className="section-title">
            {t("home.registration_title")}
          </h2>
          <p className="section-subtitle">
            {t("home.registration_subtitle")}
          </p>
          <form className="home-registration-form" onSubmit={handleSubmit}>
            <div className="home-form-row">
              <div className="home-form-group">
                <input
                  type="text"
                  placeholder={t("home.name_placeholder")}
                  value={name}
                  onChange={handleNameChange}
                  required={true}
                  maxLength={200}
                />
              </div>
              <div className="home-form-group">
                <input
                  type="tel"
                  placeholder={t("home.phone_placeholder")}
                  value={phone}
                  onChange={handlePhoneChange}
                  required={true}
                  maxLength={13}
                  pattern="[0-9\s]{10,13}"
                />
              </div>
            </div>
            <button
              type="submit"
              className="submit-button-home"
              disabled={isSubmitting}
            >
              <Phone size={20} />
              <span>{isSubmitting ? t("home.submitting") : t("home.call_me")}</span>
            </button>
          </form>
        </div>
        <div className="wave-divider bottom">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
          </svg>
        </div>
      </section>
    </div>
  );
}

export default Home;

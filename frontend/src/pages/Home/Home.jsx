import { useState } from "react";
import { MessageCircle, Globe, Settings,ShoppingCart,DollarSign,Package,TrendingUp,Users,Briefcase,Calendar,Megaphone,
        MessageSquare,Reply,Bell,Key,List,ShoppingBag,Truck,Play,Mail,ArrowRight,Sparkles,
} from "lucide-react";
import "./Home.css";
import laptop_white from "../../assets/macbook-white.png";
import { useTranslation } from "react-i18next";
function Home({ onLoginClick }) {
  const [email, setEmail] = useState("");
  const { t } = useTranslation();

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Email submitted:", email);
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
              <button className="cta-button-home" onClick={onLoginClick}>
                <span>{t("home.get_started")}</span>
                <ArrowRight size={20} />
              </button>
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
              <div className="platform-icon messenger">
                <MessageCircle size={32} />
              </div>
              <h3>{t("home.messenger")}</h3>
            </div>
            <div className="platform-card">
              <div className="platform-icon zalo">
                <MessageSquare size={32} />
              </div>
              <h3>{t("home.zalo")}</h3>
            </div>
            <div className="platform-card">
              <div className="platform-icon website">
                <Globe size={32} />
              </div>
              <h3>{t("home.website")}</h3>
            </div>
            <div className="platform-card">
              <div className="platform-icon tryai">
                <Settings size={32} />
              </div>
              <h3>{t("home.tryai")}</h3>
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
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <DollarSign size={28} />
              </div>
              <h4>{t("home.recharge")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Package size={28} />
              </div>
              <h4>{t("home.order_tracking")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <TrendingUp size={28} />
              </div>
              <h4>{t("home.sales_capability")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Users size={28} />
              </div>
              <h4>{t("home.sales_consulting")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Briefcase size={28} />
              </div>
              <h4>{t("home.recruitment")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Calendar size={28} />
              </div>
              <h4>{t("home.booking")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <Sparkles size={28} />
              </div>
              <h4>{t("home.viral")}</h4>
              <p>{t("home.sales")}</p>
            </div>
            <div className="template-card">
              <div className="template-icon">
                <ShoppingBag size={28} />
              </div>
              <h4>{t("home.order_management")}</h4>
              <p>{t("home.sales")}</p>
            </div>
          </div>
          <p className="templates-footer">{t("home.templates_footer")}</p>
        </div>
      </section>

      {/* Automation Features Section */}
      <section className="automation-section">
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
              <p>{t("home.campaign_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <MessageSquare size={32} />
              </div>
              <h4>{t("home.livechat")}</h4>
              <p>{t("home.livechat_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Reply size={32} />
              </div>
              <h4>{t("home.auto_reply")}</h4>
              <p>{t("home.auto_reply_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Bell size={32} />
              </div>
              <h4>{t("home.reminder")}</h4>
              <p>{t("home.reminder_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Key size={32} />
              </div>
              <h4>{t("home.keyword")}</h4>
              <p>{t("home.keyword_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <List size={32} />
              </div>
              <h4>{t("home.sequence")}</h4>
              <p>{t("home.sequence_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <ShoppingBag size={32} />
              </div>
              <h4>{t("home.order")}</h4>
              <p>{t("home.order_desc")}</p>
            </div>
            <div className="automation-card">
              <div className="automation-icon">
                <Truck size={32} />
              </div>
              <h4>{t("home.shipping")}</h4>
              <p>{t("home.shipping_desc")}</p>
            </div>
          </div>
        </div>
      </section>

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
                  src="https://images.unsplash.com/photo-1663153204573-1e6581da098f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwyfHxzbWFydHBob25lJTIwbW9iaWxlJTIwZ2FtZSUyMGNvbG9yZnVsJTIwYXBwfGVufDB8MXx8fDE3NjAwMTEyMjN8MA&ixlib=rb-4.1.0&q=85"
                  alt="Mobile game interface - Typerium App on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1591783097660-037e0d08343b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw1fHxtb2JpbGUlMjBwaG9uZSUyMGdhbWUlMjBjb2xvcmZ1bCUyMHByaXplfGVufDB8MXx8cmVkfDE3NjAwMTEyMjN8MA&ixlib=rb-4.1.0&q=85"
                  alt="Colorful game screen - Rombo on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1588889243484-2cacf85b9b87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxzbWFydHBob25lJTIwZ2FtZSUyMHJld2FyZHMlMjBnaWZ0cyUyMGNvbG9yZnVsfGVufDB8MXx8cHVycGxlfDE3NjAwMTEyMjJ8MA&ixlib=rb-4.1.0&q=85"
                  alt="Game rewards interface - Batu Gezer on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1619241638225-14d56e47ae64?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxtb2JpbGUlMjBnYW1lJTIwd2hlZWwlMjBwcml6ZXMlMjBjZWxlYnJhdGlvbnxlbnwwfDF8fG9yYW5nZXwxNzYwMDExMjIyfDA&ixlib=rb-4.1.0&q=85"
                  alt="Lucky wheel game - Tangerine Newt on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1663153204573-1e6581da098f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwyfHxzbWFydHBob25lJTIwbW9iaWxlJTIwZ2FtZSUyMGNvbG9yZnVsJTIwYXBwfGVufDB8MXx8fDE3NjAwMTEyMjN8MA&ixlib=rb-4.1.0&q=85"
                  alt="Mobile game interface - Typerium App on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1591783097660-037e0d08343b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw1fHxtb2JpbGUlMjBwaG9uZSUyMGdhbWUlMjBjb2xvcmZ1bCUyMHByaXplfGVufDB8MXx8cmVkfDE3NjAwMTEyMjN8MA&ixlib=rb-4.1.0&q=85"
                  alt="Colorful game screen - Rombo on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1588889243484-2cacf85b9b87?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxzbWFydHBob25lJTIwZ2FtZSUyMHJld2FyZHMlMjBnaWZ0cyUyMGNvbG9yZnVsfGVufDB8MXx8cHVycGxlfDE3NjAwMTEyMjJ8MA&ixlib=rb-4.1.0&q=85"
                  alt="Game rewards interface - Batu Gezer on Unsplash"
                  className="minigame-image"
                />
              </div>
              <div className="minigame-card">
                <img
                  src="https://images.unsplash.com/photo-1619241638225-14d56e47ae64?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxtb2JpbGUlMjBnYW1lJTIwd2hlZWwlMjBwcml6ZXMlMjBjZWxlYnJhdGlvbnxlbnwwfDF8fG9yYW5nZXwxNzYwMDExMjIyfDA&ixlib=rb-4.1.0&q=85"
                  alt="Lucky wheel game - Tangerine Newt on Unsplash"
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
            <div className="home-form-group">
              <Mail className="input-icon" size={20} />
              <input
                type="email"
                placeholder= {t("home.email_placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={true}
              />
            </div>
            <button type="submit" className="submit-button-home">{t("home.contact_me")}</button>
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

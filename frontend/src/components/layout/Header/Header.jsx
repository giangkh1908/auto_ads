import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../hooks/useAuth";
import shopService from "../../../services/shopService";
import "./Header.css";
import avatar from "../../../assets/home.jpg";
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Store,
  Package,
  BookOpen,
  Gem,
} from "lucide-react";
import logo_1 from "../../../assets/Logo_Fchat.png";
import logo_2 from "../../../assets/Logo_Fchat_2.png";

function Header({ onLoginClick }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const [openMenu, setOpenMenu] = useState(null); //"avatar", "user" || null
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const viFlag = "https://flagcdn.com/w40/vn.png";
  const enFlag = "https://flagcdn.com/w40/us.png";

  //Set màu sắc của header khi cuộn
  useEffect(() => {
    const isHome = pathname === "/";
    if (!isHome) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  // Đóng dropdown khi chuyển trang
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        openMenu &&
        !event.target.closest(".user-menu") &&
        !event.target.closest(".dropdown-language")
      ) {
        setOpenMenu(null);
      }
    };

    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu]);

  // Fetch danh sách shops
  useEffect(() => {
    const fetchShops = async () => {
      if (isAuthenticated && user) {
        try {
          const response = await shopService.getMyShops();

          if (response?.items && response.items.length > 0) {
            setShops(response.items);
            // Lấy shop đã lưu hoặc chọn shop đầu tiên
            const savedShopId = localStorage.getItem("selectedShopId");
            const shopToSelect = savedShopId
              ? response.items.find((s) => s._id === savedShopId)
              : response.items[0];
            if (shopToSelect) {
              setSelectedShop(shopToSelect);
            }
          }
        } catch (error) {
          console.error("Error fetching shops:", error);
        }
      }
    };
    fetchShops();
  }, [isAuthenticated, user]);

  //Click để mở dropdown
  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  //Click để đổi ngôn ngữ
  const handleLanguageChange = (language) => {
    i18n.changeLanguage(language);
    toggleMenu("language");
  };

  return (
    <header className={`app-header ${isScrolled ? "scrolled" : ""}`}>
      <div className="header-content">
        {/* Logo */}
        <button onClick={() => navigate("/")}>
          <h1 className="app-title">
            <img
              className="app-name"
              src={isScrolled ? logo_2 : logo_1}
              alt="Logo"
            />
          </h1>
        </button>

        {/* Nav khi không ở Home*/}
        {pathname !== "/" && (
          <div className="app-nav">
            <button
              className={`nav-btn ${pathname === "/dashboard" ? "active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              <LayoutDashboard size={18} />
              &nbsp;{t("header.dashboard")}
            </button>

            <button
              className={`nav-btn ${
                pathname === "/account-management" ? "active" : ""
              }`}
              onClick={() => navigate("/account-management")}
            >
              <Megaphone size={18} />
              &nbsp;{t("header.facebook_ads")}
            </button>

            <button
              className={`nav-btn ${pathname === "/analytics" ? "active" : ""}`}
              onClick={() => navigate("/analytics")}
            >
              <BarChart3 size={18} />
              &nbsp;{t("header.analytics")}
            </button>

            <button
              className={`nav-btn ${
                pathname.startsWith("/shop") ? "active" : ""
              }`}
              onClick={() => navigate("/shop")}
            >
              <Store size={18} />
              &nbsp;{t("header.shop")}
            </button>

            <button
              className={`nav-btn ${pathname === "/service-package" ? "active" : ""}`}
              onClick={() => navigate("/service-package")}
            >
              <Package size={18} />
              &nbsp;{t("header.package")}
            </button>
          </div>
        )}

        {/* Nav 2 khi ở Home*/}
        {pathname === "/" && (
          <div className="app-nav-2">
            <button
              className={`nav-btn-2 ${pathname === "/guide" ? "active" : ""}`}
              onClick={() => navigate("/guide")}
            >
              <BookOpen size={20} />
              &nbsp;{t("header.guide")}
            </button>

            <button
              className={`nav-btn-2 ${
                pathname === "/service-package" ? "active" : ""
              }`}
              onClick={() => navigate("/service-package")}
            >
              <Gem size={20} />
              &nbsp;{t("header.service")}
            </button>

            {isAuthenticated && (
              <button
                className={`nav-btn-2 ${
                  pathname === "/dashboard" ? "active" : ""
                }`}
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard size={20} />
                &nbsp;{t("header.dashboard")}
              </button>
            )}
          </div>
        )}

        {/* Avatar, Tên shop và Ngôn ngữ */}
        <div className="header-actions">
          {/* Hiển thị nút chuyển ngữ */}
          <div className="language-wrapper">
            <button
              className="btn-language"
              onClick={() => toggleMenu("language")}
            >
              <img src={i18n.language === "vi" ? viFlag : enFlag} alt="flag" />
            </button>
            {openMenu === "language" && (
              <ul className="dropdown-language">
                <li onClick={() => handleLanguageChange("vi")}>
                  <img src={viFlag} alt="Vietnamese" />{" "}
                  {t("header.languages.vi")}
                </li>
                <li onClick={() => handleLanguageChange("en")}>
                  <img src={enFlag} alt="English" /> {t("header.languages.en")}
                </li>
              </ul>
            )}
          </div>
          {/* Chỉ hiển thị menu user khi đã login và KHÔNG ở trang Home */}
          {isAuthenticated && pathname !== "/" && (
            <div className="user-menu">
              {/* Tên + Dropdown menu */}
              <div className="user-greeting-wrapper">
                <span
                  className="user-greeting"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleMenu("shop")}
                >
                  <strong className="user-name-header">
                    {user?.full_name}
                  </strong>
                  <p className="user-name-header-role">
                    STARTER | Onwer{user?.role}
                  </p>
                </span>
                {openMenu === "shop" && (
                  <div className="dropdown-shop">
                    <div className="dropdown-shop-header">
                      <div className="dropdown-shop-list">
                        {shops.length === 0 ? (
                          <div className="dropdown-shop-empty">
                            Chưa có shop
                          </div>
                        ) : (
                          shops.map((shop) => (
                            <div
                              key={shop._id}
                              className={`dropdown-shop-item ${
                                selectedShop?._id === shop._id ? "active" : ""
                              }`}
                              onClick={() => {
                                setSelectedShop(shop);
                                localStorage.setItem(
                                  "selectedShopId",
                                  shop._id
                                );
                              }}
                            >
                              <div className="shop-item-info">
                                <div className="shop-item-name">
                                  {shop.shop_name}
                                </div>
                              </div>
                              {selectedShop?._id === shop._id && (
                                <span className="shop-item-check">✓</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <button
                      className="btn-manage-shop"
                      onClick={() => {
                        navigate("/shop");
                        setOpenMenu(null);
                      }}
                    >
                      Quản lý shop
                    </button>
                  </div>
                )}
              </div>

              {/* Avatar + dropdown */}
              <div className="avatar-wrapper">
                <img
                  src={user?.avatar || avatar}
                  alt="avatar"
                  className="avatar"
                  onClick={() => toggleMenu("avatar")}
                />
                {openMenu === "avatar" && (
                  <div className="dropdown-avatar">
                    <div className="dropdown-infor-avatar">
                      <b>{user?.full_name}</b>
                      <small>
                        FB ID: {user?.facebookId}
                        <br />
                        Email: {user?.email}
                      </small>
                    </div>
                    <div className="dropdown-option-avatar">
                      <li onClick={() => navigate("/profile")}>
                        {t("header.profile")}
                      </li>
                      <li onClick={logout}>{t("header.logout")}</li>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chỉ hiển thị nút Đăng nhập nếu CHƯA đăng nhập và ở Home */}
          {!isAuthenticated && pathname === "/" && (
            <button className="btn-login" onClick={onLoginClick}>
              {t("header.login")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
export default Header;

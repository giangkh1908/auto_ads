import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../hooks/useAuth";
import { useAdminRole } from "../../../hooks/useAdminRole";
import "./AdminHeader.css";
import avatar from "../../../assets/no-avatar.jpg";
import logo_1 from "../../../assets/Logo_Fchat.png";
// import logo_2 from "../../../assets/Logo_Fchat_2.png";

function AdminHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation("admin");
  const { user, logout } = useAuth();
  const { internalRole, tabs } = useAdminRole();
  const [openMenu, setOpenMenu] = useState(null); // "avatar", "language" || null

  const viFlag = "https://flagcdn.com/w40/vn.png";
  const enFlag = "https://flagcdn.com/w40/us.png";

  // Đóng dropdown khi chuyển trang
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        openMenu &&
        !e.target.closest(".admin-user-menu") &&
        !e.target.closest(".admin-dropdown-language") &&
        !e.target.closest(".admin-dropdown-avatar")
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

  // Click để mở dropdown
  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setOpenMenu(null);
  };

  // Helper function to translate tab name based on path
  const getTranslatedTabName = (tabPath, tabName) => {
    const tabTranslationMap = {
      '/admin/cs-staff/leads': 'header.tabs.leads',
      '/admin/cs-staff/service-package': 'header.tabs.servicePackage',
      '/admin/cs-staff/payment': 'header.tabs.payment',
      '/admin/accountant/transactions': 'header.tabs.transactions',
      '/admin/accountant/reports': 'header.tabs.paymentReports',
      '/admin/system-admin/payment-management': 'header.tabs.paymentManagement',
      '/admin/system-admin/user-management': 'header.tabs.userManagement',
      '/admin/system-admin/system-monitoring': 'header.tabs.systemMonitoring',
    };
    
    const translationKey = tabTranslationMap[tabPath];
    return translationKey ? t(translationKey) : tabName;
  };

  return (
    <header className="admin-header">
      <div className="admin-header-content">
        {/* Logo */}
        <button className="admin-logo-btn" onClick={() => navigate("/")}>
          <h1 className="admin-app-title">
            <img
              className="admin-app-name"
              src={logo_1}
              alt="Logo"
            />
          </h1>
        </button>

        {/* Tabs Navigation */}
        {tabs && tabs.length > 0 && (
          <div className="admin-nav">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.path || pathname.startsWith(tab.path + "/");
              const translatedName = getTranslatedTabName(tab.path, tab.name);
              return (
                <button
                  key={tab.path}
                  className={`admin-nav-btn ${isActive ? "active" : ""}`}
                  onClick={() => navigate(tab.path)}
                >
                  <Icon size={18} />
                  &nbsp;{translatedName}
                </button>
              );
            })}
          </div>
        )}

        {/* Language selector và User info */}
        <div className="admin-header-actions">
          {/* Language selector */}
          <div className="admin-language-wrapper">
            <button
              className="admin-btn-language"
              onClick={() => toggleMenu("language")}
            >
              <img src={i18n.language === "vi" ? viFlag : enFlag} alt="flag" />
            </button>
            {openMenu === "language" && (
              <ul className="admin-dropdown-language">
                <li onClick={() => handleLanguageChange("vi")}>
                  <img src={viFlag} alt="Vietnamese" />{" "}
                  {t("translation:header.languages.vi")}
                </li>
                <li onClick={() => handleLanguageChange("en")}>
                  <img src={enFlag} alt="English" /> {t("translation:header.languages.en")}
                </li>
              </ul>
            )}
          </div>

          {/* User info: full_name và internal_role */}
          {user && (
            <div className="admin-user-menu">
              {internalRole && (
                <div className="admin-user-info">
                  <strong className="admin-user-name">{user.full_name}</strong>
                  <span className="admin-user-role-badge">{internalRole}</span>
                </div>
              )}

              {/* Avatar + dropdown */}
              <div className="admin-avatar-wrapper">
                <img
                  src={user?.avatar || avatar}
                  alt="avatar"
                  className="admin-avatar"
                  onClick={() => toggleMenu("avatar")}
                />
                {openMenu === "avatar" && (
                  <div className="admin-dropdown-avatar">
                    <div className="admin-dropdown-infor-avatar">
                      <b>{user?.full_name}</b>
                      <small>
                        {t("header.role")}: {internalRole}
                        <br />
                        {t("header.email")}: {user?.email}
                      </small>
                    </div>
                    <div className="admin-dropdown-option-avatar">
                      <li onClick={() => navigate("/profile")}>
                        {t("translation:header.profile")}
                      </li>
                      <li onClick={logout}>{t("translation:header.logout")}</li>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;


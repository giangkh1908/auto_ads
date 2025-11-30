import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../hooks/useAuth";
import { STORAGE_KEYS, ROUTES } from "../../../constants/app.constants";
import { saveShopCache, getShopCache, clearShopCache, onShopChange } from "../../../utils/shopCache";
import "./Header.css";
import avatar from "../../../assets/no-avatar.jpg";
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Store,
  Package,
  BookOpen,
  Gem,
  ChevronDown,
  Check,
  Menu,
  X,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

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
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        openMenu &&
        !e.target.closest(".user-menu") &&
        !e.target.closest(".dropdown-language") &&
        !e.target.closest(".dropdown-shop")
      ) {
        setOpenMenu(null);
      }

      // Đóng mobile menu khi click ra ngoài
      if (
        isMobileMenuOpen &&
        !e.target.closest(".mobile-menu") &&
        !e.target.closest(".hamburger-btn")
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    if (openMenu || isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu, isMobileMenuOpen]);

  // FETCH SHOPS + TỰ ĐỘNG CHỌN SHOP HIỆN TẠI
  useEffect(() => {
    const fetchShops = async () => {
      if (!isAuthenticated || !user) {
        // Xóa cache nếu không authenticated
        clearShopCache();
        return;
      }

      try {
        setLoading(true);
        
        // Kiểm tra cache trước
        const cachedShop = getShopCache();
        const savedShopId = localStorage.getItem("selectedShopId");
        
        // Nếu có cache và shopId khớp → sử dụng cache
        if (cachedShop && cachedShop.id === savedShopId) {
          // Đảm bảo package là string hoặc null (không set "Basic")
          const packageName = typeof cachedShop.package === 'string' 
            ? cachedShop.package 
            : (cachedShop.package?.name || null);
          const normalizedShop = {
            ...cachedShop,
            package: packageName && packageName !== "Basic" ? packageName : null,
          };
          setSelectedShop(normalizedShop);
          setLoading(false);
          // Vẫn load danh sách shops để hiển thị dropdown, nhưng không cần đợi
          fetchShopsList();
          return;
        }

        // Nếu không có cache hoặc cache không khớp → load từ API
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/shops/owner`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const formattedShops = data.data.map((shop) => ({
            id: shop._id,
            shop_name: shop.shop_name || "Cửa hàng không tên",
            package: shop.package && shop.package !== "Basic" ? shop.package : null,
            role: shop.user_role?.role_name || "Member",
            is_current: shop.is_current || false,
          }));

          setShops(formattedShops);

          // ƯU TIÊN: shop đang chọn trong localStorage
          let currentShop = null;

          if (savedShopId) {
            currentShop = formattedShops.find((s) => s.id === savedShopId);
          }

          // Nếu không có → chọn shop có is_current: true
          if (!currentShop) {
            currentShop = formattedShops.find((s) => s.is_current);
          }

          // Nếu vẫn không có → chọn shop đầu tiên
          if (!currentShop && formattedShops.length > 0) {
            currentShop = formattedShops[0];
          }

          if (currentShop) {
            setSelectedShop(currentShop);
            localStorage.setItem("selectedShopId", currentShop.id);
            // Lưu vào cache
            saveShopCache(currentShop);
          }
        }
      } catch (err) {
        console.error("Lỗi tải shops:", err);
        // Xóa cache nếu có lỗi
        clearShopCache();
      } finally {
        setLoading(false);
      }
    };

    // Hàm load danh sách shops (không block UI)
    const fetchShopsList = async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/shops/owner`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const formattedShops = data.data.map((shop) => ({
            id: shop._id,
            shop_name: shop.shop_name || "Cửa hàng không tên",
            package: shop.package && shop.package !== "Basic" ? shop.package : null,
            role: shop.user_role?.role_name || "Member",
            is_current: shop.is_current || false,
          }));
          setShops(formattedShops);
        }
      } catch (err) {
        console.error("Lỗi tải danh sách shops:", err);
      }
    };

    fetchShops();
  }, [isAuthenticated, user]);

  // Lắng nghe sự kiện thay đổi shop từ MyShop hoặc các component khác
  useEffect(() => {
    const removeListener = onShopChange((newShop) => {
      if (newShop) {
        // Đảm bảo package là string hoặc null (không set "Basic")
        const packageName = typeof newShop.package === 'string' 
          ? newShop.package 
          : (newShop.package?.name || null);
        const normalizedShop = {
          ...newShop,
          package: packageName && packageName !== "Basic" ? packageName : null,
        };
        // Cập nhật shop hiển thị trong Header
        setSelectedShop(normalizedShop);
        // Cập nhật danh sách shops nếu cần
        setShops((prevShops) => {
          const updated = prevShops.map((s) =>
            s.id === newShop.id ? { ...s, ...newShop, is_current: true } : { ...s, is_current: false }
          );
          return updated;
        });
      } else {
        // Nếu shop bị xóa, reload lại
        setSelectedShop(null);
      }
    });

    return removeListener;
  }, []);

  //Click để mở dropdown
  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? null : menu);
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setOpenMenu(null);
  };

  const handleShopSelect = async (shop) => {
    if (!shop || switching) return; // Chống click liên tục

    // Nếu đang là shop hiện tại → chỉ đóng menu
    if (selectedShop?.id === shop.id) {
      setOpenMenu(null);
      return;
    }

    setSwitching(true);
    setOpenMenu(null);

    try {
      // Gọi API switch shop
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/shops/switch/${shop.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(
              STORAGE_KEYS.AUTH_TOKEN
            )}`,
          },
        }
      );

      const data = await res.json();

      if (data.success) {
        // Lấy shop cũ trước khi xóa cache
        const previousShop = selectedShop;
        
        // Xóa cache cũ
        clearShopCache();
        
        // Cập nhật localStorage
        localStorage.setItem("selectedShopId", shop.id);

        // Cập nhật state với package info từ API response
        // Đảm bảo package là string hoặc null (không set "Basic")
        const packageName = data.shop?.package?.name || data.shop?.package || shop.package || null;
        const finalPackageName = typeof packageName === 'string' 
          ? (packageName !== "Basic" ? packageName : null)
          : (packageName?.name && packageName.name !== "Basic" ? packageName.name : null);
        const shopWithPackage = {
          ...shop,
          package: finalPackageName,
        };
        setSelectedShop(shopWithPackage);
        
        // Lưu shop mới vào cache (bao gồm role và package)
        // Truyền previousShop để kiểm tra và xóa cache ads nếu shop thay đổi
        saveShopCache(shopWithPackage, previousShop);

        // Hiển thị thông báo đẹp (tùy bạn dùng toast/notify)
        if (window.showToast) {
          window.showToast?.(
            "success",
            `Đã chuyển sang cửa hàng: ${shop.shop_name}`
          );
        } else {
          // Fallback nhẹ nhàng
          console.log(`Switched to: ${shop.shop_name}`);
        }

        // Reload lại trang để cập nhật dữ liệu với shop mới
        window.location.reload();
      } else {
        // API lỗi → không đổi shop
        if (window.showToast) {
          window.showToast?.(
            "error",
            data.message || "Không thể chuyển cửa hàng"
          );
        } else {
          alert(data.message || "Không thể chuyển cửa hàng");
        }
      }
    } catch (err) {
      console.error("Switch shop error:", err);
      if (window.showToast) {
        window.showToast?.("error", "Lỗi kết nối server");
      } else {
        alert("Lỗi kết nối server");
      }
    } finally {
      setSwitching(false);
    }
  };

  const isFacebookAdsActive =
    pathname === ROUTES.ACCOUNT_MANAGEMENT ||
    pathname === ROUTES.ADS_MANAGEMENT ||
    pathname === ROUTES.ARCHIVE_ADS;

  return (
    <header className={`app-header ${isScrolled ? "scrolled" : ""}`}>
      {/* Overlay khi mobile menu mở */}
      {isMobileMenuOpen && (
        <div
          className={`mobile-menu-overlay ${isMobileMenuOpen ? "open" : ""}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="header-content">
        {/* Logo và Hamburger Menu Button */}
        <div className="logo-hamburger-group">
          {/* Hamburger Menu Button - chỉ hiển thị trên mobile */}
          <button
            className="hamburger-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

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
        </div>

        {/* Nav khi không ở Home, Guide hoặc ở service-package đã login*/}
        {pathname !== "/" && pathname !== ROUTES.GUIDE && !(pathname === ROUTES.SERVICE_PACKAGE && !isAuthenticated) && (
          <div className="app-nav">
            <button
              className={`nav-btn ${pathname === ROUTES.DASHBOARD ? "active" : ""}`}
              onClick={() => navigate(ROUTES.DASHBOARD)}
            >
              <LayoutDashboard size={18} />
              &nbsp;{t("header.dashboard")}
            </button>

            <button
              className={`nav-btn ${isFacebookAdsActive ? "active" : ""}`}
              onClick={() => navigate(ROUTES.ACCOUNT_MANAGEMENT)}
            >
              <Megaphone size={18} />
              &nbsp;{t("header.facebook_ads")}
            </button>

            <button
              className={`nav-btn ${pathname === ROUTES.ANALYTICS ? "active" : ""}`}
              onClick={() => navigate(ROUTES.ANALYTICS)}
            >
              <BarChart3 size={18} />
              &nbsp;{t("header.analytics")}
            </button>

            <button
              className={`nav-btn ${
                pathname.startsWith(ROUTES.SHOP) ? "active" : ""
              }`}
              onClick={() => navigate(ROUTES.SHOP)}
            >
              <Store size={18} />
              &nbsp;{t("header.shop")}
            </button>

            <button
              className={`nav-btn ${
                pathname === ROUTES.SERVICE_PACKAGE ? "active" : ""
              }`}
              onClick={() => navigate(ROUTES.SERVICE_PACKAGE)}
            >
              <Package size={18} />
              &nbsp;{t("header.package")}
            </button>
          </div>
        )}

        {/* Nav 2 khi ở Home, Guide hoặc ở service-package chưa login*/}
        {(pathname === "/" || pathname === ROUTES.GUIDE || (pathname === ROUTES.SERVICE_PACKAGE && !isAuthenticated)) && (
          <div className="app-nav-2">
            <button
              className={`nav-btn-2 ${pathname === ROUTES.GUIDE ? "active" : ""}`}
              onClick={() => navigate(ROUTES.GUIDE)}
            >
              <BookOpen size={20} />
              &nbsp;{t("header.guide")}
            </button>
            <button
              className={`nav-btn-2 ${pathname === ROUTES.SERVICE_PACKAGE ? "active" : ""}`}
              onClick={() => navigate(ROUTES.SERVICE_PACKAGE)}
            >
              <Gem size={20} /> {t("header.service")}
            </button>

            {isAuthenticated && (
              <button
                className={`nav-btn-2 ${
                  pathname === ROUTES.DASHBOARD ? "active" : ""
                }`}
                onClick={() => navigate(ROUTES.DASHBOARD)}
              >
                <LayoutDashboard size={20} />
                &nbsp;{t("header.dashboard")}
              </button>
            )}
          </div>
        )}

        {/* Mobile Menu Dropdown - Nav 1 */}
        {(pathname !== "/" && pathname !== ROUTES.GUIDE && !(pathname === ROUTES.SERVICE_PACKAGE && !isAuthenticated)) && (
          <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
            <button
              className={`mobile-nav-btn ${pathname === ROUTES.DASHBOARD ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.DASHBOARD);
                setIsMobileMenuOpen(false);
              }}
            >
              <LayoutDashboard size={20} />
              <span>{t("header.dashboard")}</span>
            </button>

            <button
              className={`mobile-nav-btn ${isFacebookAdsActive ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.ACCOUNT_MANAGEMENT);
                setIsMobileMenuOpen(false);
              }}
            >
              <Megaphone size={20} />
              <span>{t("header.facebook_ads")}</span>
            </button>

            <button
              className={`mobile-nav-btn ${pathname === ROUTES.ANALYTICS ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.ANALYTICS);
                setIsMobileMenuOpen(false);
              }}
            >
              <BarChart3 size={20} />
              <span>{t("header.analytics")}</span>
            </button>

            <button
              className={`mobile-nav-btn ${pathname.startsWith(ROUTES.SHOP) ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.SHOP);
                setIsMobileMenuOpen(false);
              }}
            >
              <Store size={20} />
              <span>{t("header.shop")}</span>
            </button>

            <button
              className={`mobile-nav-btn ${pathname === ROUTES.SERVICE_PACKAGE ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.SERVICE_PACKAGE);
                setIsMobileMenuOpen(false);
              }}
            >
              <Package size={20} />
              <span>{t("header.package")}</span>
            </button>
          </div>
        )}

        {/* Mobile Menu Dropdown - Nav 2 */}
        {(pathname === "/" || pathname === ROUTES.GUIDE || (pathname === ROUTES.SERVICE_PACKAGE && !isAuthenticated)) && (
          <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
            <button
              className={`mobile-nav-btn ${pathname === ROUTES.GUIDE ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.GUIDE);
                setIsMobileMenuOpen(false);
              }}
            >
              <BookOpen size={20} />
              <span>{t("header.guide")}</span>
            </button>
            <button
              className={`mobile-nav-btn ${pathname === ROUTES.SERVICE_PACKAGE ? "active" : ""}`}
              onClick={() => {
                navigate(ROUTES.SERVICE_PACKAGE);
                setIsMobileMenuOpen(false);
              }}
            >
              <Gem size={20} />
              <span>{t("header.service")}</span>
            </button>

            {isAuthenticated && (
              <button
                className={`mobile-nav-btn ${pathname === ROUTES.DASHBOARD ? "active" : ""}`}
                onClick={() => {
                  navigate(ROUTES.DASHBOARD);
                  setIsMobileMenuOpen(false);
                }}
              >
                <LayoutDashboard size={20} />
                <span>{t("header.dashboard")}</span>
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
          {/* Chỉ hiển thị menu user khi đã login và KHÔNG ở trang Home, Guide, và nếu ở service-package thì phải đã login */}
          {isAuthenticated && pathname !== "/" && pathname !== ROUTES.GUIDE && !(pathname === "/service-package" && !isAuthenticated) && (
            <div className="user-menu">
              {/* SHOP SELECTOR */}
              <div className="shop-selector" onClick={() => toggleMenu("shop")}>
                {loading ? (
                  <span>Đang tải...</span>
                ) : selectedShop ? (
                  <>
                    <div className="shop-info">
                      <strong className="shop-name">
                        {selectedShop.shop_name}
                      </strong>
                      <small className="shop-role">{selectedShop.role}</small>
                      {(() => {
                        // Lấy package name
                        const packageName = typeof selectedShop.package === 'string' 
                          ? selectedShop.package 
                          : selectedShop.package?.name || '';
                        
                        // Chỉ hiển thị nếu có package và không phải "Basic" hoặc empty
                        if (packageName && packageName !== 'Basic' && packageName.trim() !== '') {
                          return (
                            <>
                              {" | "}
                              <small className={`shop-package package-${packageName.toLowerCase().replace(/\s+/g, '-')}`}>
                                {packageName}
                              </small>
                            </>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {/* <ChevronDown size={16} /> */}
                  </>
                ) : (
                  <span>Chọn cửa hàng</span>
                )}
              </div>

              {/* DROPDOWN SHOP */}
              {openMenu === "shop" && (
                <div className="dropdown-shop">
                  {/* <div className="dropdown-shop-header">
                    <h4>Chọn cửa hàng</h4>
                  </div> */}
                  <div className="dropdown-shop-list">
                    {shops.length === 0 ? (
                      <div className="empty">Bạn chưa có cửa hàng nào</div>
                    ) : (
                      shops.map((shop) => (
                        <div
                          key={shop.id}
                          className={`shop-item ${
                            selectedShop?.id === shop.id ? "active" : ""
                          } ${switching ? "disabled" : ""}`}
                          onClick={() => !switching && handleShopSelect(shop)}
                          style={{
                            // opacity:
                            //   switching && selectedShop?.id !== shop.id
                            //     ? 0.6
                            //     : 1,
                          }}
                        >
                          <div className="shop-item-name">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>{shop.shop_name}</span>
                            </div>
                            {switching && selectedShop?.id === shop.id && (
                              <span style={{ marginLeft: 8, fontSize: 12 }}>
                                Đang chuyển...
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    className="btn-manage-shop"
                    onClick={() => navigate("/shop")}
                  >
                    {t("header.manage_shop")}
                  </button>
                </div>
              )}

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
                      <li onClick={() => navigate("/user-transaction")}>{t("header.user_transaction")}</li>
                      <li onClick={logout}>{t("header.logout")}</li>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chỉ hiển thị nút Đăng nhập nếu CHƯA đăng nhập và ở Home, Guide hoặc service-package */}
          {!isAuthenticated && (pathname === "/" || pathname === ROUTES.GUIDE || pathname === "/service-package") && (
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

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./ConnectPage.css";
import { useToast } from "../../hooks/common/useToast";
import { useAuth } from "../../hooks/auth/useAuth";
import shopService from "../../services/shop/shopService";
import { getShopCache } from "../../utils/cache/shopCache";
import axiosInstance from "../../utils/api/axios.js";
import logo from "../../assets/Logo_Fchat.png";
import LoadingOverlay from "../../components/common/LoadingOverlay/LoadingOverlay";

function ConnectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [shopId, setShopId] = useState(null);
  const [fbPages, setFbPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("status");
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const FB_CONFIG_ID = import.meta.env.FB_CONFIG_ID;
  const hasFacebookConnected = !!user?.facebookId;

  // Tải dữ liệu từ BE
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 1. Thử lấy shopId từ cache trước (nhanh nhất)
        const cachedShop = getShopCache();
        if (cachedShop?.id) {
          setShopId(cachedShop.id);
        } else {
          // 2. Nếu không có cache, lấy từ API
          try {
            const res = await axiosInstance.get("/api/shops/owner");
            const data = res.data;
            if (data.success && Array.isArray(data.data)) {
              const currentShop = data.data.find((s) => s.is_current);
              if (currentShop?._id) {
                setShopId(currentShop._id);
              } else if (data.data.length > 0) {
                // Nếu không có current shop, lấy shop đầu tiên
                setShopId(data.data[0]._id);
              }
            }
          } catch (apiError) {
            console.error("Error fetching shops:", apiError);
          }
        }

        // Lấy danh sách pages từ API (đã có thông tin connected_shop và can_connect)
        const pagesRes = await shopService.fetchFacebookPages();
        const realPages = pagesRes?.data?.pages || [];
        setFbPages(realPages);
      } catch (e) {
        console.error("Load facebook pages error:", e);
        toast.error(t('connect_page.toast_load_error'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t, toast]);

  // Chuẩn hóa dữ liệu page từ API
  const pages = useMemo(() => {
    const deriveRole = (tasks = []) => {
      const normalized = new Set(
        (tasks || []).map((t) => String(t).toUpperCase())
      );
      // Priority from highest to lowest
      if (normalized.has("ADMINISTER") || normalized.has("MANAGE"))
        return "ADMIN";
      if (normalized.has("CREATE_CONTENT")) return "EDITOR";
      if (normalized.has("MODERATE")) return "MODERATOR";
      if (normalized.has("ADVERTISE")) return "ADVERTISER";
      if (normalized.has("ANALYZE")) return "ANALYST";
      return "PAGE";
    };
    return (fbPages || []).map((p) => {
      // ✅ Page đã được connect với shop nào đó (không phân biệt shop nào)
      const isConnected = p.connected_shop !== null && p.connected_shop !== undefined;
      const isConnectedToCurrentShop = p.connected_shop?.is_current_shop || false;
      const isConnectedToOtherShop = isConnected && !isConnectedToCurrentShop;

      return {
        id: p.id,
        name: p.name,
        avatar:
          p.picture || `https://graph.facebook.com/${p.id}/picture?type=square`,
        link: `https://www.facebook.com/${p.id}`,
        role: deriveRole(p.tasks),
        status: isConnectedToCurrentShop
          ? t('connect_page.status_connected')
          : isConnectedToOtherShop
            ? `Đã kết nối với shop "${p.connected_shop?.shop_name || 'Unknown'}"`
            : t('connect_page.status_not_connected'),
        connectedBy: p.connected_shop?.shop_name || null,
        isConnectedToCurrentShop,
        isConnectedToOtherShop,
        // ✅ Chỉ cho phép connect nếu page chưa được connect với shop nào (can_connect = true)
        canConnect: p.can_connect === true && !isConnected,
        isSelected: false,
        pageAccessToken: p.pageAccessToken,
      };
    });
  }, [fbPages, t]);

  //Đếm số page đã kết nối với shop nào đó và còn lại
  const connectedCount = pages.filter(
    (page) => page.isConnectedToCurrentShop || page.isConnectedToOtherShop
  ).length;
  const remainingCount = pages.length - connectedCount;

  // Loại bỏ các page đã kết nối với shop nào đó hoặc không thể kết nối khỏi selectedPages
  useEffect(() => {
    setSelectedPages((prev) =>
      prev.filter((pageId) => {
        const page = pages.find((p) => p.id === pageId);
        // ✅ Chỉ giữ lại page chưa được connect với shop nào và có thể connect
        return page && page.canConnect && !page.isConnectedToCurrentShop && !page.isConnectedToOtherShop;
      })
    );
  }, [pages]);

  //Xử lý chọn page
  const handlePageSelect = (pageId) => {
    const page = pages.find((p) => p.id === pageId);
    // ✅ Không cho phép chọn page:
    // - Đã kết nối với shop nào đó (current shop hoặc shop khác)
    // - Không có quyền ADMIN
    // - Không thể kết nối (canConnect = false)
    if (page && (
      page.isConnectedToCurrentShop ||
      page.isConnectedToOtherShop ||
      page.role !== "ADMIN" ||
      !page.canConnect
    )) {
      return;
    }
    //Thêm page vào selectedPages
    setSelectedPages((prev) =>
      prev.includes(pageId)
        ? prev.filter((id) => id !== pageId)
        : [...prev, pageId]
    );
  };

  //Xử lý chọn tất cả
  const handleSelectAll = () => {
    // ✅ Chỉ chọn các page chưa được connect với shop nào và có quyền ADMIN
    const selectablePages = filteredPages.filter(
      (page) => !page.isConnectedToCurrentShop && !page.isConnectedToOtherShop && page.role === "ADMIN" && page.canConnect
    );

    if (selectAll) {
      // Bỏ chọn tất cả
      setSelectedPages([]);
    } else {
      // Chọn tất cả các page có thể chọn được
      setSelectedPages(selectablePages.map((page) => page.id));
    }
  };

  //Xử lý kết nối các page đã chọn
  const handleConnectSelected = async () => {
    const selected = pages.filter((p) => selectedPages.includes(p.id));
    if (selected.length === 0) return;
    if (!shopId) {
      toast.error(t('connect_page.toast_no_shop'));
      return;
    }
    try {
      // Kết nối lần lượt nhiều page
      for (const page of selected) {
        await shopService.connectFacebookPage({
          shopId,
          pageId: page.id,
          pageAccessToken: page.pageAccessToken,
        });
      }

      // Reload pages để cập nhật trạng thái
      const pagesRes = await shopService.fetchFacebookPages();
      const realPages = pagesRes?.data?.pages || [];
      setFbPages(realPages);

      toast.success(t('connect_page.toast_connect_success', { count: selected.length }));
      navigate("/dashboard");
    } catch (e) {
      console.error("Connect page error:", e);
      toast.error(t('connect_page.toast_connect_error'));
    }
  };

  //Xử lý làm mới kết nối
  const handleRefresh = async () => {
    // Nếu user chưa có Facebook → gọi login Facebook
    if (!hasFacebookConnected) {
      handleFacebookBusinessLogin();
      return;
    }

    // Nếu đã có Facebook → refresh token như bình thường
    try {
      const response = await shopService.refreshFacebookToken();
      if (response.success) {
        toast.success(t('connect_page.toast_refresh_success'));
        const pagesRes = await shopService.fetchFacebookPages();
        const realPages = pagesRes?.data?.pages || [];
        setFbPages(realPages);
      } else {
        toast.error(response.message || t('connect_page.toast_refresh_error'));
      }
    } catch (error) {
      console.log("Refresh token error:", error);
      toast.error(t('connect_page.toast_refresh_error_detail', { error: error.message || "Unknown error" }));
    }
  };

  // Facebook Business Login Handler
  const handleFacebookBusinessLogin = () => {
    if (!window.FB) {
      toast.error("Facebook SDK chưa sẵn sàng. Vui lòng thử lại.");
      return;
    }

    window.FB.login(
      function (response) {
        if (response.status === "connected") {
          handleFacebookLoginSuccess(response);
        }
      },
      {
        config_id: FB_CONFIG_ID,
        scope: "email,public_profile,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_manage_posts,business_management,ads_read,ads_management",
      }
    );
  };

  // Xử lý khi Facebook login thành công - LINK Facebook vào account hiện tại
  const handleFacebookLoginSuccess = async (response) => {
    try {
      const { authResponse } = response;
      if (!authResponse?.accessToken) {
        toast.error("Đăng nhập Facebook thất bại");
        return;
      }

      // Gọi endpoint LINK thay vì LOGIN (dùng axiosInstance có auth token)
      const linkResponse = await axiosInstance.post(
        "/api/auth/facebook/link",
        {
          facebookId: authResponse.userID,
          accessToken: authResponse.accessToken,
        }
      );

      if (linkResponse.data.success) {
        const { user: updatedUser, pages } = linkResponse.data.data;
        
        // Cập nhật user trong context (không cần đăng nhập lại)
        updateUser(updatedUser);
        
        // Reload danh sách pages
        const pagesRes = await shopService.fetchFacebookPages();
        const realPages = pagesRes?.data?.pages || [];
        setFbPages(realPages);
        toast.success("Kết nối Facebook thành công!");
      } else {
        const errorCode = linkResponse.data?.error?.code;
        
        if (errorCode === "FACEBOOK_ALREADY_BOUND") {
          toast.error("Tài khoản Facebook này đã được liên kết với tài khoản khác. Vui lòng sử dụng tài khoản Facebook khác.");
        } else {
          toast.error(linkResponse.data?.error?.message || "Liên kết thất bại");
        }
      }
    } catch (error) {
      console.error("Facebook link error:", error);
      const errorCode = error.response?.data?.error?.code;
      
      if (errorCode === "FACEBOOK_ALREADY_BOUND") {
        toast.error("Tài khoản Facebook này đã được liên kết với tài khoản khác. Vui lòng sử dụng tài khoản Facebook khác.");
      } else {
        toast.error(error.response?.data?.error?.message || "Liên kết thất bại");
      }
    }
  };

  // Khởi tạo Facebook SDK
  useEffect(() => {
    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: "1445692036729400",
        cookie: true,
        xfbml: true,
        version: "v23.0",
      });
    };

    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    })(document, "script", "facebook-jssdk");
  }, []);

  //Xử lý quay lại
  const handleBackToList = () => {
    navigate(-1);
  };

  //Lọc danh sách page theo tên và trạng thái
  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    // ✅ Check page đã được connect với shop nào (current hoặc other)
    const isConnected = page.isConnectedToCurrentShop || page.isConnectedToOtherShop;
    const matchesStatus =
      statusFilter === "status" ||
      (statusFilter === "connected" && isConnected) ||
      (statusFilter === "not-connected" && !isConnected);
    return matchesSearch && matchesStatus;
  });

  // Cập nhật trạng thái selectAll khi selectedPages thay đổi
  useEffect(() => {
    // ✅ Chỉ đếm các page chưa được connect với shop nào và có thể connect
    const selectablePages = filteredPages.filter(
      (page) => !page.isConnectedToCurrentShop && !page.isConnectedToOtherShop && page.role === "ADMIN" && page.canConnect
    );
    setSelectAll(
      selectablePages.length > 0 &&
      selectedPages.length === selectablePages.length
    );
  }, [selectedPages, filteredPages]);

  return (
    <div className="connect-page">
      <LoadingOverlay isLoading={loading} message="Đang tải..." />
      <div className="connect-container">
        {/* Logo */}
        <div className="logo-section">
          <div className="logo">
            <img className="logo-img" src={logo}></img>
          </div>
        </div>

        {/* Status Info */}
        <div className="status-info">
          {t('connect_page.status_info', { connected: connectedCount, remaining: remainingCount })}
        </div>

        {/* Page Management Section */}
        <div className="page-management-container">
          {pages.length === 0 ? (
            <div className="empty-state">
              <p>
                {t('connect_page.empty_state')}
              </p>
            </div>
          ) : (
            <>
              {/* Search and Filter Bar */}
              <div className="search-filter-bar-connect-page">
                <div className="search-section">
                  <input
                    type="text"
                    className="search-input"
                    placeholder={t('connect_page.search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {/* Filter Section */}
                <div className="filter-section-connect-page">
                  <select
                    className="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="status">{t('connect_page.filter_status')}</option>
                    <option value="connected">{t('connect_page.filter_connected')}</option>
                    <option value="not-connected">{t('connect_page.filter_not_connected')}</option>
                  </select>
                  <span className="page-count">
                    {t('connect_page.pages_count', { count: filteredPages.length })}
                  </span>
                </div>
              </div>

              {/* Page List Table */}
              <div className="page-list-table">
                <div className="table-header">
                  <div className="col-page-name">{t('connect_page.table_page_name')}</div>
                  <div className="col-role">{t('connect_page.table_role')}</div>
                  <div className="col-status">{t('connect_page.table_status')}</div>
                  <div className="col-select">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="select-all-checkbox"
                      disabled={
                        // ✅ Disable khi không còn page nào chưa được connect với shop nào
                        filteredPages.filter(
                          (page) => !page.isConnectedToCurrentShop && !page.isConnectedToOtherShop && page.role === "ADMIN" && page.canConnect
                        ).length === 0
                      }
                    />
                    {/* <span className="select-all-label">Chọn tất cả</span> */}
                  </div>
                </div>

                {filteredPages.map((page) => (
                  <div key={page.id} className="table-row">
                    <div className="col-page-name">
                      <div className="page-info">
                        <img
                          src={page.avatar}
                          alt={page.name}
                          className="page-avatar"
                        />
                        <div className="page-details">
                          <div className="page-name">
                            {page.name}
                            <a
                              href={page.link}
                              className="external-link"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-role">
                      <span className="role-badge">{t(`connect_page.roles.${page.role}`)}</span>
                    </div>
                    <div className="col-status">
                      <div className="status-info">
                        <div className="status-text">{page.status}</div>
                        {page.connectedBy && (
                          <div className="connected-by">{page.connectedBy}</div>
                        )}
                      </div>
                    </div>

                    <div className="col-select">
                      <input
                        type="checkbox"
                        checked={selectedPages.includes(page.id)}
                        onChange={() => handlePageSelect(page.id)}
                        className="page-checkbox"
                        disabled={page.isConnectedToCurrentShop || page.isConnectedToOtherShop || page.role !== "ADMIN" || !page.canConnect}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Connect Button Bottom */}
              <div className="connect-bottom">
                <button
                  className="connect-selected-btn"
                  onClick={handleConnectSelected}
                  disabled={selectedPages.length === 0}
                >
                  {t('connect_page.connect_button', { count: selectedPages.length })}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Help Section */}
        <div className="help-section">
          <h3 className="help-title">{t('connect_page.help_title')}</h3>
          <p className="help-text">
            {t('connect_page.help_text')}
          </p>
          <button className="refresh-btn" onClick={handleRefresh}>
            <span className="refresh-icon">↻ </span>
            {t('connect_page.refresh_button')}
          </button>
        </div>

        {/* Contact Info
        <div className="contact-info">
          <p className="permission-text">
            Chúng tôi sẽ cần quyền ADMIN các Fanpages của bạn để kết nối với Chatbot.
          </p>
          <p className="contact-text">
            Mọi thắc mắc vui lòng liên hệ <strong>0898 986 008</strong> hoặc tham gia nhóm hỗ trợ <strong>Group Fchat</strong>
          </p>
        </div> */}

        {/* Back Button */}
        <div className="back-section">
          <button className="back-btn" onClick={handleBackToList}>
            <span className="back-icon">←</span>
            {t('connect_page.back_button')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectPage;
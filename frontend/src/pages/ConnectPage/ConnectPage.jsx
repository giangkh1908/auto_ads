import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./ConnectPage.css";
import { useToast } from "../../hooks/useToast";
import shopService from "../../services/shopService";
import { getShopCache } from "../../utils/shopCache";
import axiosInstance from "../../utils/axios.js";
import logo from "../../assets/Logo_Fchat.png";

function ConnectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const [shopId, setShopId] = useState(null);
  const [fbPages, setFbPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("status");
  const [selectAll, setSelectAll] = useState(false);

  // Tải dữ liệu từ BE
  useEffect(() => {
    const load = async () => {
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
      const isConnectedToCurrentShop = p.connected_shop?.is_current_shop || false;
      const isConnectedToOtherShop = p.connected_shop && !p.connected_shop.is_current_shop;
      
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
          ? `Đã kết nối với shop "${p.connected_shop.shop_name}"`
          : t('connect_page.status_not_connected'),
        connectedBy: p.connected_shop?.shop_name || null,
        isConnectedToOtherShop,
        canConnect: p.can_connect !== false, // Mặc định true nếu không có thông tin
        isSelected: false,
        pageAccessToken: p.pageAccessToken,
      };
    });
  }, [fbPages, t]);

  //Đếm số page đã kết nối và còn lại
  const connectedCount = pages.filter(
    (page) => page.status === t('connect_page.status_connected')
  ).length;
  const remainingCount = pages.length - connectedCount;

  // Loại bỏ các page đã kết nối với shop khác hoặc không thể kết nối khỏi selectedPages
  useEffect(() => {
    setSelectedPages((prev) =>
      prev.filter((pageId) => {
        const page = pages.find((p) => p.id === pageId);
        return page && !page.isConnectedToOtherShop && page.canConnect;
      })
    );
  }, [pages]);

  //Xử lý chọn page
  const handlePageSelect = (pageId) => {
    const page = pages.find((p) => p.id === pageId);
    // Không cho phép chọn page:
    // - Đã kết nối với shop khác (không phải current shop)
    // - Không có quyền ADMIN
    // - Không thể kết nối (canConnect = false)
    if (page && (
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
    const selectablePages = filteredPages.filter(
      (page) => !page.isConnectedToOtherShop && page.role === "ADMIN" && page.canConnect
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
    try {
      const response = await shopService.refreshFacebookToken();
      if (response.success) {
        toast.success(t('connect_page.toast_refresh_success'));
        // Reload pages after successful token refresh
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

  //Xử lý quay lại
  const handleBackToList = () => {
    navigate(-1);
  };

  //Lọc danh sách page theo tên và trạng thái
  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const isConnectedToCurrent = page.status === t('connect_page.status_connected');
    const matchesStatus =
      statusFilter === "status" ||
      (statusFilter === "connected" && isConnectedToCurrent) ||
      (statusFilter === "not-connected" && !isConnectedToCurrent && !page.isConnectedToOtherShop);
    return matchesSearch && matchesStatus;
  });

  // Cập nhật trạng thái selectAll khi selectedPages thay đổi
  useEffect(() => {
    const selectablePages = filteredPages.filter(
      (page) => !page.isConnectedToOtherShop && page.role === "ADMIN" && page.canConnect
    );
    setSelectAll(
      selectablePages.length > 0 &&
        selectedPages.length === selectablePages.length
    );
  }, [selectedPages, filteredPages, t]);

  return (
    <div className="connect-page">
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
              <div className="search-filter-bar">
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
                        // Disable khi không còn checkbox nào có thể chọn
                        filteredPages.filter(
                          (page) => !page.isConnectedToOtherShop && page.role === "ADMIN" && page.canConnect
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
                        disabled={page.isConnectedToOtherShop || page.role !== "ADMIN" || !page.canConnect}
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
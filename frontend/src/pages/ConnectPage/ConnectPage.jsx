import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./ConnectPage.css";
import { useToast } from "../../hooks/useToast";
import profileService from "../../services/profileService";
import shopService from "../../services/shopService";
import logo from "../../assets/Logo_Fchat.png";

function ConnectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const [shopId, setShopId] = useState(null);
  const [connectedPageIds, setConnectedPageIds] = useState([]);
  const [fbPages, setFbPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("status");
  const [selectAll, setSelectAll] = useState(false);

  // Tải dữ liệu từ BE
  useEffect(() => {
    const load = async () => {
      try {
        const me = await profileService.getCurrentProfile();
        const shop = me?.data?.shop || me?.shop;
        setShopId(shop?._id || null);
        const connected = Array.isArray(shop?.facebook_pages)
          ? shop.facebook_pages
              .filter((p) => p.connected_status === "connected")
              .map((p) => p.page_id)
          : [];
        setConnectedPageIds(connected);

        const pagesRes = await shopService.fetchFacebookPages();
        const realPages = pagesRes?.data?.pages || [];
        setFbPages(realPages);
      } catch (e) {
        console.error("Load facebook pages error:", e);
        toast.error(t('connect_page.toast_load_error'));
      }
    };
    load();
  }, [t]);

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
    return (fbPages || []).map((p) => ({
      id: p.id,
      name: p.name,
      avatar:
        p.picture || `https://graph.facebook.com/${p.id}/picture?type=square`,
      link: `https://www.facebook.com/${p.id}`,
      role: deriveRole(p.tasks),
      status: connectedPageIds.includes(p.id) ? t('connect_page.status_connected') : t('connect_page.status_not_connected'),
      connectedBy: null,
      isSelected: false,
      pageAccessToken: p.pageAccessToken,
    }));
  }, [fbPages, connectedPageIds]);

  //Đếm số page đã kết nối và còn lại
  const connectedCount = pages.filter(
    (page) => page.status === t('connect_page.status_connected')
  ).length;
  const remainingCount = pages.length - connectedCount;

  // Loại bỏ các page đã kết nối khỏi selectedPages
  useEffect(() => {
    setSelectedPages((prev) =>
      prev.filter((pageId) => {
        const page = pages.find((p) => p.id === pageId);
        return page && page.status !== t('connect_page.status_connected');
      })
    );
  }, [pages, t]);

  //Xử lý chọn page
  const handlePageSelect = (pageId) => {
    const page = pages.find((p) => p.id === pageId);
    // Không cho phép chọn page đã kết nối hoặc không có quyền ADMIN
    if (page && (page.status === t('connect_page.status_connected') || page.role !== "ADMIN")) {
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
      (page) => page.status !== t('connect_page.status_connected') && page.role === "ADMIN"
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
      setConnectedPageIds((prev) =>
        Array.from(new Set([...prev, ...selected.map((p) => p.id)]))
      );
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
    const matchesStatus =
      statusFilter === "status" ||
      (statusFilter === "connected" && page.status === t('connect_page.status_connected')) ||
      (statusFilter === "not-connected" && page.status === t('connect_page.status_not_connected'));
    return matchesSearch && matchesStatus;
  });

  // Cập nhật trạng thái selectAll khi selectedPages thay đổi
  useEffect(() => {
    const selectablePages = filteredPages.filter(
      (page) => page.status !== t('connect_page.status_connected') && page.role === "ADMIN"
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
                        // Disable khi không còn checkbox nào có thể chọn (không connected và phải là ADMIN)
                        filteredPages.filter(
                          (page) => page.status !== t('connect_page.status_connected') && page.role === "ADMIN"
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
                        disabled={page.status === t('connect_page.status_connected') || page.role !== "ADMIN"}
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

// src/pages/shop/History.jsx
import { useTranslation } from "react-i18next";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";
import { STORAGE_KEYS } from "../../constants/app.constants";
import { toast } from "sonner";
import axiosInstance from "../../utils/axios.js";
import { getShopCache, saveShopCache } from "../../utils/shopCache";
import { Store, Plus, Delete, ClipboardList, Replace, Link, Info, UserCheck, UserMinus} from "lucide-react";
// import { formatDistanceToNow, format } from "date-fns";
// import { vi, enUS } from "date-fns/locale";

const Icon = ({ type }) => {
  switch (type) {
    case "CREATE_SHOP":
      return <Store className="log-icon create" />;
    case "ADD_EMPLOYEE":
      return <Plus className="log-icon add" />;
    case "REMOVE_EMPLOYEE":
      return <UserMinus className="log-icon remove" />;
    case "DISCONNECT_FACEBOOK_PAGE":
      return <Delete className="log-icon remove" />;
    case "UPDATE_USER_ROLE":
      return <UserCheck className="log-icon update" />;
    case "ASSIGN_PAGES":
      return <ClipboardList className="log-icon assign" />;
    case "TRANSFER_OWNERSHIP":
      return <Replace className="log-icon transfer" />;
    case "CONNECT_FACEBOOK_PAGE":
      return <Link className="log-icon connect" />;
    default:
      return <Info className="log-icon default" />;
  }
};

function History() {
  const { t } = useTranslation();
  const { shopId: shopIdFromParams } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [actualShopId, setActualShopId] = useState(shopIdFromParams);
  const [loading, setLoading] = useState(true);
  // Lấy role từ cache ngay lập tức khi khởi tạo state
  const [userRoleInShop, setUserRoleInShop] = useState(() => {
    const cachedShop = getShopCache();
    return cachedShop?.role || null;
  });

  // Lấy current shop nếu không có shopId trong URL và lấy role của user
  useEffect(() => {
    const getCurrentShop = async () => {
      try {
        // Lấy current shop từ API
        const res = await axiosInstance.get("/api/shops/owner");
        const data = res.data;

        if (data.success && Array.isArray(data.data)) {
          const currentShop = data.data.find((shop) => shop.is_current);
          
          // Lưu role của user và cập nhật cache
          if (currentShop?.user_role?.role_name) {
            const role = currentShop.user_role.role_name;
            setUserRoleInShop(role);
            
            // Cập nhật cache với role mới
            const cachedShop = getShopCache();
            if (cachedShop && cachedShop.id === currentShop._id) {
              saveShopCache({
                ...cachedShop,
                role: role,
              });
            }
          }

          if (shopIdFromParams) {
            setActualShopId(shopIdFromParams);
            return;
          }

          if (currentShop) {
            const currentShopId = currentShop._id;
            setActualShopId(currentShopId);
            // Redirect đến URL với shopId
            navigate(ROUTES.SHOP_HISTORY.replace(":shopId", currentShopId), { replace: true });
          } else {
            toast.error("Không tìm thấy shop hiện tại");
          }
        }
      } catch (error) {
        console.error("Error getting current shop:", error);
        toast.error("Lỗi khi lấy shop hiện tại");
      }
    };

    getCurrentShop();
  }, [shopIdFromParams, navigate]);

  // Load logs khi actualShopId thay đổi
  useEffect(() => {
    const fetchLogs = async () => {
      if (!actualShopId) return;

      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/shops/logs`, {
          params: { shopId: actualShopId },
        });
        const data = res.data;
        if (data.success) {
          const sortedLogs = (data.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setLogs(sortedLogs);
        } else {
          toast.error(data.message || "Không thể tải lịch sử");
        }
      } catch (err) {
        console.error("Error fetching logs:", err);
        toast.error(err.response?.data?.message || "Lỗi khi tải lịch sử");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [actualShopId]);

  return (
    <div className="shop-border">
      <div className="shop-tabs">
        <NavLink end to={ROUTES.SHOP} className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}>
          {t("shop.my_shop")}
        </NavLink>

        {/* Chỉ hiển thị tab Employee nếu role không phải Marketer */}
        {userRoleInShop !== "Marketer" && (
          <NavLink
            to={actualShopId ? ROUTES.SHOP_EMPLOYEE.replace(":shopId", actualShopId) : ROUTES.SHOP}
            className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
          >
            {t("shop.employee")}
          </NavLink>
        )}

        <NavLink 
          to={actualShopId ? ROUTES.SHOP_HISTORY.replace(":shopId", actualShopId) : ROUTES.SHOP} 
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t("shop.history")}
        </NavLink>
      </div>

      <div className="shop-page">
        <div className="shop-container">
          <div className="shop-content">
            <h2 className="history-title">
              Lịch sử hoạt động
            </h2>

            {loading ? (
              <div className="history-skeleton">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton-item">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-text"></div>
                    <div className="skeleton-time"></div>
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="history-empty">
                <p>Chưa có hoạt động nào.</p>
              </div>
            ) : (
              <div className="history-list">
                {logs.map((log) => (
                  <div key={log._id} className="history-item">
                    <div className="history-avatar">
                      {log.user_id?.avatar ? (
                        <img src={log.user_id.avatar} alt={log.user_id.full_name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {log.user_id?.full_name?.[0] || "U"}
                        </div>
                      )}
                    </div>

                    <div className="history-content">
                      <div className="history-header">
                        <span className="history-user">
                          {log.user_name || log.user_id?.full_name || log.user_id?.email || "Hệ thống"}
                        </span>
                        <Icon type={log.action} />
                      </div>

                      <div className="history-description">
                        {log.description || "Đã thực hiện một hành động"}
                      </div>

                      <div className="history-time">
                        {log.created_at}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default History;
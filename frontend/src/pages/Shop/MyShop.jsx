import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { Plus, Edit, Play, Pause, Star, MapPin, ArrowRight, Crown } from "lucide-react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";
import { STORAGE_KEYS } from '../../constants/app.constants';
import axiosInstance from "../../utils/api/axios.js";
import { toast } from "sonner";
import { clearShopCache, saveShopCache, getShopCache } from "../../utils/cache/shopCache";
import { useMyPackage } from "../../hooks/shop/useMyPackage";
import LoadingOverlay from "../../components/common/LoadingOverlay/LoadingOverlay";

function MyShop() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pkg, userPkg } = useMyPackage();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab] = useState("info");
  const [currentUser, setCurrentUser] = useState(true);
  const currentShop = shops.find((s) => s.isCurrent);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Forms Add
  const [addForm, setAddForm] = useState({
    shopName: "",
    email: "",
    phone: "",
    category: "other",
  });

  //Forms Update
  const [updateForm, setUpdateForm] = useState({
    id: null,
    shopName: "",
    email: "",
    phone: "",
    category: "other",
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axiosInstance.get("/api/auth/me");
        const data = res.data;
        setCurrentUser(data.data.user);
      } catch (error) {
        //console.error("Error fetching user:", error);
        toast.error("Lỗi khi tải thông tin người dùng");
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    loadShops();

    // Kiểm tra và hiển thị thông báo sau khi reload
    const successMessage = sessionStorage.getItem('shop_update_success');
    if (successMessage) {
      toast.success(successMessage);
      sessionStorage.removeItem('shop_update_success');
    }
  }, []);

  const loadShops = async () => {
    try {
      setLoading(true);

      const res = await axiosInstance.get("/api/shops/owner");
      const data = res.data;

      // console.log("API response:", data);

      if (data.success && Array.isArray(data.data)) {
        const formatted = data.data.map((shop) => {
          const permissions = shop.user_role?.permissions || [];
          const canUpdate = permissions.some(
            (perm) =>
              perm.module === "shop" && perm.actions.includes("update_details")
          );
          const canViewEmployee = permissions.some(
            (perm) =>
              perm.module === "employee" && perm.actions.includes("view")
          );
          const canUpgrade = permissions.some(
            (perm) =>
              perm.module === "shop_owner" && perm.actions.includes("upgrade_shop")
          );

          // Backend đã trả về limits, chỉ cần format lại
          // Nếu chưa có package (Basic), backend sẽ trả về 1/1 employee và 0/0 page
          const employeeLimit = shop.employee_limit ?? 1;
          const pageLimit = shop.page_limit ?? 0;
          // Nếu không có package (Basic), employeeCount tối thiểu là 1 (owner)
          const isBasic = !shop.package || shop.package === "";
          const employeeCount = isBasic ? 1 : (shop.employee_count ?? 0);
          const pageCount = shop.page_count ?? 0;

          const shopCount = shop.shop_count ?? 0;
          const shopLimit = shop.shop_limit ?? 0;

          return {
            id: shop._id,
            shopName: shop.shop_name || "Unnamed Shop",
            package: shop.package && shop.package !== "Basic" ? shop.package : "None",
            employeeCount,
            employeeLimit,
            pageCount,
            pageLimit,
            shopCount,
            shopLimit,
            industry: shop.industry || "Other",
            isCurrent: shop.is_current || false,
            role: shop.user_role.role_name || "Owner",
            email: shop.owner_id?.email || "",
            phone: shop.owner_id?.phone || "",
            expired: shop.expired_at
              ? (() => {
                const date = new Date(shop.expired_at);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}-${month}-${year}`;
              })()
              : "Không giới hạn",
            status: shop.status || "Active",
            canUpdate,
            canViewEmployee,
            canUpgrade,
          };
        });

        setShops(formatted);
      } else {
        //console.error("Failed to load shops:", data.message);
        toast.error(data.message || "Không thể tải danh sách shop");
        setShops([]); // fallback an toàn
      }
    } catch (error) {
      //console.error("Load shops error:", e);
      toast.error("Lỗi khi tải danh sách shop");
      setShops([]); // tránh lỗi map nếu lỗi API
    } finally {
      setLoading(false);
    }
  };

  //Hành động với page
  const handleAction = (shopId, action) => {
    if (action === "upgrade") {
      navigate(ROUTES.SERVICE_PACKAGE);
      return;
    }
    // console.log(`Action ${action} for shop ${shopId}`);
  };

  //Thêm page mới
  const handleAddNewPage = () => {
    if (!pkg?.package) {
      toast.error("Tính năng này yêu cầu gói dịch vụ. Vui lòng mua gói để sử dụng.");
      return;
    }
    setIsAddOpen(true);
  };

  return (
    <div className="shop-border">
      <LoadingOverlay isLoading={loading || isCreating || isUpdating} message={isCreating ? "Đang tạo shop..." : isUpdating ? "Đang cập nhật..." : "Đang tải..."} />
      {/* Tabs */}
      <div className="shop-tabs">
        <NavLink
          end
          to={ROUTES.SHOP}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t('shop.my_shop')}
        </NavLink>
        {/* Chỉ hiển thị tab Employee nếu role không phải Marketer và có quyền view employee */}
        {currentShop?.role !== "Marketer" && currentShop?.canViewEmployee && (
          <NavLink
            to={currentShop?.id
              ? ROUTES.SHOP_EMPLOYEE.replace(":shopId", currentShop.id)
              : "#"}
            state={{ shopId: currentShop?._id }}
            className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
          >
            {t("shop.employee")}
          </NavLink>
        )}
        <NavLink
          to={currentShop?.id
            ? ROUTES.SHOP_HISTORY.replace(":shopId", currentShop.id)
            : ROUTES.SHOP}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t('shop.history')}
        </NavLink>
      </div>

      <div className="shop-page">
        {/* Tạo page mới */}
        <div className="btn-add-shop">
          <div className="shop-usage-info">
            {userPkg?.package && (
              <span className="shop-usage-text">
                Shop đã tạo: <strong>{userPkg?.usage?.shops || 0}/{userPkg?.limits?.shops || 1}</strong>
              </span>
            )}
          </div>
          <button
            className={`btn-add-new-page ${!pkg?.package ? 'premium-feature' : ''}`}
            onClick={handleAddNewPage}
          >
            <Plus size={16} />
            {t('shop.add_new_shop')}
            {!pkg?.package && (
              <span className="premium-badge">
                <Crown size={12} />
              </span>
            )}
          </button>
        </div>

        {/* Table  */}
        <div className="shop-container">
          {activeTab === "info" && (
            <div className="shop-content">
              {loading ? (
                <div className="empty-state">
                  <p>You don’t have any shops yet. Click “Add New Shop” to create one!</p>
                </div>
              ) : (
                <div className="shops-table">
                  <div className="table-header-shop">
                    <div className="table-cell-name">{t('shop.shop_name')}</div>
                    <div className="table-cell">{t('shop.package')}</div>
                    <div className="table-cell">{t('shop.employee_count')}</div>
                    <div className="table-cell">{t('shop.page_count')}</div>
                    <div className="table-cell">{t('shop.role')}</div>
                    <div className="table-cell">{t('shop.expired')}</div>
                    {/* <div className="table-cell">{t('shop.status')}</div> */}
                    <div className="table-cell">{t('shop.action')}</div>
                  </div>

                  {shops.map((shop) => (
                    <div key={shop.id} className="table-row-shop">
                      <div className="table-cell-name" data-label={t('shop.shop_name')}>
                        <div className="shop-name">
                          <span>{shop.shopName}</span>
                          {shop.isCurrent && (
                            <span className="current-badge"><MapPin size={14} /></span>
                          )}
                        </div>
                      </div>
                      <div className="table-cell" data-label={t('shop.package')}>
                        <span
                          className={`package-badge package-${(shop.package || "None").toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {shop.package || "None"}
                        </span>
                      </div>
                      <div className="table-cell" data-label={t('shop.employee_count')}>
                        <span className="employee-count">
                          {shop.employeeCount}/{shop.employeeLimit}
                        </span>
                      </div>
                      <div className="table-cell" data-label={t('shop.page_count')}>
                        <span className="page-count-shop">{shop.pageCount}/{shop.pageLimit}</span>
                      </div>
                      <div className="table-cell" data-label={t('shop.role')}>
                        <span className="role-badge">{shop.role}</span>
                      </div>
                      <div className="table-cell" data-label={t('shop.expired')}>
                        <span className="expired-date">{shop.expired}</span>
                      </div>
                      {/* <div className="table-cell" data-label={t('shop.status')}>
                        <span
                          className={`status-badge status-${shop.status.toLowerCase()}`}
                        >
                          {shop.status}
                        </span>
                      </div> */}
                      <div className="table-cell" data-label={t('shop.action')}>
                        <div className="action-buttons">
                          <button
                            className="shop-action-btn shop-update-btn"
                            onClick={() => {
                              setUpdateForm({
                                id: shop.id,
                                shopName: shop.shopName,
                                email: shop.email,
                                phone: shop.phone,
                                category: (
                                  shop.industry || "other"
                                ).toLowerCase(),
                              });
                              setIsUpdateOpen(true);
                            }}
                            title="Update"
                            disabled={!shop.canUpdate}
                            style={{
                              opacity: shop.canUpdate ? 1 : 0.5,
                              cursor: shop.canUpdate ? "pointer" : "not-allowed",
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className={`shop-action-btn shop-current-btn ${shop.isCurrent ? "active" : ""
                              }`}
                            title={shop.isCurrent ? "Current Shop" : "Set as Current"}
                            disabled={shop.isCurrent}
                            style={{
                              cursor: shop.isCurrent ? "default" : "pointer",
                            }}
                            onClick={async () => {
                              if (shop.isCurrent) return; // Nếu đã là current thì không cần làm gì
                              try {
                                const res = await axiosInstance.patch(`/api/shops/switch/${shop.id}`);
                                const data = res.data;
                                if (data.success) {
                                  // Lấy shop cũ từ cache trước khi xóa
                                  const previousShop = getShopCache();

                                  // Xóa cache cũ
                                  clearShopCache();

                                  // Cập nhật localStorage với shop mới
                                  localStorage.setItem("selectedShopId", shop.id);

                                  // Lấy package info từ API response nếu có
                                  // Đảm bảo package là string (name) chứ không phải object
                                  const packageInfo = data.shop?.package;
                                  const packageName = typeof packageInfo === 'string'
                                    ? (packageInfo && packageInfo !== "Basic" ? packageInfo : "None")
                                    : (packageInfo?.name && packageInfo.name !== "Basic" ? packageInfo.name : "None");

                                  // Tạo object shop để lưu vào cache (format giống Header)
                                  const shopForCache = {
                                    id: shop.id,
                                    shop_name: shop.shopName,
                                    package: packageName,
                                    role: shop.role,
                                    is_current: true,
                                  };

                                  // Lưu shop mới vào cache và dispatch event để Header cập nhật
                                  // Truyền previousShop để kiểm tra và xóa cache ads nếu shop thay đổi
                                  saveShopCache(shopForCache, previousShop);

                                  toast.success("Chuyển đổi shop thành công!");

                                  // Reload lại trang để cập nhật dữ liệu với shop mới
                                  window.location.reload();
                                } else {
                                  toast.error(data.message || "Không thể chuyển đổi shop");
                                }
                              } catch (err) {
                                //console.error("Switch shop error:", err);
                                toast.error("Lỗi server khi chuyển đổi shop");
                              }
                            }}
                          >
                            {shop.isCurrent ? <MapPin size={14} /> : <ArrowRight size={14} />} { }
                          </button>
                          {/* <button
                              className="shop-action-btn shop-activate-btn"
                              onClick={() => handleAction(shop.id, "activate")}
                              title="Activate"
                            >
                              <Play size={14} />
                            </button>
                            <button
                              className="shop-action-btn shop-deactivate-btn"
                              onClick={() => handleAction(shop.id, "deactivate")}
                              title="Deactivate"
                            > */}
                          {/* <Pause size={14} />
                            </button> */}
                          {shop.canUpgrade && (
                            <button
                              className="shop-action-btn shop-upgrade-btn"
                              onClick={() => handleAction(shop.id, "upgrade")}
                              title={t('shop.upgrade')}
                            >
                              <Star size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add New Page Modal */}
      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-shop">
              <h3>{t('shop.add_shop')}</h3>
              <button
                className="modal-close"
                onClick={() => setIsAddOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body-shop">
              <div className="form-field">
                <label htmlFor="add-shopName">{t('shop.shop_name')}</label>
                <input
                  id="add-shopName"
                  type="text"
                  className="modal-input"
                  value={addForm.shopName}
                  onChange={(e) =>
                    setAddForm({ ...addForm, shopName: e.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="add-email">{t('shop.email')}</label>
                <input
                  id="add-email"
                  type="email"
                  className="modal-input"
                  value={currentUser?.email || "Chưa có email"}
                  disabled
                  style={{ backgroundColor: "#e4e7ec" }}
                  title="Tự động sử dụng email của bạn"
                />
              </div>
              <div className="form-field">
                <label htmlFor="add-phone">{t('shop.phone_number')}</label>
                <input
                  id="add-phone"
                  type="tel"
                  className="modal-input"
                  value={currentUser?.phone || "Chưa có số điện thoại"}
                  disabled
                  style={{ backgroundColor: "#e4e7ec" }}
                  title="Tự động sử dụng số điện thoại của bạn"
                />
              </div>

              <div className="form-field">
                <label htmlFor="add-category">{t('shop.category')}</label>
                <select
                  id="add-category"
                  className="modal-select-shop"
                  value={addForm.category}
                  onChange={(e) =>
                    setAddForm({ ...addForm, category: e.target.value })
                  }
                >
                  <option value="other">{t('shop.other')}</option>
                  <option value="fashion">{t('shop.fashion')}</option>
                  <option value="food">{t('shop.food')}</option>
                  <option value="tech">{t('shop.tech')}</option>
                  <option value="beauty">{t('shop.beauty')}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary-shop"
                onClick={() => setIsAddOpen(false)}
              >
                {t('shop.cancel')}
              </button>
              <button
                className="btn-primary-shop"
                disabled={isCreating}
                onClick={async () => {
                  try {
                    setIsCreating(true);
                    const payload = {
                      shop_name: addForm.shopName,
                      industry: addForm.category,
                    };

                    // console.log("Submit Add:", payload);

                    const res = await axiosInstance.post("/api/shops/", payload);
                    const data = res.data;
                    if (data.success) {
                      toast.success("Tạo shop thành công!");
                      setIsAddOpen(false);
                      // Gọi lại API để refresh danh sách
                      await loadShops();
                    } else {
                      toast.error(data.message || "Không thể tạo shop");
                    }
                  } catch (err) {
                    //console.error("Error:", err);
                    toast.error(err.response?.data?.message || "Lỗi server khi tạo shop");
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                {isCreating ? "Đang tạo..." : t('shop.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Shop Modal */}
      {isUpdateOpen && (
        <div className="modal-overlay" onClick={() => setIsUpdateOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-shop">
              <h3>{t('shop.update_shop')}</h3>
              <button
                className="modal-close"
                onClick={() => setIsUpdateOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body-shop">
              <div className="form-field">
                <label htmlFor="upd-shopName">{t('shop.shop_name')}</label>
                <input
                  id="upd-shopName"
                  type="text"
                  className="modal-input"
                  value={updateForm.shopName}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, shopName: e.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="upd-email">{t('shop.email')}</label>
                <input
                  id="upd-email"
                  type="email"
                  className="modal-input"
                  value={updateForm.email}
                  style={{ backgroundColor: "#dddbdbff" }}
                  disabled
                  readOnly
                />
              </div>
              <div className="form-field">
                <label htmlFor="upd-phone">{t('shop.phone_number')}</label>
                <input
                  id="upd-phone"
                  type="tel"
                  className="modal-input"
                  value={updateForm.phone}
                  style={{ backgroundColor: "#dddbdbff" }}
                  disabled
                  readOnly
                />
              </div>

              <div className="form-field">
                <label htmlFor="upd-category">{t('shop.category')}</label>
                <select
                  id="upd-category"
                  className="modal-select-shop"
                  value={updateForm.category}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, category: e.target.value })
                  }
                >
                  <option value="other">{t('shop.other')}</option>
                  <option value="fashion">{t('shop.fashion')}</option>
                  <option value="food">{t('shop.food')}</option>
                  <option value="tech">{t('shop.tech')}</option>
                  <option value="beauty">{t('shop.beauty')}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary-shop"
                onClick={() => setIsUpdateOpen(false)}
              >
                {t('shop.cancel')}
              </button>
              <button
                className="btn-primary-shop"
                disabled={isUpdating}
                onClick={async () => {
                  try {
                    setIsUpdating(true);
                    const payload = {
                      shop_name: updateForm.shopName,
                      industry: updateForm.category,
                    };

                    const res = await axiosInstance.put(`/api/shops/${updateForm.id}`, payload);
                    const data = res.data;
                    if (data.success) {
                      setIsUpdateOpen(false);
                      // Lưu thông báo vào sessionStorage trước khi reload
                      sessionStorage.setItem('shop_update_success', 'Cập nhật shop thành công!');
                      // Reload trang để cập nhật tất cả dữ liệu
                      window.location.reload();
                    } else {
                      toast.error(data.message || "Không thể cập nhật shop");
                    }
                  } catch (err) {
                    //console.error("Error updating shop:", err);
                    toast.error(err.response?.data?.message || "Lỗi server khi cập nhật shop");
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              >
                {isUpdating ? "Đang cập nhật..." : t('shop.update')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyShop;
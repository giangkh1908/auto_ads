import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Plus, Edit, Play, Pause, Star, MapPin, Check, ArrowRight} from "lucide-react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";
import { STORAGE_KEYS } from '../../constants/app.constants';

function MyShop() {
  const { t } = useTranslation();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab] = useState("info");
  const [currentUser, setCurrentUser] = useState(true);
  const currentShop = shops.find((s) => s.isCurrent);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

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
      const res = await fetch("http://localhost:5001/api/auth/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`
        }
      });
      const data = await res.json();
      setCurrentUser(data.data.user);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      setLoading(true);

      const res = await fetch(`http://localhost:5001/api/shops/owner`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`,
        },
      });

      const data = await res.json();

      console.log("🔹 API response:", data);

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

          return {
            id: shop._id,
            shopName: shop.shop_name || "Unnamed Shop",
            package: shop.package || "Basic",
            employeeCount: shop.employee_count || 0,
            pageCount: shop.page_count || 0,
            industry: shop.industry || "Other",
            isCurrent: shop.is_current || false,
            role: shop.user_role.role_name || "Owner",
            email: shop.owner_id?.email || "",
            phone: shop.owner_id?.phone || "",
            expired: shop.expired_at
              ? new Date(shop.expired_at).toISOString().slice(0, 10)
              : "N/A",
            status: shop.status || "Active",
            canUpdate,
            canViewEmployee,
          };
        });

        setShops(formatted);
      } else {
        console.error("Failed to load shops:", data.message);
        setShops([]); // fallback an toàn
      }
    } catch (e) {
      console.error("Load shops error:", e);
      setShops([]); // tránh lỗi map nếu lỗi API
    } finally {
      setLoading(false);
    }
  };

  //Hành động với page
  const handleAction = (shopId, action) => {
    console.log(`Action ${action} for shop ${shopId}`);
  };

  // Hành động với shop (Activate / Deactivate)
  // const handleAction = async (shopId, action) => {
  //   try {
  //     let endpoint = "";
  //     let successMessage = "";

  //     if (action === "activate") {
  //       endpoint = `http://localhost:5001/api/shops/${shopId}/activate`;
  //       successMessage = "Shop activated successfully!";
  //     } else if (action === "deactivate") {
  //       endpoint = `http://localhost:5001/api/shops/${shopId}/deactivate`;
  //       successMessage = "Shop deactivated successfully!";
  //     } else {
  //       console.log(`Unknown action: ${action}`);
  //       return;
  //     }

  //     const res = await fetch(endpoint, {
  //       method: "PATCH",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${localStorage.getItem("token")}`,
  //       },
  //     });

  //     const data = await res.json();
  //     if (data.success) {
  //       alert(successMessage);
  //       // 🔁 Refresh danh sách shop
  //       const refresh = await fetch(
  //         `http://localhost:5001/api/shops/owner/68ed2a2d64097dc1c878e714`,
  //         {
  //           headers: {
  //             Authorization: `Bearer ${localStorage.getItem("token")}`,
  //           },
  //         }
  //       );
  //       const refreshedData = await refresh.json();
  //       setShops(refreshedData.data || refreshedData);
  //     } else {
  //       alert(data.message || "Failed to perform action");
  //     }
  //   } catch (err) {
  //     console.error("Action error:", err);
  //     alert("Server error while performing action");
  //   }
  // };

  //Thêm page mới
  const handleAddNewPage = () => {
    setIsAddOpen(true);
  };

  return (
    <div className="shop-border">
      {/* Tabs */}
      <div className="shop-tabs">
        <NavLink
          end
          to={ROUTES.SHOP}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t('shop.my_shop')}
        </NavLink>
        <NavLink
          to={currentShop?.canViewEmployee ? `${ROUTES.SHOP_EMPLOYEE.replace(':shopId', currentShop.id)}` : "#"}
          state={{ shopId: currentShop?._id }}
          onClick={(e) => {
            if (!currentShop?.canViewEmployee) e.preventDefault();
          }}
          className={({ isActive }) =>
            `shop-tab ${isActive ? "active" : ""} ${!currentShop?.canViewEmployee ? "disabled" : ""
            }`
          }
        >
          {t("shop.employee")}
        </NavLink>
        <NavLink
          to={ROUTES.SHOP_HISTORY}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t('shop.history')}
        </NavLink>
      </div>

      <div className="shop-page">
        {/* Tạo page mới */}
        <div className="btn-add">
          <button className="btn-add-new-page" onClick={handleAddNewPage}>
            <Plus size={16} />
            {t('shop.add_new_shop')}
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
                          <div className="shop-avatar">
                            {shop?.shopName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <span>{shop.shopName}</span>
                          {shop.isCurrent && (
                            <span className="current-badge"><MapPin size={14} /></span>
                          )}
                        </div>
                      </div>
                      <div className="table-cell" data-label={t('shop.package')}>
                        <span
                          className={`package-badge package-${shop.package.toLowerCase()}`}
                        >
                          {shop.package}
                        </span>
                      </div>
                      <div className="table-cell" data-label={t('shop.employee_count')}>
                        <span className="employee-count">
                          {shop.employeeCount}
                        </span>
                      </div>
                      <div className="table-cell" data-label={t('shop.page_count')}>
                        <span className="page-count-shop">{shop.pageCount}</span>
                      </div>
                      <div className="table-cell" data-label={t('shop.role')}>
                        <span className="role-badge">{shop.role}</span>
                      </div>
                      <div className="table-cell" data-label={t('shop.expired')}>
                        <span className="expired-date">{shop.expired ? shop.expired : "Vô hạn"}</span>
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
                            title={shop.isCurrent ? "Current Shop" : "Change Shop"}
                            disabled={shop.isCurrent}
                            style={{
                              cursor: shop.isCurrent ? "default" : "pointer",
                              opacity: shop.isCurrent ? 0.6 : 1,
                            }}
                            onClick={async () => {
                              if (shop.isCurrent) return; // Nếu đã là current thì không cần làm gì
                              try {
                                const res = await fetch(
                                  `http://localhost:5001/api/shops/switch/${shop.id}`,
                                  {
                                    method: "PATCH",
                                    headers: {
                                      Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`,
                                    },
                                  }
                                );
                                const data = await res.json();
                                if (data.success) {
                                  alert("Switched to this shop successfully!");
                                  await loadShops(); // refresh danh sách
                                } else {
                                  alert(data.message || "Failed to switch shop");
                                }
                              } catch (err) {
                                console.error("Switch shop error:", err);
                                alert("Server error while switching shop");
                              }
                            }}
                          >
                            { shop.isCurrent ? <Check size={14} /> : <ArrowRight  size={14} /> }
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
                          <button
                            className="shop-action-btn shop-upgrade-btn"
                            onClick={() => handleAction(shop.id, "upgrade")}
                            title={t('shop.upgrade')}
                          >
                            <Star size={14} />
                          </button>
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
            <div className="modal-header">
              <h3>{t('shop.add_shop')}</h3>
              <button
                className="modal-close"
                onClick={() => setIsAddOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
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
                  readOnly
                  disabled
                  style={{ backgroundColor: "#dddbdbff" }}
                />
              </div>
              <div className="form-field">
                <label htmlFor="add-phone">{t('shop.phone_number')}</label>
                <input
                  id="add-phone"
                  type="tel"
                  className="modal-input"
                  value={currentUser?.phone || "Chưa có số điện thoại"}
                  readOnly
                  disabled
                  style={{ backgroundColor: "#dddbdbff" }}
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
                onClick={async () => {
                  try {
                    const payload = {
                      shop_name: addForm.shopName,
                      industry: addForm.category,
                    };

                    console.log("Submit Add:", payload);

                    const res = await fetch("http://localhost:5001/api/shops/", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`,
                      },
                      body: JSON.stringify(payload),
                    });

                    const data = await res.json();
                    if (data.success) {
                      alert("Shop created successfully!");
                      setIsAddOpen(false);
                      // 👉 Gọi lại API để refresh danh sách
                      await loadShops();
                    } else {
                      alert(data.message || "Failed to create shop");
                    }
                  } catch (err) {
                    console.error("Error:", err);
                    alert("Server error");
                  }
                }}
              >
                {t('shop.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Shop Modal */}
      {isUpdateOpen && (
        <div className="modal-overlay" onClick={() => setIsUpdateOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('shop.update_shop')}</h3>
              <button
                className="modal-close"
                onClick={() => setIsUpdateOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
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
                onClick={async () => {
                  try {
                    const payload = {
                      shop_name: updateForm.shopName,
                      industry: updateForm.category,
                    };

                    const res = await fetch(`http://localhost:5001/api/shops/${updateForm.id}`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`,
                      },
                      body: JSON.stringify(payload),
                    });

                    const data = await res.json();
                    if (data.success) {
                      alert("Shop updated successfully!");
                      setIsUpdateOpen(false);

                      // 🔁 Refresh danh sách shop
                      await loadShops();
                    } else {
                      alert(data.message || "Failed to update shop");
                    }
                  } catch (err) {
                    console.error("Error updating shop:", err);
                    alert("Server error while updating shop");
                  }
                }}
              >
                {t('shop.update')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyShop;
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Plus, Edit, Play, Pause, Star } from "lucide-react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";

function MyShop() {
  const { t } = useTranslation();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab] = useState("info");

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
    const loadShops = async () => {
      try {
        setLoading(true);
        // Mock data - thay thế bằng API call thực tế
        const mockShops = [
          {
            id: 1,
            shopName: "Fashion Store",
            package: "Premium",
            employeeCount: 5,
            pageCount: 3,
            role: "Owner",
            expired: "2024-12-31",
            status: "Active",
          },
          {
            id: 2,
            shopName: "Tech Shop",
            package: "Basic",
            employeeCount: 2,
            pageCount: 1,
            role: "Admin",
            expired: "2024-11-15",
            status: "Inactive",
          },
          {
            id: 3,
            shopName: "Beauty Store",
            package: "Pro",
            employeeCount: 8,
            pageCount: 5,
            role: "Manager",
            expired: "2025-01-20",
            status: "Active",
          },
        ];
        setShops(mockShops);
      } catch (e) {
        console.error("Load shops error:", e);
      } finally {
        setLoading(false);
      }
    };
    loadShops();
  }, []);

  //Hành động với page
  const handleAction = (shopId, action) => {
    console.log(`Action ${action} for shop ${shopId}`);
  };

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
          to={ROUTES.SHOP_EMPLOYEE}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t('shop.employee')}
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
                <div className="loading-state">
                  <p>{t('shop.loading_shops')}</p>
                </div>
              ) : (
                <div className="shops-table">
                  <div className="table-header-shop">
                    <div className="table-cell">{t('shop.shop_name')}</div>
                    <div className="table-cell">{t('shop.package')}</div>
                    <div className="table-cell">{t('shop.employee_count')}</div>
                    <div className="table-cell">{t('shop.page_count')}</div>
                    <div className="table-cell">{t('shop.role')}</div>
                    <div className="table-cell">{t('shop.expired')}</div>
                    <div className="table-cell">{t('shop.status')}</div>
                    <div className="table-cell">{t('shop.action')}</div>
                  </div>

                  {shops.map((shop) => (
                    <div key={shop.id} className="table-row-shop">
                      <div className="table-cell" data-label={t('shop.shop_name')}>
                        <div className="shop-name">
                          <div className="shop-avatar">
                            {shop.shopName.charAt(0)}
                          </div>
                          <span>{shop.shopName}</span>
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
                        <span className="expired-date">{shop.expired}</span>
                      </div>
                      <div className="table-cell" data-label={t('shop.status')}>
                        <span
                          className={`status-badge status-${shop.status.toLowerCase()}`}
                        >
                          {shop.status}
                        </span>
                      </div>
                      <div className="table-cell" data-label={t('shop.action')}>
                        <div className="action-buttons">
                          <button
                            className="shop-action-btn shop-update-btn"
                            onClick={() => {
                              setUpdateForm({
                                id: shop.id,
                                shopName: shop.shopName,
                                email: `${shop.shopName
                                  .toLowerCase()
                                  .replace(/\s+/g, "")}@example.com`,
                                phone: "",
                                category: (
                                  shop.package || "other"
                                ).toLowerCase(),
                              });
                              setIsUpdateOpen(true);
                            }}
                            title={t('shop.update')}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="shop-action-btn shop-activate-btn"
                            onClick={() => handleAction(shop.id, "activate")}
                            title={t('shop.activate')}
                          >
                            <Play size={14} />
                          </button>
                          <button
                            className="shop-action-btn shop-deactivate-btn"
                            onClick={() => handleAction(shop.id, "deactivate")}
                            title={t('shop.deactivate')}
                          >
                            <Pause size={14} />
                          </button>
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
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm({ ...addForm, email: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor="add-phone">{t('shop.phone_number')}</label>
                <input
                  id="add-phone"
                  type="tel"
                  className="modal-input"
                  value={addForm.phone}
                  onChange={(e) =>
                    setAddForm({ ...addForm, phone: e.target.value })
                  }
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
                onClick={() => {
                  console.log("Submit Add:", addForm);
                  setIsAddOpen(false);
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
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, email: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor="upd-phone">{t('shop.phone_number')}</label>
                <input
                  id="upd-phone"
                  type="tel"
                  className="modal-input"
                  value={updateForm.phone}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, phone: e.target.value })
                  }
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
                onClick={() => {
                  console.log("Submit Update:", updateForm);
                  setIsUpdateOpen(false);
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

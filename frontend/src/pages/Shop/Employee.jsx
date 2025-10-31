import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Plus, Edit, Play, Pause, Hand } from "lucide-react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";

function Employee() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const loadShops = async () => {
      try {
        setLoading(true);
        // Mock data - thay thế bằng API call thực tế
        const mockEmployees = [
          {
            id: 1,
            name: "User_1",
            email: "user1@gmail.com",
            page: 1,
            role: "Admin",
            status: "Active",
          },
          {
            id: 2,
            name: "User_2",
            email: "user2@gmail.com",
            page: 2,
            role: "Manager",
            status: "Inactive",
          },
          {
            id: 3,
            name: "User_3",
            email: "user3@gmail.com",
            page: 3,
            role: "Saler",
            status: "Active",
          },
        ];
        setEmployees(mockEmployees);
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
    // setIsAddOpen(true);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesEmail = emp.email.toLowerCase().includes(searchEmail.toLowerCase());
    const matchesRole = roleFilter === 'all' ? true : emp.role.toLowerCase() === roleFilter;
    return matchesEmail && matchesRole;
  });

  return (
    <div className="shop-border">
      {/* Tabs/end để active đúng tại shop, ko ăn vào cái khác */}
      <div className="shop-tabs">
        <NavLink end to={ROUTES.SHOP} className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}>{t('shop.my_shop')}</NavLink>
        <NavLink to={ROUTES.SHOP_EMPLOYEE} className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}>{t('shop.employee')}</NavLink>
        <NavLink to={ROUTES.SHOP_HISTORY} className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}>{t('shop.history')}</NavLink>
      </div>

      <div className="shop-page">

        {/* Filters + Add */}
        <div className="top-table-employee">
          <div className="employee-filters">
            <input
              type="text"
              className="filter-input"
              placeholder={t('shop.search_email')}
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
            />
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">{t('shop.all_roles')}</option>
              <option value="admin">{t('shop.admin')}</option>
              <option value="manager">{t('shop.manager')}</option>
              <option value="saler">{t('shop.saler')}</option>
            </select>
          </div>

          <button className="btn-add-new-page" onClick={handleAddNewPage}>
            <Plus size={16} />
            {t('shop.add_new_employee')}
          </button>
        </div>

        {/* Table  */}
        <div className="shop-container">
          <div className="shop-content">
            {loading ? (
              <div className="loading-state">
                <p>{t('shop.loading_employees')}</p>
              </div>
            ) : (
              <div className="shops-table">
                <div className="table-header-employee">
                  <div className="table-cell">{t('shop.name')}</div>
                  <div className="table-cell">{t('shop.email')}</div>
                  <div className="table-cell">{t('shop.page_count')}</div>
                  <div className="table-cell">{t('shop.role')}</div>
                  <div className="table-cell">{t('shop.status')}</div>
                  <div className="table-cell">{t('shop.action')}</div>
                </div>

                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="table-row-employee">
                    <div className="table-cell" data-label={t('shop.name')}>
                      <div className="shop-name">
                        <div className="shop-avatar">
                          {employee.name.charAt(0)}
                        </div>
                        <span>{employee.name}</span>
                      </div>
                    </div>
                    <div className="table-cell" data-label={t('shop.email')}>
                      <span>{employee.email}</span>
                    </div>
                    <div className="table-cell" data-label={t('shop.page_count')}>
                      <span className="employee-count">{employee.page}</span>
                    </div>
                    <div className="table-cell" data-label={t('shop.role')}>
                      <span className="role-badge">{employee.role}</span>
                    </div>
                    <div className="table-cell" data-label={t('shop.status')}>
                      <span
                        className={`status-badge status-${employee.status.toLowerCase()}`}
                      >
                        {employee.status}
                      </span>
                    </div>
                    <div className="table-cell" data-label={t('shop.action')}>
                      <div className="action-buttons">
                        <button
                          className="shop-action-btn shop-update-btn"
                          onClick={() => handleAction(employee.id, "update")}
                          title={t('shop.update')}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="shop-action-btn shop-activate-btn"
                          onClick={() => handleAction(employee.id, "activate")}
                          title={t('shop.activate')}
                        >
                          <Play size={14} />
                        </button>
                        <button
                          className="shop-action-btn shop-deactivate-btn"
                          onClick={() => handleAction(employee.id, "deactivate")}
                          title={t('shop.deactivate')}
                        >
                          <Pause size={14} />
                        </button>
                        <button
                          className="shop-action-btn shop-upgrade-btn"
                          onClick={() => handleAction(employee.id, "relinquish")}
                          title={t('shop.relinquish')}
                        >
                          <Hand size={14} />
                        </button>
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

export default Employee;

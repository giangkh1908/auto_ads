import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Plus, Edit, Play, Pause, Hand } from "lucide-react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";
import { toast } from "sonner";
import { STORAGE_KEYS } from "../../constants/app.constants";
import { useParams } from "react-router-dom";

function Employee() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { shopId } = useParams();
  const userData = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.USER_DATA) || "{}"
  );
  const currentUserId = userData._id;
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [,setHasPermission] = useState(false); // Thêm state kiểm tra quyền

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Marketer");

  useEffect(() => {
    if (employees.length > 0 && currentUserId) {
      const currentEmp = employees.find((emp) => emp.id === currentUserId);
      setCurrentUserRole(currentEmp?.role || null);
    }
  }, [employees, currentUserId]);

  // Kiểm tra quyền và load employees
  useEffect(() => {
    const loadData = async () => {
      if (!shopId) {
        // Nếu không có shopId, redirect về shop list
        toast.error("Shop ID không hợp lệ");
        window.location.href = ROUTES.SHOP;
        return;
      }

      try {
        setLoading(true);

        // 1. Kiểm tra quyền xem employee (lấy từ danh sách shops)
        const shopsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/shops/owner`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(
              STORAGE_KEYS.AUTH_TOKEN
            )}`,
          },
        });
        const shopsData = await shopsRes.json();

        if (shopsData.success) {
          const targetShop = shopsData.data.find((s) => s._id === shopId);
          if (!targetShop) {
            toast.error("Bạn không có quyền truy cập shop này");
            window.location.href = ROUTES.SHOP;
            return;
          }

          // Kiểm tra quyền xem employee
          const permissions = targetShop.user_role?.permissions || [];
          const canView = permissions.some(
            (perm) =>
              perm.module === "employee" && perm.actions.includes("view")
          );

          if (!canView && targetShop.user_role?.role_name !== "Shop Owner") {
            toast.error("Bạn không có quyền xem nhân viên của shop này");
            window.location.href = ROUTES.SHOP;
            return;
          }

          setHasPermission(true);

          // 2. Load employees
          const res = await fetch(
            `${import.meta.env.VITE_API_URL}/api/shop-users/${shopId}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem(
                  STORAGE_KEYS.AUTH_TOKEN
                )}`,
              },
            }
          );
          const data = await res.json();

          if (data.success) {
            const safeEmployees = data.data.map((emp) => ({
              id: emp.user_id,
              name: emp.full_name || "Unknown",
              email: emp.email || "No email",
              role: emp.role_name || "N/A",
              status: emp.status || "Inactive",
              page: emp.page || 0,
            }));
            setEmployees(safeEmployees);
          } else {
            console.error("Fetch employees failed:", data.message);
            toast.error(data.message || "Không thể tải danh sách nhân viên");
          }
        }
      } catch (e) {
        console.error("Load data error:", e);
        toast.error("Lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [shopId]); // Thêm shopId vào dependency

  const handleRoleChange = async (userId, newRoleName) => {
    try {
      const roleMap = {
        "Shop Owner": "68ff6cab6ef1d167ed39c6fa",
        "Marketing Admin": "68ff6cab6ef1d167ed39c6f9",
        Marketer: "68ff6cab6ef1d167ed39c6f8",
      };
      const newRoleId = roleMap[newRoleName];

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/shop-users/${shopId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(
              STORAGE_KEYS.AUTH_TOKEN
            )}`,
          },
          body: JSON.stringify({ userId, newRoleId, currentUserId }),
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success("Cập nhật vai trò thành công!");
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === userId ? { ...emp, role: newRoleName } : emp
          )
        );
      } else {
        toast.error(data.message || "Không thể cập nhật vai trò");
      }
    } catch (err) {
      console.error("Update role error:", err);
      toast.error("Lỗi khi cập nhật vai trò");
    }
  };

  //Hành động với page
  const handleAction = async (userId, action) => {
    try {
      if (action === "relinquish") {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/shop-users/relinquish`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem(
                STORAGE_KEYS.AUTH_TOKEN
              )}`,
            },
            body: JSON.stringify({
              employeeId: userId,
              shopId: shopId,
            }),
          }
        );

        const data = await res.json();
        if (data.success) {
          toast.success(data.message);
          window.location.reload();
        } else {
          toast.error(data.message || "Không thể chuyển quyền");
        }
        return;
      }
      let newStatus = "";
      if (action === "activate") newStatus = "active";
      else if (action === "deactivate") newStatus = "inactive";
      else if (action === "remove") newStatus = "removed";

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/shop-users/status/${shopId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(
              STORAGE_KEYS.AUTH_TOKEN
            )}`,
          },
          body: JSON.stringify({ userId, newStatus, currentUserId }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.user_id === userId ? { ...emp, status: newStatus } : emp
          )
        );
        window.location.reload(); // Reload lại toàn trang sau khi đổi trạng thái
      } else {
        toast.error(data.message || "Không thể cập nhật trạng thái");
      }
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Lỗi khi cập nhật trạng thái");
    }
  };

  const handleInviteEmployee = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Vui lòng nhập email nhân viên!");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/shop-users/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(
            STORAGE_KEYS.AUTH_TOKEN
          )}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          roleId:
            inviteRole === "Marketing Admin"
              ? "68ff6cab6ef1d167ed39c6f9"
              : "68ff6cab6ef1d167ed39c6f8",
          invitedBy: currentUserId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Đã gửi lời mời thành công!");
        setIsInviteOpen(false);
        setInviteEmail("");
        setInviteRole("Marketer");
        window.location.reload(); // reload danh sách nhân viên
      } else {
        toast.error(data.message || "Không thể gửi lời mời");
      }
    } catch (error) {
      console.error("Invite employee error:", error);
      toast.error("Lỗi khi gửi lời mời");
    }
  };

  //Thêm page mới
  const handleAddNewPage = () => {
    setIsInviteOpen(true);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesEmail = emp.email
      ?.toLowerCase()
      .includes(searchEmail.toLowerCase());
    const matchesRole =
      roleFilter === "all"
        ? true
        : emp.role?.toLowerCase() === roleFilter.toLowerCase();

    return matchesEmail && matchesRole;
  });

  const renderInviteModal = () =>
    isInviteOpen && (
      <div className="modal-overlay" onClick={() => setIsInviteOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Thêm nhân viên mới</h3>

          <div className="modal-field">
            <label>Email nhân viên</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="vd: example@gmail.com"
            />
          </div>

          <div className="modal-field">
            <label>Chọn vai trò</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="Marketing Admin">Marketing Admin</option>
              <option value="Marketer">Marketer</option>
            </select>
          </div>

          <div className="modal-actions">
            <button onClick={handleInviteEmployee} className="btn btn-primary">
              Gửi lời mời
            </button>
            <button
              onClick={() => setIsInviteOpen(false)}
              className="btn btn-secondary"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="shop-border">
      {/* Tabs/end để active đúng tại shop, ko ăn vào cái khác */}
      <div className="shop-tabs">
        <NavLink
          end
          to={ROUTES.SHOP}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t("shop.my_shop")}
        </NavLink>
        <NavLink
          to={shopId ? ROUTES.SHOP_EMPLOYEE.replace(':shopId', shopId) : ROUTES.SHOP}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t("shop.employee")}
        </NavLink>
        <NavLink
          to={shopId ? ROUTES.SHOP_HISTORY.replace(':shopId', shopId) : ROUTES.SHOP}
          className={({ isActive }) => `shop-tab ${isActive ? "active" : ""}`}
        >
          {t("shop.history")}
        </NavLink>
      </div>

      <div className="shop-page">
        {/* Filters + Add */}
        <div className="top-table-employee">
          <div className="employee-filters">
            <input
              type="text"
              className="filter-input"
              placeholder={t("shop.search_email")}
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
            />
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">{t("shop.all_roles")}</option>
              <option value="Shop Owner">Shop Owner</option>
              <option value="Marketing Admin">Marketing Admin</option>
              <option value="Marketer">Marketer</option>
            </select>
          </div>

          <button className="btn-add-new-page" onClick={handleAddNewPage}>
            <Plus size={16} />
            {t("shop.add_new_employee")}
          </button>
        </div>

        {/* Table  */}
        <div className="shop-container">
          <div className="shop-content">
            {loading ? (
              <div className="loading-state">
                <p>{t("shop.loading_employees")}</p>
              </div>
            ) : (
              <div className="shops-table">
                <div className="table-header-employee">
                  <div className="table-cell">{t("shop.name")}</div>
                  <div className="table-cell">{t("shop.email")}</div>
                  <div className="table-cell">{t("shop.page_count")}</div>
                  <div className="table-cell">{t("shop.role")}</div>
                  <div className="table-cell">{t("shop.status")}</div>
                  <div className="table-cell">{t("shop.action")}</div>
                </div>

                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="table-row-employee">
                    <div className="table-cell" data-label={t("shop.name")}>
                      <div className="shop-name">
                        <div className="shop-avatar">
                          {employee.name ? employee.name.charAt(0) : "?"}
                        </div>
                        <span>{employee.name}</span>
                      </div>
                    </div>
                    <div className="table-cell" data-label={t("shop.email")}>
                      <span>{employee.email}</span>
                    </div>
                    <div
                      className="table-cell"
                      data-label={t("shop.page_count")}
                    >
                      <span className="employee-count">{employee.page}</span>
                    </div>
                    <div className="table-cell" data-label={t("shop.role")}>
                      <select
                        className="role-select"
                        value={employee.role}
                        onChange={(e) =>
                          handleRoleChange(employee.id, e.target.value)
                        }
                        disabled={employee.role === "Shop Owner"} // không cho sửa owner
                      >
                        <option value="Shop Owner">Shop Owner</option>
                        <option value="Marketing Admin">Marketing Admin</option>
                        <option value="Marketer">Marketer</option>
                      </select>
                    </div>
                    <div className="table-cell" data-label={t("shop.status")}>
                      <span
                        className={`status-badge status-${employee.status.toLowerCase()}`}
                      >
                        {employee.status}
                      </span>
                    </div>
                    <div className="table-cell" data-label={t("shop.action")}>
                      <div className="action-buttons">
                        {/* <button
                          className="shop-action-btn shop-update-btn"
                          onClick={() => handleAction(employee.id, "update")}
                          title={t('shop.update')}
                        >
                          <Edit size={14} />
                        </button> */}
                        <button
                          className="shop-action-btn shop-activate-btn"
                          onClick={() => handleAction(employee.id, "activate")}
                          title={t("shop.activate")}
                        >
                          <Play size={14} />
                        </button>
                        <button
                          className="shop-action-btn shop-deactivate-btn"
                          onClick={() =>
                            handleAction(employee.id, "deactivate")
                          }
                          title={t("shop.deactivate")}
                        >
                          <Pause size={14} />
                        </button>
                        {currentUserRole === "Shop Owner" && (
                          <button
                            className="shop-action-btn shop-upgrade-btn"
                            onClick={() =>
                              handleAction(employee.id, "relinquish")
                            }
                            title={t("shop.relinquish")}
                          >
                            <Hand size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {renderInviteModal()}
    </div>
  );
}

export default Employee;

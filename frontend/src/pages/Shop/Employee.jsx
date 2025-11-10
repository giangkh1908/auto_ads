import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { Plus, Edit, Play, Pause, Hand, Flag } from "lucide-react";
import { ROUTES } from "../../constants/app.constants";
import "./Shop.css";
import { toast } from "react-toastify";
import { STORAGE_KEYS } from '../../constants/app.constants';
import { useParams } from "react-router-dom";
import axiosInstance from "../../utils/axios.js";
import { getShopCache, saveShopCache } from "../../utils/shopCache";
import ConfirmationPopup from "../../components/common/ConfirmationPopup/ConfirmationPopup.jsx";

function Employee() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { shopId: shopIdFromParams } = useParams();
  const navigate = useNavigate();
  const userData = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.USER_DATA) || "{}"
  );
  const currentUserId = userData._id;
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [actualShopId, setActualShopId] = useState(shopIdFromParams);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Marketer");

  const [selectedPages, setSelectedPages] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // State cho popup xác nhận chuyển giao
  const [isRelinquishOpen, setIsRelinquishOpen] = useState(false);
  const [selectedEmployeeForRelinquish, setSelectedEmployeeForRelinquish] = useState(null);
  const [isLoadingRelinquish, setIsLoadingRelinquish] = useState(false);

  // State cho popup xác nhận thay đổi role
  const [isRoleChangeOpen, setIsRoleChangeOpen] = useState(false);
  const [selectedEmployeeForRoleChange, setSelectedEmployeeForRoleChange] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [oldRoleName, setOldRoleName] = useState("");
  const [isLoadingRoleChange, setIsLoadingRoleChange] = useState(false);

  // Lấy current shop nếu không có shopId trong URL và kiểm tra quyền truy cập
  useEffect(() => {
    const getCurrentShop = async () => {
      try {
        // Lấy danh sách shops để kiểm tra role
        const res = await axiosInstance.get("/api/shops/owner");
        const data = res.data;

        if (data.success && Array.isArray(data.data)) {
          const currentShop = data.data.find((shop) => shop.is_current);
          
          // Kiểm tra nếu role là Marketer thì redirect về /shop
          if (currentShop?.user_role?.role_name === "Marketer") {
            toast.error("Bạn không có quyền truy cập trang này");
            navigate(ROUTES.SHOP, { replace: true });
            return;
          }

          if (shopIdFromParams) {
            setActualShopId(shopIdFromParams);
            return;
          }

          if (currentShop) {
            const currentShopId = currentShop._id;
            setActualShopId(currentShopId);
            // Redirect đến URL với shopId
            navigate(ROUTES.SHOP_EMPLOYEE.replace(":shopId", currentShopId), { replace: true });
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

  useEffect(() => {
    if (employees.length > 0 && currentUserId) {
      const currentEmp = employees.find(emp => emp.id === currentUserId);
      setCurrentUserRole(currentEmp?.role || null);
    }
  }, [employees, currentUserId]);

  // Load employees khi actualShopId thay đổi
  useEffect(() => {
    const loadEmployees = async () => {
      if (!actualShopId) return;

      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/shop-users/${actualShopId}`);
        const data = res.data;

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
          toast.error(data.message || "Không thể tải danh sách nhân viên");
        }
      } catch (e) {
        console.error("Load employees error:", e);
        toast.error(e.response?.data?.message || "Lỗi khi tải danh sách nhân viên");
      } finally {
        setLoading(false);
      }
    };
    loadEmployees();
  }, [actualShopId]);

  const handleRoleChange = (userId, newRoleName) => {
    if (!actualShopId) return;
    
    // Tìm employee để lấy thông tin
    const employee = employees.find(emp => emp.id === userId);
    if (!employee) return;

    // Lưu thông tin để hiển thị trong popup
    setSelectedEmployeeForRoleChange(employee);
    setOldRoleName(employee.role);
    setNewRoleName(newRoleName);
    setIsRoleChangeOpen(true);
  };

  // Xác nhận thay đổi role
  const handleConfirmRoleChange = async () => {
    if (!selectedEmployeeForRoleChange || !actualShopId || !newRoleName) return;

    setIsLoadingRoleChange(true);
    try {
      const roleMap = {
        "Shop Owner": "68ff6cab6ef1d167ed39c6fa",
        "Marketing Admin": "68ff6cab6ef1d167ed39c6f9",
        "Marketer": "68ff6cab6ef1d167ed39c6f8",
      };
      const newRoleId = roleMap[newRoleName];

      const res = await axiosInstance.put(`/api/shop-users/${actualShopId}`, {
        userId: selectedEmployeeForRoleChange.id,
        newRoleId,
        currentUserId,
      });

      const data = res.data;
      // Kiểm tra thành công: có success: true hoặc status 200 và có message
      if (data.success === true || (res.status === 200 && data.message)) {
        // Nếu thay đổi role của chính mình → cập nhật cache
        if (selectedEmployeeForRoleChange.id === currentUserId) {
          const cachedShop = getShopCache();
          if (cachedShop && cachedShop.id === actualShopId) {
            saveShopCache({
              ...cachedShop,
              role: newRoleName,
            });
            setUserRoleInShop(newRoleName);
          }
        }
        
        // Đóng popup ngay lập tức
        setIsRoleChangeOpen(false);
        setIsLoadingRoleChange(false);
        setSelectedEmployeeForRoleChange(null);
        setNewRoleName("");
        setOldRoleName("");
        
        // Hiển thị toast success
        toast.success(data.message || "Cập nhật vai trò thành công!");
        
        // Reload trang sau một khoảng thời gian ngắn để đảm bảo toast hiển thị
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        // Xử lý lỗi từ API
        const errorMessage = data.error?.message || data.message || "Không thể cập nhật vai trò";
        toast.error(errorMessage);
        setIsLoadingRoleChange(false);
      }
    } catch (err) {
      console.error("Update role error:", err);
      const errorMessage = err.response?.data?.error?.message || 
                          err.response?.data?.message || 
                          "Lỗi khi cập nhật vai trò";
      toast.error(errorMessage);
      setIsLoadingRoleChange(false);
    }
  };

  const handleOpenPageAssignModal = async (employee) => {
    try {
      setSelectedEmployee(employee);
      const res = await axiosInstance.get("/api/shops/facebook/pages");
      const data = res.data;
      if (data.success) {
        setPages(data.data.pages || []);
        setShowModal(true);
      } else {
        toast.error("Không thể tải danh sách Page");
      }
    } catch (error) {
      console.error("Error loading pages:", error);
      toast.error(error.response?.data?.message || "Lỗi khi tải danh sách Page");
    }
  };

  const handleAssignPages = async () => {
    try {
      const res = await axiosInstance.post("/api/shop-users/assign-pages", {
        shopId: actualShopId,
        employeeId: selectedEmployee.id,
        pages: selectedPages.map((p) => ({
          page_id: p.id,
          page_token: p.pageAccessToken,
          page_info: {
            name: p.name,
            category: p.category,
            picture_url: p.picture,
          },
        })),
      });
      const data = res.data;
      if (data.success) {
        toast.success("Phân quyền Page thành công!");
        setShowModal(false);
      } else {
        toast.error(data.message || "Không thể phân quyền Page");
      }
    } catch (error) {
      console.error("Assign pages error:", error);
      toast.error(error.response?.data?.message || "Lỗi khi phân quyền Page");
    }
  };

  //Hành động với page
  const handleAction = async (userId, action) => {
    try {
      if (action === "relinquish") {
        // Tìm employee để lấy thông tin hiển thị trong popup
        const employee = employees.find(emp => emp.id === userId);
        setSelectedEmployeeForRelinquish(employee);
        setIsRelinquishOpen(true);
        return;
      }
      let newStatus = "";
      if (action === "activate") newStatus = "active";
      else if (action === "deactivate") newStatus = "inactive";
      else if (action === "remove") newStatus = "removed";

      const res = await axiosInstance.put(`/api/shop-users/status/${actualShopId}`, {
        userId,
        newStatus,
        currentUserId,
      });

      const data = res.data;

      if (data.success) {
        // Hiển thị toast với message phù hợp
        const statusMessage = 
          newStatus === "active" 
            ? "Đã kích hoạt nhân viên thành công!" 
            : newStatus === "inactive"
            ? "Đã vô hiệu hóa nhân viên thành công!"
            : data.message || "Cập nhật trạng thái thành công!";
        
        toast.success(statusMessage);
        
        // Cập nhật state mà không cần reload trang
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === userId ? { ...emp, status: newStatus } : emp
          )
        );
      } else {
        toast.error(data.message || "Không thể cập nhật trạng thái");
      }
    } catch (error) {
      console.error("Update status error:", error);
      toast.error(error.response?.data?.message || "Lỗi khi cập nhật trạng thái");
    }
  };

  const handleInviteEmployee = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Vui lòng nhập email nhân viên!");
      return;
    }

    try {
      const res = await axiosInstance.post("/api/shop-users/invite", {
        shopId: actualShopId,
        email: inviteEmail.trim(),
        roleId:
          inviteRole === "Marketing Admin"
            ? "68ff6cab6ef1d167ed39c6f9"
            : "68ff6cab6ef1d167ed39c6f8",
        invitedBy: currentUserId,
      });

      const data = res.data;

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
      toast.error(error.response?.data?.message || "Lỗi khi gửi lời mời");
    }
  };

  //Thêm page mới
  const handleAddNewPage = () => {
    setIsInviteOpen(true);
  };

  // Xác nhận chuyển giao quyền
  const handleConfirmRelinquish = async () => {
    if (!selectedEmployeeForRelinquish || !actualShopId) return;

    setIsLoadingRelinquish(true);
    try {
      const res = await axiosInstance.put("/api/shop-users/relinquish", {
        employeeId: selectedEmployeeForRelinquish.id,
        shopId: actualShopId,
      });

      const data = res.data;
      // Kiểm tra thành công: có success: true hoặc status 200 và có message/code
      if (data.success === true || (res.status === 200 && (data.message || data.code))) {
        // Khi chuyển giao quyền, role của user hiện tại sẽ thành "Marketing Admin"
        // Cập nhật cache với role mới
        const cachedShop = getShopCache();
        if (cachedShop && cachedShop.id === actualShopId) {
          saveShopCache({
            ...cachedShop,
            role: "Marketing Admin", // Sau khi relinquish, role cũ sẽ thành Marketing Admin
          });
          setUserRoleInShop("Marketing Admin");
        }
        
        // Đóng popup ngay lập tức
        setIsRelinquishOpen(false);
        setIsLoadingRelinquish(false);
        setSelectedEmployeeForRelinquish(null);
        
        // Hiển thị toast success
        toast.success(data.message || "Chuyển giao quyền thành công!");
        
        // Reload trang sau một khoảng thời gian ngắn để đảm bảo toast hiển thị
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        // Xử lý lỗi từ API
        const errorMessage = data.error?.message || data.message || "Không thể chuyển quyền";
        toast.error(errorMessage);
        setIsLoadingRelinquish(false);
      }
    } catch (error) {
      console.error("Relinquish error:", error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          "Lỗi khi chuyển giao quyền";
      toast.error(errorMessage);
      setIsLoadingRelinquish(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesEmail = emp.email?.toLowerCase().includes(searchEmail.toLowerCase());
    const matchesRole =
      roleFilter === "all"
        ? true
        : emp.role?.toLowerCase() === roleFilter.toLowerCase();

    return matchesEmail && matchesRole;
  });

  const renderInviteModal = () => (
    isInviteOpen && (
      <div className="modal-overlay" onClick={() => setIsInviteOpen(false)}>
        <div className="modal-content-shop" onClick={(e) => e.stopPropagation()}>
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
            <button onClick={handleInviteEmployee} className="btn btn-primary">Gửi lời mời</button>
            <button onClick={() => setIsInviteOpen(false)} className="btn btn-secondary">Hủy</button>
          </div>
        </div>
      </div>
    )
  );

  // Lấy role từ cache ngay lập tức khi khởi tạo state
  const [userRoleInShop, setUserRoleInShop] = useState(() => {
    const cachedShop = getShopCache();
    return cachedShop?.role || null;
  });
  
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const res = await axiosInstance.get("/api/shops/owner");
        const data = res.data;
        if (data.success && Array.isArray(data.data)) {
          const currentShop = data.data.find((shop) => shop.is_current);
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
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchUserRole();
  }, []);

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
              <option value="Shop Owner">Shop Owner</option>
              <option value="Marketing Admin">Marketing Admin</option>
              <option value="Marketer">Marketer</option>
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
                  <div className="table-cell-name">{t("shop.name")}</div>
                  <div className="table-cell">{t("shop.email")}</div>
                  <div className="table-cell">{t("shop.page_count")}</div>
                  <div className="table-cell">{t("shop.role")}</div>
                  <div className="table-cell">{t("shop.status")}</div>
                  <div className="table-cell">{t("shop.action")}</div>
                </div>

                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="table-row-employee">
                    <div className="table-cell-name" data-label={t("shop.name")}>
                      <div className="shop-name">
                        <div className="shop-avatar">
                          {employee.name ? employee.name.charAt(0) : "?"}
                        </div>
                        <span>{employee.name}</span>
                      </div>
                    </div>
                    <div className="table-cell" data-label={t('shop.email')}>
                      <span>{employee.email}</span>
                    </div>
                    <div
                      className="table-cell"
                      // data-label={t("shop.page_count")}
                    >
                      <button
                        className="btn-assign-page"
                        onClick={() => handleOpenPageAssignModal(employee)}
                        title="Phân quyền Page"
                      >
                        <Flag size={18} />
                      </button>
                    </div>
                    <div className="table-cell" data-label={t('shop.role')}>
                      <select
                        className="role-select"
                        value={
                          isRoleChangeOpen && 
                          selectedEmployeeForRoleChange?.id === employee.id
                            ? oldRoleName 
                            : employee.role
                        }
                        onChange={(e) => {
                          // Nếu role không thay đổi thì không làm gì
                          if (e.target.value === employee.role) return;
                          handleRoleChange(employee.id, e.target.value);
                        }}
                        disabled={employee.role === "Shop Owner"} // không cho sửa owner
                      >
                        <option value="Shop Owner">Shop Owner</option>
                        <option value="Marketing Admin">Marketing Admin</option>
                        <option value="Marketer">Marketer</option>
                      </select>
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
                        {/* Chỉ hiển thị button activate nếu status không phải active */}
                        {employee.status?.toLowerCase() !== "active" && (
                          <button
                            className="shop-action-btn shop-activate-btn"
                            onClick={() => handleAction(employee.id, "activate")}
                            title={t("shop.activate")}
                            disabled={employee.role === "Shop Owner"}
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {/* Chỉ hiển thị button deactivate nếu status là active */}
                        {employee.status?.toLowerCase() === "active" && (
                          <button
                            className="shop-action-btn shop-deactivate-btn"
                            onClick={() =>
                              handleAction(employee.id, "deactivate")
                            }
                            title={t("shop.deactivate")}
                            disabled={employee.role === "Shop Owner"}
                          >
                            <Pause size={14} />
                          </button>
                        )}
                        {/* Button relinquish chỉ hiển thị cho Shop Owner và chỉ khi employee không phải Shop Owner */}
                        {currentUserRole === "Shop Owner" && 
                         employee.role !== "Shop Owner" && (
                          <button
                            className="shop-action-btn shop-upgrade-btn"
                            onClick={() => handleAction(employee.id, "relinquish")}
                            title={t('shop.relinquish')}
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
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-shop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-shop">
              <h3>Phân quyền Page cho nhân viên</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body-shop">
              {pages.map((p) => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <input
                    type="checkbox"
                    checked={selectedPages.some((sp) => sp.id === p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPages([...selectedPages, p]);
                      else
                        setSelectedPages(selectedPages.filter((sp) => sp.id !== p.id));
                    }}
                  />
                  <img src={p.picture} alt="" width={24} style={{ borderRadius: "4px" }} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleAssignPages}>
                Lưu phân quyền
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup xác nhận chuyển giao quyền */}
      <ConfirmationPopup
        isOpen={isRelinquishOpen}
        onClose={() => {
          setIsRelinquishOpen(false);
          setSelectedEmployeeForRelinquish(null);
        }}
        onConfirm={handleConfirmRelinquish}
        title="Xác nhận chuyển giao quyền"
        message={
          selectedEmployeeForRelinquish
            ? `Bạn có chắc chắn muốn chuyển giao quyền Shop Owner cho "${selectedEmployeeForRelinquish.name}" (${selectedEmployeeForRelinquish.email})? Hành động này không thể hoàn tác.`
            : "Bạn có chắc chắn muốn chuyển giao quyền Shop Owner?"
        }
        confirmText="Xác nhận chuyển giao"
        cancelText="Hủy"
        type="delete"
        isLoading={isLoadingRelinquish}
      />

      {/* Popup xác nhận thay đổi role */}
      <ConfirmationPopup
        isOpen={isRoleChangeOpen}
        onClose={() => {
          setIsRoleChangeOpen(false);
          setSelectedEmployeeForRoleChange(null);
          setNewRoleName("");
          setOldRoleName("");
        }}
        onConfirm={handleConfirmRoleChange}
        title="Xác nhận thay đổi vai trò"
        message={
          selectedEmployeeForRoleChange
            ? `Bạn có chắc chắn muốn thay đổi vai trò của "${selectedEmployeeForRoleChange.name}" (${selectedEmployeeForRoleChange.email}) từ "${oldRoleName}" sang "${newRoleName}"?`
            : "Bạn có chắc chắn muốn thay đổi vai trò?"
        }
        confirmText="Xác nhận thay đổi"
        cancelText="Hủy"
        type="archive"
        isLoading={isLoadingRoleChange}
      />
    </div>
  );
}

export default Employee;
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useToast } from "../../../../../hooks/useToast";
import "./InternalPage.css";

const STAFF_ROLES = ["System Admin", "CS Staff", "Accountant"];

export default function AddNewStaff({ isOpen, onClose, onAdd }) {
  const [form, setForm] = useState({
    email: "",
    role: "CS Staff",
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    // Validate
    if (!form.email.trim()) {
      toast.error("Vui lòng nhập email");
      return;
    }
    if (!form.role) {
      toast.error("Vui lòng chọn role");
      return;
    }

    setLoading(true);
    try {
      // Gọi callback từ parent component
      await onAdd(form);

      // Reset form và đóng modal
      setForm({ email: "", role: "CS Staff" });
      toast.success("Thêm staff thành công!");
      onClose();
    } catch (error) {
      console.error("Error adding staff:", error);
      
      // Lấy error message từ response
      const errorMessage = 
        error?.response?.data?.message || 
        error?.message || 
        "Có lỗi xảy ra khi thêm staff";
      
      toast.error("Thêm staff thất bại", {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return; // Không cho đóng khi đang loading
    setForm({ email: "", role: "CS Staff" });
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="amu-modal-overlay" onClick={handleClose}>
      <div className="amu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="amu-modal-header">
          <h3 className="amu-modal-title">Add New Staff</h3>
          <button className="amu-modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        <div className="amu-modal-body">
          <div className="amu-modal-field">
            <label className="amu-modal-label">
              Email <span className="amu-required">*</span>
            </label>
            <input
              type="email"
              className="amu-modal-input"
              placeholder="Enter email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="amu-modal-field">
            <label className="amu-modal-label">
              Role <span className="amu-required">*</span>
            </label>
            <select
              className="amu-modal-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="amu-modal-footer">
          <button 
            className="amu-modal-btn-add" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


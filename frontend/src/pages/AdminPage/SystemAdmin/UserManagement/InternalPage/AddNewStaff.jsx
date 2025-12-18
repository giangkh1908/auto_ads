import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import { useToast } from "../../../../../hooks/common/useToast";
import "./InternalPage.css";

export default function AddNewStaff({ isOpen, onClose, onAdd }) {
  const { t } = useTranslation("admin");
  const [form, setForm] = useState({
    email: "",
    role: "CS Staff",
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const STAFF_ROLES = [
    t("internalPage.roles.systemAdmin"),
    t("internalPage.roles.csStaff"),
    t("internalPage.roles.accountant")
  ];

  const handleSubmit = async () => {
    // Validate
    if (!form.email.trim()) {
      toast.error(t("addNewStaff.messages.emailRequired"));
      return;
    }
    if (!form.role) {
      toast.error(t("addNewStaff.messages.roleRequired"));
      return;
    }

    setLoading(true);
    try {
      // Gọi callback từ parent component
      await onAdd(form);

      // Reset form và đóng modal
      setForm({ email: "", role: "CS Staff" });
      toast.success(t("addNewStaff.messages.addSuccess"));
      onClose();
    } catch (error) {
      console.error("Error adding staff:", error);

      // Lấy error message từ response
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t("addNewStaff.messages.addErrorGeneric");

      toast.error(t("addNewStaff.messages.addError"), {
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
          <h3 className="amu-modal-title">{t("addNewStaff.title")}</h3>
          <button className="amu-modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        <div className="amu-modal-body">
          <div className="amu-modal-field">
            <label className="amu-modal-label">
              {t("addNewStaff.email")} <span className="amu-required">{t("addNewStaff.required")}</span>
            </label>
            <input
              type="email"
              className="amu-modal-input"
              placeholder={t("addNewStaff.emailPlaceholder")}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="amu-modal-field">
            <label className="amu-modal-label">
              {t("addNewStaff.role")} <span className="amu-required">{t("addNewStaff.required")}</span>
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
                <span>{t("addNewStaff.processing")}</span>
              </>
            ) : (
              t("addNewStaff.add")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


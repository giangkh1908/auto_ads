import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./CustomerPage.css";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import { X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import NoteEditor from "../../../../../components/common/NoteEditor/NoteEditor";

export default function CustomerUpdate({ isOpen, onClose, userId, onUpdateSuccess }) {
  const { t } = useTranslation("admin");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [noteId, setNoteId] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    country: "",
  });
  const [servicePackage, setServicePackage] = useState("-");

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Reset form khi đóng modal
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        country: "",
      });
      setServicePackage("-");
      setNote("");
      setNoteId(null);
      setError(null);
    }
  }, [isOpen]);

  // Fetch user details khi mở modal
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!isOpen || !userId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await axiosInstance.get(API_ENDPOINTS.USERS.DETAIL(userId));

        if (response.data.success) {
          const user = response.data.data;
          setFormData({
            full_name: user.full_name || "",
            email: user.email || "",
            phone: user.phone || "",
            country: user.country || "",
          });

          // Fetch user packages để lấy ServicePackage
          try {
            const packageResponse = await axiosInstance.get(
              `/api/user-package?user_id=${userId}&status=active`
            );
            if (packageResponse.data.success && packageResponse.data.data?.length > 0) {
              const activePackage = packageResponse.data.data[0];
              const packageName = activePackage.package_id?.name || "Chưa nâng cấp";
              setServicePackage(packageName);
            } else {
              setServicePackage("Chưa nâng cấp");
            }
          } catch (packageErr) {
            console.log("No package found or error fetching package:", packageErr);
            setServicePackage("Chưa nâng cấp");
          }

          // Fetch note
          try {
            const noteResponse = await axiosInstance.get(
              API_ENDPOINTS.NOTES.LATEST("User", userId)
            );
            if (noteResponse.data.success && noteResponse.data.data) {
              setNote(noteResponse.data.data.note || "");
              setNoteId(noteResponse.data.data._id || null);
            } else {
              setNote("");
              setNoteId(null);
            }
          } catch (noteErr) {
            // Note không bắt buộc, chỉ log error
            console.log("No note found or error fetching note:", noteErr);
            setNote("");
            setNoteId(null);
          }
        } else {
          setError(t("customerUpdate.messages.loadError"));
        }
      } catch (err) {
        console.error("Error fetching user details:", err);
        setError(err.response?.data?.message || t("customerUpdate.messages.loadErrorGeneric"));
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [isOpen, userId, t]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const response = await axiosInstance.put(API_ENDPOINTS.USERS.UPDATE(userId), {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        country: formData.country,
      });

      if (response.data.success) {
        toast.success(t("customerUpdate.messages.updateSuccess"));
        if (onUpdateSuccess) {
          onUpdateSuccess(response.data.data);
        }
        onClose();
      } else {
        throw new Error(response.data.message || t("customerUpdate.messages.updateError"));
      }
    } catch (err) {
      console.error("Error updating user:", err);
      const errorMessage =
        err.response?.data?.message || err.message || t("customerUpdate.messages.updateErrorGeneric");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="amu-customer-update-overlay" onClick={onClose}>
      <div className="amu-customer-update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="amu-customer-update-header">
          <h3 className="amu-customer-update-title">{t("customerUpdate.title")}</h3>
          <button className="amu-customer-update-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="amu-customer-update-body">
          {loading ? (
            <div className="amu-customer-update-loading">
              <Loader2 size={24} className="spinner" />
              <p>{t("customerUpdate.loading")}</p>
            </div>
          ) : error && !formData.full_name ? (
            <div className="amu-customer-update-error">{error}</div>
          ) : (
            <form onSubmit={handleSubmit} className="amu-customer-update-form">
              {error && (
                <div className="amu-customer-update-error-message">{error}</div>
              )}

              <div className="amu-customer-update-field">
                <label htmlFor="full_name" className="amu-customer-update-label">
                  {t("customerUpdate.fullName")} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  className="amu-customer-update-input"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  placeholder={t("customerUpdate.fullNamePlaceholder")}
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="userId" className="amu-customer-update-label">
                  {t("customerUpdate.userId")}
                </label>
                <input
                  type="text"
                  id="userId"
                  name="userId"
                  className="amu-customer-update-input"
                  value={userId || ""}
                  readOnly
                  disabled
                  style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="email" className="amu-customer-update-label">
                  {t("customerUpdate.email")} <span className="required">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="amu-customer-update-input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder={t("customerUpdate.emailPlaceholder")}
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="phone" className="amu-customer-update-label">
                  {t("customerUpdate.phone")}
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="amu-customer-update-input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t("customerUpdate.phonePlaceholder")}
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="country" className="amu-customer-update-label">
                  {t("customerUpdate.country")}
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  className="amu-customer-update-input"
                  value={formData.country}
                  placeholder={t("customerUpdate.countryPlaceholder")}
                  readOnly
                  disabled
                  style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="servicePackage" className="amu-customer-update-label">
                  {t("customerUpdate.servicePackage")}
                </label>
                <input
                  type="text"
                  id="servicePackage"
                  name="servicePackage"
                  className="amu-customer-update-input"
                  value={servicePackage}
                  readOnly
                  disabled
                  style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                />
              </div>

              <div className="amu-customer-update-field">
                <label className="amu-customer-update-label">{t("customerUpdate.note")}</label>
                <NoteEditor
                  targetType="User"
                  targetId={userId}
                  initialNote={note}
                  noteId={noteId}
                  onNoteSaved={(savedData) => {
                    setNote(savedData.note || "");
                    setNoteId(savedData.noteId || null);
                  }}
                />
              </div>

              <div className="amu-customer-update-actions">
                <button
                  type="button"
                  className="amu-customer-update-btn amu-customer-update-btn-cancel"
                  onClick={onClose}
                  disabled={saving}
                >
                  {t("customerUpdate.cancel")}
                </button>
                <button
                  type="submit"
                  className="amu-customer-update-btn amu-customer-update-btn-save"
                  disabled={saving || loading}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      {t("customerUpdate.saving")}
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {t("customerUpdate.saveChanges")}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


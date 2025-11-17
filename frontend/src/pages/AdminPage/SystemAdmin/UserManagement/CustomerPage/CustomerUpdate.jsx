import { useState, useEffect } from "react";
import "./CustomerPage.css";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import { X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import NoteEditor from "../../../../../components/common/NoteEditor/NoteEditor";

export default function CustomerUpdate({ isOpen, onClose, userId, onUpdateSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [noteId, setNoteId] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    status: "active",
  });

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
        status: "active",
      });
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
            status: user.status || "active",
          });

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
          setError("Không thể tải thông tin user");
        }
      } catch (err) {
        console.error("Error fetching user details:", err);
        setError(err.response?.data?.message || "Có lỗi xảy ra khi tải thông tin user");
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [isOpen, userId]);

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
        status: formData.status,
      });

      if (response.data.success) {
        toast.success("Cập nhật thông tin user thành công!");
        if (onUpdateSuccess) {
          onUpdateSuccess(response.data.data);
        }
        onClose();
      } else {
        throw new Error(response.data.message || "Có lỗi xảy ra khi cập nhật");
      }
    } catch (err) {
      console.error("Error updating user:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Có lỗi xảy ra khi cập nhật user";
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
          <h3 className="amu-customer-update-title">User Details</h3>
          <button className="amu-customer-update-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="amu-customer-update-body">
          {loading ? (
            <div className="amu-customer-update-loading">
              <Loader2 size={24} className="spinner" />
              <p>Đang tải thông tin...</p>
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
                  Full Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  className="amu-customer-update-input"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  placeholder="Enter full name"
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="email" className="amu-customer-update-label">
                  Email <span className="required">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="amu-customer-update-input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter email address"
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="phone" className="amu-customer-update-label">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="amu-customer-update-input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="amu-customer-update-field">
                <label htmlFor="status" className="amu-customer-update-label">
                  Status <span className="required">*</span>
                </label>
                <select
                  id="status"
                  name="status"
                  className="amu-customer-update-select"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="banned">Banned</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="amu-customer-update-field">
                <label className="amu-customer-update-label">Note</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="amu-customer-update-btn amu-customer-update-btn-save"
                  disabled={saving || loading}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
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


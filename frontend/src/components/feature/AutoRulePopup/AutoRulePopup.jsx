import { useCallback } from "react";
import { X, Plus, Info } from "lucide-react";
import "./AutoRulePopup.css";
import {
  ACTIONS_OPTIONS,
  DEFAULT_METRIC,
  DEFAULT_OPERATOR,
  DEFAULT_UNIT,
  getAvailableUnits,
  convertConditionToBE,
  convertScheduleToBE,
  ACTION_VI_TO_BE,
} from "../../../constants/autoRuleConstants";
import { useAutoRuleForm } from "../../../hooks/useAutoRuleForm";
import { useHierarchicalData } from "../../../hooks/useHierarchicalData";
import { validateAndConvertToBackend } from "../../../utils/autoRuleValidation";
import HierarchicalSelector from "./HierarchicalSelector";
import ConditionRow from "./ConditionRow";
import CustomSchedule from "./CustomSchedule";

const AutoRulePopup = ({
  isOpen,
  onClose,
  onSave,
  accountId = null,
  subscriber = null,
  editingRule = null,
}) => {
  // Use custom hooks for form and hierarchical data
  const [formData, setFormData] = useAutoRuleForm(editingRule);
  const {
    hierarchicalData,
    loadingData,
    expandedCampaigns,
    expandedAdsets,
    setExpandedCampaigns,
    setExpandedAdsets,
  } = useHierarchicalData(accountId, isOpen, editingRule);

  const handleInputChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, [setFormData]);

  // Memoize selection change handler to prevent unnecessary re-renders
  // Update all fields in a single state update to avoid multiple re-renders
  const handleSelectionChange = useCallback(
    (campaignIds, adsetIds, adIds, applyToText) => {
      setFormData((prev) => ({
        ...prev,
        selectedCampaignIds: campaignIds,
        selectedAdsetIds: adsetIds,
        selectedAdIds: adIds,
        applyTo: applyToText,
      }));
    },
    [setFormData]
  );

  const handleConditionChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const newConditions = [...prev.conditions];
      const updatedCondition = {
        ...newConditions[index],
        [field]: value,
      };
      
      // Nếu thay đổi metric, tự động cập nhật unit theo mapping
      if (field === "metric") {
        const availableUnits = getAvailableUnits(value);
        // Nếu unit hiện tại không có trong available units, set unit đầu tiên
        if (!availableUnits.includes(updatedCondition.unit)) {
          updatedCondition.unit = availableUnits[0] || "";
        }
      }
      
      newConditions[index] = updatedCondition;
      return {
        ...prev,
        conditions: newConditions,
      };
    });
  }, [setFormData]);

  const addCondition = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          metric: DEFAULT_METRIC,
          operator: DEFAULT_OPERATOR,
          value: "",
          unit: DEFAULT_UNIT,
        },
      ],
    }));
  }, [setFormData]);

  const removeCondition = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  }, [setFormData]);

  const handleCustomScheduleDayCheck = useCallback((dayIndex, checked) => {
    setFormData((prev) => {
      const newDays = [...prev.customSchedule.days];
      if (checked) {
        // Khi check, enable inputs
        newDays[dayIndex] = {
          ...newDays[dayIndex],
          checked: true,
        };
      } else {
        // Khi uncheck, disable inputs và reset về 00:00, chỉ giữ 1 slot
        newDays[dayIndex] = {
          ...newDays[dayIndex],
          checked: false,
          timeSlots: [{ startTime: "00:00", endTime: "00:00" }],
        };
      }
      return {
        ...prev,
        customSchedule: {
          ...prev.customSchedule,
          days: newDays,
        },
      };
    });
  }, [setFormData]);

  const handleCustomScheduleTimeSlotChange = useCallback((dayIndex, slotIndex, field, value) => {
    setFormData((prev) => {
      const newDays = [...prev.customSchedule.days];
      const newTimeSlots = [...newDays[dayIndex].timeSlots];
      newTimeSlots[slotIndex] = {
        ...newTimeSlots[slotIndex],
        [field]: value,
      };
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        timeSlots: newTimeSlots,
      };
      return {
        ...prev,
        customSchedule: {
          ...prev.customSchedule,
          days: newDays,
        },
      };
    });
  }, [setFormData]);

  const addTimeSlot = useCallback((dayIndex) => {
    setFormData((prev) => {
      const newDays = [...prev.customSchedule.days];
      const lastSlot = newDays[dayIndex].timeSlots[newDays[dayIndex].timeSlots.length - 1];
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        timeSlots: [
          ...newDays[dayIndex].timeSlots,
          {
            startTime: lastSlot.startTime || "00:00",
            endTime: lastSlot.endTime || "00:00",
          },
        ],
      };
      return {
        ...prev,
        customSchedule: {
          ...prev.customSchedule,
          days: newDays,
        },
      };
    });
  }, [setFormData]);

  const removeTimeSlot = useCallback((dayIndex, slotIndex) => {
    // Không cho phép xóa slot đầu tiên
    if (slotIndex === 0) return;
    
    setFormData((prev) => {
      const newDays = [...prev.customSchedule.days];
      const newTimeSlots = newDays[dayIndex].timeSlots.filter((_, index) => index !== slotIndex);
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        timeSlots: newTimeSlots,
      };
      return {
        ...prev,
        customSchedule: {
          ...prev.customSchedule,
          days: newDays,
        },
      };
    });
  }, [setFormData]);

  const handleSave = useCallback(() => {
    try {
      // Validate and convert to backend format
      const backendData = validateAndConvertToBackend(
        formData,
        convertConditionToBE,
        convertScheduleToBE,
        ACTION_VI_TO_BE
      );

      if (onSave) {
        onSave(backendData);
      }
      onClose();
    } catch (error) {
      alert(error.message || "Có lỗi xảy ra khi lưu quy tắc");
      console.error("Error saving rule:", error);
    }
  }, [formData, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="auto-rule-popup-overlay">
      <div className="auto-rule-popup-modal">
          {/* Header */}
          <div className="auto-rule-popup-header">
            <h2 className="auto-rule-popup-title">
              {editingRule ? "Chỉnh sửa quy tắc" : "Thêm quy tắc mới"}
            </h2>
            <button className="auto-rule-popup-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

        {/* Body */}
        <div className="auto-rule-popup-body">
          {/* Tên quy tắc */}
          <div className="auto-rule-popup-field">
            <label className="auto-rule-popup-label">Tên quy tắc</label>
            <input
              type="text"
              className="auto-rule-popup-input"
              value={formData.ruleName}
              onChange={(e) => handleInputChange("ruleName", e.target.value)}
              placeholder="Nhập tên quy tắc"
            />
          </div>

          {/* Áp dụng quy tắc cho & Hành động */}
          <div className="auto-rule-popup-row">
            <div className="auto-rule-popup-field auto-rule-popup-field-half">
              <label className="auto-rule-popup-label">Áp dụng quy tắc cho</label>
              {!accountId ? (
                <div className="auto-rule-popup-error-text">
                  Vui lòng chọn tài khoản quảng cáo
                </div>
              ) : (
                <HierarchicalSelector
                  hierarchicalData={hierarchicalData}
                  selectedCampaignIds={formData.selectedCampaignIds}
                  selectedAdsetIds={formData.selectedAdsetIds}
                  selectedAdIds={formData.selectedAdIds}
                  expandedCampaigns={expandedCampaigns}
                  expandedAdsets={expandedAdsets}
                  onExpandedCampaignsChange={setExpandedCampaigns}
                  onExpandedAdsetsChange={setExpandedAdsets}
                  onSelectionChange={handleSelectionChange}
                  loading={loadingData}
                />
              )}
            </div>
            <div className="auto-rule-popup-field auto-rule-popup-field-half">
              <label className="auto-rule-popup-label">Hành động</label>
              <select
                className="auto-rule-popup-select"
                value={formData.action}
                onChange={(e) => handleInputChange("action", e.target.value)}
              >
                <option value="">Chọn hành động</option>
                    {ACTIONS_OPTIONS.map((action, idx) => (
                      <option key={idx} value={action}>
                        {action}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {/* Điều kiện */}
          <div className="auto-rule-popup-field">
            <div className="auto-rule-popup-label-with-info">
              <label className="auto-rule-popup-label">Điều kiện</label>
              <div className="auto-rule-popup-info-icon" title="Điều kiện của quy tắc. Quy tắc sẽ được thực hiện khi một trong các điều kiện được đáp ứng.">
                <Info size={16} />
              </div>
            </div>
            <p className="auto-rule-popup-conditions-description">
              Tất cả các điều kiện sau đây phải khớp. Lưu ý rằng một số số liệu quảng cáo có thể bị trễ và dao động trong vài giờ. Hãy cân nhắc thêm một số buffer cho các điều kiện dựa trên dữ liệu để tránh cảnh báo sai.
            </p>
            {formData.conditions.length === 0 ? (
              <div className="auto-rule-popup-conditions-empty">
                <button
                  type="button"
                  className="auto-rule-popup-add-condition-btn"
                  onClick={addCondition}
                >
                  <Plus size={24} />
                </button>
              </div>
            ) : (
              <div className="auto-rule-popup-conditions">
                {formData.conditions.map((condition, index) => (
                  <ConditionRow
                    key={index}
                    condition={condition}
                    index={index}
                    onChange={handleConditionChange}
                    onRemove={removeCondition}
                    onAdd={addCondition}
                  />
              ))}
              </div>
            )}
          </div>

          {/* Lịch trình */}
          <div className="auto-rule-popup-field">
            <div className="auto-rule-popup-label-with-info">
            <label className="auto-rule-popup-label">Lịch trình</label>
              <div className="auto-rule-popup-info-icon" title="Xác định tần suất kiểm tra quy tắc. Quy tắc sẽ được kiểm tra theo múi giờ của tài khoản quảng cáo.">
                <Info size={16} />
              </div>
            </div>
            <div className="auto-rule-popup-schedule">
              <label className="auto-rule-popup-radio-label">
                <input
                  type="radio"
                  name="schedule"
                  value="continuous"
                  checked={formData.schedule === "continuous"}
                  onChange={(e) => handleInputChange("schedule", e.target.value)}
                  className="auto-rule-popup-radio"
                />
                <div className="auto-rule-popup-radio-content">
                  <span className="auto-rule-popup-radio-title">Liên tục</span>
                  <span className="auto-rule-popup-radio-description">
                    Quy tắc chạy thường xuyên nhất có thể (thường là 30-60 phút/lần).
                  </span>
                </div>
              </label>

              <label className="auto-rule-popup-radio-label">
                <input
                  type="radio"
                  name="schedule"
                  value="daily"
                  checked={formData.schedule === "daily"}
                  onChange={(e) => handleInputChange("schedule", e.target.value)}
                  className="auto-rule-popup-radio"
                />
                <div className="auto-rule-popup-radio-content">
                  <span className="auto-rule-popup-radio-title">Hàng ngày</span>
                  <span className="auto-rule-popup-radio-description">
                    giữa {formData.dailyTime.start} và {formData.dailyTime.end} theo Giờ TP Hồ Chí Minh
                  </span>
                </div>
              </label>
              {formData.schedule === "daily" && (
                <div className="auto-rule-popup-daily-time-inputs">
                  <input
                    type="time"
                    value={formData.dailyTime.start}
                    onChange={(e) =>
                      handleInputChange("dailyTime", {
                        ...formData.dailyTime,
                        start: e.target.value,
                      })
                    }
                    className="auto-rule-popup-time-input"
                  />
                  <span className="auto-rule-popup-time-separator"> đến </span>
                  <input
                    type="time"
                    value={formData.dailyTime.end}
                    onChange={(e) =>
                      handleInputChange("dailyTime", {
                        ...formData.dailyTime,
                        end: e.target.value,
                      })
                    }
                    className="auto-rule-popup-time-input"
                  />
                </div>
              )}

              <label className="auto-rule-popup-radio-label">
                <input
                  type="radio"
                  name="schedule"
                  value="custom"
                  checked={formData.schedule === "custom"}
                  onChange={(e) => handleInputChange("schedule", e.target.value)}
                  className="auto-rule-popup-radio"
                />
                <div className="auto-rule-popup-radio-content">
                  <span className="auto-rule-popup-radio-title">Tùy chỉnh</span>
                  <span className="auto-rule-popup-radio-description">
                    Hãy điều chỉnh lịch chạy quy tắc để chạy vào những ngày và giờ cụ thể. Nếu thời gian bắt đầu và kết thúc giống nhau, quy tắc sẽ chạy mỗi ngày một lần trong vòng 30-60 phút sau thời gian đã đặt. Tất cả thời gian đều theo Giờ TP Hồ Chí Minh
                  </span>
                </div>
              </label>
            </div>

            {/* Custom Schedule UI */}
            {formData.schedule === "custom" && (
              <CustomSchedule
                customSchedule={formData.customSchedule}
                onDayCheck={handleCustomScheduleDayCheck}
                onTimeSlotChange={handleCustomScheduleTimeSlotChange}
                onAddTimeSlot={addTimeSlot}
                onRemoveTimeSlot={removeTimeSlot}
              />
            )}
          </div>

          {/* Thông báo */}
          <div className="auto-rule-popup-field">
            <label className="auto-rule-popup-checkbox-label">
              <input
                type="checkbox"
                checked={formData.notification}
                onChange={(e) =>
                  handleInputChange("notification", e.target.checked)
                }
                className="auto-rule-popup-checkbox"
              />
              <span className="auto-rule-popup-checkbox-text">Trên Facebook</span>
            </label>
            <p className="auto-rule-popup-description">
              Bạn sẽ nhận được thông báo khi đạt điều kiện của quy tắc này
            </p>
          </div>

          {/* Người đăng ký */}
          {subscriber && (
            <div className="auto-rule-popup-field">
              <label className="auto-rule-popup-label">Người đăng ký</label>
              <div className="auto-rule-popup-subscriber">
                {subscriber.full_name || subscriber.email}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="auto-rule-popup-footer">
          <button
            type="button"
            className="auto-rule-popup-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="auto-rule-popup-btn-save"
            onClick={handleSave}
          >
            Lưu quy tắc
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoRulePopup;


import { useCallback, useMemo } from "react";
import { X, Plus, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  DAYS_OPTIONS,
} from "../../../constants/autoRuleConstants";
import { useAutoRuleForm } from "../../../hooks/auto/useAutoRuleForm";
import { useHierarchicalData } from "../../../hooks/targeting/useHierarchicalData";
import { validateAndConvertToBackend, validateAutoRule } from "../../../utils/validation/autoRuleValidation";
import HierarchicalSelector from "./HierarchicalSelector";
import ConditionRow from "./ConditionRow";
import CustomSchedule from "./CustomSchedule";
import { toast } from "sonner";

const AutoRulePopup = ({
  isOpen,
  onClose,
  onSave,
  accountId = null,
  subscriber = null,
  editingRule = null,
}) => {
  const { t } = useTranslation('automationRule');
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
    setFormData((prev) => {
      // Nếu đang thay đổi schedule sang "custom", đảm bảo customSchedule có cấu trúc đúng
      if (field === "schedule" && value === "custom") {
        // Kiểm tra xem customSchedule có đầy đủ cấu trúc không
        if (!prev.customSchedule || !prev.customSchedule.days || prev.customSchedule.days.length === 0) {
          // Khởi tạo customSchedule với default values
          return {
            ...prev,
            schedule: value,
            customSchedule: {
              days: DAYS_OPTIONS.map((day) => ({
                day,
                checked: false,
                timeSlots: [{ startTime: "00:00", endTime: "00:00" }],
              })),
            },
          };
        }
        // Nếu đã có customSchedule nhưng thiếu một số days, đảm bảo có đủ 7 days
        const existingDays = prev.customSchedule.days.map(d => d.day);
        const missingDays = DAYS_OPTIONS.filter(day => !existingDays.includes(day));

        if (missingDays.length > 0) {
          const newDays = [...prev.customSchedule.days];
          missingDays.forEach(day => {
            newDays.push({
              day,
              checked: false,
              timeSlots: [{ startTime: "00:00", endTime: "00:00" }],
            });
          });
          // Sắp xếp lại theo thứ tự DAYS_OPTIONS
          newDays.sort((a, b) => {
            return DAYS_OPTIONS.indexOf(a.day) - DAYS_OPTIONS.indexOf(b.day);
          });

          return {
            ...prev,
            schedule: value,
            customSchedule: {
              days: newDays,
            },
          };
        }
      }

      return {
        ...prev,
        [field]: value,
      };
    });
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

  // Validate form data
  const validationErrors = useMemo(() => {
    return validateAutoRule(formData, !!editingRule);
  }, [formData, editingRule]);

  const isFormValid = useMemo(() => {
    return validationErrors.length === 0;
  }, [validationErrors]);

  const handleSave = useCallback(() => {
    // Double check validation before saving
    if (!isFormValid) {
      const errors = validateAutoRule(formData, !!editingRule);
      errors.forEach(error => toast.error(error));
      return;
    }

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
      toast.error(error.message || t('popup.saveError'));
    }
  }, [formData, onSave, onClose, isFormValid]);

  if (!isOpen) return null;

  return (
    <div className="auto-rule-popup-overlay">
      <div className="auto-rule-popup-modal">
        {/* Header */}
        <div className="auto-rule-popup-header">
          <h2 className="auto-rule-popup-title">
            {editingRule ? t('popup.titleEdit') : t('popup.titleAdd')}
          </h2>
          <button className="auto-rule-popup-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="auto-rule-popup-body">
          {/* Tên quy tắc */}
          <div className="auto-rule-popup-field">
            <label className="auto-rule-popup-label">* {t('popup.ruleName')}</label>
            <input
              type="text"
              className="auto-rule-popup-input"
              value={formData.ruleName}
              onChange={(e) => handleInputChange("ruleName", e.target.value)}
              placeholder={t('popup.ruleNamePlaceholder')}
            />
          </div>

          {/* Áp dụng quy tắc cho & Hành động */}
          <div className="auto-rule-popup-row">
            <div className="auto-rule-popup-field auto-rule-popup-field-half">
              <label className="auto-rule-popup-label">* {t('popup.applyTo')}</label>
              {!accountId ? (
                <div className="auto-rule-popup-error-text">
                  {t('popup.selectAccountFirst')}
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
              <label className="auto-rule-popup-label">{t('popup.action')}</label>
              <select
                className="auto-rule-popup-select"
                value={formData.action}
                onChange={(e) => handleInputChange("action", e.target.value)}
              >
                <option value="">{t('popup.selectAction')}</option>
                {ACTIONS_OPTIONS.map((action, idx) => (
                  <option key={idx} value={action}>
                    {t(`actions.${action}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Điều kiện */}
          <div className="auto-rule-popup-field">
            <div className="auto-rule-popup-label-with-info">
              <label className="auto-rule-popup-label">{t('popup.conditions')}</label>
              <div className="auto-rule-popup-info-icon" title={t('popup.conditionsTooltip')}>
                <Info size={16} />
              </div>
            </div>
            <p className="auto-rule-popup-conditions-description">
              {t('popup.conditionsDescription')}
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
              <label className="auto-rule-popup-label">{t('popup.schedule')}</label>
              <div className="auto-rule-popup-info-icon" title={t('popup.scheduleTooltip')}>
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
                  <span className="auto-rule-popup-radio-title">{t('popup.scheduleContinuous')}</span>
                  <span className="auto-rule-popup-radio-description">
                    {t('popup.scheduleContinuousDesc')}
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
                  <span className="auto-rule-popup-radio-title">{t('popup.scheduleDaily')}</span>
                  <span className="auto-rule-popup-radio-description">
                    {t('popup.scheduleDailyDesc', { start: formData.dailyTime.start, end: formData.dailyTime.end })}
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
                  <span className="auto-rule-popup-time-separator"> {t('popup.timeTo')} </span>
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
                  <span className="auto-rule-popup-radio-title">{t('popup.scheduleCustom')}</span>
                  <span className="auto-rule-popup-radio-description">
                    {t('popup.scheduleCustomDesc')}
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
              <span className="auto-rule-popup-checkbox-text">{t('popup.notificationLabel')}</span>
            </label>
            <p className="auto-rule-popup-description">
              {t('popup.notificationDesc')}
            </p>
          </div>

          {/* Người đăng ký */}
          {subscriber && (
            <div className="auto-rule-popup-field">
              <label className="auto-rule-popup-label">{t('popup.subscriber')}</label>
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
            {t('popup.cancel')}
          </button>
          <button
            type="button"
            className="auto-rule-popup-btn-save"
            onClick={handleSave}
            disabled={!isFormValid}
            title={!isFormValid ? validationErrors.join("\n") : ""}
          >
            {t('popup.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoRulePopup;


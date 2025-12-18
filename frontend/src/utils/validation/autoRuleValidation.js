/**
 * Validation functions for AutoRule form
 */

/**
 * Validate auto rule form data
 * @param {Object} formData - Form data to validate
 * @param {boolean} isEditing - true nếu đang chỉnh sửa rule (update)
 * @returns {Array} - Array of error messages (empty if valid)
 */
export const validateAutoRule = (formData, isEditing = false) => {
  const errors = [];

  // Validate rule name
  if (!formData.ruleName?.trim()) {
    errors.push("Vui lòng nhập tên quy tắc");
  }

  // Validate action
  if (!formData.action) {
    errors.push("Vui lòng chọn hành động");
  }

  // Validate conditions
  if (formData.conditions && formData.conditions.length > 0) {
    // Nếu đang chỉnh sửa và vẫn còn conditions, không cho phép để trống value
    if (isEditing) {
      const hasEmptyValue = formData.conditions.some(
        (condition) => condition.value === "" || condition.value === null
      );
      if (hasEmptyValue) {
        errors.push(
          "Tất cả điều kiện phải có giá trị. Nếu không dùng, vui lòng xóa điều kiện đó."
        );
      }
    }

    // Validate condition values
    const validConditions = formData.conditions.filter(
      (condition) => condition.value !== "" && condition.value !== null
    );

    if (validConditions.length === 0) {
      errors.push(
        "Vui lòng nhập giá trị cho ít nhất một điều kiện hoặc xóa hết điều kiện nếu không dùng"
      );
    }

    // Validate each condition value: phải là số và >= 0
    formData.conditions.forEach((condition, index) => {
      if (condition.value !== "" && condition.value !== null) {
        const value = parseFloat(condition.value);
        if (isNaN(value)) {
          errors.push(
            `Giá trị điều kiện "${condition.metric}" (điều kiện ${
              index + 1
            }) không hợp lệ`
          );
        } else if (value < 0) {
          errors.push(
            `Giá trị điều kiện "${condition.metric}" (điều kiện ${
              index + 1
            }) phải lớn hơn hoặc bằng 0`
          );
        }
      }
    });
  }

  // Validate schedule
  if (formData.schedule === "daily") {
    if (!formData.dailyTime?.start || !formData.dailyTime?.end) {
      errors.push("Vui lòng chọn thời gian cho lịch trình hàng ngày");
    }
  } else if (formData.schedule === "custom") {
    const checkedDays =
      formData.customSchedule?.days?.filter((day) => day.checked) || [];
    if (checkedDays.length === 0) {
      errors.push("Vui lòng chọn ít nhất một ngày cho lịch trình tùy chỉnh");
    }
  }

  // Validate selection
  const {
    selectedCampaignIds = [],
    selectedAdsetIds = [],
    selectedAdIds = [],
  } = formData;
  if (
    selectedCampaignIds.length === 0 &&
    selectedAdsetIds.length === 0 &&
    selectedAdIds.length === 0
  ) {
    errors.push("Vui lòng chọn ít nhất một chiến dịch, adset hoặc ad");
  }

  return errors;
};

/**
 * Validate and convert form data to backend format
 * @param {Object} formData - Form data
 * @param {Function} convertConditionToBE - Function to convert condition to BE format
 * @param {Function} convertScheduleToBE - Function to convert schedule to BE format
 * @param {Object} ACTION_VI_TO_BE - Action mapping object
 * @returns {Object} - Backend data format
 * @throws {Error} - If validation fails
 */
export const validateAndConvertToBackend = (
  formData,
  convertConditionToBE,
  convertScheduleToBE,
  ACTION_VI_TO_BE
) => {
  // Không bắt buộc phải có điều kiện
  let conditions = [];

  if (formData.conditions && formData.conditions.length > 0) {
    conditions = formData.conditions
      .filter((condition) => condition.value !== "" && condition.value !== null)
      .map((condition) => {
        const value = parseFloat(condition.value);
        if (isNaN(value)) {
          throw new Error(
            `Giá trị điều kiện "${condition.metric}" không hợp lệ`
          );
        }
        if (value < 0) {
          throw new Error(
            `Giá trị điều kiện "${condition.metric}" phải lớn hơn hoặc bằng 0`
          );
        }
        return convertConditionToBE(condition);
      });
  }

  // Convert schedule
  const schedule = convertScheduleToBE(formData);

  // Validate schedule
  if (formData.schedule === "daily") {
    if (!formData.dailyTime.start || !formData.dailyTime.end) {
      throw new Error("Vui lòng chọn thời gian cho lịch trình hàng ngày");
    }
  } else if (formData.schedule === "custom") {
    const checkedDays = formData.customSchedule.days.filter(
      (day) => day.checked
    );
    if (checkedDays.length === 0) {
      throw new Error(
        "Vui lòng chọn ít nhất một ngày cho lịch trình tùy chỉnh"
      );
    }
  }

  // Convert action
  const action = ACTION_VI_TO_BE[formData.action] || "TURN_ON";

  return {
    name: formData.ruleName,
    apply_to: formData.applyTo || "",
    apply_to_ids: {
      campaign_ids: formData.selectedCampaignIds || [],
      adset_ids: formData.selectedAdsetIds || [],
      ad_ids: formData.selectedAdIds || [],
    },
    action: action,
    conditions: conditions, // Không bắt buộc phải có điều kiện
    schedule: schedule,
    notification: formData.notification,
  };
};

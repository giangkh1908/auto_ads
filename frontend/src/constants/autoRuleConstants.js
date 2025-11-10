/**
 * Automation Rule Constants
 * Mapping giữa FE (tiếng Việt) và BE (backend format)
 */

// ===== METRICS =====
// Mapping: Metric tiếng Việt → Backend value
export const METRIC_VI_TO_BE = {
  "Đã chi tiêu": "spend",
  "Ngân sách hàng ngày": "daily_budget",
  "Tỷ lệ hàng ngày đã chi tiêu": "daily_spend_rate",
  "ROAS của lượt mua trên trang web": "website_purchase_roas",
  "CTR (liên kết)": "link_ctr",
  "Số lần hiển thị": "impressions",
  "CPC (Liên kết)": "link_cpc",
  "Chi phí trên mỗi kết quả": "cost_per_result",
  "Kết quả": "results",
  "Tần suất": "frequency",
  "Lượt mua hàng (Meta Pixel)": "website_purchases",
  "Tổng mức chi tiêu": "total_amount_spent",
  "Lượt click vào liên kết": "link_clicks",
  "CPM": "cpm",
  "% đối tượng tiếp cận được": "audience_reach_percentage",
};

// Reverse mapping: Backend value → Metric tiếng Việt
export const METRIC_BE_TO_VI = Object.fromEntries(
  Object.entries(METRIC_VI_TO_BE).map(([vi, be]) => [be, vi])
);

// Metrics với units và descriptions
export const METRICS_CONFIG = {
  "Đã chi tiêu": {
    units: ["đ"],
    description: "Tổng ngân sách bạn đã sử dụng cho chiến dịch quảng cáo trong khoảng thời gian đã chọn",
  },
  "Ngân sách hàng ngày": {
    units: ["đ"],
    description: "Số tiền tối đa bạn đặt để chi tiêu mỗi ngày cho chiến dịch quảng cáo",
  },
  "Tỷ lệ hàng ngày đã chi tiêu": {
    units: ["%"],
    description: "Tỷ lệ phần trăm ngân sách hàng ngày đã được sử dụng, tính trong ngày hiện tại",
  },
  "ROAS của lượt mua trên trang web": {
    units: [""],
    description: "Tỷ suất lợi nhuận trên chi phí quảng cáo cho lượt mua trên website",
  },
  "CTR (liên kết)": {
    units: ["%"],
    description: "Tỷ lệ người dùng nhấp vào liên kết trong quảng cáo",
  },
  "Số lần hiển thị": {
    units: ["Lượt"],
    description: "Số lần quảng cáo được xuất hiện trước người dùng",
  },
  "CPC (Liên kết)": {
    units: ["đ"],
    description: "Chi phí trung bình cho mỗi lần nhấp vào liên kết",
  },
  "Chi phí trên mỗi kết quả": {
    units: ["đ"],
    description: "Chi phí trung bình cho mỗi kết quả (CPA)",
  },
  "Kết quả": {
    units: ["Lượt"],
    description: "Số lượng hành động mong muốn mà quảng cáo đã tạo ra",
  },
  "Tần suất": {
    units: [""],
    description: "Số lần trung bình mỗi người dùng thấy quảng cáo của bạn",
  },
  "Lượt mua hàng (Meta Pixel)": {
    units: ["Lượt"],
    description: "Số lượng giao dịch mua hàng được thực hiện thông qua Meta Pixel",
  },
  "Tổng mức chi tiêu": {
    units: ["đ"],
    description: "Tổng số tiền đã chi cho các quảng cáo trong chiến dịch",
  },
  "Lượt click vào liên kết": {
    units: ["Lượt"],
    description: "Số lần người dùng nhấp vào liên kết trong quảng cáo",
  },
  "CPM": {
    units: ["đ"],
    description: "Chi phí cho mỗi 1.000 lần quảng cáo được hiển thị",
  },
  "% đối tượng tiếp cận được": {
    units: ["%"],
    description: "Phần trăm đối tượng tiếp cận được",
  },
};

// Danh sách metrics theo thứ tự hiển thị
export const METRICS_OPTIONS = Object.keys(METRICS_CONFIG);

// ===== OPERATORS =====
export const OPERATOR_VI_TO_BE = {
  "Lớn hơn": "GREATER_THAN",
  "Nhỏ hơn": "LESS_THAN",
  "Bằng": "EQUAL_TO",
};

export const OPERATOR_BE_TO_VI = Object.fromEntries(
  Object.entries(OPERATOR_VI_TO_BE).map(([vi, be]) => [be, vi])
);

export const OPERATORS_OPTIONS = Object.keys(OPERATOR_VI_TO_BE);

// ===== ACTIONS =====
export const ACTION_VI_TO_BE = {
  "Bật chiến dịch": "TURN_ON",
  "Tắt chiến dịch": "TURN_OFF",
  "Chỉ gửi thông báo": "SEND_NOTIFICATION",
};

export const ACTION_BE_TO_VI = Object.fromEntries(
  Object.entries(ACTION_VI_TO_BE).map(([vi, be]) => [be, vi])
);

export const ACTIONS_OPTIONS = Object.keys(ACTION_VI_TO_BE);

// ===== UNITS =====
export const UNIT_VI_TO_BE = {
  "đ": "CURRENCY",
  "%": "PERCENTAGE",
  "Lượt": "COUNT",
  "": "FLOAT",
};

export const UNIT_BE_TO_VI = Object.fromEntries(
  Object.entries(UNIT_VI_TO_BE).map(([vi, be]) => [be, vi])
);

export const ALL_UNITS = Object.keys(UNIT_VI_TO_BE);

// ===== SCHEDULE TYPES =====
export const SCHEDULE_VI_TO_BE = {
  "continuous": "CONTINUOUS",
  "daily": "DAILY",
  "custom": "CUSTOM",
};

export const SCHEDULE_BE_TO_VI = Object.fromEntries(
  Object.entries(SCHEDULE_VI_TO_BE).map(([vi, be]) => [be, vi])
);

// ===== DAYS =====
export const DAY_VI_TO_BE = {
  "Chủ Nhật": "SUNDAY",
  "Thứ Hai": "MONDAY",
  "Thứ Ba": "TUESDAY",
  "Thứ Tư": "WEDNESDAY",
  "Thứ Năm": "THURSDAY",
  "Thứ Sáu": "FRIDAY",
  "Thứ Bảy": "SATURDAY",
};

export const DAY_BE_TO_VI = Object.fromEntries(
  Object.entries(DAY_VI_TO_BE).map(([vi, be]) => [be, vi])
);

export const DAYS_OPTIONS = Object.keys(DAY_VI_TO_BE);

// ===== DEFAULT VALUES =====
export const DEFAULT_METRIC = "Đã chi tiêu";
export const DEFAULT_OPERATOR = "Lớn hơn";
export const DEFAULT_UNIT = "đ";
export const DEFAULT_ACTION = "Bật chiến dịch";
export const DEFAULT_SCHEDULE = "continuous";
export const DEFAULT_DAILY_TIME = { start: "00:00", end: "23:59" };

// Helper functions
export const getAvailableUnits = (metric) => {
  return METRICS_CONFIG[metric]?.units || ["đ"];
};

export const getMetricDescription = (metric) => {
  return METRICS_CONFIG[metric]?.description || "";
};

// Convert FE format sang BE format
export const convertConditionToBE = (condition) => {
  return {
    metric: METRIC_VI_TO_BE[condition.metric] || condition.metric,
    operator: OPERATOR_VI_TO_BE[condition.operator] || condition.operator,
    value: parseFloat(condition.value) || 0,
    unit: UNIT_VI_TO_BE[condition.unit] || "CURRENCY",
  };
};

// Convert BE format sang FE format
export const convertConditionToFE = (condition) => {
  return {
    metric: METRIC_BE_TO_VI[condition.metric] || condition.metric,
    operator: OPERATOR_BE_TO_VI[condition.operator] || condition.operator,
    value: condition.value?.toString() || "",
    unit: UNIT_BE_TO_VI[condition.unit] || "đ",
  };
};

// Convert schedule FE sang BE
export const convertScheduleToBE = (schedule) => {
  const result = {
    type: SCHEDULE_VI_TO_BE[schedule.schedule] || "CONTINUOUS",
  };

  if (schedule.schedule === "daily") {
    result.daily_time = {
      start_time: schedule.dailyTime.start,
      end_time: schedule.dailyTime.end,
    };
  } else if (schedule.schedule === "custom") {
    result.custom_schedule = {
      days: schedule.customSchedule.days.map((day) => ({
        day: DAY_VI_TO_BE[day.day] || day.day,
        checked: day.checked,
        time_slots: day.timeSlots
          .filter((slot) => slot.startTime && slot.endTime)
          .map((slot) => ({
            start_time: slot.startTime,
            end_time: slot.endTime,
          })),
      })),
    };
  }

  return result;
};

// Convert schedule BE sang FE
export const convertScheduleToFE = (schedule) => {
  const scheduleType = SCHEDULE_BE_TO_VI[schedule.type] || "continuous";
  const result = {
    schedule: scheduleType,
    dailyTime: schedule.daily_time
      ? {
          start: schedule.daily_time.start_time,
          end: schedule.daily_time.end_time,
        }
      : DEFAULT_DAILY_TIME,
    customSchedule: {
      days: schedule.custom_schedule?.days?.map((day) => ({
        day: DAY_BE_TO_VI[day.day] || day.day,
        checked: day.checked || false,
        timeSlots: day.time_slots?.map((slot) => ({
          startTime: slot.start_time,
          endTime: slot.end_time,
        })) || [{ startTime: "00:00", endTime: "00:00" }],
      })) || DAYS_OPTIONS.map((day) => ({
        day,
        checked: false,
        timeSlots: [{ startTime: "00:00", endTime: "00:00" }],
      })),
    },
  };

  return result;
};


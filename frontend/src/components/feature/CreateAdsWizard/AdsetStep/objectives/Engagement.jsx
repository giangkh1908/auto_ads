import {
  ADSET_CONFIG_BY_OBJECTIVE,
  getCompatibleBillingEvents,
} from "../../../../../constants/wizardConstants";

const BILLING_EVENT_LABELS = {
  IMPRESSIONS: "Hiển thị (lượt xem quảng cáo)",
  LINK_CLICKS: "Nhấp vào liên kết",
  APP_INSTALLS: "Cài đặt ứng dụng",
};

const EngagementSchema = {
  objective: "ENGAGEMENT",
  sections: [
    {
      id: "name",
      title: "Tên nhóm quảng cáo",
      icon: "Circle",
      fields: [
        {
          type: "input",
          name: "name",
          placeholder: "Nhóm quảng cáo Tương tác mới",
          validate: (value) => {
            if (!value || value.trim() === "") {
              return "Vui lòng nhập tên nhóm quảng cáo";
            }
            return true;
          },
        },
      ],
    },
    {
      id: "performance-goal",
      title: "Mục tiêu hiệu quả",
      icon: "Target",
      description: "Chọn loại tương tác bạn muốn tối ưu hóa",
      fields: [
        {
          type: "select",
          name: "optimization_goal",
          label: "Loại tương tác",
          options: (objective) => {
            const config = ADSET_CONFIG_BY_OBJECTIVE[objective];
            return config?.optimization_goals || [];
          },
          default: "POST_ENGAGEMENT",
          validate: (value) => {
            if (!value) return "Thiếu mục tiêu tối ưu hóa";
            return true;
          },
        },
      ],
    },
    {
      id: "billing",
      title: "Thanh toán",
      icon: "Target",
      fields: [
        {
          type: "select",
          name: "billing_event",
          label: "Sự kiện tính phí",
          options: (objective, adset) => {
            const events = getCompatibleBillingEvents(
              objective,
              adset.optimization_goal
            );
            return events.map((e) => ({
              value: e,
              label: BILLING_EVENT_LABELS[e] || e,
            }));
          },
          default: "IMPRESSIONS",
          disabled: (adset) => !adset.optimization_goal,
          hint: (adset) =>
            !adset.optimization_goal
              ? "Vui lòng chọn mục tiêu tối ưu hóa trước"
              : null,
          validate: (value) => {
            if (!value) return "Thiếu sự kiện tính phí";
            return true;
          },
        },
      ],
    },
    {
      id: "promoted-object",
      title: "Đối tượng được quảng cáo",
      icon: "Target",
      visibleIf: (adset) =>
        adset.optimization_goal === "PAGE_LIKES" ||
        adset.optimization_goal === "CONVERSATIONS" ||
        adset.optimization_goal === "EVENT_RESPONSES",
      fields: [
        {
          type: "input",
          name: "promoted_object.page_id",
          label: "Page ID",
          placeholder: "Nhập Page ID cần quảng cáo",
          visibleIf: (adset) =>
            adset.optimization_goal === "PAGE_LIKES" ||
            adset.optimization_goal === "CONVERSATIONS",
          validate: (value, adset) => {
            if (
              (adset.optimization_goal === "PAGE_LIKES" ||
                adset.optimization_goal === "CONVERSATIONS") &&
              !value
            ) {
              return "Page ID là bắt buộc cho mục tiêu này";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "promoted_object.event_id",
          label: "Event ID",
          placeholder: "Nhập Event ID",
          visibleIf: (adset) => adset.optimization_goal === "EVENT_RESPONSES",
          validate: (value, adset) => {
            if (adset.optimization_goal === "EVENT_RESPONSES" && !value) {
              return "Event ID là bắt buộc cho mục tiêu này";
            }
            return true;
          },
        },
      ],
    },
    {
      id: "budget",
      title: "Ngân sách",
      icon: "DollarSign",
      fields: [
        {
          type: "select",
          name: "budgetType",
          label: "Loại ngân sách",
          options: [
            { value: "daily", label: "Ngân sách hàng ngày" },
            { value: "lifetime", label: "Ngân sách tổng" },
          ],
          default: "daily",
        },
        {
          type: "money",
          name: "budgetAmount",
          label: "Số tiền",
          currency: "VND",
          validate: (value) => {
            if (!value || value <= 0) return "Ngân sách phải > 0";
            return true;
          },
        },
      ],
    },
    {
      id: "schedule",
      title: "Thời gian",
      icon: "Calendar",
      layout: "horizontal",
      fields: [
        {
          type: "datetime",
          name: "start_time",
          label: "Ngày bắt đầu",
          disabled: (mode) => mode === "edit",
          lockMessage: "🔒 Không thể sửa",
        },
        {
          type: "datetime",
          name: "end_time",
          label: "Ngày kết thúc",
        },
      ],
    },
    {
      id: "targeting",
      title: "Đối tượng tùy chỉnh",
      icon: "Users",
      fields: [
        {
          type: "age-range",
          nameMin: "targeting.ageMin",
          nameMax: "targeting.ageMax",
          label: "Tuổi",
          min: 13,
          max: 65,
          defaultMin: 18,
          defaultMax: 65,
        },
        {
          type: "select",
          name: "targeting.gender",
          label: "Giới tính",
          options: [
            { value: "all", label: "Tất cả" },
            { value: "male", label: "Nam" },
            { value: "female", label: "Nữ" },
          ],
          default: "all",
        },
        {
          type: "select",
          name: "targeting.language",
          label: "Ngôn ngữ",
          options: () => {
            const languages = [
              { code: "all", name: "Tất cả ngôn ngữ" },
              { code: "vi", name: "Tiếng Việt" },
              { code: "en", name: "English" },
              { code: "zh", name: "中文 (Chinese)" },
              { code: "ja", name: "日本語 (Japanese)" },
              { code: "ko", name: "한국어 (Korean)" },
              { code: "fr", name: "Français (French)" },
              { code: "de", name: "Deutsch (German)" },
              { code: "es", name: "Español (Spanish)" },
              { code: "ru", name: "Русский (Russian)" },
              { code: "th", name: "ไทย (Thai)" },
              { code: "id", name: "Bahasa Indonesia" },
              { code: "ms", name: "Bahasa Melayu" },
              { code: "hi", name: "हिन्दी (Hindi)" },
              { code: "pt", name: "Português (Portuguese)" },
              { code: "it", name: "Italiano (Italian)" },
              { code: "ar", name: "العربية (Arabic)" },
            ];
            return languages.map((l) => ({ value: l.code, label: l.name }));
          },
          default: "vi",
        },
      ],
    },
    {
      id: "location",
      title: "Vị trí",
      icon: "MapPin",
      fields: [
        {
          type: "tags-country",
          name: "targeting.locations",
          label: "Quốc gia",
          placeholder: "Tìm kiếm vị trí (quốc gia)",
          default: ["Viet Nam"],
        },
      ],
    },
    {
      id: "detailed-targeting",
      title: "Nhắm mục tiêu chi tiết",
      icon: "Search",
      fields: [
        {
          type: "tags",
          name: "targeting.interests",
          label: "Sở thích/hành vi",
          placeholder: "Thêm sở thích hoặc hành vi",
          suggestions: [
            "E-commerce",
            "Online shopping",
            "Digital marketing",
            "Technology",
            "Mobile apps",
            "Gaming",
            "Travel",
            "Food & beverage",
            "Fashion",
            "Beauty",
            "Fitness",
            "Finance",
            "Education",
          ],
          default: ["E-commerce"],
        },
      ],
    },
    {
      id: "bid-strategy",
      title: "Chiến lược giá thầu",
      icon: "Target",
      fields: [
        {
          type: "select",
          name: "bid_strategy",
          label: "Chiến lược",
          options: [
            { value: "LOWEST_COST_WITHOUT_CAP", label: "Giá thầu tối thiểu" },
            {
              value: "LOWEST_COST_WITH_BID_CAP",
              label: "Giá thầu tối thiểu có giới hạn",
            },
          ],
          default: "LOWEST_COST_WITHOUT_CAP",
        },
        {
          type: "number",
          name: "bid_amount",
          label: "Giới hạn giá thầu",
          suffix: "VNĐ",
          min: 1000,
          placeholder: "1000",
          visibleIf: (adset) =>
            adset.bid_strategy === "LOWEST_COST_WITH_BID_CAP",
          validate: (value, adset) => {
            if (adset.bid_strategy === "LOWEST_COST_WITH_BID_CAP") {
              if (!value || value < 1000)
                return "Giới hạn giá thầu phải >= 1000";
            }
            return true;
          },
        },
        {
          type: "info",
          content: (adset) => {
            if (adset.bid_strategy === "LOWEST_COST_WITHOUT_CAP") {
              return "Facebook sẽ tự động tối ưu hóa giá thầu để đạt chi phí thấp nhất.";
            }
            if (adset.bid_strategy === "LOWEST_COST_WITH_BID_CAP") {
              return "Bạn cần đặt giới hạn giá thầu tối đa Facebook có thể sử dụng.";
            }
            return null;
          },
        },
      ],
    },
  ],
};

export default EngagementSchema;

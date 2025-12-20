import {
  ADSET_CONFIG_BY_OBJECTIVE,
  getCompatibleBillingEvents,
} from "../../../../../constants/wizardConstants";
import i18n from "../../../../../i18n.js";

const BILLING_EVENT_LABELS = {
  IMPRESSIONS: "Hiển thị (lượt xem quảng cáo)",
  LINK_CLICKS: "Nhấp vào liên kết",
  APP_INSTALLS: "Cài đặt ứng dụng",
  CONVERSATIONS: "Cuộc trò chuyện",
  PURCHASE: "Mua hàng",
};

const EngagementSchema = {
  objective: "ENGAGEMENT",
  sections: [
    {
      id: "name",
      title: i18n.t('wizard:objective_schema.name_title'),
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
      title: i18n.t('wizard:objective_schema.performance_goal_title'),
      icon: "Target",
      description: "Chọn loại tương tác bạn muốn tối ưu hóa",
      fields: [
        {
          type: "select",
          name: "optimization_goal",
          label: "* Loại tương tác",
          options: (objective) => {
            const config = ADSET_CONFIG_BY_OBJECTIVE[objective];
            const goals = config?.optimization_goals || [];
            return [
              { value: "", label: "~ Chọn loại tương tác ~" },
              ...goals
            ];
          },
          default: "",
          validate: (value) => {
            if (!value || value === "") {
              return "Vui lòng chọn loại tương tác";
            }
            return true;
          },
        },
      ],
    },
    {
      id: "billing",
      title: i18n.t('wizard:objective_schema.billing_title'),
      icon: "Target",
      fields: [
        {
          type: "select",
          name: "billing_event",
          label: i18n.t('wizard:objective_schema.billing_event_label'),
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
          // disabled: (adset) => !adset.optimization_goal,
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
      id: "engagement-destination",
      title: i18n.t('wizard:objective_schema.conversion_destination_title'),
      icon: "Target",
      // Ẩn section này nếu chưa chọn optimization_goal
      visibleIf: (adset) => {
        return adset?.optimization_goal && adset.optimization_goal !== "";
      },
      fields: [
        {
          type: "radio-group",
          name: "engagement_destination",
          // label: "Chọn nơi bạn muốn người dùng tương tác",
          // Filter options dựa trên optimization_goal
          options: (objective, adset) => {
            const allOptions = [
              {
                value: "MESSENGER",
                label: "Tin nhắn",
                icon: "MessageSquare",
              },
              {
                value: "ON_POST",
                label: "Trên quảng cáo",
                icon: "Megaphone",
              },
              { value: "CALL", label: "Cuộc gọi", icon: "Phone" },
              { value: "WEBSITE", label: "Trang web", icon: "Globe" },
              { value: "APP", label: "Ứng dụng", icon: "Smartphone" },
              { value: "ON_PAGE", label: "Facebook", icon: "Facebook" },
            ];

            const optimizationGoal = adset?.optimization_goal;

            // Nếu chưa chọn optimization_goal, hiển thị tất cả
            if (!optimizationGoal || optimizationGoal === "") {
              return allOptions;
            }

            // Filter theo optimization_goal
            switch (optimizationGoal) {
              case "CONVERSATIONS":
                // Chỉ MESSENGER
                return allOptions.filter((opt) => opt.value === "MESSENGER");

              case "MESSAGING_PURCHASE_CONVERSION":
                // Chỉ MESSENGER
                return allOptions.filter((opt) => opt.value === "MESSENGER");

              case "LINK_CLICKS":
                // MESSENGER, WEBSITE, APP
                return allOptions.filter((opt) =>
                  ["MESSENGER", "WEBSITE", "APP"].includes(opt.value)
                );

              case "REACH":
                // Tất cả 6 options
                return allOptions;

              default:
                // Các optimization_goal khác: hiển thị tất cả
                return allOptions;
            }
          },
          default: "ON_POST",
          // ✅ onChange được xử lý trong AdsetStep.jsx (FieldRenderer radio-group)
        },
        {
          type: "input",
          name: "promoted_object.page_id",
          label: "Page ID",
          placeholder: "Nhập Page ID",
          visibleIf: (adset) =>
            adset.engagement_destination === "MESSENGER" ||
            adset.engagement_destination === "ON_PAGE" ||
            adset.engagement_destination === "ON_POST",
          validate: (value, adset) => {
            if (
              (adset.engagement_destination === "MESSENGER" ||
                adset.engagement_destination === "ON_PAGE" ||
                adset.engagement_destination === "ON_POST") &&
              !value
            ) {
              return "Page ID là bắt buộc cho lựa chọn này";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "promoted_object.application_id",
          label: "ID ứng dụng",
          placeholder: "Nhập ID ứng dụng của bạn",
          visibleIf: (adset) => adset.engagement_destination === "APP",
        },
        {
          type: "input",
          name: "promoted_object.object_store_url",
          label: "URL App Store",
          placeholder: "https://...",
          visibleIf: (adset) => adset.engagement_destination === "APP",
        },
        {
          type: "input",
          name: "promoted_object.phone_number_id",
          label: "Phone Number ID",
          placeholder: "Nhập Phone Number ID",
          visibleIf: (adset) => adset.engagement_destination === "CALL",
          validate: (value, adset) => {
            if (adset.engagement_destination === "CALL" && !value) {
              return "Phone Number ID là bắt buộc cho cuộc gọi";
            }
            return true;
          },
        },
        {
          type: "input",
          name: "promoted_object.pixel_id",
          label: "Pixel ID",
          placeholder: "Nhập Pixel ID để theo dõi chuyển đổi",
          // ✅ Hiển thị khi chọn LINK_CLICKS - WEBSITE
          visibleIf: (adset) =>
            adset.optimization_goal === "LINK_CLICKS" &&
            adset.engagement_destination === "WEBSITE",
          validate: (value, adset) => {
            if (
              adset.optimization_goal === "LINK_CLICKS" &&
              adset.engagement_destination === "WEBSITE" &&
              !value
            ) {
              return "Pixel ID là bắt buộc";
            }
            return true;
          },
        },
      ],
    },
    {
      id: "promoted-object",
      title: i18n.t('wizard:objective_schema.promoted_object_title'),
      icon: "Target",
      visibleIf: (adset) =>
        adset.optimization_goal === "PAGE_LIKES" ||
        adset.optimization_goal === "CONVERSATIONS" ||
        adset.optimization_goal === "EVENT_RESPONSES",
      fields: [
        // {
        //   type: "input",
        //   name: "promoted_object.page_id",
        //   label: "Page ID",
        //   placeholder: "Nhập Page ID cần quảng cáo",
        //   visibleIf: (adset) =>
        //     adset.optimization_goal === "PAGE_LIKES" ||
        //     adset.optimization_goal === "CONVERSATIONS",
        //   validate: (value, adset) => {
        //     if (
        //       (adset.optimization_goal === "PAGE_LIKES" ||
        //         adset.optimization_goal === "CONVERSATIONS") &&
        //       !value
        //     ) {
        //       return "Page ID là bắt buộc cho mục tiêu này";
        //     }
        //     return true;
        //   },
        // },
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
      title: i18n.t('wizard:objective_schema.budget_title'),
      icon: "DollarSign",
      fields: [
        {
          type: "select",
          name: "budgetType",
          label: i18n.t('wizard:objective_schema.budget_type_label'),
          options: [
            { value: "daily", label: "Ngân sách hàng ngày" },
            { value: "lifetime", label: "Ngân sách tổng" },
          ],
          default: "daily",
          disabled: (adset, mode) => mode === "edit" && adset.external_id,
        },
        {
          type: "money",
          name: "budgetAmount",
          label: i18n.t('wizard:objective_schema.amount_label'),
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
      title: i18n.t('wizard:objective_schema.schedule_title'),
      icon: "Calendar",
      layout: "horizontal",
      fields: [
        {
          type: "datetime",
          name: "start_time",
          label: i18n.t('wizard:objective_schema.start_time_label'),
          disabled: (adset, mode) => mode === "edit" && adset?.external_id,
        },
        {
          type: "datetime",
          name: "end_time",
          label: i18n.t('wizard:objective_schema.end_time_label'),
        },
      ],
    },
    {
      id: "targeting",
      title: i18n.t('wizard:objective_schema.targeting_title'),
      icon: "Users",
      fields: [
        {
          type: "age-range",
          nameMin: "targeting.ageMin",
          nameMax: "targeting.ageMax",
          label: i18n.t('wizard:objective_schema.age_label'),
          min: 13,
          max: 65,
          defaultMin: 18,
          defaultMax: 65,
        },
        {
          type: "select",
          name: "targeting.gender",
          label: i18n.t('wizard:objective_schema.gender_label'),
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
          label: i18n.t('wizard:objective_schema.language_label'),
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
          default: "all",
        },
      ],
    },
    {
      id: "location",
      title: i18n.t('wizard:objective_schema.location_title'),
      icon: "MapPin",
      fields: [
        {
          type: "location",
          name: "targeting.locations",
          placeholder: "Tìm kiếm thành phố, tỉnh thành...",
          default: {
            regions: [],
            cities: [],
            custom_locations: [],
            excluded_ids: [],
          },
          validate: (value) => {
            if (
              !value ||
              (!value.regions?.length &&
                !value.cities?.length &&
                !value.custom_locations?.length)
            ) {
              return "Vui lòng chọn ít nhất 1 vị trí";
            }
            const total =
              (value.regions?.length || 0) + (value.cities?.length || 0);
            if (total > 250) {
              return "Tối đa 250 vị trí được cho phép";
            }
            return true;
          },
        },
      ],
    },
    {
      id: "detailed-targeting",
      title: i18n.t('wizard:objective_schema.detailed_targeting_title'),
      icon: "Search",
      fields: [
        {
          type: "detailed_targeting",
          name: "targeting.detailed_targeting",
          label: i18n.t('wizard:objective_schema.detailed_targeting_label'),
          placeholder: "Tìm kiếm sở thích, hành vi, nhân khẩu học...",
          default: [],
        },
      ],
    },
    {
      id: "bid-strategy",
      title: i18n.t('wizard:objective_schema.bid_strategy_title'),
      icon: "Target",
      fields: [
        {
          type: "select",
          name: "bid_strategy",
          label: i18n.t('wizard:objective_schema.strategy_label'),
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
          label: i18n.t('wizard:objective_schema.bid_cap_label'),
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

// Constants và initial data cho CreateAdsWizard

export const INITIAL_DATA = {
  campaign: {
    id: 1,
    name: "Chiến dịch mới",
    status: "PAUSED",
    objective: "", // Không chọn mặc định - user phải chọn
    budgetType: "CAMPAIGN",
    facebookPage: null,
    facebookPageId: null,
    facebookPageAvatar: null,
    createdAt: new Date().toISOString(),
    adsets: [
      {
        id: 101,
        _id: null,
        name: "Nhóm quảng cáo mới",
        status: "PAUSED",
        budgetType: "daily",
        budgetAmount: 100000,
        targeting: {
          // ĐỒNG BỘ HÓA CẤU TRÚC DỮ LIỆU TẠI ĐÂY
          geo_locations: {
            countries: ["VN"],
          },
          age_min: 18,
          age_max: 65,
          publisher_platforms: ["facebook"],
          facebook_positions: ["feed", "video_feeds", "marketplace", "search"],
        },
        optimization_goal: "REACH",
        billing_event: "IMPRESSIONS",
        promoted_object: null,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        ads: [
          {
            id: 1001,
            adset_id: null,
            page_id: null,
            name: "Quảng cáo mới",
            status: "PAUSED",
            media: "text",
            mediaUrl: "",
            primaryText: "Khám phá sản phẩm/dịch vụ tuyệt vời của chúng tôi!",
            headline: "Sản phẩm/Dịch vụ chất lượng cao",
            description:
              "Đội ngũ chuyên nghiệp, kinh nghiệm lâu năm trong lĩnh vực.",
            cta: "LEARN_MORE",
            destinationUrl: "https://fchat.vn",
          },
        ],
      },
    ],
  },
  adset: {
    id: 101,
    _id: null,
    name: "Nhóm quảng cáo mới",
    status: "PAUSED",
    budgetType: "daily",
    budgetAmount: 100000,
    targeting: {
      location: "Việt Nam",
      ageMin: 18,
      ageMax: 65,
      gender: "all",
    },
    optimization_goal: "REACH",
    billing_event: "IMPRESSIONS",
    promoted_object: null,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    ads: [],
  },
  ad: {
    id: 1001,
    adset_id: null,
    page_id: null,
    name: "Quảng cáo mới",
    status: "PAUSED",
    media: "text",
    mediaUrl: "",
    primaryText: "Khám phá sản phẩm/dịch vụ tuyệt vời của chúng tôi!",
    headline: "Sản phẩm/Dịch vụ chất lượng cao",
    description: "Đội ngũ chuyên nghiệp, kinh nghiệm lâu năm trong lĩnh vực.",
    cta: "LEARN_MORE",
    destinationUrl: "https://fchat.vn",
  },
};

export const INITIAL_ADSET_STATE = {
  _id: `temp_adset_${Date.now()}`,
  name: "Nhóm quảng cáo mới",
  billing_event: "IMPRESSIONS",
  optimization_goal: "REACH",
  daily_budget: 50000,
  start_time: new Date().toISOString(),
  end_time: null,
  targeting: {
    geo_locations: {
      countries: ["VN"],
    },
    age_min: 18,
    age_max: 65,
    // Thêm 2 dòng này để giới hạn vị trí quảng cáo chỉ trên Facebook
    publisher_platforms: ["facebook"],
    facebook_positions: ["feed", "video_feeds", "marketplace", "search"],
  },
  status: "PAUSED",
  campaign_id: null,
  ads: [],
};

export const INITIAL_CAMPAIGN_STATE = {
  id: 1,
  name: "Chiến dịch mới",
  status: "PAUSED",
  objective: "", // Không chọn mặc định - user phải chọn
  budgetType: "CAMPAIGN",
  facebookPage: null,
  facebookPageId: null,
  facebookPageAvatar: null,
  createdAt: new Date().toISOString(),
  adsets: [
    {
      id: 101,
      _id: null,
      name: "Nhóm quảng cáo mới",
      status: "PAUSED",
      budgetType: "daily",
      budgetAmount: 100000,
      targeting: {
        // ĐỒNG BỘ HÓA CẤU TRÚC DỮ LIỆU TẠI ĐÂY
        geo_locations: {
          countries: ["VN"],
        },
        age_min: 18,
        age_max: 65,
        publisher_platforms: ["facebook"],
        facebook_positions: ["feed", "video_feeds", "marketplace", "search"],
      },
      optimization_goal: "REACH",
      billing_event: "IMPRESSIONS",
      promoted_object: null,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      ads: [
        {
          id: 1001,
          adset_id: null,
          page_id: null,
          name: "Quảng cáo mới",
          status: "PAUSED",
          media: "text",
          mediaUrl: "",
          primaryText: "Khám phá sản phẩm/dịch vụ tuyệt vời của chúng tôi!",
          headline: "Sản phẩm/Dịch vụ chất lượng cao",
          description:
            "Đội ngũ chuyên nghiệp, kinh nghiệm lâu năm trong lĩnh vực.",
          cta: "LEARN_MORE",
          destinationUrl: "https://fchat.vn",
        },
      ],
    },
  ],
};

// Map UI objectives sang API objectives (Meta outcome-based)
// Theo bảng ODAX Migration từ Facebook API v23.0+
export const FB_OBJECTIVE_MAP = {
  AWARENESS: "OUTCOME_AWARENESS",
  TRAFFIC: "OUTCOME_TRAFFIC",
  ENGAGEMENT: "OUTCOME_ENGAGEMENT", // POST_ENGAGEMENT, PAGE_LIKES, EVENT_RESPONSES, VIDEO_VIEWS, MESSAGES
  LEADS: "OUTCOME_LEADS",
  SALES: "OUTCOME_SALES",
  APP_PROMOTION: "OUTCOME_APP_PROMOTION",
};

// Mặc định các giá trị optimization_goal và billing_event theo tài liệu Meta v23.0
export const FB_ADSET_DEFAULTS_BY_OBJECTIVE = {
  OUTCOME_AWARENESS: {
    optimization_goal: "REACH",
    billing_event: "IMPRESSIONS",
    promoted_object: null,
  },
  OUTCOME_TRAFFIC: {
    optimization_goal: "LINK_CLICKS",
    billing_event: "IMPRESSIONS",
    promoted_object: null,
  },
  OUTCOME_ENGAGEMENT: {
    optimization_goal: "POST_ENGAGEMENT",
    billing_event: "IMPRESSIONS",
    promoted_object: { page_id: null },
  },
  OUTCOME_LEADS: {
    optimization_goal: "LEAD_GENERATION",
    billing_event: "IMPRESSIONS",
    promoted_object: { page_id: null }, // cần page_id để tạo form lead
  },
  OUTCOME_SALES: {
    optimization_goal: "OFFSITE_CONVERSIONS",
    billing_event: "IMPRESSIONS",
    promoted_object: { pixel_id: null, custom_event_type: "PURCHASE" },
  },
  OUTCOME_APP_PROMOTION: {
    optimization_goal: "APP_INSTALLS",
    billing_event: "IMPRESSIONS",
    promoted_object: {
      application_id: null,
      object_store_url: null,
      custom_event_type: "APP_INSTALLS",
    },
  },
};

// Các bước Wizard
export const WIZARD_STEPS = {
  TARGET: 0, // chọn mục tiêu
  CAMPAIGN: 1, // thông tin chiến dịch
  ADSET: 2, // nhóm quảng cáo
  AD: 3, // quảng cáo
  CREATIVE: 4, // xem trước
};

export const EDITING_ITEM_TYPES = {
  CAMPAIGN: "campaign",
  ADSET: "adset",
  AD: "ad",
};

export const TAB_TYPES = {
  CAMPAIGN: "campaign",
  CHILD: "child",
};

// Helper lấy mặc định AdSet theo mục tiêu campaign
export const getAdsetDefaultsByObjective = (uiObjective) => {
  const fbObjective = FB_OBJECTIVE_MAP[uiObjective];
  const defaults = FB_ADSET_DEFAULTS_BY_OBJECTIVE[fbObjective];
  return (
    defaults || {
      optimization_goal: "REACH",
      billing_event: "IMPRESSIONS",
      promoted_object: null,
    }
  );
};

// Cấu hình chi tiết cho Adset theo từng mục tiêu chiến dịch
// Theo bảng ODAX Migration chính thức từ Meta v23.0+
export const ADSET_CONFIG_BY_OBJECTIVE = {
  // ODAX: AWARENESS → AD_RECALL_LIFT, REACH, IMPRESSIONS, THRUPLAY, TWO_SECOND_CONTINUOUS_VIDEO_VIEWS
  AWARENESS: {
    optimization_goals: [
      { 
        value: "AD_RECALL_LIFT", 
        label: "🧠 Mức độ ghi nhớ quảng cáo", 
        description: "📸 Ảnh/Video → Tăng khả năng ghi nhớ thương hiệu",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { page_id: null }
      },
      { 
        value: "REACH", 
        label: "👥 Tiếp cận", 
        description: "📸 Ảnh/Video → Tối đa số người thấy quảng cáo",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { page_id: null }
      },
      { 
        value: "THRUPLAY", 
        label: "🎬 Lượt xem video (ThruPlay)", 
        description: "🎥 BẮT BUỘC VIDEO → Tối ưu người xem hết video",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { page_id: null }
      },
      { 
        value: "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS", 
        label: "⏱️ Xem video 2s liên tục", 
        description: "🎥 BẮT BUỘC VIDEO → Tối ưu xem ít nhất 2 giây",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { page_id: null }
      },
    ],
    billing_events: ["IMPRESSIONS"],
  },
  // ODAX: TRAFFIC → LINK_CLICKS, LANDING_PAGE_VIEWS, REACH, IMPRESSIONS
  // Theo bảng: destination_type không bắt buộc, promoted_object: application_id, object_store_url (cho app)
  TRAFFIC: {
    optimization_goals: [
      { 
        value: "LINK_CLICKS", 
        label: "🔗 Lượt nhấp liên kết", 
        description: "📸 Ảnh/Video → Tăng traffic đến website/app",
        billing_events: ["IMPRESSIONS", "LINK_CLICKS"],
        promoted_object: { application_id: null, object_store_url: null }
      },
      { 
        value: "LANDING_PAGE_VIEWS", 
        label: "📄 Lượt xem trang đích", 
        description: "📸 Ảnh/Video → Tối ưu người xem landing page",
        billing_events: ["IMPRESSIONS"],
        promoted_object: {}
      },
      { 
        value: "REACH", 
        label: "👥 Tiếp cận", 
        description: "📸 Ảnh/Video → Tối đa số người thấy",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { application_id: null, object_store_url: null }
      },
      { 
        value: "REACH", 
        label: "👥 Tiếp cận bài viết", 
        description: "📸 Ảnh/Video → Tối đa số người thấy",
        billing_events: ["IMPRESSIONS"], 
        destination_type: "ON_POST",
        promoted_object: {}
      },
    ],
    billing_events: ["IMPRESSIONS", "LINK_CLICKS"],
  },
  // ODAX: ENGAGEMENT → POST_ENGAGEMENT, PAGE_LIKES, EVENT_RESPONSES, THRUPLAY, TWO_SECOND_CONTINUOUS_VIDEO_VIEWS, CONVERSATIONS
  // Theo bảng ODAX chính thức: OUTCOME_ENGAGEMENT với destination_type
  ENGAGEMENT: {
    optimization_goals: [
      // ON_POST: Tương tác với bài viết
      // { 
      //   value: "POST_ENGAGEMENT", 
      //   label: "💬 Tương tác bài viết", 
      //   description: "📸 Ảnh/Video → Tăng like, comment, share",
      //   billing_events: ["IMPRESSIONS"], 
      //   destination_type: "ON_POST",
      //   promoted_object: {}
      // },
      { 
        value: "REACH", 
        label: "👥 Tiếp cận", 
        description: "📸 Ảnh/Video → Tối đa số người thấy",
        billing_events: ["IMPRESSIONS"], 
        destination_type: "ON_POST",
        promoted_object: {}
      },
      // { 
      //   value: "IMPRESSIONS", 
      //   label: "📊 Số lần hiển thị", 
      //   description: "📸 Ảnh/Video → Tối đa lượt hiển thị",
      //   billing_events: ["IMPRESSIONS"], 
      //   destination_type: "ON_POST",
      //   promoted_object: {}
      // },
      // ON_PAGE: Lượt thích trang
      { 
        value: "PAGE_LIKES", 
        label: "👍 Lượt thích trang", 
        description: "📸 Ảnh/Video → Tăng follower trang Facebook",
        billing_events: ["IMPRESSIONS"], 
        destination_type: "ON_PAGE",
        promoted_object: { page_id: null }
      },
      // ON_EVENT: Phản hồi sự kiện
      { 
        value: "EVENT_RESPONSES", 
        label: "📅 Phản hồi sự kiện", 
        description: "📸 Ảnh/Video → Tăng người quan tâm/tham gia sự kiện",
        billing_events: ["IMPRESSIONS"], 
        destination_type: "ON_EVENT",
        promoted_object: {}
      },
      // { 
      //   value: "POST_ENGAGEMENT", 
      //   label: "💬 Tương tác bài viết (Event)", 
      //   description: "📸 Ảnh/Video → Tương tác với bài viết sự kiện",
      //   billing_events: ["IMPRESSIONS"], 
      //   destination_type: "ON_EVENT",
      //   promoted_object: {}
      // },
      // { 
      //   value: "REACH", 
      //   label: "👥 Tiếp cận sự kiện", 
      //   description: "📸 Ảnh/Video → Tiếp cận người quan tâm sự kiện",
      //   billing_events: ["IMPRESSIONS"], 
      //   destination_type: "ON_EVENT",
      //   promoted_object: {}
      // },
      // ON_VIDEO: Lượt xem video
      // { 
      //   value: "THRUPLAY", 
      //   label: "🎬 Lượt xem video (ThruPlay)", 
      //   description: "🎥 BẮT BUỘC VIDEO → Tối ưu người xem hết video",
      //   billing_events: ["IMPRESSIONS"], 
      //   destination_type: "ON_VIDEO",
      //   promoted_object: {}
      // },
      // { 
      //   value: "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS", 
      //   label: "⏱️ Xem video 2s liên tục", 
      //   description: "🎥 BẮT BUỘC VIDEO → Tối ưu xem ít nhất 2 giây",
      //   billing_events: ["IMPRESSIONS"], 
      //   destination_type: "ON_VIDEO",
      //   promoted_object: {}
      // },
      // MESSENGER: Tin nhắn
      { 
        value: "CONVERSATIONS", 
        label: "💬 Hội thoại (Messenger)", 
        description: "📸 Ảnh/Video → Bắt đầu hội thoại Messenger",
        billing_events: ["IMPRESSIONS"], 
        destination_type: "MESSENGER",
        promoted_object: { page_id: null }
      },
      { 
        value: "LINK_CLICKS", 
        label: "🔗 Lượt nhấp liên kết (Messenger)", 
        description: "📸 Ảnh/Video → Nhấp vào link trong Messenger",
        billing_events: ["IMPRESSIONS"], 
        destination_type: "MESSENGER",
        promoted_object: { page_id: null }
      },
    ],
    billing_events: ["IMPRESSIONS"],
  },
  // ODAX: LEADS → LEAD_GENERATION, QUALITY_LEAD, CONVERSATIONS, OFFSITE_CONVERSIONS, etc.
  // Theo bảng: destination_type ON_AD, promoted_object: page_id, pixel_id, custom_event_type
  LEADS: {
    optimization_goals: [
      // ON_AD: Lead form trên quảng cáo
      { 
        value: "LEAD_GENERATION", 
        label: "📋 Thu thập khách hàng tiềm năng", 
        description: "📸 Ảnh/Video → Form lead trên quảng cáo",
        billing_events: ["IMPRESSIONS"],
        destination_type: "ON_AD",
        promoted_object: { page_id: null }
      },
      { 
        value: "QUALITY_LEAD", 
        label: "⭐ Khách hàng tiềm năng chất lượng", 
        description: "📸 Ảnh/Video → Tối ưu lead chất lượng cao",
        billing_events: ["IMPRESSIONS"],
        destination_type: "ON_AD",
        promoted_object: { page_id: null }
      },
      // Messenger: Lead từ Messenger
      // { 
      //   value: "LEAD_GENERATION", 
      //   label: "💬 Lead từ Messenger", 
      //   description: "📸 Ảnh/Video → Thu thập lead qua Messenger",
      //   billing_events: ["IMPRESSIONS"],
      //   destination_type: "MESSENGER",
      //   promoted_object: { page_id: null }
      // },
      // Phone Call
      // { 
      //   value: "QUALITY_CALL", 
      //   label: "📞 Cuộc gọi chất lượng", 
      //   description: "📸 Ảnh/Video → Tối ưu số lượng cuộc gọi",
      //   billing_events: ["IMPRESSIONS"],
      //   promoted_object: { page_id: null }
      // },
      // Conversion events (pixel/app)
      { 
        value: "OFFSITE_CONVERSIONS", 
        label: "🔄 Chuyển đổi ngoài site", 
        description: "📸 Ảnh/Video → Tối ưu conversion events",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { pixel_id: null, custom_event_type: null, application_id: null, object_store_url: null }
      //Khi tối ưu hóa cho chuyển đổi ngoài trang web, bạn cần cung cấp đối tượng được quảng cáo có (a) pixel_id hoặc (b) cả application_id và event_type  
      },
      { 
        value: "LINK_CLICKS", 
        label: "🔗 Lượt nhấp liên kết", 
        description: "📸 Ảnh/Video → Tăng traffic đến landing page",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { pixel_id: null, custom_event_type: null, application_id: null, object_store_url: null }
      },
      { 
        value: "REACH", 
        label: "👥 Tiếp cận", 
        description: "📸 Ảnh/Video → Tối đa số người thấy",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { pixel_id: null, custom_event_type: null, application_id: null, object_store_url: null }
      },
      { 
        value: "LANDING_PAGE_VIEWS", 
        label: "📄 Lượt xem trang đích", 
        description: "📸 Ảnh/Video → Tối ưu người xem landing page",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { pixel_id: null, custom_event_type: null }
      },
      
    ],
    billing_events: ["IMPRESSIONS"],
  },
  // ODAX: SALES → OFFSITE_CONVERSIONS, LINK_CLICKS, CONVERSATIONS, QUALITY_CALL
  // Theo bảng: promoted_object: pixel_id, custom_event_type, application_id, page_id (cho messenger/phone)
  SALES: {
    optimization_goals: [
      // WEBSITE: Conversion events
      { 
        value: "OFFSITE_CONVERSIONS", 
        label: "🔄 Chuyển đổi ngoài site", 
        description: "📸 Ảnh/Video → Tối ưu mua hàng/conversion",
        billing_events: ["IMPRESSIONS"],
        destination_type: "WEBSITE",
        promoted_object: { pixel_id: null, custom_event_type: "PURCHASE", application_id: null, object_store_url: null }
      },
      // MESSENGER: Conversations
      { 
        value: "CONVERSATIONS", 
        label: "💬 Hội thoại (Messenger)", 
        description: "📸 Ảnh/Video → Bắt đầu hội thoại mua hàng",
        billing_events: ["IMPRESSIONS"],
        destination_type: "MESSENGER",
        promoted_object: { page_id: null, pixel_id: null, custom_event_type: null }
      },
      // Phone Call
      { 
        value: "QUALITY_CALL", 
        label: "📞 Cuộc gọi chất lượng", 
        description: "📸 Ảnh/Video → Tối ưu số lượng cuộc gọi",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { page_id: null }
      },
    ],
    billing_events: ["IMPRESSIONS"],
  },
  // ODAX: APP_PROMOTION → LINK_CLICKS, OFFSITE_CONVERSIONS, APP_INSTALLS
  // Theo bảng: promoted_object: application_id, object_store_url
  APP_PROMOTION: {
    optimization_goals: [
      { 
        value: "LINK_CLICKS", 
        label: "🔗 Lượt nhấp liên kết", 
        description: "📸 Ảnh/Video → Tăng traffic đến app store",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { application_id: null, object_store_url: null }
      },
      { 
        value: "OFFSITE_CONVERSIONS", 
        label: "🔄 Chuyển đổi ngoài site", 
        description: "📸 Ảnh/Video → Tối ưu app events",
        billing_events: ["IMPRESSIONS"],
        promoted_object: { application_id: null, object_store_url: null }
      },
      { 
        value: "APP_INSTALLS", 
        label: "📱 Lượt cài đặt ứng dụng", 
        description: "📸 Ảnh/Video → Tối ưu số lượt cài app",
        billing_events: ["IMPRESSIONS", "APP_INSTALLS"],
        promoted_object: { application_id: null, object_store_url: null }
      },
    ],
    billing_events: ["IMPRESSIONS", "APP_INSTALLS"],
  },
};

// Helpers: lấy danh sách goals và billing_events hợp lệ theo objective/goal
export const getOptimizationGoals = (uiObjective) => {
  return ADSET_CONFIG_BY_OBJECTIVE[uiObjective]?.optimization_goals || [];
};

export const getCompatibleBillingEvents = (uiObjective, optimizationGoal) => {
  const goals = getOptimizationGoals(uiObjective);
  const goal = goals.find((g) => g.value === optimizationGoal);
  return goal?.billing_events?.length ? goal.billing_events : ["IMPRESSIONS"];
};

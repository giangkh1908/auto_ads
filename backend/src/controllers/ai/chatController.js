import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { analyticsTools } from "../../services/chat/analyticsTools.js";
import ChatConversation from "../../models/ai/chatConversation.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import { v4 as uuidv4 } from "uuid";

// ============================================
// INTENT CLASSIFIER
// ============================================

const ANALYTICS_KEYWORDS = [
  "chi phí",
  "spend",
  "ctr",
  "cpc",
  "cpm",
  "campaign",
  "chiến dịch",
  "quảng cáo",
  "hiệu suất",
  "so sánh",
  "compare",
  "top",
  "bottom",
  "ranking",
  "tốt nhất",
  "tệ nhất",
  "xu hướng",
  "trend",
  "tăng",
  "giảm",
  "thay đổi",
  "ngày",
  "tuần",
  "tháng",
  "hôm nay",
  "hôm qua",
  "impressions",
  "clicks",
  "results",
  "chuyển đổi",
  "conversion",
  "reach",
];

function classifyIntent(message) {
  const lowerMsg = message.toLowerCase();

  // Check for analytics keywords
  const hasAnalyticsKeyword = ANALYTICS_KEYWORDS.some((kw) =>
    lowerMsg.includes(kw)
  );

  // Check for greetings
  const greetings = ["xin chào", "hello", "hi", "chào", "hey"];
  const isGreeting = greetings.some((g) => lowerMsg.startsWith(g));

  // Check for general questions
  const generalPatterns = [
    /mấy giờ/,
    /thời gian/,
    /ngày.*tháng/,
    /là gì/,
    /giúp.*gì/,
    /làm.*gì/,
  ];
  const isGeneral = generalPatterns.some((p) => p.test(lowerMsg));

  if (hasAnalyticsKeyword) {
    return "ANALYTICS_QUERY";
  } else if (isGreeting || isGeneral) {
    return "GENERAL_CHAT";
  }

  // Fallback: use LLM for complex classification
  return "UNKNOWN";
}

// ============================================
// HELPERS: DATE PARSER, NORMALIZERS, ENTITY RESOLUTION, LOGGING
// ============================================
const removeDiacritics = (s) => s
  ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  : "";

function parseViDateRange(text, now = new Date()) {
  const t = removeDiacritics(String(text || "").toLowerCase());
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const today = startOfDay(now);

  // Presets
  if (/\bhom nay\b|\btoday\b/.test(t)) {
    return { preset: "today", date_from: toISO(today), date_to: toISO(today) };
  }
  if (/\bhom qua\b|\byesterday\b/.test(t)) {
    const y = addDays(today, -1);
    return { preset: "yesterday", date_from: toISO(y), date_to: toISO(y) };
  }
  if (/(7|b\s*ay)\s*ngay\b|\blast\s*7/.test(t) || /\b7 ngay gan\b/.test(t)) {
    const start = addDays(today, -6);
    return { preset: "last_7_days", date_from: toISO(start), date_to: toISO(today) };
  }
  if (/30\s*ngay|last\s*30/.test(t)) {
    const start = addDays(today, -29);
    return { preset: "last_30_days", date_from: toISO(start), date_to: toISO(today) };
  }
  if (/\bthang nay\b|\bthis month\b/.test(t)) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { preset: "this_month", date_from: toISO(start), date_to: toISO(end) };
  }
  if (/\bthang truoc\b|\blast month\b/.test(t)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { preset: "last_month", date_from: toISO(start), date_to: toISO(end) };
  }

  // Custom range dd/mm[/yyyy] - dd/mm[/yyyy]
  const m = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(?:den|->|to|\-|–|—)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m) {
    const [, d1, mo1, y1, d2, mo2, y2] = m;
    const yStart = y1 ? Number(y1.length === 2 ? `20${y1}` : y1) : today.getFullYear();
    const yEnd = y2 ? Number(y2.length === 2 ? `20${y2}` : y2) : today.getFullYear();
    const start = new Date(yStart, Number(mo1) - 1, Number(d1));
    const end = new Date(yEnd, Number(mo2) - 1, Number(d2));
    return { preset: "custom", date_from: toISO(start), date_to: toISO(end) };
  }

  return null; // để router/clarify hỏi lại
}

function toISO(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
}

const METRIC_SYNONYMS = {
  CPC: ["cpc", "gia 1 click", "gia mot click", "chi phi moi nhap", "cost per click", "gia 1 nhap", "giá 1 click", "giá một nhấp"],
  CTR: ["ctr", "ty le nhap", "ti le click", "click through rate", "ty le click", "tỷ lệ nhấp"],
  CPM: ["cpm", "chi phi 1000 hien thi", "cost per mille"],
  SPEND: ["chi tieu", "chi phi", "spend", "cost"],
  IMPRESSIONS: ["impressions", "luot hien thi", "hien thi"],
  CLICKS: ["clicks", "nhap", "luot nhap", "click"],
  RESULTS: ["ket qua", "results"],
};

function normalizeMetrics(raw) {
  if (!raw) return [];
  const toKey = (s) => removeDiacritics(String(s).toLowerCase().trim());
  const res = new Set();
  const list = Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    const k = toKey(item);
    for (const [std, arr] of Object.entries(METRIC_SYNONYMS)) {
      if (std.toLowerCase() === k || arr.some((x) => toKey(x) === k)) {
        res.add(std);
      }
    }
  }
  return [...res];
}

async function getAccountObjectId(account_id) {
  // Already ObjectId?
  if (String(account_id).match(/^[0-9a-fA-F]{24}$/)) {
    const account = await AdsAccount.findById(account_id).select("_id");
    if (account) return account._id;
  }
  const hasPrefix = String(account_id).startsWith("act_");
  const account = await AdsAccount.findOne({
    $or: [
      { external_id: account_id },
      { external_id: hasPrefix ? account_id.slice(4) : `act_${account_id}` },
    ],
  }).select("_id");
  if (!account) throw new Error(`Account ${account_id} not found`);
  return account._id;
}

async function resolveCampaignNames(account_id, names = []) {
  const accountObjId = await getAccountObjectId(account_id);
  const norm = (s) => removeDiacritics(String(s || "").toLowerCase());
  const tokens = (s) => norm(s).split(/\s+/).filter(Boolean);

  const campaigns = await AdsCampaign.find({ account_id: accountObjId })
    .select("name external_id")
    .lean();

  const results = [];
  for (const q of names) {
    const qt = tokens(q);
    const scored = campaigns
      .map((c) => {
        const nt = tokens(c.name);
        let hit = 0;
        qt.forEach((t) => {
          if (nt.some((n) => n.includes(t))) hit++;
        });
        const s = hit / Math.max(qt.length, 1);
        return { id: c.external_id || null, name: c.name, score: +s.toFixed(2) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    results.push({ query: q, matches: scored });
  }
  return results;
}

function logDebug(step, payload) {
  if (!process.env.AI_DEBUG) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    step,
    ...payload,
  });
  console.log(line);
}

// ============================================
// CLARIFY HELPERS
// ============================================

async function extractCampaignFromClarifyResponse(message, account_id) {
  // Try to extract campaign name from user's clarify response
  // e.g., "Chiến dịch mới", "chọn campaign ABC", etc.
  const lowerMsg = message.toLowerCase();
  
  // Remove common prefixes
  let cleanMsg = message
    .replace(/^(chọn|select|campaign|chiến dịch|phân tích chiến dịch):/i, "")
    .trim();
  
  if (!cleanMsg) return null;

  // Try to resolve the campaign name
  const resolution = await resolveCampaignNames(account_id, [cleanMsg]);
  if (resolution.length > 0 && resolution[0].matches.length > 0) {
    const bestMatch = resolution[0].matches[0];
    if (bestMatch.score >= 0.5) {
      return { id: bestMatch.id, name: bestMatch.name };
    }
  }

  return null;
}

async function executeToolWithIntent(originalIntent, params, conversation, conversationId, res) {
  const { account_id, date_from, date_to, metrics, entityNames } = params;

  // Resolve campaign IDs if needed
  let resolvedCampaignIds = [];
  if (entityNames && entityNames.length > 0) {
    const resolution = await resolveCampaignNames(account_id, entityNames);
    for (const r of resolution) {
      if (r.matches.length > 0 && r.matches[0].id) {
        resolvedCampaignIds.push(r.matches[0].id);
      }
    }
  }

  // Map intent -> tool name
  const intentToolMap = {
    OVERVIEW: "get_overview",
    TOTAL_METRICS: "get_total_metrics",
    COMPARE: "compare_campaigns",
    TREND: "get_trend",
    RANKING: "get_ranking",
    LIST_CAMPAIGNS: "list_campaigns",
  };

  const toolName = intentToolMap[originalIntent] || null;
  if (!toolName) {
    const errorMsg = "⚠️ Không thể tiếp tục yêu cầu này.";
    conversation.messages.push({
      message_id: uuidv4(),
      role: "assistant",
      content: errorMsg,
      timestamp: new Date(),
    });
    await conversation.save();
    return res.json({
      success: true,
      conversation_id: conversationId,
      response: errorMsg,
      intent: originalIntent,
    });
  }

  const tool = analyticsTools.find((t) => t.name === toolName);
  if (!tool) {
    const errorMsg = "⚠️ Không tìm thấy công cụ phù hợp.";
    conversation.messages.push({
      message_id: uuidv4(),
      role: "assistant",
      content: errorMsg,
      timestamp: new Date(),
    });
    await conversation.save();
    return res.json({
      success: true,
      conversation_id: conversationId,
      response: errorMsg,
      intent: originalIntent,
    });
  }

  // Build tool params
  const baseParams = { account_id, date_from, date_to };
  let toolParams = { ...baseParams };

  if (toolName === "compare_campaigns" && resolvedCampaignIds.length > 0) {
    toolParams.campaign_ids = resolvedCampaignIds;
  }
  if (toolName === "get_trend") {
    const trendMetric = (metrics && metrics[0]) || "spend";
    toolParams.metric = trendMetric.toLowerCase();
    toolParams.granularity = "day";
    if (resolvedCampaignIds[0]) toolParams.campaign_id = resolvedCampaignIds[0];
  }
  if (toolName === "get_ranking") {
    const rankMetric = (metrics && metrics[0]) || "spend";
    toolParams.metric = rankMetric.toLowerCase();
    toolParams.entity_type = "campaign";
    toolParams.order = "top";
    toolParams.limit = 5;
  }

  logDebug("tool_input_clarify_resume", { conversation_id: conversationId, tool: toolName, tool_params: toolParams });

  let assistantResponse;
  let rawData = null;
  let meta = {};

  try {
    const toolResult = await tool.invoke(toolParams);
    try {
      rawData = JSON.parse(toolResult);
    } catch (e) {
      rawData = { raw: toolResult };
    }

    const noData = detectNoData(toolName, rawData);
    if (noData) {
      meta.errorCode = "no_data";
      assistantResponse = "Không có dữ liệu cho bộ lọc hiện tại. Hãy thử đổi khoảng thời gian hoặc chọn chiến dịch khác. 📉";
    } else {
      logDebug("tool_output_clarify_resume", { conversation_id: conversationId, tool: toolName, no_data: !!noData });

      // Format response with LLM
      const useOpenAI = process.env.OPENAI_API_KEY ? true : false;
      const llm = useOpenAI
        ? new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.3 })
        : new ChatGoogleGenerativeAI({ modelName: "gemini-2.0-flash-exp", temperature: 0.3 });

      const formatPrompt = `Dựa vào dữ liệu sau, hãy trả lời ngắn gọn, dễ hiểu, tiếng Việt, dùng emoji vừa phải, không markdown ** hay ##.
DỮ LIỆU:
${JSON.stringify(rawData)}
`;
      const formattedResponse = await llm.invoke([{ role: "user", content: formatPrompt }]);
      assistantResponse = (formattedResponse.content || "").replace(/\*\*|\_\_|\#\#/g, "");
    }
  } catch (toolError) {
    console.error("❌ Tool execution error:", toolError);
    assistantResponse = "⚠️ Xin lỗi, đã xảy ra lỗi khi truy vấn dữ liệu. Vui lòng thử lại.";
    meta.errorCode = "internal";
  }

  // Save assistant response
  conversation.messages.push({
    message_id: uuidv4(),
    role: "assistant",
    content: assistantResponse,
    timestamp: new Date(),
    tool_used: toolName,
    data: rawData,
    needs_clarification: false,
  });

  // Clear context_summary after successful execution
  conversation.context_summary = {
    current_intent: originalIntent,
    original_intent: null,
    last_date_range: { date_from, date_to },
    updated_at: new Date(),
  };

  conversation.last_activity_at = new Date();

  if (conversation.messages.length > 20) {
    conversation.messages = conversation.messages.slice(-20);
  }

  await conversation.save();

  return res.json({
    success: true,
    conversation_id: conversationId,
    response: assistantResponse,
    intent: originalIntent,
    date_range: { date_from, date_to },
    meta,
    raw_data: rawData,
  });
}

function detectNoData(toolName, data) {
  if (!data) return true;
  switch (toolName) {
    case "compare_campaigns":
      return !Array.isArray(data.campaigns) || data.campaigns.length === 0;
    case "get_trend":
      return !Array.isArray(data.data_points) || data.data_points.length === 0;
    case "get_ranking":
      return !Array.isArray(data.ranking) || data.ranking.length === 0;
    case "get_overview":
      return (
        data.total_campaigns === 0 &&
        data.total_adsets === 0 &&
        data.total_ads === 0
      );
    case "get_total_metrics":
      return !data.metrics || data.total_days === 0;
    case "list_campaigns":
      return !Array.isArray(data.campaigns) || data.campaigns.length === 0;
    default:
      return false;
  }
}

// ============================================
// CHAT CONTROLLER
// ============================================

// ============================================
// CHAT CONTROLLER
// ============================================

// ============================================
// MODULE CONFIGURATION
// ============================================

const MODULE_CONFIG = {
  PERF: {
    name: "Hiệu suất tổng quan",
    allowed_intents: ["TOTAL_METRICS", "OVERVIEW", "LIST_CAMPAIGNS"],
    tools: ["get_total_metrics", "get_overview", "list_campaigns"],
    description: "Xem tổng quan hiệu suất, chỉ số trung bình, số lượng chiến dịch/adset/ads",
  },
  COMPARE: {
    name: "So sánh chiến dịch",
    allowed_intents: ["COMPARE", "RANKING", "LIST_CAMPAIGNS"],
    tools: ["compare_campaigns", "get_ranking", "list_campaigns"],
    description: "So sánh hiệu suất giữa các chiến dịch, xếp hạng top/bottom",
  },
  AUDIENCE: {
    name: "Phân tích đối tượng",
    allowed_intents: ["AUDIENCE_ANALYSIS"],
    tools: ["analyze_audience"],
    description: "Phân tích hiệu suất theo độ tuổi, giới tính, vị trí địa lý",
  },
  TREND: {
    name: "Xu hướng theo thời gian",
    allowed_intents: ["TREND"],
    tools: ["get_trend"],
    description: "Phân tích xu hướng theo ngày/tuần/tháng, tìm insight tăng/giảm",
  },
};

function validateModuleIntent(module_type, intent) {
  if (!module_type || !MODULE_CONFIG[module_type]) {
    return { valid: false, error: "Module không hợp lệ. Vui lòng chọn module: PERF, COMPARE, AUDIENCE, hoặc TREND." };
  }
  
  const module = MODULE_CONFIG[module_type];
  if (!module.allowed_intents.includes(intent)) {
    return { 
      valid: false, 
      error: `Câu hỏi này không thuộc chức năng của module "${module.name}". ${module.description}. Vui lòng hỏi câu khác hoặc chọn module phù hợp.` 
    };
  }
  
  return { valid: true };
}

export const chatAnalyze = async (req, res) => {
  try {
    const { message, conversation_id, account_id, module_type } = req.body;
    const user_id = req.user._id;

    if (!message || !account_id) {
      return res.status(400).json({
        success: false,
        message: "Message and account_id are required",
      });
    }

    if (!module_type) {
      return res.status(400).json({
        success: false,
        message: "Module type is required. Please select a module: PERF, COMPARE, AUDIENCE, or TREND.",
      });
    }

    // Step 1: Get or create conversation
    let conversationId = conversation_id;
    let conversation;

    if (conversationId) {
      conversation = await ChatConversation.findOne({
        conversation_id: conversationId,
        user_id,
      });
    }

    if (!conversation) {
      conversationId = uuidv4();
      conversation = new ChatConversation({
        conversation_id: conversationId,
        user_id,
        account_id,
        messages: [],
        context_summary: {},
      });
    }

    // Step 2: Add user message
    conversation.messages.push({
      message_id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Step 2.5: Check if we're in CLARIFY mode (continuing a previous intent)
    const contextSummary = conversation.context_summary || {};
    const isInClarifyMode = contextSummary.current_intent === "CLARIFY" && contextSummary.original_intent;

    if (isInClarifyMode) {
      // User is responding to a clarify question - skip router, resume original intent
      const originalIntent = contextSummary.original_intent;
      const partialParams = contextSummary.partial_params || {};
      let { metrics = [], entityNames = [] } = partialParams;
      let date_from = contextSummary.date_range?.from;
      let date_to = contextSummary.date_range?.to;

      // Try to extract campaign selection from user's response
      const selectedCampaign = await extractCampaignFromClarifyResponse(message, account_id);
      if (selectedCampaign) {
        entityNames.push(selectedCampaign.name);
      }

      // Try to extract date from user's response
      const dateFromMessage = parseViDateRange(message);
      if (dateFromMessage) {
        date_from = dateFromMessage.date_from;
        date_to = dateFromMessage.date_to;
      }

      // Now resume original intent with updated params
      logDebug("clarify_resume", { 
        conversation_id: conversationId, 
        original_intent: originalIntent, 
        selected_campaign: selectedCampaign?.name,
        date_range: { date_from, date_to }
      });

      // Continue to tool execution with originalIntent
      return await executeToolWithIntent(
        originalIntent, 
        { account_id, date_from, date_to, metrics, entityNames }, 
        conversation, 
        conversationId, 
        res
      );
    }

    // Step 3: Classify intent (coarse)
    const coarseIntent = classifyIntent(message);

    // Handle GENERAL_CHAT
    if (coarseIntent === "GENERAL_CHAT") {
      const generalResponse =
        "Xin chào! Tôi là trợ lý phân tích quảng cáo Facebook. Tôi có thể giúp bạn:\n\n" +
        "📊 Xem tổng quan hiệu suất quảng cáo\n" +
        "📈 So sánh các chiến dịch\n" +
        "🔍 Phân tích xu hướng theo thời gian\n" +
        "🏆 Xếp hạng campaigns/adsets/ads\n\n" +
        "Bạn muốn xem dữ liệu gì?";

      conversation.messages.push({
        message_id: uuidv4(),
        role: "assistant",
        content: generalResponse,
        timestamp: new Date(),
      });

      await conversation.save();

      return res.json({
        success: true,
        conversation_id: conversationId,
        response: generalResponse,
        intent: "GENERAL_CHAT",
      });
    }

    // Step 4: Router with structured output + Date parsing
    // First, try to parse date range from message loosely (fallback)
    const fallbackDate = parseViDateRange(message) || {};
    let date_from = fallbackDate.date_from;
    let date_to = fallbackDate.date_to;

    // Step 5: Setup LLM
    const useOpenAI = process.env.OPENAI_API_KEY ? true : false;
    const llm = useOpenAI
      ? new ChatOpenAI({
          modelName: "gpt-4o-mini",
          temperature: 0.3,
        })
      : new ChatGoogleGenerativeAI({
          modelName: "gemini-2.0-flash-exp",
          temperature: 0.3,
        });

    // Step 6: Get last 12 messages for context
    const chatHistory = conversation.messages
      .slice(-12) // Use a larger window for better context
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Step 7: Ask LLM for structured router output
    const systemPrompt = `Bạn là router phân tích quảng cáo Facebook. TRẢ LỜI CHỈ BẰNG JSON HỢP LỆ. Dựa vào toàn bộ lịch sử chat để hiểu ngữ cảnh.

SCHEMA:
{
  "intent": "OVERVIEW|TOTAL_METRICS|COMPARE|TREND|RANKING|LIST_CAMPAIGNS|GENERAL_CHAT|CLARIFY",
  "metrics": ["CPC","CTR","CPM","SPEND","IMPRESSIONS","CLICKS","RESULTS"]?,
  "entities": [{"type": "campaign", "name": "..."}]?
  "date_text": "nguyên văn người dùng nói về thời gian"?,
  "missing": ["date_range"|"entities"|"metrics"]?
}

QUY TẮC:
- Nếu hỏi "đếm số lượng", "có bao nhiêu" campaign/adset/ad -> intent=OVERVIEW.
- Nếu hỏi về các chỉ số (CTR, CPC, chi tiêu, lượt hiển thị, reach) hoặc "số liệu" -> intent=TOTAL_METRICS.
- Nếu hỏi "tên là gì", "liệt kê", "có những" campaign nào -> intent=LIST_CAMPAIGNS.
- Nếu không chắc ngày hoặc campaign -> intent=CLARIFY và điền "missing".
- Không bịa ID.
- Ví dụ câu hỏi so sánh theo tên -> intent=COMPARE, entities với name raw.
`;

    const llmMessages = [
        { role: "system", content: systemPrompt },
        ...chatHistory,
    ];

    const llmResponse = await llm.invoke(llmMessages);

    const llmText = llmResponse.content || "";
    let routerOutput = {};
    try {
      const jsonMatch = llmText.match(/\{[\s\S]*\}/);
      routerOutput = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      routerOutput = {};
    }

    logDebug("router_output", { conversation_id: conversationId, user_query: message, router_raw: llmText, router_parsed: routerOutput });

    // Normalize router fields
    const intent = routerOutput.intent || coarseIntent || "UNKNOWN";
    const metrics = normalizeMetrics(routerOutput.metrics);
    const dateText = routerOutput.date_text || message;
    const dateParsed = parseViDateRange(dateText);
    if (dateParsed) {
      date_from = dateParsed.date_from;
      date_to = dateParsed.date_to;
    }

    // MODULE VALIDATION: Check if intent is allowed in this module
    const moduleValidation = validateModuleIntent(module_type, intent);
    if (!moduleValidation.valid) {
      const errorResponse = moduleValidation.error;
      
      conversation.messages.push({
        message_id: uuidv4(),
        role: "assistant",
        content: errorResponse,
        timestamp: new Date(),
        type: "GENERAL_CHAT",
      });
      
      await conversation.save();
      
      return res.json({
        success: true,
        conversation_id: conversationId,
        response: errorResponse,
        intent: "OUT_OF_SCOPE",
        meta: { errorCode: "module_mismatch", module_type },
      });
    }

    // Determine missing slots
    const finalIntent = routerOutput.intent || coarseIntent || "UNKNOWN";
    const missingSet = new Set();

    // If LLM explicitly asks to clarify, trust its list of missing items.
    if (finalIntent === 'CLARIFY') {
        (routerOutput.missing || ['entities']).forEach(item => missingSet.add(item));
    }

    // Server-side validation for required params based on intent
    const needsDate = ["TOTAL_METRICS", "COMPARE", "TREND", "RANKING"].includes(finalIntent);
    if (needsDate && (!date_from || !date_to)) {
        missingSet.add("date_range");
    }

    // Extract and resolve entities
    const entityNames = Array.isArray(routerOutput.entities)
      ? routerOutput.entities.filter((e) => e && e.type === "campaign" && e.name).map((e) => e.name)
      : [];
    
    let resolvedCampaignIds = [];
    let campaignSuggestions = [];
    const needsEntities = ["COMPARE"].includes(finalIntent);

    if (needsEntities && entityNames.length === 0) {
        missingSet.add("entities");
    } else if (entityNames.length > 0) {
      const resolution = await resolveCampaignNames(account_id, entityNames);
      for (const r of resolution) {
        if (r.matches.length === 0) {
          missingSet.add("entities");
        } else if (r.matches.length === 1 || r.matches[0].score >= 0.8) {
          if (r.matches[0].id) resolvedCampaignIds.push(r.matches[0].id);
        } else {
          campaignSuggestions.push(...r.matches);
          missingSet.add("entities");
        }
      }
      campaignSuggestions = Object.values(
        campaignSuggestions.reduce((acc, c) => {
          const key = `${c.id || ""}|${c.name}`;
          if (!acc[key]) acc[key] = c;
          return acc;
        }, {})
      ).slice(0, 8);
    }

    const missing = Array.from(missingSet);

    // If clarify needed
    if (missing.length > 0) {
      const clarifyMessage = buildClarifyMessage(missing, campaignSuggestions);

      conversation.messages.push({
        message_id: uuidv4(),
        role: "assistant",
        content: clarifyMessage,
        timestamp: new Date(),
        type: "ANALYTICS_QUERY",
        needs_clarification: true,
        suggestions: campaignSuggestions.map((c) => c.name),
        data: null,
      });

      conversation.context_summary = {
        current_intent: "CLARIFY",
        original_intent: finalIntent, // Save the ORIGINAL intent to resume later
        original_query: message,
        partial_params: { metrics, entityNames },
        date_range: date_from && date_to ? { from: new Date(date_from), to: new Date(date_to) } : undefined,
        last_updated: new Date(),
      };
      conversation.last_activity_at = new Date();
      await conversation.save();

      return res.json({
        success: true,
        conversation_id: conversationId,
        response: clarifyMessage,
        intent: "CLARIFY",
        date_range: date_from && date_to ? { date_from, date_to } : null,
        meta: {
          clarify: { missing: Array.from(new Set(missing)) },
          suggestions: { campaigns: campaignSuggestions },
        },
      });
    }

    // Map intent -> tool name
    const intentToolMap = {
      OVERVIEW: "get_overview",
      TOTAL_METRICS: "get_total_metrics",
      COMPARE: "compare_campaigns",
      TREND: "get_trend",
      RANKING: "get_ranking",
      LIST_CAMPAIGNS: "list_campaigns",
    };

    const toolName = intentToolMap[finalIntent] || null;
    let assistantResponse;
    let toolUsed = null;
    let rawData = null;
    let meta = {};

    if (!toolName) {
      // Fallback: direct chat
      assistantResponse = llmText || "Mình có thể giúp bạn phân tích quảng cáo. Bạn muốn xem gì?";
    } else {
      const tool = analyticsTools.find((t) => t.name === toolName);
      if (!tool) {
        assistantResponse = "⚠️ Không tìm thấy công cụ phù hợp để xử lý yêu cầu này.";
      } else {
        toolUsed = tool.name;
        // Build tool params per tool
        const baseParams = { account_id, date_from, date_to };
        let toolParams = { ...baseParams };
        if (toolName === "compare_campaigns") {
          if (resolvedCampaignIds.length > 0) toolParams.campaign_ids = resolvedCampaignIds;
        }
        if (toolName === "get_trend") {
          // Pick one metric, default spend
          const trendMetric = (metrics[0] || "SPEND").toLowerCase();
          toolParams.metric = trendMetric.toLowerCase();
          toolParams.granularity = "day";
          if (resolvedCampaignIds[0]) toolParams.campaign_id = resolvedCampaignIds[0];
        }
        if (toolName === "get_ranking") {
          const rankMetric = (metrics[0] || "SPEND").toLowerCase();
          toolParams.metric = rankMetric;
          toolParams.entity_type = "campaign";
          toolParams.order = "top";
          toolParams.limit = 5;
        }

        logDebug("tool_input", { conversation_id: conversationId, tool: toolName, tool_params: toolParams });

        try {
          const toolResult = await tool.invoke(toolParams);
          // toolResult is stringified JSON
          try {
            rawData = JSON.parse(toolResult);
          } catch (e) {
            rawData = { raw: toolResult };
          }

          // Determine no_data
          const noData = detectNoData(toolName, rawData);
          if (noData) {
            meta.errorCode = "no_data";
            assistantResponse = "Không có dữ liệu cho bộ lọc hiện tại. Hãy thử đổi khoảng thời gian hoặc chọn chiến dịch khác. 📉";
          } else {
            logDebug("tool_output", { conversation_id: conversationId, tool: toolName, no_data: !!noData, sample: JSON.stringify(rawData).substring(0, 300) });

            // Ask LLM to format brief answer
            const formatPrompt = `Dựa vào dữ liệu sau, hãy trả lời ngắn gọn, dễ hiểu, tiếng Việt, dùng emoji vừa phải, không markdown ** hay ##.
CÂU HỎI: ${message}
DỮ LIỆU:
${JSON.stringify(rawData)}
`;
            const formattedResponse = await llm.invoke([{ role: "user", content: formatPrompt }]);
            assistantResponse = (formattedResponse.content || "").replace(/\*\*|\_\_|\#\#/g, "");
          }
        } catch (toolError) {
          console.error("❌ Tool execution error:", toolError);
          assistantResponse = "⚠️ Xin lỗi, đã xảy ra lỗi khi truy vấn dữ liệu. Vui lòng thử lại.";
          meta.errorCode = "internal";
        }
      }
    }

    // Step 10: Save assistant response
    conversation.messages.push({
      message_id: uuidv4(),
      role: "assistant",
      content: assistantResponse,
      timestamp: new Date(),
      tool_used: toolUsed,
      data: rawData,
      needs_clarification: false,
    });

    // Step 9: Update context summary, clearing original_query after successful execution
    conversation.context_summary = {
      current_intent: finalIntent,
      original_query: null, // Clear after successful action
      last_date_range: { date_from, date_to },
      updated_at: new Date(),
    };

    conversation.last_activity_at = new Date();

    // Keep only last 20 messages (sliding window)
    if (conversation.messages.length > 20) {
      conversation.messages = conversation.messages.slice(-20);
    }

    await conversation.save();

    // Step 11: Return response
    return res.json({
      success: true,
      conversation_id: conversationId,
      response: assistantResponse,
      intent: finalIntent || "ANALYTICS_QUERY",
      date_range: { date_from, date_to },
      meta,
      raw_data: rawData,
    });
  } catch (error) {
    console.error("Error in chatAnalyze:", error);
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi xử lý yêu cầu",
      error: error.message,
    });
  }
};

function buildClarifyMessage(missing, campaignSuggestions) {
  const miss = Array.from(new Set(missing || []));
  const parts = [];
  if (miss.includes("date_range")) {
    parts.push("Bạn muốn xem trong khoảng thời gian nào? Ví dụ: 'Hôm nay', '7 ngày gần đây', 'Tháng này'.");
  }
  if (miss.includes("entities")) {
    if (campaignSuggestions && campaignSuggestions.length > 0) {
      parts.push(
        `Mình tìm thấy vài chiến dịch gần giống tên bạn nói. Bạn chọn một nhé: ${campaignSuggestions
          .slice(0, 6)
          .map((c) => c.name)
          .join(", ")}.`
      );
    } else {
      parts.push("Bạn có thể nói rõ tên chiến dịch cần xem hoặc so sánh?");
    }
  }
  if (miss.includes("metrics")) {
    parts.push("Bạn muốn xem chỉ số nào? Ví dụ: CPC, CTR, CPM, Chi tiêu.");
  }
  return parts.join(" \n");
}

// ============================================
// GET MODULES
// ============================================

export const getModules = async (req, res) => {
  try {
    const modules = Object.entries(MODULE_CONFIG).map(([key, config]) => ({
      module_type: key,
      name: config.name,
      description: config.description,
      allowed_intents: config.allowed_intents,
    }));

    return res.json({
      success: true,
      modules,
    });
  } catch (error) {
    console.error("Error in getModules:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get modules",
      error: error.message,
    });
  }
};


import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { analyticsTools } from "../../services/chat/analyticsTools.js";
import ChatConversation from "../../models/ai/chatConversation.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import { agentExecutor } from "../../services/chat/agentExecutor.js";
import { v4 as uuidv4 } from "uuid";
import { userHasFeature, FEATURE_KEYS } from "../../services/admin/entitlementService.js";

// ============================================
// HELPERS: DATE PARSER, NORMALIZERS, ENTITY RESOLUTION, LOGGING
// ============================================

// Remove diacritics
const removeDiacritics = (s) => s
  ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  : "";

// Parse Vietnamese date range
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

// Convert date to ISO format
function toISO(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
}

// Metric synonyms
const METRIC_SYNONYMS = {
  CPC: ["cpc", "gia 1 click", "gia mot click", "chi phi moi nhap", "cost per click", "gia 1 nhap", "giá 1 click", "giá một nhấp"],
  CTR: ["ctr", "ty le nhap", "ti le click", "click through rate", "ty le click", "tỷ lệ nhấp"],
  CPM: ["cpm", "chi phi 1000 hien thi", "cost per mille"],
  SPEND: ["chi tieu", "chi phi", "spend", "cost"],
  IMPRESSIONS: ["impressions", "luot hien thi", "hien thi"],
  CLICKS: ["clicks", "nhap", "luot nhap", "click"],
  RESULTS: ["ket qua", "results"],
};

// Normalize metrics
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

// Get account ObjectId
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

// Resolve entities
async function resolveEntitiesV2(account_id, entitiesFromRouter = []) {
  if (!entitiesFromRouter || entitiesFromRouter.length === 0) {
    return { resolved: [], suggestions: [], unresolved: [] };
  }

  const accountObjId = await getAccountObjectId(account_id);
  const norm = (s) => removeDiacritics(String(s || "").toLowerCase());
  const tokens = (s) => norm(s).split(/[\s_\-]+/).filter(Boolean);

  // 1. Fetch all available entities for the account in parallel
  const [allCampaigns, allAdsets, allAds] = await Promise.all([
    AdsCampaign.find({ account_id: accountObjId }).select("name external_id").lean(),
    AdsSet.find({ account_id: accountObjId }).select("name external_id").lean(),
    Ads.find({ account_id: accountObjId }).select("name external_id").lean(),
  ]);

  const entityMap = {
    campaign: allCampaigns,
    adset: allAdsets,
    ad: allAds,
  };

  const resolved = [];
  const suggestions = [];
  const unresolved = [];

  for (const entity of entitiesFromRouter) {
    const { type, name } = entity;
    const availableEntities = entityMap[type] || [];
    
    if (availableEntities.length === 0) {
      unresolved.push(entity);
      continue;
    }

    const queryTokens = tokens(name);
    
    const scored = availableEntities
      .map((e) => {
        const nameTokens = tokens(e.name);
        let hit = 0;
        let matchScore = 0;

        // Exact match bonus
        if (norm(e.name) === norm(name)) {
            matchScore = 1;
        } else {
            queryTokens.forEach(qToken => {
              if (nameTokens.some(nToken => nToken.includes(qToken))) {
                hit++;
              }
            });
            matchScore = hit / Math.max(queryTokens.length, 1);
        }

        return { id: e.external_id, name: e.name, score: +matchScore.toFixed(2) };
      })
      .filter((x) => x.score > 0.5) // Minimum threshold
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      unresolved.push(entity);
    } else if (scored[0].score >= 0.9) { // High confidence match
      resolved.push({ type, id: scored[0].id, name: scored[0].name });
    } else { // Low confidence, needs clarification
      suggestions.push({ type, query: name, matches: scored.slice(0, 5) });
    }
  }

  return { resolved, suggestions, unresolved };
}

// Log debug
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

// Start conversation session
export const startConversationSession = async (req, res) => {
  try {
    const { account_id } = req.body;
    const user_id = req.user?._id;

    if (!user_id || !account_id) {
      return res.status(400).json({
        success: false,
        message: "account_id is required to start a conversation",
      });
    }

    const conversationId = uuidv4();

    return res.json({
      success: true,
      conversation_id: conversationId,
    });
  } catch (error) {
    console.error("Error in startConversationSession:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo cuộc trò chuyện mới",
      error: error.message,
    });
  }
};

// Chat analyze
export const chatAnalyze = async (req, res) => {
  try {
    const { message, conversation_id, account_id, context, conversationHistory: frontendHistory } = req.body;
    const user_id = req.user._id;

    if (!message || !account_id) {
      return res.status(400).json({
        success: false,
        message: "Message and account_id are required",
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

    // Step 3: Process with Agent Executor
    // Frontend sends conversationHistory - use it directly
    const history = frontendHistory || [];
    
    let result;
    try {
      result = await agentExecutor.processMessage(
        user_id, 
        account_id, 
        message, 
        history,
        context // Pass context from frontend
      );
    } catch (agentError) {
      console.error("[chatController] AgentExecutor error:", agentError);
      
      // Fallback response
      result = {
        response: "⚠️ Xin lỗi, tôi đang gặp sự cố kỹ thuật. Bạn có thể thử lại câu hỏi hoặc hỏi một câu khác không?",
        intent: "GENERAL_CHAT",
        tool_used: null,
        data: null,
        suggestions: ["Kiểm tra trạng thái tài khoản", "Xem tổng quan chiến dịch", "Hỗ trợ kỹ thuật"]
      };
    }

    // Step 4: Save Assistant Response
    conversation.messages.push({
      message_id: uuidv4(),
      role: "assistant",
      content: result.response,
      timestamp: new Date(),
      tool_used: result.tool_used,
      data: result.data,
      // Map intent to type if needed
      type: result.intent === "GENERAL_CHAT" ? "GENERAL_CHAT" : "ANALYTICS_QUERY",
    });

    conversation.last_activity_at = new Date();
    
    // Prune old messages
    if (conversation.messages.length > 50) {
      conversation.messages = conversation.messages.slice(-50);
    }

    // Save with timeout protection
    try {
      await Promise.race([
        conversation.save(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MongoDB save timeout')), 5000)
        )
      ]);
    } catch (saveError) {
      console.error("[chatController] Failed to save conversation:", saveError);
      // Continue anyway - don't block response
    }

    console.log("[chatController] Returning entities:", result.entities);

    return res.json({
      success: true,
      conversation_id: conversationId,
      response: result.response,
      intent: result.intent,
      data: result.data,
      suggestions: result.suggestions,
      entities: result.entities || [] // Return entities for frontend context tracking
    });

  } catch (error) {
    console.error("Error in chatAnalyze:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
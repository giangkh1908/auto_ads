import { contextManager } from "./contextManager.js";
import { intentClassifier } from "./intentClassifier.js";
import { analyticsTools } from "./analyticsTools.js";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import NodeCache from 'node-cache';
import crypto from 'crypto';

// ============================================
// HELPER: Simple Entity Resolution
// ============================================
const removeDiacritics = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

async function simpleEntityResolution(accountId, entityName, type) {
  let Model = AdsCampaign;
  if (type === 'adset') Model = AdsSet;
  if (type === 'ad') Model = Ads;

  const entity = await Model.findOne({
    external_account_id: accountId.replace('act_', ''),
    name: { $regex: new RegExp(entityName, 'i') }
  }).select('external_id name');

  return entity ? { id: entity.external_id, name: entity.name } : null;
}

// ============================================
// AGENT EXECUTOR - SIMPLIFIED VERSION
// ============================================
export class AgentExecutor {
  constructor() {
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    this.llm = useOpenAI
      ? new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.3 })
      : new ChatGoogleGenerativeAI({ modelName: "gemini-2.0-flash-exp", temperature: 0.3 });
    
    this.toolCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  }

  _normalizeParams(params) {
    const normalized = {};
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          normalized[key] = value.sort().join(',');
        } else if (typeof value === 'object') {
          normalized[key] = JSON.stringify(value);
        } else {
          normalized[key] = String(value);
        }
      }
    }
    return normalized;
  }

  _generateCacheKey(intent, toolName, params) {
    const normalized = this._normalizeParams(params);
    const keyString = `${intent}_${toolName}_${JSON.stringify(normalized)}`;
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  _extractRankFromResult(toolResult, rankPosition) {
    if (!rankPosition || !toolResult || !toolResult.top || !Array.isArray(toolResult.top)) {
      return toolResult;
    }

    const requestedItem = toolResult.top[rankPosition - 1];
    if (requestedItem) {
      return {
        ...toolResult,
        top: [requestedItem],
        requested_rank: rankPosition,
        total_in_cache: toolResult.top.length,
        cache_used: toolResult.cache_used || false
      };
    } else {
      return {
        ...toolResult,
        top: [],
        requested_rank: rankPosition,
        total_in_cache: toolResult.top.length,
        cache_used: toolResult.cache_used || false,
        error: `Không có item thứ ${rankPosition} trong kết quả (chỉ có ${toolResult.top.length} items)`
      };
    }
  }

  async _executeToolWithCache(intent, toolName, params, tool, rankPosition = null) {
    const cacheKey = this._generateCacheKey(intent, toolName, params);
    
    let cachedResult = this.toolCache.get(cacheKey);
    
    if (cachedResult) {
      console.log(`[AgentExecutor] Cache HIT for ${toolName}: ${cacheKey}`);
      
      if (rankPosition) {
        return this._extractRankFromResult(cachedResult, rankPosition);
      }
      
      return { ...cachedResult, cache_used: true };
    }
    
    console.log(`[AgentExecutor] Cache MISS for ${toolName}: ${cacheKey}, querying DB...`);
    
    try {
      const rawResult = await tool.invoke(params);
      const toolResult = JSON.parse(rawResult);
      
      this.toolCache.set(cacheKey, toolResult);
      console.log(`[AgentExecutor] Cached result for ${toolName}: ${cacheKey}`);
      
      if (rankPosition) {
        return this._extractRankFromResult(toolResult, rankPosition);
      }
      
      return { ...toolResult, cache_used: false };
    } catch (e) {
      console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
      throw e;
    }
  }

  async processMessage(userId, accountId, message, conversationHistory = []) {
    try {
      // 1. Build Context
      let context;
      try {
        context = await contextManager.build(accountId, userId);
      } catch (contextError) {
        console.error("[AgentExecutor] Context build error:", contextError);
        context = { account: { id: accountId, name: "Unknown" }, error: contextError.message };
      }

      // 2. Classify Intent
      let plan;
      try {
        plan = await intentClassifier.classify(message, context, conversationHistory);
        console.log("[AgentExecutor] Plan:", JSON.stringify(plan, null, 2));
      } catch (classifyError) {
        console.error("[AgentExecutor] Intent classification error:", classifyError);
        plan = {
          intent: "GENERAL_CHAT",
          query_type: null,
          entities: [],
          time_range: null,
          metrics: [],
          rank_position: null,
          reasoning: "Classification failed"
        };
      }

      // 3. Execute Tool based on Intent
      let toolResult = null;
      let toolName = null;

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // ============================================
      // INTENT: RANK_CAMPAIGNS / RANK_ADSETS / RANK_ADS
      // ============================================
      if (plan.intent === "RANK_CAMPAIGNS" || plan.intent === "RANK_ADSETS" || plan.intent === "RANK_ADS") {
        toolName = "rank_campaigns";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          let defaultLevel = "campaign";
          if (plan.intent === "RANK_ADSETS") defaultLevel = "adset";
          else if (plan.intent === "RANK_ADS") defaultLevel = "ad";
          
          const baseTopN = 5;
          const topN = plan.rank_position 
            ? Math.max(baseTopN, plan.rank_position) 
            : baseTopN;
          
          const params = {
            account_id: accountId,
            level: plan.level || defaultLevel,
            objective: plan.objective || null,
            date_from: plan.time_range?.from || thirtyDaysAgo,
            date_to: plan.time_range?.to || today,
            top_n: topN,
            sort_by_metric: plan.metrics && plan.metrics.length > 0 ? plan.metrics[0] : null,
          };
          
          try {
            toolResult = await this._executeToolWithCache(plan.intent, toolName, params, tool, plan.rank_position);
          } catch (e) {
            console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
            toolResult = { error: "Failed to rank campaigns/adsets/ads", message: e.message };
          }

          // Fallback: nếu rank không có dữ liệu với cửa sổ hiện tại (thường là 7 ngày),
          // thử mở rộng ra 30 ngày để tăng cơ hội có dữ liệu.
          const isRankIntent = plan.intent === "RANK_CAMPAIGNS" || plan.intent === "RANK_ADSETS" || plan.intent === "RANK_ADS";
          const noData =
            toolResult &&
            !toolResult.error &&
            (
              (Array.isArray(toolResult.top) && toolResult.top.length === 0) ||
              (!toolResult.top && toolResult.groups && Object.keys(toolResult.groups).length === 0)
            );
          
          const isShortRange =
            (plan.time_range?.preset === "last_7_days") ||
            (
              plan.time_range?.from && plan.time_range?.to &&
              (new Date(plan.time_range.to) - new Date(plan.time_range.from) <= 10 * 24 * 60 * 60 * 1000)
            );

          if (isRankIntent && noData && isShortRange) {
            const fallbackParams = {
              ...params,
              date_from: thirtyDaysAgo,
              date_to: today
            };
            try {
              const fallbackResult = await this._executeToolWithCache(plan.intent, toolName, fallbackParams, tool, plan.rank_position);
              const hasFallbackData =
                (Array.isArray(fallbackResult?.top) && fallbackResult.top.length > 0) ||
                (fallbackResult?.groups && Object.keys(fallbackResult.groups).length > 0);
              
              if (hasFallbackData) {
                toolResult = { ...fallbackResult, fallback_to_30d: true };
                plan.time_range = { preset: "last_30_days", from: thirtyDaysAgo, to: today };
              }
            } catch (e) {
              console.error(`[AgentExecutor] Fallback rank 30d failed:`, e);
            }
          }
        }
      }
      
      // ============================================
      // INTENT: GET_ENTITY_METADATA
      // ============================================
      else if (plan.intent === "GET_ENTITY_METADATA") {
        toolName = "get_entity_metadata";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          let entityIds = [];
          
          if (plan.entities && plan.entities.length > 0) {
            for (const ent of plan.entities) {
              const res = await simpleEntityResolution(accountId, ent.name, ent.type);
              if (res) entityIds.push(res.id);
            }
          } else {
            const lastResult = conversationHistory
              .filter(m => m.role === "assistant" && m.data)
              .slice(-1)[0]?.data;
            
            if (lastResult && lastResult.top && Array.isArray(lastResult.top)) {
              entityIds = lastResult.top.map(e => e.entity_id);
            } else if (lastResult && lastResult.groups) {
              const allEntities = Object.values(lastResult.groups).flat();
              entityIds = allEntities.map(e => e.entity_id);
            }
          }
          
          if (entityIds.length === 0) {
            toolResult = { 
              error: "Không tìm thấy entity IDs", 
              message: "Vui lòng chỉ định rõ entities cần query hoặc hỏi sau khi đã có kết quả ranking." 
            };
          } else {
            const params = {
              account_id: accountId,
              entity_type: plan.entities?.[0]?.type || "ad",
              entity_ids: entityIds,
            };
            
            try {
              toolResult = await this._executeToolWithCache(plan.intent, toolName, params, tool);
            } catch (e) {
              console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
              toolResult = { error: "Failed to get metadata", message: e.message };
            }
          }
        }
      }
      
      // ============================================
      // INTENT: QUERY_DATA
      // ============================================
      else if (plan.intent === "QUERY_DATA") {
        toolName = "query_data";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          const params = {
            account_id: accountId,
            query_type: plan.query_type || "overview",
            date_from: plan.time_range?.from || thirtyDaysAgo,
            date_to: plan.time_range?.to || today,
          };
          
          // Add entity info if present
          if (plan.entities && plan.entities.length > 0) {
            const resolvedIds = [];
            for (const ent of plan.entities) {
              if (ent.name) {
                const res = await simpleEntityResolution(accountId, ent.name, ent.type);
                if (res) resolvedIds.push(res.id);
              }
            }
            if (resolvedIds.length > 0) {
              params.entity_ids = resolvedIds;
            }
            // Always set entity_type from entities array (even if no names, for count queries)
            params.entity_type = plan.entities[0].type;
          } else if (plan.level) {
            // Fallback: use level if entities not provided
            params.entity_type = plan.level;
          }
          
          // Add metric if present (for top_bottom queries)
          if (plan.metrics && plan.metrics.length > 0) {
            params.metric = plan.metrics[0];
          }
          
          try {
            toolResult = await this._executeToolWithCache(plan.intent, toolName, params, tool);
          } catch (e) {
            console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
            toolResult = { error: "Failed to fetch data", message: e.message };
          }
        }
      } 
      
      // ============================================
      // INTENT: ANALYZE_TREND
      // ============================================
      else if (plan.intent === "ANALYZE_TREND") {
        toolName = "get_trend";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          const params = {
            account_id: accountId,
            metric: plan.metrics?.[0] || "spend",
            granularity: "day",
            date_from: plan.time_range?.from || thirtyDaysAgo,
            date_to: plan.time_range?.to || today,
          };
          
          // Add entity filter if present
          if (plan.entities && plan.entities.length > 0) {
            const ent = plan.entities[0];
            const res = await simpleEntityResolution(accountId, ent.name, ent.type);
            if (res) {
              if (ent.type === "campaign") params.campaign_id = res.id;
              else if (ent.type === "adset") params.adset_id = res.id;
              else if (ent.type === "ad") params.ad_id = res.id;
            }
          }
          
          try {
            toolResult = await this._executeToolWithCache(plan.intent, toolName, params, tool);
          } catch (e) {
            console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
            toolResult = { error: "Failed to fetch data", message: e.message };
          }
        }
      }
      
      // ============================================
      // INTENT: GENERAL_CHAT
      // ============================================
      else if (plan.intent === "GENERAL_CHAT") {
        toolResult = { message: "General conversation - no tool needed" };
      }

      // 4. Generate Response (with streaming support)
      let content;
      try {
        const response = await this._generateResponse(message, plan, toolResult, context, conversationHistory);
        content = response.content;
      } catch (responseError) {
        console.error("[AgentExecutor] Response generation error:", responseError);
        content = "⚠️ Xin lỗi, tôi gặp khó khăn khi tạo câu trả lời. Vui lòng thử lại.";
      }
      
      return {
        response: content,
        intent: plan.intent,
        tool_used: toolName,
        data: toolResult,
        suggestions: []
      };

    } catch (error) {
      console.error("[AgentExecutor] Fatal Error:", error);
      return {
        response: "⚠️ Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
        intent: "GENERAL_CHAT",
        error: error.message,
        suggestions: []
      };
    }
  }

  // ============================================
  // RESPONSE GENERATION
  // ============================================
  async _generateResponse(userMessage, plan, toolResult, context, conversationHistory = []) {
    // Check if user is asking about system features/capabilities
    const lowerMessage = userMessage.toLowerCase();
    const systemFeatureKeywords = [
      'chức năng', 'tính năng', 'features', 'capabilities',
      'hệ thống có gì', 'hệ thống làm gì', 'hệ thống có thể',
      'có những gì', 'làm được gì', 'có gì', 'tính năng nào',
      'chức năng nào', 'có chức năng gì', 'có tính năng gì',
      'hệ thống này', 'nền tảng này', 'ứng dụng này',
      'bạn có thể', 'bạn làm được', 'bạn giúp được gì'
    ];
    const isAskingAboutSystem = systemFeatureKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // If asking about system features, return predefined response
    if (isAskingAboutSystem) {
      const systemFeaturesContent = [
        '<h4>📋 Các chức năng chính của hệ thống:</h4>',
        '<h4>1. 📊 Quản lý Quảng cáo (Ads Management)</h4>',
        '<p>• Quản lý chiến dịch (Campaigns), nhóm quảng cáo (Ad Sets) và quảng cáo (Ads)</p>',
        '<p>• Đồng bộ dữ liệu từ Facebook Marketing API</p>',
        '<p>• Xem và cập nhật thông tin quảng cáo trực tiếp</p>',
        '<p>• Lọc và tìm kiếm theo tên, trạng thái, mục tiêu</p>',
        '<p>• Xem insights chi tiết (spend, impressions, clicks, CTR, CPC, v.v.)</p>',
        '<h4>2. 📈 Phân tích & Báo cáo (Analytics)</h4>',
        '<p>• Phân tích hiệu suất quảng cáo theo thời gian</p>',
        '<p>• Xem dữ liệu insights đã được đồng bộ</p>',
        '<p>• Lọc theo mục tiêu quảng cáo (objective)</p>',
        '<p>• Phân trang và tìm kiếm ads có dữ liệu</p>',
        '<h4>3. ⚡ Tự động hóa (Automation Rules)</h4>',
        '<p>• Tự động bật/tắt quảng cáo dựa trên điều kiện</p>',
        '<p>• Tự động tăng/giảm ngân sách</p>',
        '<p>• Thiết lập quy tắc theo metrics (spend, CTR, CPC, v.v.)</p>',
        '<p>• Chạy theo lịch định kỳ (hàng phút, hàng giờ, hàng ngày)</p>',
        '<h4>4. 🏪 Quản lý Shop & Tài khoản</h4>',
        '<p>• Quản lý nhiều cửa hàng (Shops)</p>',
        '<p>• Quản lý nhân viên và phân quyền</p>',
        '<p>• Kết nối Facebook Pages</p>',
        '<p>• Kết nối Facebook Ad Accounts</p>',
        '<h4>5. 🤖 AI Chat Hỗ trợ</h4>',
        '<p>• Hỏi đáp về dữ liệu quảng cáo bằng tiếng Việt</p>',
        '<p>• Phân tích xu hướng và hiệu suất</p>',
        '<p>• Truy vấn thông tin campaigns, adsets, ads</p>',
        '<p>• Đưa ra insights và khuyến nghị</p>',
        '<h4>6. 🔄 Đồng bộ dữ liệu</h4>',
        '<p>• Đồng bộ tự động entities (campaigns, adsets, ads) từ Facebook</p>',
        '<p>• Đồng bộ insights theo lịch (cron job)</p>',
        '<p>• Cache dữ liệu để tối ưu hiệu suất</p>',
        '<p>• Lazy loading insights khi cần</p>'
      ].join('\n');
      
      return { content: systemFeaturesContent };
    }

    // Nếu là QUERY_DATA + count (đếm số lượng) và đã có toolResult hợp lệ
    // → bỏ qua LLM2, trả lời trực tiếp cho nhanh
    if (plan.intent === "QUERY_DATA" && plan.query_type === "count" && toolResult && !toolResult.error) {
      const entityType = toolResult.entity_type || (plan.entities && plan.entities[0]?.type) || "campaign";
      const entityLabelMap = {
        campaign: "chiến dịch",
        adset: "nhóm quảng cáo",
        ad: "quảng cáo"
      };
      const label = entityLabelMap[entityType] || "đối tượng";
      const count = typeof toolResult.count === "number" ? toolResult.count : 0;
      
      const content = `<p>Hiện tại tài khoản này đang có <strong>${count}</strong> ${label}.</p>`;
      return { content };
    }

    // Check if we have real data (not GENERAL_CHAT)
    const hasRealData = plan.intent !== "GENERAL_CHAT" &&
                       toolResult && 
                       toolResult.message !== "General conversation - no tool needed" &&
                       !toolResult.error;
    
    // Format date range for display - ONLY if we have real data
    let dateRangeText = "";
    if (hasRealData) {
      // Check if toolResult has date_range_effective (from rankCampaignsTool)
      if (toolResult.date_range_effective) {
        const formatDate = (dateStr) => {
          const d = new Date(dateStr);
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        };
        dateRangeText = `từ ${formatDate(toolResult.date_range_effective.from)} đến ${formatDate(toolResult.date_range_effective.to)}`;
      } else if (plan.time_range?.from && plan.time_range?.to) {
        const formatDate = (dateStr) => {
          const d = new Date(dateStr);
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        };
        dateRangeText = `từ ${formatDate(plan.time_range.from)} đến ${formatDate(plan.time_range.to)}`;
      }
    }
    
    // Build conversation history context
    const recentHistory = (conversationHistory || [])
      .filter(m => m && m.content && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-5)
      .map(m => ({ role: m.role, content: m.content }));
    
    // Extract previous toolResult from conversation history if available
    let previousToolResult = null;
    if (conversationHistory && conversationHistory.length > 0) {
      const lastAssistantMessage = conversationHistory
        .filter(m => m.role === "assistant" && m.data)
        .slice(-1)[0];
      if (lastAssistantMessage && lastAssistantMessage.data) {
        // If data is a string (JSON), parse it
        if (typeof lastAssistantMessage.data === 'string') {
          try {
            previousToolResult = JSON.parse(lastAssistantMessage.data);
          } catch (e) {
            // If parse fails, try to use as-is
            previousToolResult = lastAssistantMessage.data;
          }
        } else {
          previousToolResult = lastAssistantMessage.data;
        }
      }
    }
    
    const systemPrompt = `
You are a Senior Marketing Consultant for Facebook Ads.
Your goal is to provide actionable insights, not just data.

CONTEXT:
- Account: ${context.account?.name || "Unknown"}
- Today's Spend: ${context.today_stats?.spend || "N/A"}
- User Intent: ${plan.intent}
- Query Type: ${plan.query_type || "N/A"}
- Level: ${plan.level || toolResult?.level || "N/A"}
- Sort By Metric: ${plan.metrics?.[0] || toolResult?.sort_by_metric || "default (effectiveness score)"}
- Date Range: ${dateRangeText || "N/A"}

CONTEXT SUMMARY (from LLM1 analysis of conversation history):
${plan.context_summary || "No previous context"}

DATA FROM TOOLS (current query):
${JSON.stringify(toolResult, null, 2)}

PREVIOUS QUERY DATA (from conversation history):
${previousToolResult ? JSON.stringify(previousToolResult, null, 2) : "No previous data"}

CRITICAL RULES:
1. **Date Range Display**: 
   - ONLY show date range (e.g., "Từ ngày DD/MM/YYYY đến DD/MM/YYYY") if:
     * Intent is QUERY_DATA, ANALYZE_TREND, RANK_CAMPAIGNS, or RANK_ADSETS
     * AND there is actual data from tools (not "General conversation - no tool needed")
     * AND date range is available
   - If toolResult has date_range_effective, use that instead of plan.time_range
   - If toolResult has data_coverage_notes, include them in your response
   - DO NOT show date range for GENERAL_CHAT or questions without data
   - If showing date range, put it on a single line at the start, then add ONE blank line before content
2. **Follow-up Questions**: 
   - If user asks about "bao lâu", "thời gian", "khoảng thời gian" after a ranking query:
     * Check toolResult.date_range_effective or plan.time_range
     * Answer with the ACTUAL date range used, not generic advice
     * Example: "Kết quả được tính từ ngày DD/MM/YYYY đến DD/MM/YYYY"
   - If user asks about "thuộc adset nào", "thuộc campaign nào", "adset/campaign của ads này":
     * FIRST: Check CONTEXT SUMMARY to understand which entities user is referring to (e.g., "3 ads: X, Y, Z")
     * SECOND: Check if current toolResult has the data (toolResult.top or toolResult.groups)
     * THIRD: If not, check PREVIOUS QUERY DATA from conversation history (previousToolResult)
     * Look for entities with adset_id, adset_name, campaign_id, campaign_name fields
     * Match entity names from context_summary with entities in toolResult/previousToolResult
     * If found, use them directly to answer
     * Format: "Ads [name] thuộc Adset [adset_name] (ID: [adset_id]), Campaign [campaign_name] (ID: [campaign_id])"
     * If parent info is missing in both current and previous data, mention that information is not available
   - Use conversation history to understand context of follow-up questions
3. **Parent Information (for RANK_ADS)**: 
   - When toolResult contains ranking results with level="ad", check if each entity has:
     * adset_id, adset_name (parent adset)
     * campaign_id, campaign_name (parent campaign)
   - If user asks "ads này thuộc adset/campaign nào", list all ads with their parent info
   - Format parent info clearly in your response
4. **Use HTML for formatting** - Output will be rendered as HTML
5. **For ranking tables (RANK_CAMPAIGNS/RANK_ADSETS/RANK_ADS)**: 
   - ALWAYS render ranking results using a 3-column table. DO NOT add more columns.
   - **Column 1 Header** (MUST match level from toolResult.level or plan.level):
     * level="campaign" → "Tên chiến dịch"
     * level="adset" → "Tên nhóm quảng cáo"  
     * level="ad" → "Tên quảng cáo"
   - **Column 2 Header** (MUST match sort_by_metric from toolResult or plan.metrics):
     * If sort_by_metric is "spend" or null/undefined → "Chi phí" (show spend.formatted or spend value)
     * If sort_by_metric is "ctr" → "Chỉ số chính" (show CTR with %)
     * If sort_by_metric is "cpc" → "Chỉ số chính" (show CPC)
     * If sort_by_metric is "cpm" → "Chỉ số chính" (show CPM)
     * If sort_by_metric is "cpa" → "Chỉ số chính" (show CPA)
     * If sort_by_metric is "cpl" → "Chỉ số chính" (show CPL)
     * If sort_by_metric is NOT "spend", add note above table: "Xếp hạng theo: [metric_name] (Chi phí chỉ để tham khảo)"
   - **Column 3 Header**: "Điểm hiệu quả" (format score correctly)
   - **Score Formatting** (CRITICAL):
     * Check toolResult.top[].score.value format:
     * If score.value is 0-1 range (e.g., 0.888) → multiply by 100, add % → "88.8%"
     * If score.value is 0-100 range (e.g., 88.8) → keep as is, add % → "88.8%"
     * If score.value is index/rank → use "Điểm" label, no % → "85"
     * Use score.formatted if available from toolResult
   - **Score Color**: Use dark gray (#374151) or dark text color. DO NOT use red (#dc2626) for scores.
   - **Table Template** (use this exact structure):
   <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
     <thead>
       <tr style="background-color: #667eea; color: white;">
         <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px; border: none;">[Column 1: Entity name based on level]</th>
         <th style="padding: 12px 16px; text-align: right; font-weight: 600; font-size: 14px; border: none;">[Column 2: Metric based on sort_by_metric]</th>
         <th style="padding: 12px 16px; text-align: right; font-weight: 600; font-size: 14px; border: none;">Điểm hiệu quả</th>
       </tr>
     </thead>
     <tbody>
       <tr style="border-bottom: 1px solid #e5e7eb;">
         <td style="padding: 14px 16px; font-weight: 500; color: #1f2937;">[Entity Name]</td>
         <td style="padding: 14px 16px; text-align: right; color: #059669; font-weight: 500;">[Metric Value]</td>
         <td style="padding: 14px 16px; text-align: right; color: #374151; font-weight: 600; font-size: 15px;">[Score]</td>
       </tr>
       <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
         <td style="padding: 14px 16px; font-weight: 500; color: #1f2937;">[Entity Name 2]</td>
         <td style="padding: 14px 16px; text-align: right; color: #059669; font-weight: 500;">[Metric Value 2]</td>
         <td style="padding: 14px 16px; text-align: right; color: #374151; font-weight: 600; font-size: 15px;">[Score 2]</td>
       </tr>
     </tbody>
   </table>
   - **Important Notes**:
     * Header: Purple background (#667eea), white text, horizontal
     * Rows: Alternate background (#ffffff and #f9fafb)
     * Metric value: Green (#059669) for spend, neutral (#1f2937) for other metrics
     * Score: Dark gray (#374151), bold, right-aligned, NO red color
     * All text must be horizontal (no vertical rotation)
     * If toolResult has score_method or metric_score_explain, add below table: "<p style='font-size: 12px; color: #6b7280; margin-top: 8px;'>Cách tính điểm: [explanation]</p>"
6. **For other tables**: Use clean HTML tables with proper styling, but keep it simple
7. **Highlighting**: 
   - Use <strong> for important items
   - Use <span style="color: #1890ff"> for metric labels
   - Use <h4> for section titles (NO ### headers)
8. **NO MARKDOWN**: Do not use ###, **, or markdown syntax
9. **NO FOLLOW-UP QUESTIONS**: Do not generate suggestions
10. **Language**: ALWAYS respond in VIETNAMESE (Tiếng Việt)
11. **Be concise**: Keep analysis brief and actionable
12. **Minimize whitespace**: 
   - Remove extra blank lines (max 1 blank line between sections)
   - Remove trailing spaces
   - Keep paragraphs compact

If data is missing or error, politely explain what went wrong.
`;

    if (!userMessage || !userMessage.trim()) {
      return { content: "Xin chào! Tôi có thể giúp gì cho bạn về quảng cáo hôm nay?" };
    }

    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...recentHistory,
        { role: "user", content: userMessage }
      ];
      
      const result = await this.llm.invoke(messages);
      let content = result.content?.trim() || "⚠️ Không thể tạo câu trả lời";
      
      // Clean up excessive whitespace
      // Remove multiple consecutive blank lines (more than 1)
      content = content.replace(/\n{3,}/g, '\n\n');
      // Remove trailing spaces from each line
      content = content.split('\n').map(line => line.trimEnd()).join('\n');
      // Remove leading/trailing whitespace
      content = content.trim();
      // Remove blank lines between HTML tags (but keep structure)
      content = content.replace(/>\s*\n\s*</g, '><');
      // Add back single newline between major sections (h4 tags)
      content = content.replace(/<\/h4><h4>/g, '</h4>\n<h4>');
      // Add back single newline between h4 and p
      content = content.replace(/<\/h4><p>/g, '</h4>\n<p>');
      
      return { content };
    } catch (error) {
      console.error("[AgentExecutor] Error generating response:", error);
      return { 
        content: "⚠️ Xin lỗi, tôi đang gặp chút khó khăn khi tạo câu trả lời. Bạn vui lòng thử lại nhé!"
      };
    }
  }
}

export const agentExecutor = new AgentExecutor();

import { contextManager } from "./contextManager.js";
import { intentClassifier } from "./intentClassifier.js";
import { analyticsTools } from "./analyticsTools.js";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";

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
    const useGemini = !!process.env.GOOGLE_API_KEY;
    
    if (useOpenAI) {
      this.llm = new ChatOpenAI({ 
        modelName: "gpt-4o-mini", 
        temperature: 0.3 
      });
    } else if (useGemini) {
      this.llm = new ChatGoogleGenerativeAI({ 
        modelName: "gemini-2.0-flash-exp", 
        temperature: 0.3 
      });
    } else {
      console.warn("⚠️ No AI API key configured. AgentExecutor will not work properly.");
      this.llm = null;
    }
  }

  async processMessage(userId, accountId, message, conversationHistory = []) {
    if (!this.llm) {
      throw new Error("AI service not configured. Please set OPENAI_API_KEY or GOOGLE_API_KEY.");
    }
    
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
          reasoning: "Classification failed"
        };
      }

      // 3. Execute Tool based on Intent
      let toolResult = null;
      let toolName = null;

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // ============================================
      // INTENT: QUERY_DATA
      // ============================================
      if (plan.intent === "QUERY_DATA") {
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
              const res = await simpleEntityResolution(accountId, ent.name, ent.type);
              if (res) resolvedIds.push(res.id);
            }
            params.entity_ids = resolvedIds;
            params.entity_type = plan.entities[0].type;
          }
          
          // Add metric if present (for top_bottom queries)
          if (plan.metrics && plan.metrics.length > 0) {
            params.metric = plan.metrics[0];
          }
          
          console.log(`[AgentExecutor] Invoking ${toolName}:`, JSON.stringify(params, null, 2));
          
          try {
            const rawResult = await tool.invoke(params);
            toolResult = JSON.parse(rawResult);
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
          
          console.log(`[AgentExecutor] Invoking ${toolName}:`, JSON.stringify(params, null, 2));
          
          try {
            const rawResult = await tool.invoke(params);
            toolResult = JSON.parse(rawResult);
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

      // 4. Generate Response
      let content;
      try {
        const response = await this._generateResponse(message, plan, toolResult, context);
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
  async _generateResponse(userMessage, plan, toolResult, context) {
    // Format date range for display
    let dateRangeText = "";
    if (plan.time_range?.from && plan.time_range?.to) {
      const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      };
      dateRangeText = `từ ${formatDate(plan.time_range.from)} đến ${formatDate(plan.time_range.to)}`;
    }
    
    const systemPrompt = `
You are a Senior Marketing Consultant for Facebook Ads.
Your goal is to provide actionable insights, not just data.

CONTEXT:
- Account: ${context.account?.name || "Unknown"}
- Today's Spend: ${context.today_stats?.spend || "N/A"}
- User Intent: ${plan.intent}
- Query Type: ${plan.query_type || "N/A"}
- Date Range: ${dateRangeText || "N/A"}

DATA FROM TOOLS:
${JSON.stringify(toolResult, null, 2)}

CRITICAL RULES:
1. **ALWAYS START with date range**: Begin your response with the date range in format "Từ ngày DD/MM/YYYY đến DD/MM/YYYY" (use Date Range from context above)
2. **Use HTML for formatting** - Output will be rendered as HTML
3. **For lists/tables**: Use clean HTML tables with proper styling
4. **Highlighting**: 
   - Use <strong> for important items
   - Use <span style="color: #1890ff"> for metric labels
   - Use <h4> for section titles (NO ### headers)
5. **NO MARKDOWN**: Do not use ###, **, or markdown syntax
6. **NO FOLLOW-UP QUESTIONS**: Do not generate suggestions
7. **Language**: ALWAYS respond in VIETNAMESE (Tiếng Việt)
8. **Be concise**: Keep analysis brief and actionable

If data is missing or error, politely explain what went wrong.
`;

    if (!userMessage || !userMessage.trim()) {
      return { content: "Xin chào! Tôi có thể giúp gì cho bạn về quảng cáo hôm nay?" };
    }

    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ];
      
      const result = await this.llm.invoke(messages);
      const content = result.content?.trim() || "⚠️ Không thể tạo câu trả lời";
      
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

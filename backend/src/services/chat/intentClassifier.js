import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const IntentSchema = z.object({
  intent: z.enum([
    "QUERY_DATA",      // ANY data query (overview, count, list, entity-specific, top_bottom)
    "RANK_CAMPAIGNS",  // Rank campaigns by effectiveness
    "RANK_ADSETS",     // Rank adsets by effectiveness
    "RANK_ADS",        // Rank ads (quảng cáo) by effectiveness
    "GET_ENTITY_METADATA", // Get entity metadata and relationships
    "ANALYZE_TREND",   // Trends over time
    "GENERAL_CHAT",    // Greetings, off-topic
  ]),
  query_type: z.enum(["overview", "count", "list", "top_bottom"]).nullable().describe("Type of data query if intent=QUERY_DATA"),
  level: z.enum(["campaign", "adset", "ad"]).nullable().describe("Level for ranking: campaign, adset, or ad (if intent=RANK_CAMPAIGNS, RANK_ADSETS, or RANK_ADS)"),
  objective: z.enum(["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION"]).nullable().describe("Campaign objective if mentioned, or null for all objectives"),
  entities: z.array(z.object({
    type: z.enum(["campaign", "adset", "ad"]),
    name: z.string(),
  })).nullable().describe("List of entities mentioned in the query or null"),
  time_range: z.object({
    preset: z.enum(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "custom", "unknown"]).describe("Time range preset"),
    from: z.string().nullable().describe("YYYY-MM-DD or null"),
    to: z.string().nullable().describe("YYYY-MM-DD or null"),
  }).nullable().describe("Time range or null"),
  metrics: z.array(z.string()).nullable().describe("List of metrics mentioned (e.g., spend, cpc, ctr) or null"),
  rank_position: z.number().nullable().describe("Vị trí trong ranking (1, 2, 3...) nếu user hỏi 'thứ 2', 'thứ 3', 'top 2', etc. Null nếu không có"),
  context_summary: z.string().nullable().describe("Tóm tắt context từ conversation history: những gì user đã hỏi, kết quả đã nhận được, entities đã được đề cập. Null nếu không có context trước đó."),
  reasoning: z.string().describe("Brief reasoning for the classification"),
});

export class IntentClassifier {
  constructor() {
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    this.llm = useOpenAI
      ? new ChatOpenAI({ 
          modelName: "gpt-5-mini"
        })
      : new ChatGoogleGenerativeAI({ modelName: "gemini-2.0-flash-exp", temperature: 0 });
  }

  /**
   * Classify the user's message into an intent and extract slots.
   * @param {string} message - The user's message.
   * @param {Object} context - The context object (optional).
   * @param {Array} history - Chat history (optional).
   * @returns {Promise<Object>} The classification result.
   */
  async classify(message, context = {}, history = []) {
    try {
      const systemPrompt = `
You are an expert Intent Classifier for a Facebook Ads AI Agent.
Your job is to analyze the user's query and extract the intent, entities, time range, and metrics.
CONTEXT:
Current Date: ${new Date().toISOString().split('T')[0]}
Account Name: ${context.account?.name || "Unknown"}
INTENT SYSTEM:
1. **RANK_CAMPAIGNS** - Rank campaigns by effectiveness (hiệu quả nhất, tốt nhất)
   - Set level="campaign"
   - Detect objective from context if mentioned (sales, leads, traffic, awareness, engagement, app)
   - Examples:
     - "Campaign nào hiệu quả nhất trong 3 tháng gần đây?" → RANK_CAMPAIGNS, level=campaign, objective=null
     - "Top 5 campaigns bán hàng tốt nhất" → RANK_CAMPAIGNS, level=campaign, objective=OUTCOME_SALES
     - "Campaign nào tốt nhất?" → RANK_CAMPAIGNS, level=campaign, objective=null
2. **RANK_ADSETS** - Rank adsets by effectiveness
   - Set level="adset"
   - Detect objective from context if mentioned
   - Examples:
     - "Adset nào hiệu quả nhất?" → RANK_ADSETS, level=adset, objective=null
     - "Top adsets cho leads" → RANK_ADSETS, level=adset, objective=OUTCOME_LEADS
3. **RANK_ADS** - Rank ads (quảng cáo) by effectiveness
   - Set level="ad"
   - Detect objective from context if mentioned
   - Examples:
     - "Ads nào hiệu quả nhất?" → RANK_ADS, level=ad, objective=null
     - "Quảng cáo nào có CTR cao nhất?" → RANK_ADS, level=ad, metrics=["ctr"]
     - "Ad nào tốt nhất?" → RANK_ADS, level=ad, objective=null
   - IMPORTANT: "ads" (plural) or "ad" (singular) or "quảng cáo" → RANK_ADS, level=ad
   - "adsets" or "nhóm quảng cáo" → RANK_ADSETS, level=adset
4. **GET_ENTITY_METADATA** - Query metadata và relationship của entities
   - Dùng khi user hỏi về quan hệ: "ads này thuộc adset nào?", "adset này thuộc campaign nào?", "nó thuộc adset nào?"
   - CRITICAL: Nếu user hỏi "nó", "3 cái ads trên", "ads trên", "quảng cáo trên", "cái này", "cái đó" → đây là follow-up question về entities đã được đề cập trước đó
   - CRITICAL: Nếu user hỏi "thuộc", "belong to", "của" → GET_ENTITY_METADATA, không phải QUERY_DATA
   - Extract entity_type và entity_ids từ câu hỏi hoặc conversation history
   - Examples:
     - "2 ads này thuộc adset với campaign nào?" → GET_ENTITY_METADATA, entity_type=ad, entity_ids=[...]
     - "Adset X thuộc campaign nào?" → GET_ENTITY_METADATA, entity_type=adset, entity_ids=[X]
     - "nó thuộc adset nào?" (sau khi đã ranking ads) → GET_ENTITY_METADATA, entity_type=ad
     - "3 cái ads trên thuộc adset nào?" → GET_ENTITY_METADATA, entity_type=ad
     - "ads trên thuộc campaign nào?" → GET_ENTITY_METADATA, entity_type=ad
     - "ý là 3 cái ads trên thuộc cái adset nào?" → GET_ENTITY_METADATA, entity_type=ad
   - Nếu không có entity_ids trong câu hỏi, check conversation history để lấy từ kết quả ranking trước đó
5. **QUERY_DATA** - ANY data query about ads performance
   - Also determine query_type:
     - "overview": Metrics summary (spend, CTR, CPC, clicks, results) for account or specific entities
     - "count": Count number of campaigns/adsets/ads
     - "list": List campaigns/adsets/ads with names and status
     - "top_bottom": Find top/bottom performing entities by metric
   Examples:
   - "Chi tiêu hôm nay?" → QUERY_DATA, query_type=overview
   - "Campaign X thế nào?" → QUERY_DATA, query_type=overview, entities=[X]
   - "Có bao nhiêu chiến dịch?" → QUERY_DATA, query_type=count, entities=[{type: "campaign", name: null}]
   - "Có bao nhiêu nhóm quảng cáo?" → QUERY_DATA, query_type=count, entities=[{type: "adset", name: null}]
   - "Có bao nhiêu quảng cáo?" → QUERY_DATA, query_type=count, entities=[{type: "ad", name: null}]
   - "Danh sách campaigns" → QUERY_DATA, query_type=list
   - "Campaign nào có spend cao nhất?" → QUERY_DATA, query_type=top_bottom
   - IMPORTANT: Khi user hỏi "Có bao nhiêu X?", extract entity_type từ X:
     * "chiến dịch", "campaign" → entity_type: "campaign"
     * "nhóm quảng cáo", "adset", "adsets" → entity_type: "adset"
     * "quảng cáo", "ad", "ads" → entity_type: "ad"
6. **ANALYZE_TREND** - Time-series analysis, changes over time
   Examples: "Xu hướng CTR 7 ngày", "Spend tháng này biến động thế nào"
7. **GENERAL_CHAT** - Greetings, thanks, unrelated topics
   Examples: "Xin chào", "Cảm ơn", "Thời tiết hôm nay"
INSTRUCTIONS:
- If no time range mentioned, set preset="last_7_days" and calculate from/to dates (7 days ago to today)
- Extract entity names exactly as mentioned
- Map metrics: "chi phí"→"spend", "giá click"→"cpc", "tỷ lệ nhấp"→"ctr", "cpm"→"cpm", "cpa"→"cpa", "cpl"→"cpl"
- Map effectiveness keywords: "hiệu quả nhất", "tốt nhất", "hiệu quả" → RANK_CAMPAIGNS or RANK_ADSETS
- Map metric ranking queries to RANK_CAMPAIGNS/RANK_ADSETS:
  - "CTR cao nhất", "tỷ lệ nhấp cao nhất" → RANK_CAMPAIGNS/RANK_ADSETS, metrics=["ctr"]
  - "CPC thấp nhất", "giá click thấp nhất" → RANK_CAMPAIGNS/RANK_ADSETS, metrics=["cpc"]
  - "CPM thấp nhất" → RANK_CAMPAIGNS/RANK_ADSETS, metrics=["cpm"]
  - "CPA thấp nhất" → RANK_CAMPAIGNS/RANK_ADSETS, metrics=["cpa"]
  - "CPL thấp nhất" → RANK_CAMPAIGNS/RANK_ADSETS, metrics=["cpl"]
  - "spend cao nhất", "chi phí cao nhất" → RANK_CAMPAIGNS/RANK_ADSETS, metrics=["spend"]
- Extract rank position from queries:
  - "thứ 2", "thứ hai", "cao thứ 2", "thứ hai" → rank_position: 2
  - "thứ 3", "thứ ba", "top 3" → rank_position: 3
  - "thứ nhất", "cao nhất", "top 1", "nhất" → rank_position: 1
  - If not mentioned, rank_position: null
- For follow-up questions like "thế còn cao thứ 2", check conversation history to understand the previous query context
- **CRITICAL: Context Summary**:
  - MANDATORY: Always analyze conversation history (both user questions and assistant responses)
  - Extract key information: what user asked, what results were returned, which entities were mentioned
  - If user asked about ranking, note: level (campaign/adset/ad), number of results, entity names
  - If assistant returned data with toolResult, check if it has "top" array or "groups" object
  - If assistant returned ranking results, extract: entity names, entity_ids, scores, and parent info (adset_id, campaign_id) if available
  - Format context_summary as a brief, structured summary in Vietnamese
  - Examples:
    * "User đã hỏi về ranking ads hiệu quả nhất. Kết quả trả về 3 ads: 'Quảng cáo A' (ID: xxx), 'Quảng cáo B' (ID: yyy), 'Quảng cáo C' (ID: zzz) với điểm hiệu quả 86.1%, 84.3%, 73.9%."
    * "User đã hỏi về ranking campaigns. Kết quả trả về top 5 campaigns với điểm hiệu quả từ 88.8% đến 24.2%."
  - If current question is follow-up (uses "nó", "trên", "đó", "cái này"), context_summary MUST reference previous results
  - If no relevant history, set context_summary: null
- Detect objective from context:
  - "sales", "purchase", "mua hàng", "bán hàng" → OUTCOME_SALES
  - "lead", "form", "đăng ký" → OUTCOME_LEADS
  - "traffic", "click", "lượt truy cập" → OUTCOME_TRAFFIC
  - "awareness", "reach", "nhận biết" → OUTCOME_AWARENESS
  - "engagement", "tương tác" → OUTCOME_ENGAGEMENT
  - "app", "install" → OUTCOME_APP_PROMOTION

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "QUERY_DATA" | "RANK_CAMPAIGNS" | "RANK_ADSETS" | "RANK_ADS" | "GET_ENTITY_METADATA" | "ANALYZE_TREND" | "GENERAL_CHAT",
  "query_type": "overview" | "count" | "list" | "top_bottom" (or null if not QUERY_DATA),
  "level": "campaign" | "adset" | "ad" (or null if not RANK_CAMPAIGNS/RANK_ADSETS/RANK_ADS),
  "objective": "OUTCOME_SALES" | "OUTCOME_LEADS" | ... (or null),
  "entities": [ { "type": "campaign/adset/ad", "name": "string" } ] (or null),
  "time_range": { "preset": "string", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (or null),
  "metrics": ["string"] (or null),
  "rank_position": 1 | 2 | 3 | null,
  "context_summary": "string" | null,
  "reasoning": "string"
}
`;

      const validHistory = history
        .filter(m => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const messages = [
        { role: "system", content: systemPrompt },
        ...validHistory,
        { role: "user", content: message }
      ];

      console.log("[IntentClassifier] Invoking LLM with messages:", JSON.stringify(messages, null, 2));
      const result = await this.llm.invoke(messages);
      console.log("[IntentClassifier] LLM Result:", JSON.stringify(result, null, 2));
      
      let parsed;
      try {
        parsed = JSON.parse(result.content);
      } catch (e) {
        console.error("[IntentClassifier] JSON Parse Error:", e);
        // Try to extract JSON from text if markdown code blocks are used
        const match = result.content.match(/```json([\s\S]*?)```/);
        if (match) {
            parsed = JSON.parse(match[1]);
        } else {
            throw new Error("Failed to parse JSON response");
        }
      }

      // Normalize output to match expected schema
      // Apply default time_range if not provided
      let timeRange = parsed.time_range;
      if (!timeRange || !timeRange.preset || timeRange.preset === "unknown") {
        const today = new Date();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        timeRange = {
          preset: "last_7_days",
          from: sevenDaysAgo.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      }
      
      return {
        intent: parsed.intent || "GENERAL_CHAT",
        query_type: parsed.query_type || null,
        level: parsed.level || null,
        objective: parsed.objective || null,
        entities: parsed.entities || [],
        time_range: timeRange,
        metrics: parsed.metrics || [],
        rank_position: parsed.rank_position || null,
        context_summary: parsed.context_summary || null,
        reasoning: parsed.reasoning || ""
      };

    } catch (error) {
      console.error("[IntentClassifier] Error:", error);
      // Fallback
      return {
        intent: "GENERAL_CHAT",
        reasoning: "Error in classification or Empty Response",
        entities: [],
        metrics: [],
        rank_position: null,
        context_summary: null
      };
    }
  }
}

export const intentClassifier = new IntentClassifier();

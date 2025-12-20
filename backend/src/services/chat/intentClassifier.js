import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// ============================================
// INTENT DEFINITIONS - Separated by category
// ============================================

const INTENT_DEFINITIONS = {
  RANK_CAMPAIGNS: {
    description: "Xếp hạng campaigns theo hiệu quả",
    keywords: ["hiệu quả", "tốt nhất", "top", "xếp hạng", "campaign", "chiến dịch"],
    examples: [
      '"Campaign nào hiệu quả nhất?" → RANK_CAMPAIGNS, level=campaign, objective=null',
      '"Top 5 campaigns bán hàng" → RANK_CAMPAIGNS, level=campaign, objective=OUTCOME_SALES',
    ],
    schema: 'level="campaign", objective=OUTCOME_* or null'
  },
  
  RANK_ADSETS: {
    description: "Xếp hạng adsets theo hiệu quả",
    keywords: ["hiệu quả", "tốt nhất", "top", "xếp hạng", "adset", "nhóm quảng cáo"],
    examples: [
      '"Adset nào hiệu quả nhất?" → RANK_ADSETS, level=adset, objective=null',
      '"Top adsets cho leads" → RANK_ADSETS, level=adset, objective=OUTCOME_LEADS',
    ],
    schema: 'level="adset", objective=OUTCOME_* or null'
  },
  
  RANK_ADS: {
    description: "Xếp hạng ads/quảng cáo theo hiệu quả",
    keywords: ["hiệu quả", "tốt nhất", "top", "xếp hạng", "ad", "ads", "quảng cáo"],
    examples: [
      '"Ads nào hiệu quả nhất?" → RANK_ADS, level=ad, objective=null',
      '"Quảng cáo có CTR cao nhất?" → RANK_ADS, level=ad, metrics=["ctr"]',
    ],
    schema: 'level="ad", objective=OUTCOME_* or null'
  },
  
  GET_ENTITY_METADATA: {
    description: "Lấy thông tin quan hệ giữa entities (ads → adset → campaign)",
    keywords: ["thuộc", "của", "nó", "trên", "belong", "relationship"],
    examples: [
      '"Ads này thuộc adset nào?" → GET_ENTITY_METADATA, entity_type=ad',
      '"3 cái ads trên thuộc campaign nào?" → GET_ENTITY_METADATA, entity_type=ad',
    ],
    schema: 'entity_type=ad/adset/campaign, entity_ids=[] (from context)'
  },
  
  QUERY_DATA: {
    description: "Truy vấn dữ liệu: overview, count, list, top_bottom",
    keywords: ["chi tiêu", "phân tích", "xem", "có bao nhiêu", "danh sách", "thế nào"],
    examples: [
      '"Chi tiêu hôm nay?" → QUERY_DATA, query_type=overview',
      '"Phân tích campaign ABC" → QUERY_DATA, query_type=overview, entities=[{type:"campaign", name:"ABC"}]',
      '"Có bao nhiêu chiến dịch?" → QUERY_DATA, query_type=count, entities=[{type:"campaign"}]',
      '"Danh sách campaigns" → QUERY_DATA, query_type=list',
      '"Campaign nào spend cao nhất?" → QUERY_DATA, query_type=top_bottom, metric=spend',
    ],
    schema: 'query_type=overview/count/list/top_bottom, entities=[], metrics=[]'
  },
  
  ANALYZE_TREND: {
    description: "Phân tích xu hướng theo thời gian",
    keywords: ["xu hướng", "biến động", "tăng", "giảm", "trend", "thay đổi"],
    examples: [
      '"Xu hướng CTR 7 ngày" → ANALYZE_TREND, metric=ctr',
      '"Spend tháng này biến động thế nào?" → ANALYZE_TREND, metric=spend',
    ],
    schema: 'metrics=[], time_range={}'
  },
  
  GENERAL_CHAT: {
    description: "Chào hỏi, cảm ơn, off-topic",
    keywords: ["xin chào", "cảm ơn", "hi", "hello", "thank"],
    examples: [
      '"Xin chào" → GENERAL_CHAT',
      '"Cảm ơn bạn" → GENERAL_CHAT',
    ],
    schema: 'No additional fields needed'
  }
};

// ============================================
// SMART INTENT SELECTION
// ============================================

function selectRelevantIntents(message) {
  const lowerMessage = message.toLowerCase();
  const relevant = [];
  
  for (const [intentName, definition] of Object.entries(INTENT_DEFINITIONS)) {
    const hasKeyword = definition.keywords.some(kw => lowerMessage.includes(kw));
    if (hasKeyword) {
      relevant.push(intentName);
    }
  }
  
  // Always include GENERAL_CHAT as fallback
  if (!relevant.includes('GENERAL_CHAT')) {
    relevant.push('GENERAL_CHAT');
  }
  
  // If no match, include all (safety net)
  if (relevant.length === 1 && relevant[0] === 'GENERAL_CHAT') {
    return Object.keys(INTENT_DEFINITIONS);
  }
  
  return relevant;
}

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
    this.llm = new ChatOpenAI({ 
      modelName: "gpt-4o",
      temperature: 0,
      timeout: 30000,
      maxRetries: 1,
    });
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
      // Smart intent selection based on keywords
      const relevantIntents = selectRelevantIntents(message);
      console.log(`[IntentClassifier] Relevant intents: ${relevantIntents.join(', ')}`);
      
      // Build compact prompt with only relevant intents
      let intentInstructions = '';
      for (const intentName of relevantIntents) {
        const def = INTENT_DEFINITIONS[intentName];
        intentInstructions += `\n**${intentName}** - ${def.description}\n`;
        intentInstructions += `Examples:\n${def.examples.map(ex => `  - ${ex}`).join('\n')}\n`;
        intentInstructions += `Schema: ${def.schema}\n`;
      }
      
      const systemPrompt = `
You are an Intent Classifier for Facebook Ads AI Agent.
CONTEXT: Date=${new Date().toISOString().split('T')[0]}, Account=${context.account?.name || "Unknown"}

INTENT OPTIONS:
${intentInstructions}

COMMON RULES:
- Extract entity names EXACTLY as mentioned (bao gồm số, ký tự đặc biệt, dấu gạch ngang)
- Default time_range: last_7_days (if not mentioned)
- Map metrics: "chi phí"→spend, "giá click"→cpc, "tỷ lệ nhấp"→ctr
- Map objectives: "bán hàng"→OUTCOME_SALES, "leads"→OUTCOME_LEADS, "traffic"→OUTCOME_TRAFFIC, "awareness"→OUTCOME_AWARENESS, "engagement"→OUTCOME_ENGAGEMENT, "app"→OUTCOME_APP_PROMOTION

OUTPUT (JSON only):
{
  "intent": "RANK_CAMPAIGNS|RANK_ADSETS|RANK_ADS|GET_ENTITY_METADATA|QUERY_DATA|ANALYZE_TREND|GENERAL_CHAT",
  "query_type": "overview|count|list|top_bottom" (or null),
  "level": "campaign|adset|ad" (or null),
  "objective": "OUTCOME_*" (or null),
  "entities": [{"type": "campaign/adset/ad", "name": "string"}] (or null),
  "time_range": {"preset": "last_7_days", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD"} (or null),
  "metrics": ["string"] (or null),
  "rank_position": number (or null),
  "context_summary": "string" (or null),
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
        // Try to extract JSON from markdown code blocks first
        const match = result.content.match(/```json([\s\S]*?)```/);
        if (match) {
          try {
            parsed = JSON.parse(match[1]);
            console.log("[IntentClassifier] ✓ Parsed JSON from markdown code block");
          } catch (parseError) {
            console.error("[IntentClassifier] JSON Parse Error (markdown):", parseError);
            console.error("[IntentClassifier] Content:", result.content);
            throw new Error("Failed to parse JSON response");
          }
        } else {
          console.error("[IntentClassifier] JSON Parse Error (no markdown):", e);
          console.error("[IntentClassifier] Content:", result.content);
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

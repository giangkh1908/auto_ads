import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const IntentSchema = z.object({
  intent: z.enum([
    "QUERY_DATA",      // ANY data query (overview, count, list, entity-specific, top/bottom)
    "ANALYZE_TREND",   // Trends over time
    "GENERAL_CHAT",    // Greetings, off-topic
  ]),
  query_type: z.enum(["overview", "count", "list", "top_bottom"]).nullable().describe("Type of data query if intent=QUERY_DATA"),
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
  reasoning: z.string().describe("Brief reasoning for the classification"),
});

export class IntentClassifier {
  constructor() {
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    this.llm = useOpenAI
      ? new ChatOpenAI({ 
          modelName: "gpt-4o-mini", 
          temperature: 0
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

SIMPLIFIED INTENT SYSTEM (3 intents only):

1. **QUERY_DATA** - ANY data query about ads performance
   - Also determine query_type:
     - "overview": Metrics summary (spend, CTR, CPC, clicks, results) for account or specific entities
     - "count": Count number of campaigns/adsets/ads
     - "list": List campaigns/adsets/ads with names and status
     - "top_bottom": Find top/bottom performing entities by metric
   
   Examples:
   - "Chi tiêu hôm nay?" → QUERY_DATA, query_type=overview
   - "Campaign X thế nào?" → QUERY_DATA, query_type=overview, entities=[X]
   - "Có bao nhiêu chiến dịch?" → QUERY_DATA, query_type=count
   - "Danh sách campaigns" → QUERY_DATA, query_type=list
   - "Campaign nào tốt nhất?" → QUERY_DATA, query_type=top_bottom

2. **ANALYZE_TREND** - Time-series analysis, changes over time
   Examples: "Xu hướng CTR 7 ngày", "Spend tháng này biến động thế nào"

3. **GENERAL_CHAT** - Greetings, thanks, unrelated topics
   Examples: "Xin chào", "Cảm ơn", "Thời tiết hôm nay"

INSTRUCTIONS:
- If no time range mentioned, set preset="last_30_days" and calculate from/to dates (30 days ago to today)
- Extract entity names exactly as mentioned
- Map metrics: "chi phí"→"spend", "giá click"→"cpc", "tỷ lệ nhấp"→"ctr"

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "QUERY_DATA" | "ANALYZE_TREND" | "GENERAL_CHAT",
  "query_type": "overview" | "count" | "list" | "top_bottom" (or null if not QUERY_DATA),
  "entities": [ { "type": "campaign/adset/ad", "name": "string" } ] (or null),
  "time_range": { "preset": "string", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" } (or null),
  "metrics": ["string"] (or null),
  "reasoning": "string"
}
`;

      const validHistory = history
        .filter(m => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(-3)
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
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        timeRange = {
          preset: "last_30_days",
          from: thirtyDaysAgo.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      }
      
      return {
        intent: parsed.intent || "GENERAL_CHAT",
        query_type: parsed.query_type || null,
        entities: parsed.entities || [],
        time_range: timeRange,
        metrics: parsed.metrics || [],
        reasoning: parsed.reasoning || ""
      };

    } catch (error) {
      console.error("[IntentClassifier] Error:", error);
      // Fallback
      return {
        intent: "GENERAL_CHAT",
        reasoning: "Error in classification or Empty Response",
        entities: [],
        metrics: []
      };
    }
  }
}

export const intentClassifier = new IntentClassifier();

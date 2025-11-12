import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { retrieveSimilarExamples } from "./ragService.js";

const RouterSchema = z.object({
  intent: z.enum([
    "TOTAL_METRICS",
    "OVERVIEW",
    "COMPARE",
    "TREND",
    "RANKING",
    "LIST_CAMPAIGNS",
    "CLARIFY",
    "GENERAL_CHAT",
  ]),
  tool: z.union([
    z.enum([
      "get_total_metrics",
      "get_overview",
      "compare_campaigns",
      "get_trend",
      "get_ranking",
      "list_campaigns",
    ]),
    z.null(),
  ]),
  confidence: z.number().min(0).max(1),
  metrics: z.union([
    z.array(
      z.enum([
        "CPC",
        "CTR",
        "CPM",
        "SPEND",
        "IMPRESSIONS",
        "CLICKS",
        "RESULTS",
        "REACH",
        "CONVERSIONS",
      ])
    ),
    z.null(),
  ]),
  date_text: z.union([z.string(), z.null()]),
  entities: z.union([
    z.array(
      z.object({
        type: z.literal("campaign"),
        name: z.string(),
      })
    ),
    z.null(),
  ]),
  reasoning: z.string(),
  missing: z.union([
    z.array(z.enum(["date_range", "entities", "metrics"])),
    z.null(),
  ]),
});

class SimpleRouter {
  constructor() {
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    const baseLLM = useOpenAI
      ? new ChatOpenAI({
          modelName: "gpt-4o-mini",
          temperature: 0.1,
        })
      : new ChatGoogleGenerativeAI({
          modelName: "gemini-2.0-flash-exp",
          temperature: 0.1,
        });

    this.llm = baseLLM.withStructuredOutput(RouterSchema);
  }

  buildPrompt(ragExamples, conversationHistory) {
    const examplesText = ragExamples
      .map((ex, i) => `${i + 1}. "${ex.example}"`)
      .join("\n");

    const historyText =
      conversationHistory.length > 0
        ? conversationHistory
            .slice(-5)
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n")
        : "Không có lịch sử chat trước đó.";

    return `Bạn là router phân tích quảng cáo Facebook. Nhiệm vụ của bạn là phân tích câu hỏi của người dùng và trả về structured output với intent và tool phù hợp.

EXAMPLES TƯƠNG TỰ (từ RAG):
${examplesText}

LỊCH SỬ CHAT:
${historyText}

NHIỆM VỤ:
1. Phân tích câu hỏi của người dùng
2. Xác định intent phù hợp
3. Chọn tool cần thiết để trả lời
4. Extract các thông tin: metrics, date_range, entities

QUY TẮC INTENT:
- TOTAL_METRICS: Hỏi về chỉ số, số liệu, trung bình (CTR, CPC, chi tiêu, lượt hiển thị, reach)
- OVERVIEW: Hỏi về số lượng, "có bao nhiêu" campaign/adset/ad
- COMPARE: Hỏi so sánh, "nào tốt hơn", "so sánh giữa"
- RANKING: Hỏi top, bottom, "nhiều nhất", "ít nhất"
- TREND: Hỏi xu hướng, tăng/giảm, theo thời gian, "7 ngày qua"
- LIST_CAMPAIGNS: Hỏi danh sách, tên, "liệt kê"
- CLARIFY: Thiếu thông tin cần thiết (date, campaign name, metrics)
- GENERAL_CHAT: Câu hỏi chung, không liên quan đến analytics

QUY TẮC TOOL:
- get_total_metrics: Cho TOTAL_METRICS intent
- get_overview: Cho OVERVIEW intent
- compare_campaigns: Cho COMPARE intent
- get_trend: Cho TREND intent
- get_ranking: Cho RANKING intent
- list_campaigns: Cho LIST_CAMPAIGNS intent

QUY TẮC METRICS:
- Extract metrics từ câu hỏi: CTR, CPC, CPM, SPEND, IMPRESSIONS, CLICKS, RESULTS, REACH, CONVERSIONS
- Nếu không rõ metrics nào, để trống

QUY TẮC DATE:
- Extract date_text nguyên văn từ câu hỏi: "hôm nay", "7 ngày qua", "tuần này", "tháng này"
- Nếu không có, để trống

QUY TẮC ENTITIES:
- Extract campaign names từ câu hỏi
- Format: [{"type": "campaign", "name": "Tên campaign"}]
- Nếu không có, để trống

QUY TẮC MISSING:
- Nếu thiếu date_range → ["date_range"]
- Nếu thiếu entities (cho COMPARE) → ["entities"]
- Nếu thiếu metrics (cho TOTAL_METRICS) → ["metrics"]
- Nếu đủ thông tin, để null

QUAN TRỌNG - OUTPUT FORMAT:
- BẮT BUỘC phải trả về TẤT CẢ các trường trong schema
- Nếu không có giá trị, dùng null (KHÔNG được bỏ qua trường)
- tool: null nếu không cần tool
- metrics: null nếu không có metrics cụ thể
- date_text: null nếu không có thông tin ngày
- entities: null nếu không có entities
- missing: null nếu không thiếu thông tin gì

Trả lời chỉ bằng JSON hợp lệ theo schema, BẮT BUỘC có đầy đủ tất cả các trường.`;
  }

  async route(userMessage, conversationHistory = []) {
    try {
      const ragExamples = await retrieveSimilarExamples(userMessage, 5);

      const systemPrompt = this.buildPrompt(ragExamples, conversationHistory);

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-5).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      const result = await this.llm.invoke(messages);

      return {
        intent: result.intent,
        tool: result.tool,
        confidence: result.confidence,
        metrics: result.metrics ?? [],
        date_text: result.date_text ?? "",
        entities: result.entities ?? [],
        reasoning: result.reasoning,
        missing: result.missing ?? [],
        rag_examples: ragExamples.map((ex) => ex.example),
      };
    } catch (error) {
      console.error("[Simple Router] Error routing:", error);
      return {
        intent: "GENERAL_CHAT",
        tool: null,
        confidence: 0,
        metrics: [],
        date_text: "",
        entities: [],
        reasoning: `Error: ${error.message}`,
        missing: [],
        rag_examples: [],
      };
    }
  }
}

export default SimpleRouter;


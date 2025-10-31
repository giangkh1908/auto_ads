import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v2 as cloudinary } from "cloudinary";
import pLimit from "p-limit";

dotenv.config();

// Khởi tạo clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const geminiTextModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const geminiImageModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-image",
});

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Lưu trữ context trong memory
const contexts = new Map();
const TTL = 30 * 60 * 1000; // 30 phút

// Cấu hình concurrency và retry
const CONCURRENT_LIMIT = 3; // Giới hạn 3 request đồng thời
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Retry function với exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, delays = RETRY_DELAYS) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = delays[attempt] || delays[delays.length - 1];
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * POST /api/ai/keywords/suggest
 * Gợi ý từ khóa liên quan
 */
export async function suggestKeywords(req, res) {
  try {
    const {
      language = "vi",
      main_keywords = [],
      ai_provider = "openai", // Thêm parameter này
    } = req.body;

    if (!main_keywords.length) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu từ khóa chính" });
    }

    const prompt = `Với vai trò là chuyên gia marketing, hãy tạo danh sách 5-7 từ khóa nhắm mục tiêu (targeting keywords) cho quảng cáo Facebook về chủ đề "${main_keywords.join(
      ", "
    )}" bằng ${language}. Từ khóa nên đa dạng, phù hợp với quảng cáo, và liên quan đến chủ đề. Chỉ liệt kê từ khóa mà khách hàng tiềm năng có thể quan tâm, cách nhau bằng dấu phẩy, không giải thích. Mỗi từ khóa nên ngắn gọn (1-3 từ).`;

    let relatedKeywordsText = "";

    if (ai_provider === "gemini") {
      const result = await geminiTextModel.generateContent(prompt);
      relatedKeywordsText = result.response.text();
    } else {
      // Mặc định là openai
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 300,
      });
      relatedKeywordsText = response.choices[0].message.content.trim();
    }

    const relatedKeywords = relatedKeywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      related_keywords: relatedKeywords,
      ai_provider_used: ai_provider,
    });
  } catch (error) {
    console.error("Error suggesting keywords:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi gợi ý từ khóa",
      error: error.message,
    });
  }
}

/**
 * POST /api/ai/context/confirm
 * Xác nhận context trước khi dùng AI
 */
export function confirmContext(req, res) {
  try {
    const { language, tone, personalization, main_keywords } = req.body;

    // Validate required fields
    if (!language || !tone || !main_keywords || !Array.isArray(main_keywords)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin context (language, tone, main_keywords)",
      });
    }

    // Generate a unique context ID
    const context_id = "ctx_" + uuidv4().substring(0, 8);

    // Store context with expiration time
    contexts.set(context_id, {
      language,
      tone,
      personalization: personalization || "",
      main_keywords,
      expiresAt: Date.now() + TTL,
    });

    // Clean up expired contexts occasionally
    if (Math.random() < 0.1) {
      // 10% chance to clean up
      for (const [id, ctx] of contexts.entries()) {
        if (ctx.expiresAt < Date.now()) {
          contexts.delete(id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      context_id,
      expires_in: TTL / 1000, // seconds
    });
  } catch (error) {
    console.error("Error confirming context:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xác nhận context",
      error: error.message,
    });
  }
}

/**
 * Build prompt for text generation based on target and context
 */
function buildPromptByTarget(target, ctx, constraints = {}) {
  const { language, tone, personalization, main_keywords } = ctx;
  const kw = main_keywords.join(", ");
  const maxLen = constraints.max_len || 100;
  const policy = `
TUÂN THỦ NGHIÊM:
1) Không gán/suy đoán thuộc tính cá nhân (sức khỏe, tài chính, chủng tộc, tôn giáo, tuổi, bệnh…); tránh "bạn đang/bạn bị".
2) Không nội dung y tế/giảm cân/thuốc, không chẩn đoán hay kết quả định lượng.
3) Không "trước–sau", không bảo đảm kết quả, không từ ngữ tuyệt đối: "tốt nhất", "rẻ nhất", "100%", "cam kết".
4) Không nhắc Facebook/Meta hay thương hiệu bên thứ ba nếu không được phép; không logo, watermark.
5) Không giật gân/sốc, kỳ thị, người lớn, vũ khí, hàng cấm, tin sai.
6) Giới hạn kỹ thuật: tránh ALL CAPS dài, không chuỗi ký tự đặc biệt, không để số ĐT/email trong tiêu đề.
7) Tuân độ dài: Primary ≤125 ký tự ưu tiên phần đầu; Headline 25-40; Description ~30; CTA 2-3 từ.
Chỉ viết nội dung trung tính, nói về lợi ích/sử dụng, không nhắm trúng người dùng cụ thể.`;

  const sharedContext = `Ngữ cảnh: ${
    personalization || "Quảng cáo sản phẩm/dịch vụ"
  }.Từ khóa: ${kw}.Giọng: ${tone}. Ngôn ngữ: ${language}.${policy}`;

  switch (target) {
    case "headline":
      return `Viết 1 tiêu đề quảng cáo (${language}) theo AIDA: chú ý mạnh vào lợi ích chính, tối đa ${Math.min(
        maxLen,
        60
      )} ký tự.${sharedContext}.Yêu cầu:
- 1 dòng duy nhất, không chấm câu cuối câu nếu không cần
- Tránh từ sáo rỗng, nêu lợi ích cụ thể, có yếu tố khẩn trương hợp lý.`;

    case "body":
      return `Viết nội dung chính (${language}) theo AIDA, tối đa ${maxLen} ký tự. ${sharedContext}.
Cấu trúc:
1) Attention: 1 câu mở đầu chạm vấn đề/mong muốn.
2) Interest/Desire: 2-3 ý lợi ích cụ thể, có bằng chứng ngắn (số liệu/mini proof).
3) Action: 1 CTA rõ.
Kết thúc bằng CTA ngắn. Không liệt kê dạng bullet, viết thành đoạn mạch lạc.`;

    case "description":
      return `Viết 1 mô tả ngắn (${language}) bổ trợ tiêu đề, tối đa ${Math.min(
        maxLen,
        90
      )} ký tự. ${sharedContext}.
Yêu cầu:
- Nêu điểm khác biệt/cụ thể hóa lợi ích
- Tránh lặp lại nguyên văn tiêu đề.`;

    default:
      return `Viết nội dung quảng cáo Facebook bằng ${language}, giọng ${tone}.
Ngữ cảnh: ${personalization}. Từ khóa: ${kw}.
Giới hạn ${maxLen} ký tự. ${policy}`;
  }
}

/**
 * POST /api/ai/generate-text
 * Sinh nội dung text cho quảng cáo
 */
export async function generateText(req, res) {
  try {
    const {
      context_id,
      target,
      constraints = {},
      model = "gpt-4o-mini",
    } = req.body;
    if (!context_id || !target) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin (context_id, target)",
      });
    }

    const ctx = contexts.get(context_id);
    if (!ctx)
      return res.status(404).json({
        success: false,
        code: "CONTEXT_NOT_FOUND",
        message: "Context không tồn tại",
      });
    if (ctx.expiresAt < Date.now()) {
      contexts.delete(context_id);
      return res.status(410).json({
        success: false,
        code: "CONTEXT_EXPIRED",
        message: "Context đã hết hạn, vui lòng tạo lại",
      });
    }

    const prompt = buildPromptByTarget(target, ctx, constraints);

    let generatedText = "";
    if (model.startsWith("gemini")) {
      const resp = await geminiTextModel.generateContent(prompt);
      generatedText = resp.response.text().trim();
    } else {
      const response = await openai.chat.completions.create({
        model, // ví dụ: 'gpt-4o-mini' (giữ nguyên mặc định)
        messages: [
          {
            role: "system",
            content:
              "Bạn là chuyên gia viết quảng cáo Facebook. Viết nội dung theo yêu cầu của người dùng.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 300,
      });
      generatedText = response.choices[0].message.content.trim();
    }

    return res.status(200).json({ success: true, chosen: generatedText });
  } catch (error) {
    console.error("Error generating text:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo nội dung",
      error: error.message,
    });
  }
}

/**
 * Helper: Upload base64 to Cloudinary with size optimization
 */
async function uploadToCloudinary(base64Data, mimeType) {
  try {
    // Check base64 data size (rough estimation)
    const sizeInBytes = (base64Data.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    console.log(`📊 Image size: ${sizeInMB.toFixed(5)}MB`);

    // If image is too large (>5MB), compress it
    let quality = "auto:good";
    if (sizeInMB > 5) {
      quality = "auto:low";
      console.log("🔧 Large image detected, using compression");
    }

    const dataUri = `data:${mimeType};base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "ai_ads_images",
      resource_type: "image",
      format: "jpg",
      quality: quality,
      width: 1024,
      height: 1024,
      crop: "limit",
      flags: "progressive",
    });

    console.log(`✅ Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

/**
 * Helper: Process and optimize image data from Gemini
 */
function processGeminiImageData(part) {
  try {
    // Check for inline data (most common)
    const inline = part.inlineData || part.inline_data;
    if (inline?.data && inline?.mimeType) {
      return {
        data: inline.data,
        mimeType: inline.mimeType,
        source: "inline",
      };
    }

    // Check for media data
    const media = part.media;
    if (media?.data && media?.mimeType) {
      return {
        data: media.data,
        mimeType: media.mimeType,
        source: "media",
      };
    }

    // Check for file URI
    const fileUri = part.fileData?.fileUri || part.file_data?.file_uri;
    if (fileUri && fileUri.startsWith("http")) {
      return {
        url: fileUri,
        source: "fileUri",
      };
    }

    // Check for text containing URL
    if (typeof part.text === "string") {
      const urlMatch = part.text.match(/https?:\/\/\S+/g);
      if (urlMatch && urlMatch.length) {
        return {
          url: urlMatch[0],
          source: "text",
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error processing Gemini image data:", error);
    return null;
  }
}

/**
 * Tạo một ảnh đơn lẻ với Gemini và upload lên Cloudinary
 */
async function generateSingleGeminiImage(prompt, imageIndex) {
  return retryWithBackoff(async () => {
    console.log(`🔄 Generating Gemini image ${imageIndex + 1}...`);

    const enhancedPrompt = `${prompt}\n\nGenerate a single high-quality image suitable for Facebook advertising. The image should be clear, professional, and visually appealing. Return the image data directly as base64.`;

    const resp = await geminiImageModel.generateContent([
      {
        text: enhancedPrompt,
      },
    ]);

    const cands = resp?.response?.candidates || [];
    let imageFound = false;
    let result = null;

    for (const c of cands) {
      const parts = c?.content?.parts || [];
      for (const p of parts) {
        try {
          const imageData = processGeminiImageData(p);

          if (!imageData) continue;

          let publicUrl = null;

          // Handle different data sources
          if (imageData.url) {
            // Direct URL (fileUri or text URL)
            publicUrl = imageData.url;
            console.log(`✅ Gemini image ${imageIndex + 1} (direct URL): ${publicUrl}`);
          } else if (imageData.data && imageData.mimeType) {
            // Base64 data - upload to Cloudinary
            console.log(`📤 Uploading Gemini image ${imageIndex + 1} to Cloudinary (${imageData.source})...`);
            publicUrl = await uploadToCloudinary(imageData.data, imageData.mimeType);
          }

          if (publicUrl) {
            result = {
              preview_url: publicUrl,
              source: imageData.source || "unknown",
              model: "gemini",
            };
            console.log(`✅ Gemini image ${imageIndex + 1}: ${publicUrl}`);
            imageFound = true;
            break;
          }
        } catch (partError) {
          console.error(`❌ Error processing Gemini image part ${imageIndex + 1}:`, partError.message);
        }
      }
      if (imageFound) break;
    }

    if (!imageFound) {
      throw new Error(`No valid image generated for image ${imageIndex + 1}`);
    }

    return result;
  });
}

/**
 * POST /api/ai/images/generate
 * Sinh ảnh AI và tự động upload lên cloud để có URL công khai
 */
export async function generateImages(req, res) {
  try {
    const {
      context_id,
      count = 3,
      aspect_ratio = "1:1",
      model = "dall-e-2",
    } = req.body;

    if (!context_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu context_id" });
    }

    const ctx = contexts.get(context_id);
    if (!ctx) {
      return res.status(404).json({
        success: false,
        code: "CONTEXT_NOT_FOUND",
        message: "Context không tồn tại",
      });
    }
    if (ctx.expiresAt < Date.now()) {
      contexts.delete(context_id);
      return res.status(410).json({
        success: false,
        code: "CONTEXT_EXPIRED",
        message: "Context đã hết hạn",
      });
    }

    const { tone, personalization, main_keywords } = ctx;
    const prompt = `Create a high-quality image for Facebook advertising about: ${main_keywords.join(
      ", "
    )}.
Style: ${tone}.
Context: ${personalization || "Professional product/service advertising"}.
The image should be attractive, suitable for Facebook advertising.
No text, logos, or inappropriate content.
Clear, eye-catching colors, brand-appropriate.`;

    console.log(`🎨 Generating ${count} images with ${model}...`);
    let previews = [];

    // --------- GEMINI IMAGE ----------
    if (model.startsWith("gemini")) {
      const n = Math.min(count, 3);
      console.log(`🚀 Starting parallel generation of ${n} Gemini images with concurrency limit ${CONCURRENT_LIMIT}`);

      // Tạo limit function để kiểm soát concurrency
      const limit = pLimit(CONCURRENT_LIMIT);

      // Tạo array các tasks
      const tasks = Array.from({ length: n }, (_, i) => 
        limit(() => generateSingleGeminiImage(prompt, i))
      );

      // Chạy tất cả tasks song song với Promise.allSettled
      const results = await Promise.allSettled(tasks);

      // Xử lý kết quả
      const successfulImages = [];
      const failedImages = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulImages.push(result.value);
          console.log(`✅ Image ${index + 1} generated successfully`);
        } else {
          failedImages.push({ index: index + 1, error: result.reason });
          console.error(`❌ Image ${index + 1} failed:`, result.reason.message);
        }
      });

      previews = successfulImages;

      // Nếu không có ảnh nào thành công, thử fallback
      if (!previews.length) {
        console.log("⚠️ No valid images generated by Gemini, trying fallback...");

        try {
          const fallbackPrompt = `Create a simple, clean image for Facebook advertising about: ${main_keywords.join(
            ", "
          )}. Professional style, no text.`;
          
          const fallbackResult = await retryWithBackoff(async () => {
            const fallbackResp = await geminiImageModel.generateContent([
              {
                text: fallbackPrompt,
              },
            ]);

            const fallbackCands = fallbackResp?.response?.candidates || [];
            for (const c of fallbackCands) {
              const parts = c?.content?.parts || [];
              for (const p of parts) {
                const imageData = processGeminiImageData(p);
                if (
                  imageData &&
                  (imageData.url || (imageData.data && imageData.mimeType))
                ) {
                  let publicUrl = imageData.url;
                  if (!publicUrl && imageData.data) {
                    publicUrl = await uploadToCloudinary(
                      imageData.data,
                      imageData.mimeType
                    );
                  }
                  if (publicUrl) {
                    return {
                      preview_url: publicUrl,
                      source: imageData.source || "fallback",
                      model: "gemini",
                    };
                  }
                }
              }
            }
            throw new Error("Fallback generation failed");
          });

          if (fallbackResult) {
            previews.push(fallbackResult);
          }
        } catch (fallbackError) {
          console.error("Fallback generation failed:", fallbackError);
        }

        if (!previews.length) {
          return res.status(500).json({
            success: false,
            message:
              "Gemini không tạo được hình ảnh hợp lệ. Vui lòng thử lại hoặc sử dụng OpenAI.",
            code: "GEMINI_NO_IMAGE",
          });
        }
      }

      console.log(`📊 Generation summary: ${successfulImages.length} successful, ${failedImages.length} failed`);
    }
    // --------- OPENAI DALL-E ----------
    else {
      console.log("🎨 Generating OpenAI DALL-E images...");

      const imagesResponse = await openai.images.generate({
        model: "dall-e-2",
        prompt,
        size: "1024x1024", // DALL-E-2 chỉ hỗ trợ size vuông
        n: Math.min(count, 4),
      });

      previews = imagesResponse.data.map((image, index) => {
        console.log(`✅ OpenAI image ${index + 1}: ${image.url}`);
        return {
          preview_url: image.url,
          source: "openai",
          model: "dall-e-2",
        };
      });
    }

    console.log(`🎉 Successfully generated ${previews.length} images`);

    return res.status(200).json({
      success: true,
      previews,
      ttl: 900,
      model_used: model,
      total_generated: previews.length,
      note: model.startsWith("gemini")
        ? "Gemini images processed and uploaded to Cloudinary with size optimization"
        : "OpenAI DALL-E images with direct URLs",
    });
  } catch (error) {
    console.error("Error generating images:", error);

    // Xử lý lỗi cụ thể
    if (
      error.code === "content_policy_violation" ||
      error.message?.includes("safety")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Nội dung không phù hợp với chính sách AI. Vui lòng thử từ khóa khác.",
        code: "CONTENT_POLICY_VIOLATION",
      });
    }

    if (
      error.message?.includes("quota") ||
      error.message?.includes("rate limit")
    ) {
      return res.status(429).json({
        success: false,
        message: "Đã đạt giới hạn API. Vui lòng thử lại sau.",
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi khi tạo hình ảnh",
      error: error.message,
    });
  }
}

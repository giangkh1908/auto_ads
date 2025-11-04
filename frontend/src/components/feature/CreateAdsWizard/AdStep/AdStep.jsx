import { useRef, useState, forwardRef, useImperativeHandle, useEffect } from "react";
import {
  Circle,
  Image,
  ChevronDown,
  Facebook,
  FileText,
  Bot,
  MousePointer,
  X,
  Settings,
} from "lucide-react";
import AiPopup from "../AiPopup/AiPopup";
import AiPromptConfig from "../AiPromptConfig/AiPromptConfig";
import AiConfigManager from "../AiConfigManager/AiConfigManager";
import "../AiPopup/AiPopup.css";
import axiosInstance from "../../../../utils/axios";
import "./AdStep.css";
import { useToast } from "../../../../hooks/useToast";
import { validateNonEmpty } from "../../../../utils/validation";
import { CTA_OPTIONS } from "../../../../constants/ctaConstants";
import { aiConfigService } from "../../../../services/aiConfigService";

function AdStepInner({ ad, setAd, adset }, ref) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showAIGeneration, setShowAIGeneration] = useState(false);
  const [aiImages, setAiImages] = useState([]);
  const [selectedAiImages, setSelectedAiImages] = useState([]);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [showAiPromptConfig, setShowAiPromptConfig] = useState(false);
  const [showAiConfigManager, setShowAiConfigManager] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [aiPromptConfig, setAiPromptConfig] = useState(null);
  const [defaultConfigId, setDefaultConfigId] = useState(null);
  const toast = useToast();

  // Get detailed requirements and guidance based on destination_type
  const getDestinationGuidance = () => {
    const destType = adset?.destination_type;
    // const optimizationGoal = adset?.optimization_goal;
    
    switch(destType) {
      case 'ON_VIDEO':
        return {
          title: '🎬 Mục tiêu: Lượt xem video',
          mediaType: 'video',
          mediaLabel: 'Video',
          mediaAccept: 'video/*',
          mediaDescription: '⚠️ BẮT BUỘC upload video',
          requirements: [
            '✅ Video phải hấp dẫn trong 3 giây đầu',
            '✅ Độ dài khuyến nghị: 15-60 giây',
            '✅ Định dạng: MP4, MOV (tối đa 4GB)',
            '✅ Tỷ lệ: 9:16 (Stories), 1:1 (Feed), 16:9 (Landscape)',
          ],
          ctaRecommendations: ['Tìm hiểu thêm', 'Xem khuyến mãi', 'Nghe ngay'],
          destinationNote: 'URL đích sẽ hiển thị khi người dùng nhấp vào video hoặc CTA'
        };
        
      case 'ON_POST':
        return {
          title: '💬 Mục tiêu: Tương tác bài viết',
          mediaType: 'image-or-video',
          mediaLabel: 'Ảnh hoặc Video',
          mediaAccept: 'image/*,video/*',
          mediaDescription: '📸 Ảnh hoặc video để tăng tương tác',
          requirements: [
            '✅ Nội dung văn bản phải khuyến khích tương tác (like, comment, share)',
            '✅ Ảnh: Độ phân giải tối thiểu 1080x1080px',
            '✅ Video: Độ dài 15-30 giây cho tương tác tốt nhất',
            '✅ Sử dụng câu hỏi hoặc call-to-action trong văn bản',
          ],
          ctaRecommendations: ['Tìm hiểu thêm', 'Liên hệ ngay', 'Nhận ưu đãi'],
          destinationNote: 'Tập trung vào engagement, URL đích là phụ (có thể dẫn đến trang fanpage hoặc website)'
        };
        
      case 'ON_PAGE':
        return {
          title: '👍 Mục tiêu: Lượt thích trang',
          mediaType: 'image-or-video',
          mediaLabel: 'Ảnh hoặc Video',
          mediaAccept: 'image/*,video/*',
          mediaDescription: '📸 Ảnh/video giới thiệu trang của bạn',
          requirements: [
            '✅ Nội dung phải thể hiện rõ giá trị của trang Facebook',
            '✅ Highlight những lợi ích khi like trang (cập nhật, ưu đãi...)',
            '✅ Ảnh cover hoặc logo trang nên xuất hiện',
            '✅ Văn bản chính: Mô tả ngắn gọn về trang',
          ],
          ctaRecommendations: ['Tìm hiểu thêm', 'Liên hệ ngay', 'Nhận ưu đãi'],
          destinationNote: '🎯 Quảng cáo sẽ hiển thị nút "Thích trang" trực tiếp, URL đích thường là link trang Facebook'
        };
        
      case 'ON_EVENT':
        return {
          title: '📅 Mục tiêu: Phản hồi sự kiện',
          mediaType: 'image-or-video',
          mediaLabel: 'Ảnh hoặc Video',
          mediaAccept: 'image/*,video/*',
          mediaDescription: '🎉 Ảnh/video về sự kiện',
          requirements: [
            '✅ Hiển thị rõ thông tin sự kiện (ngày, giờ, địa điểm)',
            '✅ Sử dụng ảnh chất lượng cao về venue hoặc sự kiện tương tự',
            '✅ Văn bản chính: Mô tả highlights của sự kiện',
            '✅ Tạo cảm giác FOMO (Fear of Missing Out)',
          ],
          ctaRecommendations: ['Đăng ký ngay', 'Đặt ngay', 'Nhận ưu đãi'],
          destinationNote: '🎯 Quảng cáo sẽ hiển thị nút phản hồi sự kiện (Quan tâm/Tham gia), URL đích thường là link sự kiện Facebook'
        };
        
      case 'MESSAGING_APPS':
        return {
          title: '💬 Mục tiêu: Bắt đầu hội thoại',
          mediaType: 'image-or-video',
          mediaLabel: 'Ảnh hoặc Video',
          mediaAccept: 'image/*,video/*',
          mediaDescription: '💬 Ảnh/video khuyến khích nhắn tin',
          requirements: [
            '✅ Nội dung phải khuyến khích người dùng nhắn tin (Hỏi, Tư vấn, Hỗ trợ...)',
            '✅ Văn bản chính: Đề cập rõ lợi ích khi nhắn tin (tư vấn miễn phí, ưu đãi...)',
            '✅ Ảnh nên thể hiện sự thân thiện, sẵn sàng hỗ trợ',
            '✅ Chuẩn bị auto-reply hoặc chatbot để phản hồi nhanh',
          ],
          ctaRecommendations: ['Liên hệ ngay', 'Nhận ưu đãi', 'Tìm hiểu thêm'],
          destinationNote: '🎯 Quảng cáo sẽ có nút "Nhắn tin" mở Messenger, URL đích không quan trọng (có thể để link fanpage)'
        };
        
      default:
        return {
          title: '📢 Tạo quảng cáo',
          mediaType: 'image-or-video',
          mediaLabel: 'Ảnh hoặc Video',
          mediaAccept: 'image/*,video/*',
          mediaDescription: 'Hỗ trợ ảnh hoặc video',
          requirements: [
            '✅ Nội dung phải rõ ràng, hấp dẫn',
            '✅ Ảnh: Độ phân giải tối thiểu 1080x1080px',
            '✅ Video: Độ dài 15-60 giây',
          ],
          ctaRecommendations: ['Tìm hiểu thêm', 'Liên hệ ngay', 'Nhận ưu đãi'],
          destinationNote: 'URL đích là trang bạn muốn người dùng truy cập'
        };
    }
  };

  const guidance = getDestinationGuidance();

  // AI context tracking
  const [aiProvider, setAiProvider] = useState('openai');
  const [contextId, setContextId] = useState(null);
  const [selectedConfigId, setSelectedConfigId] = useState(null);
  const [isGenerating, setIsGenerating] = useState({
    headline: false,
    primaryText: false,
    description: false,
  });

  useEffect(() => {
    loadDefaultConfig();
  }, []);

  const loadDefaultConfig = async () => {
    try {
      const response = await aiConfigService.getConfigs('own');
      if (response.success && response.configs) {
        const defaultConfig = response.configs.find(c => c.is_default);
        if (defaultConfig) {
          setDefaultConfigId(defaultConfig._id);
        }
      }
    } catch (error) {
      console.error('Error loading default config:', error);
    }
  };

  // Function to handle file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      const res = await axiosInstance.post("/api/upload/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data?.url) {
        // Lấy file đầu tiên trong formData
        const file = formData.get("file") || formData.get("media");
        const fileType = file?.type || "";

        // Xác định loại media
        const mediaType = fileType.startsWith("video/")
          ? "video"
          : fileType.startsWith("image/")
            ? "image"
            : "unknown";

        setAd((prev) => ({
          ...prev,
          media: mediaType,
          mediaUrl: res.data.url,
        }));

        toast.success("Tải file thành công");
      } else {
        toast.error(res.data?.message || "Upload thất bại");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Không thể upload file. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  // Function to generate text content using AI
  const generateAIContent = async (field, maxLength = 100) => {
    if (!contextId) {
      toast.warning("Vui lòng thiết lập AI trước", {
        description: "Hãy nhấn 'Tạo bằng AI' để thiết lập tham số AI",
      });
      return;
    }

    try {
      setIsGenerating(prev => ({ ...prev, [field]: true }));

      const target = field === 'primaryText' ? 'body' : field;
      const model =
        aiProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
      const response = await axiosInstance.post('/api/ai/generate-text', {
        context_id: contextId,
        target,
        constraints: { max_len: maxLength },
        model
      });

      if (response.data && response.data.success) {
        setAd(prev => ({ ...prev, [field]: response.data.chosen }));
        toast.success(`Đã tạo ${field === 'headline' ? 'tiêu đề' :
          field === 'primaryText' ? 'văn bản chính' :
            field === 'description' ? 'mô tả' : 'nội dung'}`);
      } else {
        toast.error("Không thể tạo nội dung", {
          description: response.data?.message || "Vui lòng thử lại"
        });
      }
    } catch (error) {
      console.error(`Error generating ${field}:`, error);
      toast.error(`Không thể tạo ${field}`, {
        description: error.message
      });
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }));
    }
  };

  // Function to generate AI images based on context
  const generateAIImages = async () => {
    if (!contextId) {
      toast.warning("Vui lòng thiết lập AI trước", {
        description: "Hãy nhấn 'Tạo bằng AI' để thiết lập tham số AI",
      });
      return;
    }

    try {
      setIsGeneratingImages(true);
      setShowAIGeneration(true);
      const model =
        aiProvider === 'gemini' ? 'gemini-2.5-flash-image' : 'dall-e-2';
      // Gọi API để tạo hình ảnh dựa trên context_id sẵn có
      const response = await axiosInstance.post('/api/ai/images/generate', {
        context_id: contextId,
        count: 4, // Số lượng ảnh cần tạo
        aspect_ratio: '1:1', // Tỉ lệ khung hình
        model
      }, {
        timeout: 60000 // 60 giây
      }
      );

      if (response.data && response.data.success && response.data.previews) {
        const generatedImages = response.data.previews.map((img, index) => ({
          id: `ai-${Date.now()}-${index}`,
          url: img.preview_url,
          selected: index === 0 // Mặc định chọn ảnh đầu tiên
        }));

        setAiImages(generatedImages);
        setSelectedAiImages([generatedImages[0]]);

        // Tự động sử dụng ảnh đầu tiên cho quảng cáo
        setAd(prev => ({
          ...prev,
          media: 'image',
          mediaUrl: generatedImages[0].url
        }));

        toast.success(`Đã tạo ${generatedImages.length} hình ảnh dựa trên ngữ cảnh`);
      } else {
        // Fallback to placeholder images for testing
        const placeholderImages = Array.from({ length: 4 }, (_, i) => ({
          id: `placeholder-${Date.now()}-${i}`,
          url: `https://picsum.photos/512/512?random=${Date.now() + i}`,
          selected: i === 0
        }));

        setAiImages(placeholderImages);
        setSelectedAiImages([placeholderImages[0]]);

        setAd(prev => ({
          ...prev,
          media: 'image',
          mediaUrl: placeholderImages[0].url
        }));

        toast.info("Đang sử dụng hình ảnh mẫu", {
          description: response.data?.message || "API chưa sẵn sàng"
        });
      }
    } catch (error) {
      console.error("Error generating AI images:", error);

      // Thông báo lỗi cụ thể hơn
      let errorMessage = "Không thể tạo hình ảnh AI";
      if (error.code === "ECONNABORTED") {
        errorMessage = "Quá thời gian chờ khi tạo ảnh. Vui lòng thử lại sau.";
      } else if (error.response) {
        errorMessage = `Lỗi máy chủ: ${error.response.status}`;
      }

      // Fall back to placeholder images
      const placeholderImages = Array.from({ length: 4 }, (_, i) => ({
        id: `fallback-${Date.now()}-${i}`,
        url: `https://picsum.photos/512/512?random=${Date.now() + i}`,
        selected: i === 0
      }));

      setAiImages(placeholderImages);
      setSelectedAiImages([placeholderImages[0]]);

      setAd(prev => ({
        ...prev,
        media: 'image',
        mediaUrl: placeholderImages[0].url
      }));

      toast.error(errorMessage, {
        description: error.code === "ECONNABORTED"
          ? "Việc tạo ảnh AI có thể mất nhiều thời gian. Đang sử dụng ảnh mẫu thay thế."
          : error.message
      });
    } finally {
      setIsGeneratingImages(false);
    }
  };

  // Function to handle AI image selection
  const handleImageSelection = (imageId) => {
    const newImages = aiImages.map((img) => ({
      ...img,
      selected: img.id === imageId
    }));

    setAiImages(newImages);

    const selectedImage = newImages.find(img => img.id === imageId);
    if (selectedImage) {
      setAd(prev => ({
        ...prev,
        media: 'image',
        mediaUrl: selectedImage.url
      }));
      setSelectedAiImages([selectedImage]);
    }
  };

  // Expose validate() to parent
  useImperativeHandle(
    ref,
    () => ({
      validate: () => {
        const okName = !!ad?.name && String(ad.name).trim() !== "";
        const okMedia = !!ad?.mediaUrl;
        const okUrl =
          !!ad?.destinationUrl && String(ad.destinationUrl).trim() !== "";
        
        // Validate media type matches destination_type requirements
        let okMediaType = true;
        if (okMedia && guidance.mediaType === 'video' && ad.media !== 'video') {
          toast.warning("Mục tiêu xem video yêu cầu upload file video");
          okMediaType = false;
        }
        
        if (!okName) validateNonEmpty(ad.name, "tên quảng cáo", toast);
        if (!okMedia) toast.warning("Vui lòng chọn file phương tiện");
        if (!okUrl) validateNonEmpty(ad.destinationUrl, "URL đích", toast);
        return okName && okMedia && okMediaType && okUrl;
      },
    }),
    [ad, toast, guidance]
  );

  return (
    <div className="ad-step">
      <div className="config-scroll-container">
        {/* Guidance Banner */}
        {adset?.destination_type && (
          <div className="guidance-banner">
            <h3 className="guidance-banner-title">
              {guidance.title}
            </h3>
            <div className="guidance-banner-box">
              <h4 className="guidance-banner-box-header">
                📋 Yêu cầu nội dung:
              </h4>
              {guidance.requirements.map((req, idx) => (
                <div key={idx} className="guidance-banner-requirement">
                  {req}
                </div>
              ))}
            </div>
            <div className="guidance-banner-cta-box">
              <strong>💡 Gợi ý CTA:</strong> {guidance.ctaRecommendations.join(', ')}
            </div>
            <div className="guidance-banner-note">
              ℹ️ {guidance.destinationNote}
            </div>
          </div>
        )}

        <div className="btn-generate-ai-container">
          <button
            className="btn-generate-ai"
            onClick={() => {
              setShowAIConfig(!showAIConfig);
            }}
          >
            Tạo bằng AI
          </button>

          <button
            className="btn-ai-settings"
            onClick={() => setShowAiConfigManager(true)}
            title="Quản lý AI Configs"
          >
            <Settings size={18} />
          </button>

          {/* AI Config Modal */}
          <AiPopup
            isOpen={showAIConfig}
            onClose={() => setShowAIConfig(false)}
            defaultConfigId={defaultConfigId}
            onConfirm={(config) => {
              const toArray = (v) =>
                Array.isArray(v)
                  ? v
                  : String(v || '')
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
              
              const mainKeywords = [
                ...toArray(config.mainKeywords),
                ...toArray(config.synonymousKeywords),
                ...toArray(config.main_keywords),
              ];

              if (mainKeywords.length === 0 && !config.config_id) {
                toast.warning("Vui lòng nhập ít nhất một từ khóa chính");
                return;
              }

              if (config.config_id) {
                setSelectedConfigId(config.config_id);
              } else {
                setSelectedConfigId(null);
              }

              const modelToSend = config.config_id 
                ? null 
                : (config.ai_provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');

              axiosInstance.post('/api/ai/context/confirm', {
                ...config,
                main_keywords: mainKeywords.length > 0 ? mainKeywords : undefined,
                model: modelToSend
              })
                .then(response => {
                  if (response.data && response.data.success) {
                    setContextId(response.data.context_id);
                    
                    if (response.data.model) {
                      const provider = response.data.model.includes('gemini') ? 'gemini' : 'openai';
                      setAiProvider(provider);
                    } else if (config.ai_provider) {
                      setAiProvider(config.ai_provider);
                    }
                    
                    toast.success("Đã thiết lập AI thành công");
                  }
                })
                .catch(error => {
                  console.error("Error confirming AI context:", error);
                  toast.error("Không thể thiết lập AI", {
                    description: error.response?.data?.message || error.message
                  });
                });
            }}
          />

          {/* AI Config Manager Modal */}
          <AiConfigManager
            isOpen={showAiConfigManager}
            onClose={() => setShowAiConfigManager(false)}
            onConfigSelect={(config) => {
              setDefaultConfigId(config._id);
              loadDefaultConfig();
              toast.success(`Đã chọn config: ${config.name}`);
            }}
          />

          {/* AI Prompt Config Modal */}
          <AiPromptConfig
            isOpen={showAiPromptConfig}
            onClose={() => setShowAiPromptConfig(false)}
            onSave={(config) => {
              setAiPromptConfig(config);
              toast.success("Đã lưu cấu hình AI Prompt");
            }}
            initialConfig={aiPromptConfig || {}}
          />
        </div>

        {/* Ad Name Section */}
        <div className="config-section">
          <div className="section-header-ads">
            <Circle size={8} fill="#2563eb" color="#2563eb" />
            <h3 className="section-title-ads">Tên quảng cáo</h3>
          </div>
          <input
            type="text"
            className="ad-name-input"
            value={ad.name}
            onChange={(e) =>
              setAd((prev) => ({ ...prev, name: e.target.value }))
            }
            onBlur={() => validateNonEmpty(ad.name, "tên quảng cáo", toast)}
            placeholder="Quảng cáo mới"
          />
        </div>

        {/* Ad Content Section */}
        <div className="config-section">
          <div className="section-header-ads">
            <FileText size={16} color="#2563eb" />
            <h3 className="section-title-ads">Nội dung quảng cáo</h3>
          </div>
          <div className="ad-content-fields">
            {/* Headline */}
            <div className="field-group">
              <div className="field-label-container">
                <label className="field-label">Tiêu đề</label>
                <button
                  onClick={() => generateAIContent('headline', 40)}
                  disabled={isGenerating.headline || !contextId}
                  className="ai-generate-btn"
                >
                  <Bot size={14} />
                  {isGenerating.headline ? 'Đang tạo...' : 'AI'}
                </button>
              </div>
              <input
                type="text"
                className="headline-input"
                value={ad.headline}
                onChange={(e) =>
                  setAd((prev) => ({ ...prev, headline: e.target.value }))
                }
                placeholder="Sản phẩm/Dịch vụ chất lượng cao"
              />
            </div>

            {/* Primary Text */}
            <div className="field-group">
              <div className="field-label-container">
                <label className="field-label">Văn bản chính</label>
                <button
                  onClick={() => generateAIContent('primaryText', 125)}
                  disabled={isGenerating.primaryText || !contextId}
                  className="ai-generate-btn"
                >
                  <Bot size={14} />
                  {isGenerating.primaryText ? 'Đang tạo...' : 'AI'}
                </button>
              </div>
              <textarea
                className="primary-text-input"
                value={ad.primaryText}
                onChange={(e) =>
                  setAd((prev) => ({ ...prev, primaryText: e.target.value }))
                }
                rows={4}
                placeholder="Nội dung chính của quảng cáo..."
              />
            </div>

            {/* Description */}
            <div className="field-group">
              <div className="field-label-container">
                <label className="field-label">Mô tả</label>
                <button
                  onClick={() => generateAIContent('description', 30)}
                  disabled={isGenerating.description || !contextId}
                  className="ai-generate-btn"
                >
                  <Bot size={14} />
                  {isGenerating.description ? 'Đang tạo...' : 'AI'}
                </button>
              </div>
              <textarea
                className="description-input"
                value={ad.description || ""}
                onChange={(e) =>
                  setAd((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
                placeholder="Mô tả ngắn gọn bổ sung..."
              />
            </div>

            {/* Call to Action */}
            <div className="field-group">
              <div className="field-label-container">
                <label className="field-label">Nút kêu gọi hành động</label>
              </div>
              <select
                className="cta-select"
                value={ad.cta}
                onChange={(e) =>
                  setAd((prev) => ({ ...prev, cta: e.target.value }))
                }
              >
                {CTA_OPTIONS.map((cta) => (
                  <option key={cta} value={cta}>
                    {cta}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination URL */}
            <div className="field-group">
              <label className="field-label">* URL đích</label>
              <input
                type="url"
                className="url-input"
                value={ad.destinationUrl || ""}
                onChange={(e) =>
                  setAd((prev) => ({ ...prev, destinationUrl: e.target.value }))
                }
                onBlur={() =>
                  validateNonEmpty(ad.destinationUrl, "URL đích", toast)
                }
                placeholder="https://example.com"
              />
            </div>

            {/* Media File */}
            <div className="field-group">
              <label className="field-label">* File phương tiện ({guidance.mediaLabel})</label>
              <small className="media-description-hint">
                {guidance.mediaDescription}
              </small>
              <div className="media-buttons-container">
                <button
                  className="media-button upload-button"
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                >
                  <Image size={18} className="media-icon" />

                  {uploading
                    ? "Đang tải lên..."
                    : ad.mediaUrl
                      ? "Đã chọn file"
                      : `Thêm ${guidance.mediaLabel.toLowerCase()}`}
                </button>
                {guidance.mediaType !== 'video' && (
                  <button
                    className="media-button ai-button"
                    onClick={() => {
                      if (!contextId) {
                        toast.warning("Vui lòng thiết lập AI trước", {
                          description: "Hãy nhấn 'Tạo bằng AI' để thiết lập tham số AI",
                        });
                        return;
                      }

                      // Gọi hàm tạo ảnh ngay lập tức
                      generateAIImages();
                    }}
                    disabled={uploading || isGeneratingImages}
                  >
                    <Image size={18} className="button-icon" />
                    {isGeneratingImages ? "Đang tạo ảnh..." : "AI tạo ảnh"}
                  </button>
                )}
              </div>

              {/* AI Generation Section */}
              {showAIGeneration && (
                <div className="ai-generation-section">
                  <div className="ai-images-grid">
                    {isGeneratingImages ? (
                      // Loading text with wave effect
                      <div className="loading-wave-container">
                        <div className="loading-wave-text">
                          {'Vui lòng chờ đợi...'.split('').map((char, index) => (
                            <span key={index} style={{ animationDelay: `${index * 0.1}s` }}>
                              {char === ' ' ? '\u00A0' : char}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Rendered images
                      aiImages.map((image) => (
                        <div
                          key={image.id}
                          className={`ai-image-cell ${image.selected ? "selected" : ""}`}
                          onClick={() => handleImageSelection(image.id)}
                        >
                          <img src={image.url} alt="AI generated" className="ai-image" />
                        </div>
                      ))
                    )}
                  </div>

                  <div className="ai-info-section">
                    <div className="ai-info-text">
                      <div className="ai-info-line">
                        Ảnh đã tạo {aiImages.length}/{aiImages.length}
                      </div>
                      <div className="ai-info-line">
                        Ảnh có thể thêm {10 - aiImages.length}
                      </div>
                      <div className="ai-info-line">
                        Ảnh đã chọn {selectedAiImages.length}/{selectedAiImages.length}
                      </div>
                    </div>
                    <button
                      className="auto-select-button"
                      onClick={() => {
                        // Auto select all images
                        const allSelected = aiImages.map((img) => ({
                          ...img,
                          selected: true,
                        }));
                        setAiImages(allSelected);
                        setSelectedAiImages(allSelected);
                      }}
                    >
                      Chọn ảnh tự động
                    </button>
                  </div>
                </div>
              )}

              {/* File input */}
              <input
                className="image-input"
                type="file"
                accept={guidance.mediaAccept}
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              {ad.mediaUrl && ad.media === "image" && (
                <div className="image-frame">
                  <img src={ad.mediaUrl} alt="Preview" />
                </div>
              )}
              {ad.mediaUrl && ad.media === "video" && (
                <div className="image-frame">
                  <video
                    src={ad.mediaUrl}
                    controls
                    className="video-preview"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AdStep = forwardRef(AdStepInner);
export default AdStep;

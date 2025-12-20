import React from 'react';
import { Play, ExternalLink, MessageCircle, ThumbsUp, Share, MoreHorizontal, Globe, Camera, Image } from 'lucide-react';
import './Creative.css';

function Creative({ ad, campaign, adset }) { // eslint-disable-line no-unused-vars
  const getCTAColor = (cta) => {
    const ctaColors = {
      'Tìm hiểu thêm': '#1877f2',
      'Đăng ký ngay': '#ff6b6b',
      'Liên hệ ngay': '#ab47bc',
      'Nhận ưu đãi': '#f59e0b',
      'Đặt ngay': '#10b981',
      'Mua ngay': '#42b883',
      'Tải xuống': '#3b82f6',
      'Xem khuyến mãi': '#ef4444',
      'Xem suất chiếu': '#8b5cf6',
      'Nghe ngay': '#ec4899',
      'Nhận quyền truy cập': '#14b8a6',
      'Xem menu': '#f97316'
    };
    return ctaColors[cta] || '#1877f2';
  };

  const getMediaIcon = (mediaType) => {
    switch (mediaType) {
      case 'video':
        return <Play size={20} className="media-icon" />;
      case 'carousel':
        return <div className="carousel-icon"><Camera size={20} /></div>;
      default:
        return <div className="image-icon"><Image size={20} /></div>;
    }
  };

  // Lấy page info từ adset (ưu tiên facebookPage/facebookPageId từ UI, fallback page_name/page_id từ DB)
  const pageName = adset?.facebookPage || adset?.page_name || null;
  const pageId = adset?.facebookPageId || adset?.page_id || null;
  const pageAvatar = adset?.facebookPageAvatar || null;

  return (
    <div className="creative-preview">
      <div className="creative-container">
        {/* Facebook Post Style Creative */}
        <div className="facebook-post">

          {/* Header */}
          <div className="post-header">
            <div className="page-info">
              <div className="page-avatar">
                {pageAvatar ? (
                  <img
                    src={pageAvatar}
                    alt={pageName || "Facebook Page"}
                    className="avatar-circle-creative"
                  />
                ) : pageId ? (
                  <img
                    src={`https://graph.facebook.com/${pageId}/picture?type=square`}
                    alt={pageName || "Facebook Page"}
                    className="avatar-circle-creative"
                  />
                ) : (
                  <div className="avatar-circle-creative">
                    {(pageName || ad?.page || "").charAt(0) || "F"}
                  </div>
                )}
              </div>
              <div className="page-details">
                <div className="page-name">{pageName || ad?.page || "Facebook Page"}</div>
                <div className="post-meta">
                  <span className="sponsored-badge">Được tài trợ</span>
                  <span className="post-time"><Globe size={14} /></span>
                </div>
              </div>
            </div>
            <button className="more-options">
              <MoreHorizontal size={16} />
            </button>
          </div>

          {/* Post Content */}
          <div className="post-content">
            <div className="post-text">
              {ad.primaryText || "Hãy giới thiệu về nội dung quảng cáo của bạn"}
            </div>
          </div>



          {/* Media Section */}
          <div className="post-media">
            <div className="media-container">
              {ad.mediaUrl ? (
                ad.media === "video" ? (
                  <video src={ad.mediaUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={ad.mediaUrl} alt="Ad Creative" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : (
                getMediaIcon(ad.media)
              )}
            </div>
          </div>


          {/* Ad Link Preview */}
          <div className="link-preview">
            <div className="link-content">
              <div className="link-image">
                <div className="placeholder-image">
                  <ExternalLink size={20} />
                </div>
              </div>
              <div className="link-details">
                <div className="link-title">{ad.headline || "Chat trong Messenger"}</div>
                <div className="link-description">
                  {ad.description || "Khám phá dịch vụ của chúng tôi và trải nghiệm những điều tuyệt vời nhất"}
                </div>
                <div className="link-domain">{ad.destinationUrl}</div>
              </div>
            </div>
            <div
              className="cta-button"
              style={{ backgroundColor: getCTAColor(ad.cta) }}
            >
              {ad.cta || "Tìm hiểu thêm"}
            </div>
          </div>

          {/* Engagement Bar */}
          <div className="engagement-bar">
            <div className="engagement-actions">
              <button className="action-btn like-btn">
                <ThumbsUp size={16} />
                <span>Thích</span>
              </button>
              <button className="action-btn comment-btn">
                <MessageCircle size={16} />
                <span>Bình luận</span>
              </button>
              <button className="action-btn share-btn">
                <Share size={16} />
                <span>Chia sẻ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Creative;

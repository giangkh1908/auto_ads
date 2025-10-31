import React from "react";
import {
  Megaphone,
  ArrowRight,
  MessageCircle,
  Search,
  Users,
  ShoppingBag,
} from "lucide-react";
import { getAdsetDefaultsByObjective } from "../../../../constants/wizardConstants.js";
import Image_1 from "../../../../assets/wizard/1.jpg";
import Image_2 from "../../../../assets/wizard/2.jpg";
import Image_3 from "../../../../assets/wizard/3.jpg";
import Image_4 from "../../../../assets/wizard/4.jpg";
import Image_5 from "../../../../assets/wizard/5.jpg";
import Image_6 from "../../../../assets/wizard/6.jpg";
import target from "../../../../assets/wizard/target.jpg";
import "./TargetStep.css";

function TargetStep({ campaign, setCampaign }) {
  const objectives = [
    {
      key: "AWARENESS",
      icon: <Megaphone size={16} />,
      label: "Mức độ nhận biết",
    },
    {
      key: "TRAFFIC",
      icon: <ArrowRight size={16} />,
      label: "Lưu lượng truy cập",
    },
    {
      key: "ENGAGEMENT",
      icon: <MessageCircle size={16} />,
      label: "Tương tác",
    },
    {
      key: "LEADS",
      icon: <Search size={16} />,
      label: "Khách hàng tiềm năng",
    },
    {
      key: "APP_PROMOTION",
      icon: <Users size={16} />,
      label: "Quảng bá ứng dụng",
    },
    {
      key: "SALES",
      icon: <ShoppingBag size={16} />,
      label: "Doanh số",
    },
  ];

  const handleObjectiveChange = (e) => {
    const newObjective = e.target.value;
    const adsetDefaults = getAdsetDefaultsByObjective(newObjective);

    setCampaign((prev) => {
      // Cập nhật tất cả adset hiện có với các giá trị mặc định mới
      const updatedAdsets = prev.adsets.map((adset) => ({
        ...adset,
        ...adsetDefaults,
      }));

      return {
        ...prev,
        objective: newObjective,
        adsets: updatedAdsets,
      };
    });
  };

  const objectiveDetails = {
    AWARENESS: {
      title: "Mức độ nhận biết",
      description: "Hiển thị quảng cáo cho những người có nhiều khả năng nhớ đến quảng cáo nhất.",
      image: Image_1,
      suitableFor: [
        "Số người tiếp cận",
        "Mức độ nhận biết thương hiệu",
        "Lượt xem video",
      ],
    },
    TRAFFIC: {
      title: "Lưu lượng truy cập",
      description: "Chuyển mọi người tới một đích đến nào đó, chẳng hạn như trang web, ứng dụng, trang cá nhân hoặc sự kiện trên Facebook.",
      image: Image_2,
      suitableFor: [
        "Lượt click vào liên kết",
        "Lượt xem trang đích",
        "Lượt truy cập vào trang cá nhân",
        "Cuộc gọi",
      ],
    },
    ENGAGEMENT: {
      title: "Tương tác",
      description: "Tăng số tin nhắn, lượt mua qua tin nhắn, lượt xem video, lượt tương tác với bài viết, lượt thích Trang hoặc phản hồi sự kiện.",
      image: Image_3,
      suitableFor: [
        "Fanpage",
        "Lượt xem video",
        "Lượt tương tác với bài viết",
        "Lượt chuyển đổi",
        "Cuộc gọi",
      ],
    },
    LEADS: {
      title: "Khách hàng tiềm năng",
      description: "Tìm kiếm khách hàng tiềm năng cho doanh nghiệp hoặc thương hiệu của bạn.",
      image: Image_4,
      suitableFor: [
        "Trang web và mẫu phản hồi tức thì",
        "Mẫu phản hồi thức thì",
        "Fanpage",
        "Lượt chuyển đổi",
        "Cuộc gọi",
      ],
    },
    APP_PROMOTION: {
      title: "Quảng bá ứng dụng",
      description: "Thu hút những người mới cài đặt và tiếp tục sử dụng ứng dụng của bạn.",
      image: Image_5,
      suitableFor: [
        "Lượt cài đặt ứng dụng",
        "Sự kiện trong ứng dụng",
      ],
    },
    SALES: {
      title: "Doanh số",
      description: "Tìm những người có khả năng sẽ mua sản phẩm hoặc dịch vụ của bạn.",
      image: Image_6,
      suitableFor: [
        "Lịch sử chuyển dổi",
        "Doanh số theo danh mục",
        "Cuộc gọi",
        "Fanpage",
      ],
    },
  };

  const currentObjective = campaign.objective && objectiveDetails[campaign.objective] 
    ? objectiveDetails[campaign.objective]
    : {
        title: "Chọn mục tiêu chiến dịch",
        description: "Mục tiêu chiến dịch là mục tiêu kinh doanh mà bạn mong muốn đạt được khi chạy quảng cáo. Hãy chọn một mục tiêu từ danh sách bên trái để tiếp tục.",
        image: target,
        suitableFor: ['Chọn mục tiêu để xem chi tiết'],
      };

  return (
    <div className="panel objectives-panel">
      <div className="objectives-layout">
        {/* Left Panel - Objectives List */}
        <div className="objectives-sidebar">
          <div className="objectives-title">
            Chọn mục tiêu chiến dịch
          </div>
          <div className="objectives-list">
            {objectives.map((item) => (
              <label
                key={item.key}
                className={`objective-item ${
                  campaign.objective === item.key ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="objective"
                  value={item.key}
                  checked={campaign.objective === item.key}
                  onChange={handleObjectiveChange}
                />
                <div className="objective-icon">{item.icon}</div>
                <div className="objective-label">
                  <span className="objective-name">{item.label}</span>
                  {item.key === "ENGAGEMENT" && (
                    <span className="recommended-tag">Đề xuất</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Right Panel - Objective Details */}
        <div className="objective-details">
          <div className="objective-image-placeholder">
            <div className="placeholder-circle">
              <img
                className="image-ads"
                src={currentObjective.image}
                alt="Objective"
              />
            </div>
          </div>
          <div className="objective-detail-title">
            {currentObjective.title}
          </div>
          <div className="objective-description">
            {currentObjective.description}
          </div>
          <div className="suitable-for-section">
            <div className="suitable-for-title">Phù hợp với</div>
            <div className="suitable-tags">
              {currentObjective.suitableFor.map((tag, index) => (
                <span key={index} className="suitable-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TargetStep;

import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(['wizard', 'ads']);
  const objectives = [
    {
      key: "AWARENESS",
      icon: <Megaphone size={16} />,
      label: t('ads:objectives.AWARENESS'),
    },
    {
      key: "TRAFFIC",
      icon: <ArrowRight size={16} />,
      label: t('ads:objectives.TRAFFIC'),
    },
    {
      key: "ENGAGEMENT",
      icon: <MessageCircle size={16} />,
      label: t('ads:objectives.ENGAGEMENT'),
    },
    {
      key: "LEADS",
      icon: <Search size={16} />,
      label: t('ads:objectives.LEADS'),
    },
    {
      key: "APP_PROMOTION",
      icon: <Users size={16} />,
      label: t('ads:objectives.APP_PROMOTION'),
    },
    {
      key: "SALES",
      icon: <ShoppingBag size={16} />,
      label: t('ads:objectives.SALES'),
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
      title: t('wizard:objective_details.awareness.title'),
      description: t('wizard:objective_details.awareness.description'),
      image: Image_1,
      suitableFor: [
        t('wizard:objective_details.awareness.suitable_0'),
        t('wizard:objective_details.awareness.suitable_1'),
        t('wizard:objective_details.awareness.suitable_2'),
      ],
    },
    TRAFFIC: {
      title: t('wizard:objective_details.traffic.title'),
      description: t('wizard:objective_details.traffic.description'),
      image: Image_2,
      suitableFor: [
        t('wizard:objective_details.traffic.suitable_0'),
        t('wizard:objective_details.traffic.suitable_1'),
        t('wizard:objective_details.traffic.suitable_2'),
        t('wizard:objective_details.traffic.suitable_3'),
      ],
    },
    ENGAGEMENT: {
      title: t('wizard:objective_details.engagement.title'),
      description: t('wizard:objective_details.engagement.description'),
      image: Image_3,
      suitableFor: [
        t('wizard:objective_details.engagement.suitable_0'),
        t('wizard:objective_details.engagement.suitable_1'),
        t('wizard:objective_details.engagement.suitable_2'),
        t('wizard:objective_details.engagement.suitable_3'),
        t('wizard:objective_details.engagement.suitable_4'),
      ],
    },
    LEADS: {
      title: t('wizard:objective_details.leads.title'),
      description: t('wizard:objective_details.leads.description'),
      image: Image_4,
      suitableFor: [
        t('wizard:objective_details.leads.suitable_0'),
        t('wizard:objective_details.leads.suitable_1'),
        t('wizard:objective_details.leads.suitable_2'),
        t('wizard:objective_details.leads.suitable_3'),
        t('wizard:objective_details.leads.suitable_4'),
      ],
    },
    APP_PROMOTION: {
      title: t('wizard:objective_details.app_promotion.title'),
      description: t('wizard:objective_details.app_promotion.description'),
      image: Image_5,
      suitableFor: [
        t('wizard:objective_details.app_promotion.suitable_0'),
        t('wizard:objective_details.app_promotion.suitable_1'),
      ],
    },
    SALES: {
      title: t('wizard:objective_details.sales.title'),
      description: t('wizard:objective_details.sales.description'),
      image: Image_6,
      suitableFor: [
        t('wizard:objective_details.sales.suitable_0'),
        t('wizard:objective_details.sales.suitable_1'),
        t('wizard:objective_details.sales.suitable_2'),
        t('wizard:objective_details.sales.suitable_3'),
      ],
    },
  };

  const currentObjective = campaign.objective && objectiveDetails[campaign.objective]
    ? objectiveDetails[campaign.objective]
    : {
      title: t('wizard:target_step.title'),
      description: t('wizard:target_step.description'),
      image: target,
      suitableFor: [t('wizard:target_step.title')],
    };

  return (
    <div className="panel objectives-panel">
      <div className="objectives-layout">
        {/* Left Panel - Objectives List */}
        <div className="objectives-sidebar">
          <div className="objectives-title">
            {t('wizard:target_step.header')}
          </div>
          <div className="objectives-list">
            {objectives.map((item) => (
              <label
                key={item.key}
                className={`objective-item ${campaign.objective === item.key ? "selected" : ""
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
            <div className="suitable-for-title">{t('wizard:target_step.suitable_for_title')}</div>
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

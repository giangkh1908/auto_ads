import { forwardRef, useImperativeHandle } from "react";
import { Circle, DollarSign, Settings } from "lucide-react";
import "./CampaignStep.css";
import { useToast } from "../../../../hooks/useToast";
import { validateNonEmpty } from "../../../../utils/validation";

function CampaignStepInner({ campaign, setCampaign }, ref) {
  const toast = useToast();

  // Expose validate() to parent (CreateAdsWizard)
  useImperativeHandle(ref, () => ({
    validate: () => {
      const okName = !!campaign?.name && String(campaign.name).trim() !== "";
      if (!okName) validateNonEmpty(campaign.name, 'tên chiến dịch', toast);
      return okName;
    }
  }), [campaign, toast]);

  return (
    <div className="campaign-step">
      <div className="step-content">
        {/* Campaign Name Section */}
        <div className="config-section-ads">
          <div className="section-header-campaign">
            <Circle size={8} fill="#2563eb" color="#2563eb" />
            <h3 className="section-title-ads">Tên chiến dịch</h3>
          </div>
          <input
            type="text"
            className="campaign-name-input"
            value={campaign.name}
            onChange={(e) => setCampaign((prev) => ({ ...prev, name: e.target.value }))}
            onBlur={() => validateNonEmpty(campaign.name, 'tên chiến dịch', toast)}
            placeholder="Nhập tên chiến dịch"
          />
        </div>

        {/* Campaign Details Section */}
        <div className="config-section-ads">
          <div className="section-header-campaign">
            <Settings size={16} color="#2563eb" />
            <h3 className="section-title-ads">Chi tiết chiến dịch</h3>
          </div>
          <div className="section-content">
            <label className="field-label">Cách mua</label>
            <select className="conversion-select">
              <option value="Đấu giá">Đấu giá</option>
              <option value="Đặt trước">Đặt trước</option>
            </select>
          </div>
        </div>

        {/* Budget Section */}
        <div className="config-section-ads">
          <div className="section-header-campaign">
            <DollarSign size={16} color="#2563eb" />
            <h3 className="section-title-ads">Ngân sách</h3>
          </div>
          <div className="budget-options">
            <label
              className={`budget-option ${campaign.budgetType === "CAMPAIGN" ? "selected" : ""
                }`}
            >
              <input
                type="radio"
                name="budgetType"
                value="CAMPAIGN"
                checked={campaign.budgetType === "CAMPAIGN"}
                onChange={(e) =>
                  setCampaign((prev) => ({
                    ...prev,
                    budgetType: e.target.value,
                  }))
                }
              />
              <div className="option-content">
                <div className="option-title">Ngân sách chiến dịch</div>
                <div className="option-description">
                  Tự động phân bổ ngân sách cho những cơ hội tốt nhất trên toàn
                  chiến dịch. Bây còn gọi là ngân sách chiến dịch Avantage+.
                  Giới thiệu về ngân sách chiến dịch
                </div>
              </div>
            </label>

            <label className={`budget-option ${campaign.budgetType === "ADSET" ? "selected" : ""}`}>
              <input
                type="radio"
                name="budgetType"
                value="ADSET"
                checked={campaign.budgetType === "ADSET"}
                onChange={(e) =>
                  setCampaign((prev) => ({
                    ...prev,
                    budgetType: e.target.value,
                  }))
                }
              />
              <div className="option-content">
                <div className="option-title">Ngân sách nhóm quảng cáo</div>
                <div className="option-description">
                  Đặt chiến lược giá thầu hoặc lên lịch điều chỉnh chính sách
                  riêng cho từng nhóm quảng cáo.
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

const CampaignStep = forwardRef(CampaignStepInner);
export default CampaignStep;

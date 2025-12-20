import { forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { Circle, DollarSign, Settings } from "lucide-react";
import "./CampaignStep.css";
import { useToast } from "../../../../hooks/common/useToast";
import { validateNonEmpty } from "../../../../utils/validation/validation";

function CampaignStepInner({ campaign, setCampaign }, ref) {
  const toast = useToast();
  const { t } = useTranslation('wizard');

  // Expose validate() to parent (CreateAdsWizard)
  useImperativeHandle(ref, () => ({
    validate: () => {
      const okName = !!campaign?.name && String(campaign.name).trim() !== "";
      if (!okName) validateNonEmpty(campaign.name, t('validation.enter_campaign_name'), toast);
      return okName;
    }
  }), [campaign, toast, t]);

  return (
    <div className="campaign-step">
      <div className="step-content">
        {/* Campaign Name Section */}
        <div className="config-section-ads">
          <div className="section-header-campaign">
            <Circle size={8} fill="#2563eb" color="#2563eb" />
            <h3 className="section-title-ads">{t('campaign_step.name_title')}</h3>
          </div>
          <input
            type="text"
            className="campaign-name-input"
            value={campaign.name}
            onChange={(e) => setCampaign((prev) => ({ ...prev, name: e.target.value }))}
            onBlur={() => validateNonEmpty(campaign.name, t('validation.enter_campaign_name'), toast)}
            placeholder={t('campaign_step.name_placeholder')}
          />
        </div>

        {/* Campaign Details Section */}
        <div className="config-section-ads">
          <div className="section-header-campaign">
            <Settings size={16} color="#2563eb" />
            <h3 className="section-title-ads">{t('campaign_step.details_title')}</h3>
          </div>
          <div className="section-content">
            <label className="field-label">{t('campaign_step.buy_method')}</label>
            <select className="conversion-select">
              <option value="Đấu giá">{t('campaign_step.buy_method_value')}</option>
              {/* <option value="Đặt trước">Đặt trước</option> */}
            </select>
          </div>
        </div>

        {/* Budget Section */}
        <div className="config-section-ads">
          <div className="section-header-campaign">
            <DollarSign size={16} color="#2563eb" />
            <h3 className="section-title-ads">{t('campaign_step.budget_title')}</h3>
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
                <div className="option-title">{t('campaign_step.budget_title')}</div>
                <div className="option-description">
                  {t('campaign_step.budget_description')}
                  {t('campaign_step.budget_learn_more')}
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
                <div className="option-title">{t('campaign_step.adset_budget_title')}</div>
                <div className="option-description">
                  {t('campaign_step.adset_budget_description')}
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

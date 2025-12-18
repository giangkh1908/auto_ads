import { useTranslation } from "react-i18next";

/**
 * Breadcrumb navigation component
 * Shows navigation path: All Campaigns > Campaign Name > Adset Name
 */
export default function AdsBreadcrumb({
  selectedCampaign,
  selectedAdset,
  onReset,
  onCampaignClick,
  onAdsetClick,
}) {
  const { t } = useTranslation(['ads']);

  if (!selectedCampaign && !selectedAdset) {
    return null;
  }

  return (
    <div className="breadcrumb-nav">
      <button
        className="breadcrumb-item"
        onClick={onReset}
      >
        {t('management.all_campaigns')}
      </button>
      {selectedCampaign && (
        <>
          <span className="breadcrumb-separator">›</span>
          <button
            className="breadcrumb-item"
            onClick={onCampaignClick}
          >
            {selectedCampaign.name}
          </button>
        </>
      )}
      {selectedAdset && (
        <>
          <span className="breadcrumb-separator">›</span>
          <button
            className="breadcrumb-item active"
            onClick={onAdsetClick}
          >
            {selectedAdset.name}
          </button>
        </>
      )}
    </div>
  );
}


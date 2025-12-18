import { RefreshCw, Archive, Trash } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Tabs component for Ads Management
 * Shows campaigns, adsets, and ads tabs with action buttons
 */
export default function AdsTabs({
  activeTab,
  onTabChange,
  hasSelectedItems,
  onArchive,
  onDelete,
  onRefresh,
  refreshing,
  selectedAccountId,
}) {
  const { t } = useTranslation(['ads']);

  return (
    <div className="ads-tabs">
      <button
        className={`tab ${activeTab === "campaigns" ? "active" : ""}`}
        onClick={() => onTabChange("campaigns")}
      >
        <span className="tab-icon">▦</span> {t('management.campaigns_tab')}
      </button>
      <button
        className={`tab ${activeTab === "adsets" ? "active" : ""}`}
        onClick={() => onTabChange("adsets")}
      >
        <span className="tab-icon">▣</span> {t('management.adsets_tab')}
      </button>
      <button
        className={`tab ${activeTab === "ads" ? "active" : ""}`}
        onClick={() => onTabChange("ads")}
      >
        <span className="tab-icon">▥</span> {t('management.ads_tab')}
      </button>

      {hasSelectedItems && (
        <div className="icon-beside-tab">
          <button
            className="ads-action-btn ads-archive-btn"
            onClick={onArchive}
            title="Lưu trữ"
          >
            <Archive size={15} />
          </button>
          <button
            className="ads-action-btn ads-delete-btn"
            onClick={onDelete}
            title="Xóa"
          >
            <Trash size={15} />
          </button>
        </div>
      )}
      <button
        className="btn-refresh-ads"
        onClick={onRefresh}
        disabled={refreshing || !selectedAccountId}
        title={t('management.refresh')}
      >
        <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
        {refreshing ? t('management.refreshing') : t('management.refresh')}
      </button>
    </div>
  );
}


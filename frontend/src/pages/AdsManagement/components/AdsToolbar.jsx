import { Search, Settings, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants/app.constants";
import DateRangePicker from "../../../components/common/DateRangePicker/DateRangePicker";
import { useTranslation } from "react-i18next";

/**
 * Toolbar component for Ads Management
 * Contains account selector, create buttons, search, and date picker
 */
export default function AdsToolbar({
  adAccounts,
  selectedAccountId,
  loadingAccounts,
  onAccountChange,
  onCreateCampaign,
  onCreateRule,
  searchTerm,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}) {
  const { t } = useTranslation(['ads']);
  const navigate = useNavigate();

  return (
    <div className="ads-toolbar">
      <div className="account-select">
        <select
          value={selectedAccountId}
          onChange={(e) => onAccountChange(e.target.value)}
          disabled={loadingAccounts}
        >
          <option value="">{t('management.select_account')}</option>
          {loadingAccounts ? (
            <option disabled>{t('management.loading_accounts')}</option>
          ) : adAccounts.length === 0 ? (
            <option disabled>{t('management.no_accounts')}</option>
          ) : (
            adAccounts.map((account) => (
              <option key={account._id} value={account.external_id}>
                {account.name || t('management.account')} ({account.external_id})
              </option>
            ))
          )}
        </select>

        <button
          className={`btn-create-ads ${!selectedAccountId ? 'disabled' : ''}`}
          onClick={onCreateCampaign}
          disabled={!selectedAccountId}
        >
          <Plus size={13} /> {t('management.create_campaign')}
        </button>
        <button
          className={`btn-create-rule ${!selectedAccountId ? 'disabled' : ''}`}
          onClick={() => {
            if (!selectedAccountId) return;
            navigate(ROUTES.AUTOMATION_RULE);
          }}
          disabled={!selectedAccountId}
        >
          <Settings size={13} /> {t('management.create_rule')}
        </button>
      </div>

      <div>
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input-ads"
            placeholder={t('management.search')}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          placeholder="Lọc theo thời gian"
        />
      </div>
    </div>
  );
}


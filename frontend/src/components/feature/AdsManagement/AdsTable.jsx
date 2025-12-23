import { Edit, Archive, Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { translateStatus, getStatusClass } from "../../../utils/formatters/statusUtils";
import { translateObjective, translateOptimizationGoal, formatTargetingVN } from "../../../utils/formatters/translationUtils";
import Pagination from "../../common/Pagination/Pagination";

/**
 * Table component for Ads Management
 * Renders campaigns, adsets, or ads based on activeTab
 */
export default function AdsTable({
  activeTab,
  rows,
  checkAll,
  onCheckAll,
  onCheckItem,
  onToggleRow,
  togglingItems,
  onUpdate,
  onArchive,
  onDelete,
  onCampaignClick,
  onAdsetClick,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  refreshing,
}) {
  const { t } = useTranslation(['ads']);

  const getColSpan = () => {
    if (activeTab === "adsets") return 17;
    if (activeTab === "campaigns") return 15;  // Không có budget
    return 14;  // Ads: Không có budget
  };

  return (
    <>
      <div className="ads-table-wrapper">
        <table className="ads-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={checkAll}
                  onChange={onCheckAll}
                />
              </th>
              <th>{t('management.toggle_on_off')}</th>
              <th>{t('management.name')}</th>
              <th>{t('management.status')}</th>
              {activeTab === "adsets" && <th>{t('management.budget')}</th>}
              {activeTab === "adsets" && <th>{t('management.runtime')}</th>}
              {activeTab === "adsets" && <th>{t('management.targeting')}</th>}
              {activeTab === "campaigns" && <th>{t('management.objective')}</th>}
              <th>{t('management.impressions')}</th>
              <th>{t('management.reach')}</th>
              <th>{t('management.results')}</th>
              <th>Spend</th>
              <th>Clicks</th>
              <th>CPC</th>
              <th>CTR (%)</th>
              <th>{t('management.creator')}</th>
              <th>{t('management.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={getColSpan()} style={{ textAlign: 'center', padding: '16px', color: '#6b7280' }}>
                  {t('management.no_data')}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={row.isChecked}
                    onChange={() => onCheckItem(row.id)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={`switch ${row.enabled ? "on" : "off"} ${togglingItems.has(row.id) ? "loading" : ""
                      }`}
                    aria-pressed={row.enabled}
                    onClick={() => onToggleRow(row.id)}
                    disabled={togglingItems.has(row.id)}
                  />
                </td>
                <td>
                  <span
                    className={`name-text ${activeTab === "ads"
                      ? "ad-name"
                      : "clickable"
                      }`}
                    onClick={() => {
                      if (activeTab === "campaigns")
                        onCampaignClick(row);
                      else if (activeTab === "adsets")
                        onAdsetClick(row);
                    }}
                  >
                    {row.name}
                  </span>
                </td>
                <td className={getStatusClass(row.status)}>
                  {translateStatus(row.status)}
                </td>
                {activeTab === "adsets" && (
                  <td className="text-center">{row.budget || "0"}</td>
                )}
                {activeTab === "adsets" && (
                  <td className="text-center">
                    {row.start_time && row.end_time ? (
                      <div style={{ fontSize: '12px' }}>
                        <div>{new Date(row.start_time).toLocaleDateString('vi-VN')}</div>
                        <div>{t('management.to')}</div>
                        <div>{new Date(row.end_time).toLocaleDateString('vi-VN')}</div>
                      </div>
                    ) : row.start_time ? (
                      <div style={{ fontSize: '12px' }}>
                        <div>{t('management.from')}: {new Date(row.start_time).toLocaleDateString('vi-VN')}</div>
                        <div>{t('management.no_limit')}</div>
                      </div>
                    ) : (
                      t('labels.not_set')
                    )}
                  </td>
                )}
                {activeTab === "adsets" && (
                  <td className="text-center">
                    <div style={{ fontSize: '12px', textAlign: 'left' }}>
                      {row.targeting && Object.keys(row.targeting).length > 0 ? (
                        formatTargetingVN(row.targeting).map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))
                      ) : (
                        t('labels.not_set')
                      )}
                      {row.optimization_goal && (
                        <div>{t('management.goal_label')}: {translateOptimizationGoal(row.optimization_goal)}</div>
                      )}
                    </div>
                  </td>
                )}
                {activeTab === "campaigns" && (
                  <td className="text-center">
                    <div style={{ fontSize: '12px' }}>
                      {row.objective ? translateObjective(row.objective) : t('labels.not_set')}
                    </div>
                  </td>
                )}
                <td className="text-center">{row.impressions || "0"}</td>
                <td className="text-center">{row.reach || "0"}</td>
                <td className="text-center">{row.results || "0"}</td>
                <td className="text-center">{row.spend ? new Intl.NumberFormat('vi-VN').format(row.spend) : "0"}</td>
                <td className="text-center">{row.clicks || "0"}</td>
                <td className="text-center">{row.cpc ? new Intl.NumberFormat('vi-VN').format(row.cpc) : "0"}</td>
                <td className="text-center">{row.ctr ? Number(row.ctr).toFixed(2) : "0.00"}</td>
                <td className="text-center">
                  {row.created_by?.full_name || row.created_by?.email || t('labels.not_set')}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="ads-action-btn ads-update-btn"
                      onClick={() => onUpdate(row.id)}
                      title={t('management.update')}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      className="ads-action-btn ads-archive-btn"
                      onClick={() => onArchive(row.id)}
                      title={t('management.archive')}
                    >
                      <Archive size={14} />
                    </button>
                    <button
                      className="ads-action-btn ads-delete-btn"
                      onClick={() => onDelete(row.id)}
                      title={t('management.delete')}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {rows.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          itemsPerPage={pagination.limit}
          totalItems={pagination.total}
          startIndex={(pagination.page - 1) * pagination.limit}
          endIndex={Math.min(pagination.page * pagination.limit, pagination.total)}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
          disabled={refreshing}
        />
      )}
    </>
  );
}


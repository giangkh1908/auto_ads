import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axiosInstance from "../../utils/axios";
import { toast } from "sonner";
import { ROUTES, STORAGE_KEYS } from "../../constants/app.constants";
import "./AccountManagement.css";
import { CheckCircle, XCircle, Archive, Trash2, Play, Pause } from "lucide-react";
import ConfirmationPopup from "../../components/common/ConfirmationPopup/ConfirmationPopup";
import { onShopChange } from "../../utils/shopCache";

function AccountManagement() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // UI states
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  // query states
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState([]); // raw items từ API
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  // state thống kê
  const [accountStats, setAccountStats] = useState({});
  
  // state cho confirmation popup
  const [confirmationPopup, setConfirmationPopup] = useState({
    isOpen: false,
    type: 'delete', // 'delete' | 'archive' | 'activate' | 'deactivate'
    title: '',
    message: '',
    onConfirm: null,
    isLoading: false
  });

  /** Gọi API list ads accounts */
  const fetchAccounts = useCallback(
    async ({ q = "", page = 1, limit = 10 } = {}) => {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit };
        if (q) params.q = q;

        const res = await axiosInstance.get("/api/ads-accounts", { params });
        // API trả: { items, total, page, limit, pages }
        console.log("📦 Dữ liệu API trả về:", res.data);
        setItems(res.data?.items || []);
        setTotal(res.data?.total || 0);
      } catch (err) {
        console.error(err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Không thể tải dữ liệu tài khoản quảng cáo."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /** Lần đầu & khi đổi trang */
  useEffect(() => {
    fetchAccounts({ q: "", page, limit });
  }, [fetchAccounts, page, limit]);

  /** Lắng nghe sự kiện thay đổi shop và reload accounts */
  useEffect(() => {
    const unsubscribe = onShopChange(() => {
      // Khi shop thay đổi, reload danh sách accounts
      setPage(1);
      fetchAccounts({ q: searchText.trim(), page: 1, limit });
    });
    
    return unsubscribe;
  }, [fetchAccounts, limit, searchText]);

  /** Chỉ làm mới số liệu campaign/adset/ad từ Facebook (không đồng bộ DB, không reload list) */
  const handleSync = async () => {
    try {
      setSyncing(true);
      const accountIds = items.map((acc) => acc.external_id).filter(Boolean);
      if (accountIds.length === 0) return;
      await fetchAccountStats(accountIds);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  /** Lấy thống kê cho các tài khoản */
  const fetchAccountStats = useCallback(async (accountIds) => {
    if (!accountIds?.length) return;

    const stats = {};
    const timestamp = new Date().getTime();

    try {
      await Promise.all(
        accountIds.map(async (accountId) => {
          try {
            const response = await axiosInstance.get(
              `/api/ads-accounts/stats/live?account_id=${accountId}&_t=${timestamp}`,
              { headers: { "Cache-Control": "no-cache" } }
            );

            if (response.data && response.data.stats) {
              stats[accountId] = response.data.stats;
            } else {
              stats[accountId] = { campaigns: 0, adsets: 0, ads: 0 };
            }
          } catch (error) {
            console.error(`Lỗi lấy thống kê cho ${accountId}:`, error);
            stats[accountId] = { campaigns: 0, adsets: 0, ads: 0 };
          }
        })
      );
      setAccountStats(stats);
    } catch (error) {
      console.error("Lỗi lấy thống kê tài khoản:", error);
    }
  }, []);

  /** Gọi lại thống kê khi danh sách tài khoản thay đổi */
  useEffect(() => {
    if (items?.length > 0) {
      const accountIds = items.map((acc) => acc.external_id).filter(Boolean);
      if (accountIds.length > 0) fetchAccountStats(accountIds);
    }
  }, [items, fetchAccountStats]);

  /** Chuẩn hóa dữ liệu hiển thị (chỉ hiển thị accounts của current shop) */
  const accounts = useMemo(() => {
    return (items || []).map((acc, idx) => {
      const accountId = acc.external_id;
      const stats = accountStats[accountId] || {
        campaigns: 0,
        adsets: 0,
        ads: 0,
      };

      // Lấy status từ DB và hiển thị trực tiếp
      const internalStatus = acc.status || 'ACTIVE';
      const displayStatus = internalStatus === 'ACTIVE' 
        ? t('account_management.status_active')
        : t('account_management.status_inactive');

      return {
        id: acc._id || idx,
        name: acc.name || "Facebook Ad Account",
        number: accountId || "-",
        campaignCount: stats.campaigns,
        adsetCount: stats.adsets,
        adCount: stats.ads,
        status: displayStatus,
        internalStatus: internalStatus,
        updatedAt: new Date(
          acc.last_updated_at || acc.updated_at || acc.created_at || Date.now()
        ).toLocaleString(i18n.language === 'en' ? 'en-US' : 'vi-VN'),
      };
    });
  }, [items, accountStats, t, i18n.language]);

  /** Tìm kiếm */
  const onSearch = () => {
    setPage(1);
    fetchAccounts({ q: searchText.trim(), page: 1, limit });
  };

  /** Xử lý các hành động với account */
  const handleAccountAction = async (accountId, action, accountName) => {
    try {
      setConfirmationPopup(prev => ({ ...prev, isLoading: true }));
      
      switch (action) {
        case 'activate':
          await axiosInstance.patch(`/api/ads-accounts/${accountId}`, { status: 'ACTIVE' });
          toast.success(t('account_management.activate_success'), {
            description: t('account_management.activate_description', { name: accountName })
          });
          break;
        case 'deactivate':
          await axiosInstance.patch(`/api/ads-accounts/${accountId}`, { status: 'INACTIVE' });
          toast.success(t('account_management.deactivate_success'), {
            description: t('account_management.deactivate_description', { name: accountName })
          });
          break;
        case 'archive':
          await axiosInstance.patch(`/api/ads-accounts/${accountId}`, { status: 'INACTIVE' });
          toast.success(t('account_management.archive_success'), {
            description: t('account_management.archive_description', { name: accountName })
          });
          break;
        case 'disconnect': {
          // Tìm account trong danh sách hiện tại để lấy external_id trước khi xóa
          const accountToDelete = items.find(acc => acc._id === accountId || acc.id === accountId);
          const externalId = accountToDelete?.external_id;
          
          const deleteResponse = await axiosInstance.delete(`/api/ads-accounts/${accountId}`);
          
          // Xóa tất cả cache liên quan đến tài khoản quảng cáo đã disconnect
          if (externalId || deleteResponse?.data?.account?.external_id) {
            const deletedExternalId = deleteResponse?.data?.account?.external_id || externalId;
            
            try {
              // 1. Xóa cache FB_AD_ACCOUNTS (danh sách tài khoản quảng cáo từ Facebook)
              const cachedAccounts = JSON.parse(
                localStorage.getItem(STORAGE_KEYS.FB_AD_ACCOUNTS) || '[]'
              );
              
              const updatedAccounts = cachedAccounts.filter(
                (acc) => {
                  const accExternalId = acc.external_id || acc.id;
                  const accId = acc._id || acc.id;
                  return accExternalId !== deletedExternalId && accId !== accountId;
                }
              );
              
              localStorage.setItem(
                STORAGE_KEYS.FB_AD_ACCOUNTS,
                JSON.stringify(updatedAccounts)
              );
              
              // 2. Xóa selectedAdAccount nếu nó là account bị disconnect
              const selectedAdAccount = localStorage.getItem('selectedAdAccount');
              if (selectedAdAccount === deletedExternalId || selectedAdAccount === accountId) {
                localStorage.removeItem('selectedAdAccount');
                console.log('✅ Đã xóa selectedAdAccount:', selectedAdAccount);
              }
              
              // 3. Xóa tất cả cache keys liên quan đến account trong localStorage
              // Cache keys có format: `${entityType}_${contextId}_${accountId}` hoặc `${accountId}_${entityType}`
              // Chỉ xóa các keys có pattern cụ thể để tránh xóa nhầm
              const entityTypes = ['campaigns', 'adsets', 'ads'];
              const cacheKeysToRemove = [];
              
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                
                // Kiểm tra các pattern cache keys của campaigns, adsets, ads
                const matchesPattern = entityTypes.some(type => {
                  // Pattern: `${type}_all_${accountId}` hoặc `${type}_${contextId}_${accountId}`
                  const pattern1 = new RegExp(`^${type}_(all|\\w+)_(${deletedExternalId}|${accountId})$`);
                  // Pattern: `${accountId}_${type}`
                  const pattern2 = new RegExp(`^(${deletedExternalId}|${accountId})_${type}$`);
                  return pattern1.test(key) || pattern2.test(key);
                });
                
                if (matchesPattern) {
                  cacheKeysToRemove.push(key);
                }
              }
              
              cacheKeysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('✅ Đã xóa cache key:', key);
              });
              
              console.log('✅ Đã xóa tất cả cache của tài khoản quảng cáo:', deletedExternalId);
            } catch (error) {
              console.error('❌ Lỗi khi xóa cache tài khoản quảng cáo:', error);
            }
          }
          
          toast.success(t('account_management.disconnect_success'), {
            description: t('account_management.disconnect_description', { name: accountName })
          });
          break;
        }
        default:
          throw new Error(t('common.error'));
      }
      
      // Refresh danh sách sau khi thực hiện hành động
      await fetchAccounts({ q: searchText.trim(), page, limit });
      
    } catch (error) {
      console.error(`Lỗi ${action} account:`, error);
      toast.error(`Lỗi ${action} tài khoản`, {
        description: error?.response?.data?.message || 
        error?.message || 
        `Không thể ${action} tài khoản ${accountName}`
      });
    } finally {
      setConfirmationPopup(prev => ({ ...prev, isLoading: false, isOpen: false }));
    }
  };

  /** Hiển thị confirmation popup */
  const showConfirmDialog = (accountId, accountName, action) => {
    const actionConfig = {
      activate: {
        type: 'activate',
        title: t('account_management.confirm_activate_title'),
        message: t('account_management.confirm_activate_message', { name: accountName })
      },
      deactivate: {
        type: 'deactivate',
        title: t('account_management.confirm_deactivate_title'),
        message: t('account_management.confirm_deactivate_message', { name: accountName })
      },
      archive: {
        type: 'archive',
        title: t('account_management.confirm_archive_title'),
        message: t('account_management.confirm_archive_message', { name: accountName })
      },
      disconnect: {
        type: 'delete',
        title: t('account_management.confirm_disconnect_title'),
        message: t('account_management.confirm_disconnect_message', { name: accountName })
      }
    };

    const config = actionConfig[action];
    if (!config) return;

    setConfirmationPopup({
      isOpen: true,
      type: config.type,
      title: config.title,
      message: config.message,
      onConfirm: () => handleAccountAction(accountId, action, accountName),
      isLoading: false
    });
  };

  return (
    <div className="account-management-layout">
      <div className="account-management-content">
        <div className="account-management-center">
          <div className="account-management-card">
            {/* Header */}
            <div className="account-management-header">
              <div>
                <h3>{t('account_management.title')}</h3>
                <p>
                  {t('account_management.description')}
                </p>
                <div className="search-row">
                  <input
                    className="search-input"
                    placeholder={t('account_management.search_placeholder')}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  />
                  <button
                    className="btn-find"
                    onClick={onSearch}
                    disabled={loading || syncing}
                  >
                    {loading ? t('account_management.searching') : t('account_management.search')}
                  </button>
                  <button
                    className="btn-find"
                    onClick={handleSync}
                    disabled={loading || syncing}
                  >
                    {syncing ? t('account_management.refreshing') : t('account_management.refresh')}
                  </button>
                </div>
              </div>

              <div>
                <button
                  className="add-account"
                  onClick={() => navigate(ROUTES.CONNECT_AD_ACCOUNT)}
                >
                  + {t('account_management.add_account')}
                </button>
              </div>
            </div>

            {error && toast.error(error)}

            {/* Table */}
            <table className="table">
              <thead>
                <tr>
                  <th>{t('account_management.stt')}</th>
                  <th>{t('account_management.account_name')}</th>
                  <th className="text-right">{t('account_management.campaigns')}</th>
                  <th className="text-right">{t('account_management.adsets')}</th>
                  <th className="text-right">{t('account_management.ads')}</th>
                  <th>{t('account_management.status')}</th>
                  <th>{t('account_management.last_update')}</th>
                  <th>{t('account_management.action')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", color: "#6b7280" }}>
                      {t('account_management.loading')}
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", color: "#6b7280" }}>
                      {t('account_management.no_accounts')}
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc, idx) => (
                    <tr key={acc.id}>
                      <td>{(page - 1) * limit + idx + 1}</td>
                      <td>
                        <div>{acc.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>
                          {acc.number}
                        </div>
                      </td>
                      <td className="text-right">{acc.campaignCount}</td>
                      <td className="text-right">{acc.adsetCount}</td>
                      <td className="text-right">{acc.adCount}</td>
                      <td className={acc.internalStatus === 'ACTIVE' ? 'status-active-account' : 'status-inactive-account'}>{acc.status}</td>
                      <td>{acc.updatedAt}</td>
                      <td>
                        <div className="action-buttons">
                          {/* Hiển thị button dựa trên trạng thái internal (ACTIVE/INACTIVE) */}
                          {acc.internalStatus === 'ACTIVE' ? (
                            <button 
                              className="btn-inactive-account"
                              onClick={() => showConfirmDialog(acc.id, acc.name, 'deactivate')}
                              disabled={loading}
                              title={t('account_management.deactivate')}
                            >
                              <Pause size={15} />
                            </button>
                          ) : (
                            <button 
                              className="btn-active-account"
                              onClick={() => showConfirmDialog(acc.id, acc.name, 'activate')}
                              disabled={loading}
                              title={t('account_management.activate')}
                            >
                              <Play size={15} />
                            </button>
                          )}
                          
                          {/* <button 
                            className="btn-archive-account"
                            onClick={() => showConfirmDialog(acc.id, acc.name, 'archive')}
                            disabled={loading}
                            title={t('account_management.archive')}
                          >
                            <Archive size={15} />
                          </button> */}
                          
                          <button 
                            className="btn-disconnect-account"
                            onClick={() => showConfirmDialog(acc.id, acc.name, 'disconnect')}
                            disabled={loading}
                            title={t('account_management.disconnect')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {total > limit && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn-find"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading || syncing}
                >
                  Trang trước
                </button>
                <button
                  className="btn-find"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading || syncing || page * limit >= total}
                >
                  Trang sau
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Popup */}
      <ConfirmationPopup
        isOpen={confirmationPopup.isOpen}
        onClose={() => setConfirmationPopup(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmationPopup.onConfirm}
        title={confirmationPopup.title}
        message={confirmationPopup.message}
        type={confirmationPopup.type}
        isLoading={confirmationPopup.isLoading}
      />
    </div>
  );
}

export default AccountManagement;

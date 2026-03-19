import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import "./AutomationRule.css";
import AutoRulePopup from "../../components/feature/AutoRulePopup/AutoRulePopup";
import { useAuth } from "../../hooks/auth/useAuth";
import axiosInstance from "../../utils/api/axios";
import automationRuleService from "../../services/auto/automationRuleService";
import { useToast } from "../../hooks/common/useToast";
import {
  ACTION_BE_TO_VI,
  METRIC_BE_TO_VI,
  OPERATOR_BE_TO_VI,
  // convertConditionToFE,
  // convertScheduleToFE,
} from "../../constants/autoRuleConstants";
import { buildApplyToText } from "../../utils/business-logic/autoRuleUtils";
import { sanitizeHTML } from "../../utils/security/securityUtils";
import LoadingOverlay from "../../components/common/LoadingOverlay/LoadingOverlay";

function AutomationRule() {
  const { t } = useTranslation('automationRule');
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [showAddRulePopup, setShowAddRulePopup] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [loading, setLoading] = useState(false);

  // Lấy selectedAccountId từ localStorage khi component mount
  useEffect(() => {
    const savedAccountId = localStorage.getItem("selectedAdAccount");
    if (savedAccountId) {
      setSelectedAccountId(savedAccountId);
    }
  }, []);

  // Fetch ad accounts
  useEffect(() => {
    const fetchAdAccounts = async () => {
      try {
        const response = await axiosInstance.get("/api/ads-accounts", {
          params: { status: "ACTIVE", fetch_all: true },
        });
        if (response.data?.items) {
          setAdAccounts(response.data.items);
          // Nếu chưa có selectedAccountId và có account trong localStorage
          const savedAccountId = localStorage.getItem("selectedAdAccount");
          if (savedAccountId && !selectedAccountId) {
            // Kiểm tra account có tồn tại trong danh sách không
            const account = response.data.items.find(
              (acc) => acc.external_id === savedAccountId
            );
            if (account) {
              setSelectedAccountId(savedAccountId);
            }
            // Nếu không có cache hoặc account không hợp lệ -> không chọn gì
          }
        }
      } catch (error) {
        console.error("Error fetching ad accounts:", error);
        toast.error(t('toast.loadAccountsError', { ns: 'common' }) || "Cannot load ad accounts");
      }
    };

    fetchAdAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update localStorage khi account thay đổi
  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem("selectedAdAccount", selectedAccountId);
    }
  }, [selectedAccountId]);

  // Fetch rules từ API theo selectedAccountId
  useEffect(() => {
    const fetchRules = async () => {
      if (!selectedAccountId) {
        setRules([]);
        return;
      }

      try {
        setLoading(true);
        const response = await automationRuleService.getRules({
          account_id: selectedAccountId,
          shop_id: user?.shop_id, // Thêm shop_id để filter rules theo shop
          fetch_all: true,
        });

        if (response.success && response.items) {
          // Format rules data từ BE sang FE format
          const formattedRules = response.items.map((rule) => ({
            id: rule._id,
            name: rule.name,
            status:
              rule.status === "ACTIVE"
                ? t('statusDisplay.enabled')
                : rule.status === "TRIGGERED"
                  ? t('statusDisplay.triggered')
                  : rule.status === "PAUSED"
                    ? t('statusDisplay.disabled')
                    : rule.status,
            enabled: rule.enabled,
            appliedTo: rule.apply_to_ids
              ? buildApplyToText(
                rule.apply_to_ids.campaign_ids || [],
                rule.apply_to_ids.adset_ids || [],
                rule.apply_to_ids.ad_ids || [],
                t
              )
              : rule.apply_to || t('statusDisplay.notSelected'),
            actionCondition: formatActionCondition(rule),
            actionConditionHTML: formatActionConditionHTML(rule),
            result: formatResult(rule),
            frequency: formatFrequency(rule),
            creator:
              rule.created_by?.full_name ||
              rule.created_by?.email ||
              "Người dùng không xác định",
            createdAt: new Date(rule.created_at).toLocaleDateString("vi-VN"),
            rawData: rule, // Giữ raw data để edit
          }));
          setRules(formattedRules);
        }
      } catch (error) {
        console.error("Error fetching rules:", error);
        toast.error(error.message || t('loading.fetchingRules'));
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, user?.shop_id, i18n.language]);

  // Helper functions để format rule data
  const formatActionCondition = (rule) => {
    const action = ACTION_BE_TO_VI[rule.action] || rule.action;
    const conditions = rule.conditions
      ?.map((c) => {
        const metric = METRIC_BE_TO_VI[c.metric] || c.metric;
        const operator = OPERATOR_BE_TO_VI[c.operator] || c.operator;
        return `${metric} ${operator} ${c.value}`;
      })
      .join("\n");
    return `${action}. Nếu:\n${conditions || ""}`;
  };

  // Format action condition với HTML để in đậm
  const formatActionConditionHTML = (rule) => {
    const actionKey = ACTION_BE_TO_VI[rule.action] || rule.action;
    const action = t(`actions.${actionKey}`);
    const conditions = rule.conditions
      ?.map((c) => {
        const metricKey = METRIC_BE_TO_VI[c.metric] || c.metric;
        const metric = t(`metrics.${metricKey}`);
        const operatorKey = OPERATOR_BE_TO_VI[c.operator] || c.operator;
        const operator = t(`operators.${operatorKey}`);
        return `<strong>${metric}</strong> ${operator} <strong>${c.value}</strong>`;
      })
      .join("\n");
    return `<strong>${action}</strong>. Nếu:\n${conditions || ""}`;
  };

  const formatResult = (rule) => {
    const lines = [];

    // Dòng 1: Trạng thái tổng quan
    if (!rule.enabled) {
      return t('statusDisplay.disabled');
    }

    // TRIGGERED status được xử lý giống ACTIVE (rule vẫn tiếp tục chạy)
    if (rule.status !== "ACTIVE" && rule.status !== "TRIGGERED") {
      return `${rule.status === "PAUSED" ? "Đã tạm dừng" : rule.status}`;
    }

    // Kiểm tra lỗi (ưu tiên hiển thị lỗi)
    if (rule.last_error) {
      lines.push(`Lỗi: ${rule.last_error.substring(0, 50)}${rule.last_error.length > 50 ? "..." : ""}`);
      if (rule.last_error_at) {
        const errorTime = new Date(rule.last_error_at).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
        lines.push(t('resultDisplay.errorTime', { time: errorTime }));
      }
      return lines.join("\n");
    }

    // Dòng 2: Số lần trigger
    if (rule.trigger_count > 0) {
      lines.push(t('resultDisplay.triggered', { count: rule.trigger_count }));
      if (rule.last_triggered_at) {
        const triggeredTime = new Date(rule.last_triggered_at).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
        lines.push(t('resultDisplay.lastTriggered', { time: triggeredTime }));
      }
    } else {
      lines.push(t('resultDisplay.notTriggered'));
    }

    // Dòng 3: Số lần chạy
    if (rule.run_count > 0) {
      lines.push(t('resultDisplay.runCount', { count: rule.run_count }));
      if (rule.last_run_at) {
        const lastRunTime = new Date(rule.last_run_at).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
        lines.push(t('resultDisplay.lastRun', { time: lastRunTime }));
      }
    } else {
      lines.push(t('resultDisplay.notRun'));
    }

    // Dòng 4: Thời gian chạy tiếp theo
    if (rule.next_run_at) {
      const nextRun = new Date(rule.next_run_at);
      const now = new Date();
      if (nextRun > now) {
        const diffMinutes = Math.round((nextRun - now) / 1000 / 60);
        if (diffMinutes < 60) {
          lines.push(t('resultDisplay.runInMinutes', { minutes: diffMinutes }));
        } else {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          if (minutes > 0) {
            lines.push(t('resultDisplay.runInHours', { hours, minutes }));
          } else {
            lines.push(t('resultDisplay.runInHoursOnly', { hours }));
          }
        }
      } else {
        lines.push(t('resultDisplay.waiting'));
      }
    } else {
      lines.push(t('resultDisplay.noSchedule'));
    }

    return lines.join("\n");
  };

  const formatFrequency = (rule) => {
    if (rule.schedule?.type === "CONTINUOUS") {
      return t('frequencyDisplay.continuous');
    } else if (rule.schedule?.type === "DAILY") {
      return t('frequencyDisplay.daily', { start: rule.schedule.daily_time?.start_time || "", end: rule.schedule.daily_time?.end_time || "" });
    } else if (rule.schedule?.type === "CUSTOM") {
      return t('frequencyDisplay.custom');
    }
    return t('frequencyDisplay.notSet');
  };

  const handleAccountChange = (e) => {
    const accountId = e.target.value;
    setSelectedAccountId(accountId);
    localStorage.setItem("selectedAdAccount", accountId);
  };

  const handleToggleRule = async (id) => {
    try {
      const response = await automationRuleService.toggleRule(id);
      if (response.success) {
        // Update local state
        setRules((prev) =>
          prev.map((rule) =>
            rule.id === id
              ? {
                ...rule,
                enabled: response.data.enabled,
                status: response.data.enabled ? t('statusDisplay.enabled') : t('statusDisplay.disabled'),
                rawData: response.data,
              }
              : rule
          )
        );
        toast.success(response.message || t('toast.toggleSuccess'));
      }
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error(error.message || t('toast.toggleError'));
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm(t('confirmDelete.message'))) {
      return;
    }

    try {
      const response = await automationRuleService.deleteRule(id);
      if (response.success) {
        setRules((prev) => prev.filter((rule) => rule.id !== id));
        toast.success(response.message || t('toast.deleteSuccess'));
      }
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error(error.message || t('toast.deleteError'));
    }
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule.rawData);
    setShowAddRulePopup(true);
  };

  const handleAddNewRule = () => {
    setEditingRule(null);
    setShowAddRulePopup(true);
  };

  const handleSaveRule = async (ruleData) => {
    try {
      setLoading(true);

      if (!selectedAccountId) {
        toast.error(t('selectAccount'));
        return;
      }

      // Tìm account_id (ObjectId) từ external_id
      const account = adAccounts.find(
        (acc) => acc.external_id === selectedAccountId
      );
      if (!account) {
        toast.error(t('toast.accountNotFound', { ns: 'common' }) || "Account not found");
        return;
      }

      const ruleDataWithAccount = {
        ...ruleData,
        account_id: account._id, // ObjectId từ AdsAccount
        shop_id: user?.shop_id || null,
        subscriber_id: user?._id,
        created_by: user?._id,
      };

      let response;
      if (editingRule) {
        // Update existing rule
        response = await automationRuleService.updateRule(
          editingRule._id,
          ruleDataWithAccount
        );
        toast.success(response.message || t('toast.updateSuccess'));
      } else {
        // Create new rule
        response = await automationRuleService.createRule(ruleDataWithAccount);
        toast.success(response.message || t('toast.createSuccess'));
      }

      if (response.success) {
        // Refresh rules list
        const rulesResponse = await automationRuleService.getRules({
          account_id: selectedAccountId,
          shop_id: user?.shop_id, // Thêm shop_id để filter rules theo shop
          fetch_all: true,
        });
        if (rulesResponse.success && rulesResponse.items) {
          const formattedRules = rulesResponse.items.map((rule) => ({
            id: rule._id,
            name: rule.name,
            status:
              rule.status === "ACTIVE"
                ? "Đã bật"
                : rule.status === "TRIGGERED"
                  ? "Đã kích hoạt"
                  : rule.status === "PAUSED"
                    ? "Vô hiệu hóa"
                    : rule.status,
            enabled: rule.enabled,
            appliedTo: rule.apply_to || "Chưa chọn",
            actionCondition: formatActionCondition(rule),
            actionConditionHTML: formatActionConditionHTML(rule),
            result: formatResult(rule),
            frequency: formatFrequency(rule),
            creator:
              rule.created_by?.full_name ||
              rule.created_by?.email ||
              "Người dùng",
            createdAt: new Date(rule.created_at).toLocaleDateString("vi-VN"),
            rawData: rule,
          }));
          setRules(formattedRules);
        }
        setShowAddRulePopup(false);
        setEditingRule(null);
      }
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error(error.message || t('loading.savingRule'));
    } finally {
      setLoading(false);
    }
  };

  const handleClosePopup = () => {
    setShowAddRulePopup(false);
    setEditingRule(null);
  };

  return (
    <div className="automation-rule-page">
      <LoadingOverlay isLoading={loading} message={t('loading.fetchingRules')} />
      <div className="automation-rule-container">
        {/* Header with Back Button */}
        <div className="automation-rule-header">
          <button
            className="btn-back"
            onClick={() => navigate(-1)}
            title="Quay lại"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Action Button */}
        <div className="automation-rule-actions">
          <h1 className="automation-rule-title">{t('pageTitle')}</h1>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select
              value={selectedAccountId}
              onChange={handleAccountChange}
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                border: "1px solid #ddd",
                minWidth: "200px",
              }}
            >
              <option value="">{t('selectAccount')}</option>
              {adAccounts.map((account) => (
                <option key={account._id} value={account.external_id}>
                  {account.name || account.external_id} ({account.external_id})
                </option>
              ))}
            </select>
            <button
              className="btn-add-rule"
              onClick={handleAddNewRule}
              disabled={!selectedAccountId || loading}
            >
              <Plus size={16} />
              {t('addNewRule')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="automation-rule-table-wrapper">
          <table className="automation-rule-table">
            <thead>
              <tr>
                <th></th>
                <th>{t('table.headers.ruleName')}</th>
                <th>{t('table.headers.enabled')}</th>
                <th>ID</th>
                <th>{t('table.headers.applyTo')}</th>
                <th>{t('table.headers.actionCondition')}</th>
                <th>{t('table.headers.result')}</th>
                <th>{t('table.headers.frequency')}</th>
                <th>{t('table.headers.createdBy')}</th>
                <th>{t('table.headers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    {t('loading.fetchingRules')}
                  </td>
                </tr>
              ) : !selectedAccountId ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    {t('emptyState')}
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={10}>
                    {t('emptyState')}
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <button
                        type="button"
                        className={`rule-toggle ${rule.enabled ? "on" : "off"}`}
                        onClick={() => handleToggleRule(rule.id)}
                        aria-pressed={rule.enabled}
                        disabled={loading}
                      />
                    </td>
                    <td>{rule.name}</td>
                    <td>
                      <span
                        className={`rule-status ${rule.status === "Đã kích hoạt"
                          ? "status-triggered"
                          : rule.enabled
                            ? "status-enabled"
                            : "status-disabled"
                          }`}
                      >
                        {rule.status}
                      </span>
                    </td>
                    <td className="rule-id-cell">{rule.id}</td>
                    <td>{rule.appliedTo}</td>
                    <td
                      className="action-condition-cell"
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(rule.actionConditionHTML) }}
                    />
                    <td className="rule-result-cell">{rule.result}</td>
                    <td>{rule.frequency}</td>
                    <td>
                      {rule.creator} <br /> {rule.createdAt}
                    </td>
                    <td>
                      <div className="rule-actions">
                        <button
                          className="btn-edit"
                          onClick={() => handleEditRule(rule)}
                          title={t('buttons.edit')}
                          disabled={loading}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteRule(rule.id)}
                          title={t('buttons.delete')}
                          disabled={loading}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Rule Popup */}
      <AutoRulePopup
        isOpen={showAddRulePopup}
        onClose={handleClosePopup}
        onSave={handleSaveRule}
        accountId={selectedAccountId}
        subscriber={user}
        editingRule={editingRule}
      />
    </div>
  );
}

export default AutomationRule;


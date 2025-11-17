import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Plus } from "lucide-react";
import "./AutomationRule.css";
import AutoRulePopup from "../../components/feature/AutoRulePopup/AutoRulePopup";
import { useAuth } from "../../hooks/useAuth";
import axiosInstance from "../../utils/axios";
import automationRuleService from "../../services/automationRuleService";
import { useToast } from "../../hooks/useToast";
import {
  ACTION_BE_TO_VI,
  METRIC_BE_TO_VI,
  OPERATOR_BE_TO_VI,
  // convertConditionToFE,
  // convertScheduleToFE,
} from "../../constants/autoRuleConstants";

function AutomationRule() {
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
            } else if (response.data.items.length > 0) {
              // Nếu account không tồn tại, chọn account đầu tiên
              setSelectedAccountId(response.data.items[0].external_id);
            }
          } else if (!selectedAccountId && response.data.items.length > 0) {
            // Nếu không có account nào trong localStorage, chọn account đầu tiên
            setSelectedAccountId(response.data.items[0].external_id);
          }
        }
      } catch (error) {
        console.error("Error fetching ad accounts:", error);
        toast.error("Không thể tải danh sách tài khoản quảng cáo");
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
              "Người dùng không xác định",
            createdAt: new Date(rule.created_at).toLocaleDateString("vi-VN"),
            rawData: rule, // Giữ raw data để edit
          }));
          setRules(formattedRules);
        }
      } catch (error) {
        console.error("Error fetching rules:", error);
        toast.error(error.message || "Không thể tải danh sách quy tắc");
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, user?.shop_id]);

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
    const action = ACTION_BE_TO_VI[rule.action] || rule.action;
    const conditions = rule.conditions
      ?.map((c) => {
        const metric = METRIC_BE_TO_VI[c.metric] || c.metric;
        const operator = OPERATOR_BE_TO_VI[c.operator] || c.operator;
        return `<strong>${metric}</strong> ${operator} <strong>${c.value}</strong>`;
      })
      .join("\n");
    return `<strong>${action}</strong>. Nếu:\n${conditions || ""}`;
  };

  const formatResult = (rule) => {
    const lines = [];

    // Dòng 1: Trạng thái tổng quan
    if (!rule.enabled) {
      return "Vô hiệu hóa";
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
        lines.push(`Thời gian: ${errorTime}`);
      }
      return lines.join("\n");
    }

    // Dòng 2: Số lần trigger
    if (rule.trigger_count > 0) {
      lines.push(`Kích hoạt: ${rule.trigger_count} lần`);
      if (rule.last_triggered_at) {
        const triggeredTime = new Date(rule.last_triggered_at).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
        lines.push(`Lần cuối: ${triggeredTime}`);
      }
    } else {
      lines.push("Chưa kích hoạt");
    }

    // Dòng 3: Số lần chạy
    if (rule.run_count > 0) {
      lines.push(`Đã chạy: ${rule.run_count} lần`);
      if (rule.last_run_at) {
        const lastRunTime = new Date(rule.last_run_at).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
        lines.push(`Chạy lần cuối: ${lastRunTime}`);
      }
    } else {
      lines.push("Chưa chạy lần nào");
    }

    // Dòng 4: Thời gian chạy tiếp theo
    if (rule.next_run_at) {
      const nextRun = new Date(rule.next_run_at);
      const now = new Date();
      if (nextRun > now) {
        const diffMinutes = Math.round((nextRun - now) / 1000 / 60);
        if (diffMinutes < 60) {
          lines.push(`Chạy sau: ~${diffMinutes} phút`);
        } else {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          if (minutes > 0) {
            lines.push(`Chạy sau: ~${hours}h ${minutes}m`);
          } else {
            lines.push(`Chạy sau: ~${hours} giờ`);
          }
        }
      } else {
        lines.push("⏰ Đang chờ chạy...");
      }
    } else {
      lines.push("Chưa có lịch chạy");
    }

    return lines.join("\n");
  };

  const formatFrequency = (rule) => {
    if (rule.schedule?.type === "CONTINUOUS") {
      return "Đã kiểm tra tối thiểu 30 phút một lần.";
    } else if (rule.schedule?.type === "DAILY") {
      return `Hàng ngày từ ${rule.schedule.daily_time?.start_time || ""} đến ${rule.schedule.daily_time?.end_time || ""}`;
    } else if (rule.schedule?.type === "CUSTOM") {
      return "Theo lịch tùy chỉnh";
    }
    return "Chưa cài đặt";
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
                  status: response.data.enabled ? "Đã bật" : "Vô hiệu hóa",
                  rawData: response.data,
                }
              : rule
          )
        );
        toast.success(response.message || "Đã cập nhật trạng thái quy tắc");
      }
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error(error.message || "Không thể cập nhật trạng thái quy tắc");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa quy tắc này?")) {
      return;
    }

    try {
      const response = await automationRuleService.deleteRule(id);
      if (response.success) {
        setRules((prev) => prev.filter((rule) => rule.id !== id));
        toast.success(response.message || "Đã xóa quy tắc thành công");
      }
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error(error.message || "Không thể xóa quy tắc");
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
        toast.error("Vui lòng chọn tài khoản quảng cáo");
        return;
      }

      // Tìm account_id (ObjectId) từ external_id
      const account = adAccounts.find(
        (acc) => acc.external_id === selectedAccountId
      );
      if (!account) {
        toast.error("Không tìm thấy tài khoản quảng cáo");
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
        toast.success(response.message || "Đã cập nhật quy tắc thành công");
      } else {
        // Create new rule
        response = await automationRuleService.createRule(ruleDataWithAccount);
        toast.success(response.message || "Đã tạo quy tắc thành công");
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
      toast.error(error.message || "Có lỗi xảy ra khi lưu quy tắc");
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
          <h1 className="automation-rule-title">Quy tắc tự động</h1>
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
              <option value="">Chọn tài khoản quảng cáo</option>
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
              Tạo quy tắc mới
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="automation-rule-table-wrapper">
          <table className="automation-rule-table">
            <thead>
              <tr>
                <th></th>
                <th>Tên quy tắc</th>
                <th>Trạng thái</th>
                <th>ID</th>
                <th>Áp dụng cho</th>
                <th>Hành động & điều kiện</th>
                <th>Kết quả của quy tắc</th>
                <th>Tần suất chạy</th>
                <th>Người tạo</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    Đang tải...
                  </td>
                </tr>
              ) : !selectedAccountId ? (
                <tr>
                  <td colSpan={10} className="empty-state">
                    Vui lòng chọn tài khoản quảng cáo để xem quy tắc.
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={10}>
                    Chưa có quy tắc nào. Hãy tạo quy tắc mới để bắt đầu.
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
                        className={`rule-status ${
                          rule.status === "Đã kích hoạt"
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
                      dangerouslySetInnerHTML={{ __html: rule.actionConditionHTML }}
                    />
                    <td className="rule-result-cell">{rule.result}</td>
                    <td>{rule.frequency}</td>
                    <td>
                      {rule.creator} {rule.createdAt}
                    </td>
                    <td>
                      <div className="rule-actions">
                        <button
                          className="btn-edit"
                          onClick={() => handleEditRule(rule)}
                          title="Chỉnh sửa"
                          disabled={loading}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Xóa"
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


import { useState, useEffect } from "react";
import {
  DEFAULT_METRIC,
  DEFAULT_OPERATOR,
  DEFAULT_UNIT,
  DEFAULT_ACTION,
  DEFAULT_SCHEDULE,
  DEFAULT_DAILY_TIME,
  DAYS_OPTIONS,
  convertConditionToFE,
  convertScheduleToFE,
  ACTION_BE_TO_VI,
} from "../constants/autoRuleConstants";
import { extractIds, buildApplyToText } from "../utils/autoRuleUtils";

/**
 * Get initial form data based on editing rule
 */
const getInitialFormData = (editingRule) => {
  if (editingRule) {
    // Convert BE data to FE format
    const scheduleFE = convertScheduleToFE(
      editingRule.schedule || { type: "CONTINUOUS" }
    );

    // Extract IDs
    const campaignIds = extractIds(editingRule.apply_to_ids?.campaign_ids || []);
    const adsetIds = extractIds(editingRule.apply_to_ids?.adset_ids || []);
    const adIds = extractIds(editingRule.apply_to_ids?.ad_ids || []);

    // Build apply_to text from selected items
    const applyToText = buildApplyToText(campaignIds, adsetIds, adIds) ||
      editingRule.apply_to ||
      "";

    return {
      ruleName: editingRule.name || "",
      applyTo: applyToText,
      selectedCampaignIds: campaignIds,
      selectedAdsetIds: adsetIds,
      selectedAdIds: adIds,
      action: ACTION_BE_TO_VI[editingRule.action] || DEFAULT_ACTION,
      conditions:
        (editingRule.conditions || []).length > 0
          ? editingRule.conditions.map(convertConditionToFE)
          : [
              {
                metric: DEFAULT_METRIC,
                operator: DEFAULT_OPERATOR,
                value: "",
                unit: DEFAULT_UNIT,
              },
            ],
      schedule: scheduleFE.schedule,
      dailyTime: scheduleFE.dailyTime,
      customSchedule: scheduleFE.customSchedule,
      notification:
        editingRule.notification !== undefined
          ? editingRule.notification
          : true,
    };
  }

  return {
    ruleName: "",
    applyTo: "",
    selectedCampaignIds: [],
    selectedAdsetIds: [],
    selectedAdIds: [],
    action: DEFAULT_ACTION,
    conditions: [
      {
        metric: DEFAULT_METRIC,
        operator: DEFAULT_OPERATOR,
        value: "",
        unit: DEFAULT_UNIT,
      },
    ],
    schedule: DEFAULT_SCHEDULE,
    dailyTime: { ...DEFAULT_DAILY_TIME },
    customSchedule: {
      days: DAYS_OPTIONS.map((day) => ({
        day,
        checked: false,
        timeSlots: [{ startTime: "00:00", endTime: "00:00" }],
      })),
    },
    notification: true,
  };
};

/**
 * Custom hook for managing AutoRule form state
 * @param {Object} editingRule - Rule being edited (null for new rule)
 * @returns {Array} - [formData, setFormData]
 */
export const useAutoRuleForm = (editingRule) => {
  const [formData, setFormData] = useState(() => getInitialFormData(editingRule));

  // Reset form when editingRule changes
  useEffect(() => {
    setFormData(getInitialFormData(editingRule));
  }, [editingRule]);

  return [formData, setFormData];
};


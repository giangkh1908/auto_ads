import AutomationRule from "../models/ads/autoRule.model.js";
import AdPerformance from "../models/ads/adPerformance.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";
import User from "../models/user.model.js";
import {
  updateCampaignStatus,
  updateAdsetStatus,
  updateAdStatus,
} from "./fbAdsService.js";
import { sendAutoRuleNotificationEmail } from "./emailService.js";

/**
 * Mapping từ metric name trong rule sang field trong AdPerformance
 */
const METRIC_TO_FIELD_MAP = {
  spend: "spend",
  daily_budget: "daily_budget",
  daily_spend_rate: "daily_spend_rate",
  website_purchase_roas: "website_purchase_roas",
  link_ctr: "link_ctr",
  impressions: "impressions",
  link_cpc: "link_cpc",
  cost_per_result: "cost_per_result",
  results: "results",
  frequency: "frequency",
  website_purchases: "website_purchases",
  total_amount_spent: "total_amount_spent",
  link_clicks: "link_clicks",
  cpm: "cpm",
  audience_reach_percentage: "audience_reach_percentage", // Field có sẵn trong AdPerformance model
};

/**
 * Tính toán next_run_at dựa trên schedule type
 */
export function calculateNextRunAt(schedule) {
  if (!schedule || !schedule.type) {
    return null;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

  if (schedule.type === "CONTINUOUS") {
    // Chạy sau 30 phút
    return new Date(now.getTime() + 30 * 60 * 1000);
  } else if (schedule.type === "DAILY") {
    // DAILY: 30 phút/lần trong khoảng thời gian từ start_time đến end_time
    if (schedule.daily_time && schedule.daily_time.start_time && schedule.daily_time.end_time) {
      const [startHour, startMinute] = schedule.daily_time.start_time
        .split(":")
        .map(Number);
      const [endHour, endMinute] = schedule.daily_time.end_time
        .split(":")
        .map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      // Nếu đang trong khoảng thời gian start_time đến end_time
      if (currentTime >= startTime && currentTime < endTime) {
        // Chạy sau 30 phút (nhưng không được vượt quá end_time)
        const nextRun = new Date(now.getTime() + 30 * 60 * 1000);
        const nextRunTime = nextRun.getHours() * 60 + nextRun.getMinutes();
        
        // Nếu sau 30 phút vượt quá end_time, thì chạy vào start_time ngày mai
        if (nextRunTime >= endTime) {
          const nextDayRun = new Date(now);
          nextDayRun.setDate(nextDayRun.getDate() + 1);
          nextDayRun.setHours(startHour, startMinute, 0, 0);
          return nextDayRun;
        }
        
        return nextRun;
      }
      // Nếu chưa đến start_time, chạy vào start_time hôm nay
      else if (currentTime < startTime) {
        const nextRun = new Date(now);
        nextRun.setHours(startHour, startMinute, 0, 0);
        return nextRun;
      }
      // Nếu đã qua end_time, chạy vào start_time ngày mai
      else {
        const nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(startHour, startMinute, 0, 0);
        return nextRun;
      }
    } else {
      // Nếu không có daily_time đầy đủ, mặc định chạy sau 30 phút
      return new Date(now.getTime() + 30 * 60 * 1000);
    }
  } else if (schedule.type === "CUSTOM") {
    // CUSTOM: 30 phút/lần trong time slot, nhưng phải kiểm tra thứ hiện tại
    if (!schedule.custom_schedule || !schedule.custom_schedule.days) {
      return null;
    }

    const days = schedule.custom_schedule.days;
    const dayNames = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];

    // Tìm ngày hiện tại trong schedule
    const currentDayName = dayNames[currentDay];
    const currentDayConfig = days.find((d) => d.day === currentDayName);

    // Kiểm tra xem ngày hiện tại có được chọn không
    if (currentDayConfig && currentDayConfig.checked) {
      const timeSlots = currentDayConfig.time_slots || [];
      
      // Duyệt qua các time slots để tìm slot phù hợp
      for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
        const slot = timeSlots[slotIndex];
        if (!slot.start_time || !slot.end_time) continue;

        const [startHour, startMinute] = slot.start_time
          .split(":")
          .map(Number);
        const [endHour, endMinute] = slot.end_time.split(":").map(Number);
        const slotStartTime = startHour * 60 + startMinute;
        const slotEndTime = endHour * 60 + endMinute;

        // Nếu đang trong time slot này
        if (currentTime >= slotStartTime && currentTime < slotEndTime) {
          // Chạy sau 30 phút (nhưng không được vượt quá end_time của slot)
          const nextRun = new Date(now.getTime() + 30 * 60 * 1000);
          const nextRunTime = nextRun.getHours() * 60 + nextRun.getMinutes();
          
          // Nếu sau 30 phút vượt quá end_time của slot này, tìm slot tiếp theo
          if (nextRunTime >= slotEndTime) {
            // Tìm slot tiếp theo trong ngày
            const nextSlotIndex = slotIndex + 1;
            if (nextSlotIndex < timeSlots.length) {
              const nextSlot = timeSlots[nextSlotIndex];
              if (nextSlot.start_time) {
                const [nextStartHour, nextStartMinute] = nextSlot.start_time
                  .split(":")
                  .map(Number);
                const nextRunSlot = new Date(now);
                nextRunSlot.setHours(nextStartHour, nextStartMinute, 0, 0);
                return nextRunSlot;
              }
            } else {
              // Không còn slot nào trong ngày, tìm ngày tiếp theo
              break;
            }
          }
          
          return nextRun;
        }
        // Nếu chưa đến time slot này, chạy vào start_time của slot này
        else if (currentTime < slotStartTime) {
          const nextRun = new Date(now);
          nextRun.setHours(startHour, startMinute, 0, 0);
          return nextRun;
        }
        // Nếu đã qua time slot này, tiếp tục tìm slot tiếp theo
      }
    }

    // Nếu không tìm thấy time slot trong ngày hiện tại hoặc ngày hiện tại không được chọn,
    // tìm ngày tiếp theo có được chọn và có time slot
    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (currentDay + i) % 7;
      const nextDayName = dayNames[nextDayIndex];
      const nextDayConfig = days.find((d) => d.day === nextDayName);

      // Kiểm tra ngày tiếp theo có được chọn không
      if (nextDayConfig && nextDayConfig.checked) {
        const timeSlots = nextDayConfig.time_slots || [];
        if (timeSlots.length > 0) {
          // Lấy time slot đầu tiên của ngày tiếp theo
          const firstSlot = timeSlots[0];
          if (firstSlot.start_time) {
            const [startHour, startMinute] = firstSlot.start_time
              .split(":")
              .map(Number);
            const nextRun = new Date(now);
            nextRun.setDate(nextRun.getDate() + i);
            nextRun.setHours(startHour, startMinute, 0, 0);
            return nextRun;
          }
        }
      }
    }

    // Nếu không có ngày nào được chọn, return null
    return null;
  }

  return null;
}

/**
 * So sánh condition với giá trị thực tế
 */
function compareCondition(condition, actualValue) {
  if (actualValue === null || actualValue === undefined) {
    return false;
  }

  const { operator, value } = condition;
  const numValue = Number(actualValue);
  const numConditionValue = Number(value);

  if (isNaN(numValue) || isNaN(numConditionValue)) {
    return false;
  }

  switch (operator) {
    case "GREATER_THAN":
      return numValue > numConditionValue;
    case "LESS_THAN":
      return numValue < numConditionValue;
    case "EQUAL_TO":
      return Math.abs(numValue - numConditionValue) < 0.01; // Cho phép sai số nhỏ
    default:
      return false;
  }
}

/**
 * Evaluate conditions với AdPerformance data
 * Return true nếu 1 trong các điều kiện thỏa mãn (OR logic)
 */
export async function evaluateConditions(rule) {
  try {
    if (!rule.conditions || rule.conditions.length === 0) {
      return false;
    }

    // Lấy ngày hiện tại (chỉ date part, bỏ qua time)
    // Sử dụng local time để phù hợp với timezone của server
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Build query filter
    const filter = {
      account_id: rule.account_id,
      date: {
        $gte: todayStart,
        $lt: todayEnd,
      },
    };

    // Thêm filter theo apply_to_ids
    // Nếu rule apply to campaigns: Query theo campaign_id
    // Nếu rule apply to adsets: Query theo set_id (adset_id)
    // Nếu rule apply to ads: Query theo ads_id (ad_id)
    const { campaign_ids, adset_ids, ad_ids } = rule.apply_to_ids || {};
    
    // Xây dựng OR conditions cho các entity types
    const orConditions = [];
    
    if (campaign_ids && campaign_ids.length > 0) {
      orConditions.push({ campaign_id: { $in: campaign_ids } });
    }
    if (adset_ids && adset_ids.length > 0) {
      orConditions.push({ set_id: { $in: adset_ids } });
    }
    if (ad_ids && ad_ids.length > 0) {
      orConditions.push({ ads_id: { $in: ad_ids } });
    }
    
    // Nếu có điều kiện OR, thêm vào filter
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    } else {
      // Nếu không có điều kiện nào, return false
      return false;
    }

    // Query AdPerformance data
    const adPerformanceData = await AdPerformance.find(filter).lean();

    if (!adPerformanceData || adPerformanceData.length === 0) {
      return false;
    }

    // Với mỗi condition, kiểm tra xem có bản ghi nào thỏa mãn không
    for (const condition of rule.conditions) {
      const fieldName = METRIC_TO_FIELD_MAP[condition.metric];
      if (!fieldName) {
        console.warn(`Unknown metric: ${condition.metric}`);
        continue;
      }

      // Kiểm tra từng bản ghi AdPerformance
      for (const record of adPerformanceData) {
        const actualValue = record[fieldName];

        // So sánh condition với giá trị thực tế
        if (compareCondition(condition, actualValue)) {
          return true; // Nếu 1 trong các điều kiện thỏa mãn, return true (OR logic)
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error evaluating conditions:", error);
    return false;
  }
}

/**
 * Lấy Facebook access token từ User
 */
export async function getAccessTokenForRule(rule) {
  try {
    // Ưu tiên lấy từ created_by, nếu không có thì lấy từ subscriber_id
    const userId = rule.created_by || rule.subscriber_id;
    if (!userId) {
      throw new Error("No user ID found in rule");
    }

    const user = await User.findById(userId).select("+facebookAccessToken").lean();
    if (!user || !user.facebookAccessToken) {
      throw new Error("User not found or no Facebook access token");
    }

    return user.facebookAccessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

/**
 * Xử lý song song với giới hạn concurrent để tránh rate limiting
 * @param {Array} entities - Mảng các entities cần xử lý
 * @param {Function} updateFunction - Hàm update status (updateCampaignStatus, updateAdsetStatus, updateAdStatus)
 * @param {string} entityType - Loại entity (Campaign, Adset, Ad)
 * @param {string} accessToken - Facebook access token
 * @param {string} status - Status cần set (ACTIVE hoặc PAUSED)
 * @param {number} concurrencyLimit - Số lượng requests đồng thời tối đa (mặc định: 10)
 */
async function processEntitiesInParallel(entities, updateFunction, entityType, accessToken, status, concurrencyLimit = 10) {
  const results = { success: 0, failed: 0, errors: [] };

  if (!entities || entities.length === 0) {
    return results;
  }

  // Tách entities có và không có external_id
  const validEntities = entities.filter((entity) => entity.external_id);
  const invalidEntities = entities.filter((entity) => !entity.external_id);

  // Xử lý entities không có external_id
  invalidEntities.forEach((entity) => {
    results.failed++;
    results.errors.push(`${entityType} ${entity._id} has no external_id`);
  });

  if (validEntities.length === 0) {
    return results;
  }

  // Chia entities thành các batches để xử lý song song với giới hạn concurrent
  const batches = [];
  for (let i = 0; i < validEntities.length; i += concurrencyLimit) {
    batches.push(validEntities.slice(i, i + concurrencyLimit));
  }

  // Xử lý từng batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    // Xử lý batch song song với Promise.allSettled
    const batchPromises = batch.map(async (entity) => {
      try {
        await updateFunction(entity.external_id, accessToken, status);
        return { success: true, entity };
      } catch (error) {
        return {
          success: false,
          entity,
          error: error.message || error.response?.data?.error?.message || "Unknown error",
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    // Xử lý kết quả batch
    batchResults.forEach((result, index) => {
      const entity = batch[index];
      if (result.status === "fulfilled") {
        if (result.value.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(
            `${entityType} ${entity.external_id}: ${result.value.error}`
          );
        }
      } else {
        // Trường hợp promise bị reject (ít xảy ra vì đã có try-catch)
        results.failed++;
        results.errors.push(
          `${entityType} ${entity.external_id}: ${result.reason?.message || "Unknown error"}`
        );
      }
    });

    // Log tiến độ xử lý (chỉ log nếu có nhiều hơn 1 batch)
    if (batches.length > 1) {
      console.log(
        `[AutoRule] ${entityType} batch ${batchIndex + 1}/${batches.length}: ${results.success} thành công, ${results.failed} thất bại`
      );
    }
  }

  return results;
}

/**
 * Thực thi action TURN_ON hoặc TURN_OFF với xử lý song song
 * - Query DB cho campaigns, adsets, ads song song
 * - Xử lý từng loại entity song song với giới hạn concurrent (mặc định: 10)
 */
async function executeTurnOnOff(rule, accessToken, status) {
  const results = {
    campaigns: { success: 0, failed: 0, errors: [] },
    adsets: { success: 0, failed: 0, errors: [] },
    ads: { success: 0, failed: 0, errors: [] },
  };

  try {
    const { campaign_ids, adset_ids, ad_ids } = rule.apply_to_ids || {};
    const actionName = status === "ACTIVE" ? "TURN_ON" : "TURN_OFF";

    console.log(
      `[AutoRule] Bắt đầu thực thi ${actionName} cho rule "${rule.name}"`
    );

    // Xử lý song song các loại entities (campaigns, adsets, ads)
    // Query DB và xử lý song song để tối ưu performance
    const promises = [];

    // Process campaigns
    if (campaign_ids && campaign_ids.length > 0) {
      promises.push(
        AdsCampaign.find({
          _id: { $in: campaign_ids },
          deleted_at: null,
        })
          .lean()
          .then((campaigns) => {
            console.log(
              `[AutoRule] Tìm thấy ${campaigns.length} campaign(s) cần xử lý`
            );
            return processEntitiesInParallel(
              campaigns,
              updateCampaignStatus,
              "Campaign",
              accessToken,
              status
            ).then((result) => {
              results.campaigns = result;
              console.log(
                `[AutoRule] Campaigns: ${result.success} thành công, ${result.failed} thất bại`
              );
            });
          })
      );
    }

    // Process adsets
    if (adset_ids && adset_ids.length > 0) {
      promises.push(
        AdsSet.find({
          _id: { $in: adset_ids },
          deleted_at: null,
        })
          .lean()
          .then((adsets) => {
            console.log(
              `[AutoRule] Tìm thấy ${adsets.length} adset(s) cần xử lý`
            );
            return processEntitiesInParallel(
              adsets,
              updateAdsetStatus,
              "Adset",
              accessToken,
              status
            ).then((result) => {
              results.adsets = result;
              console.log(
                `[AutoRule] Adsets: ${result.success} thành công, ${result.failed} thất bại`
              );
            });
          })
      );
    }

    // Process ads
    if (ad_ids && ad_ids.length > 0) {
      promises.push(
        Ads.find({
          _id: { $in: ad_ids },
          deleted_at: null,
        })
          .lean()
          .then((ads) => {
            console.log(`[AutoRule] Tìm thấy ${ads.length} ad(s) cần xử lý`);
            return processEntitiesInParallel(
              ads,
              updateAdStatus,
              "Ad",
              accessToken,
              status
            ).then((result) => {
              results.ads = result;
              console.log(
                `[AutoRule] Ads: ${result.success} thành công, ${result.failed} thất bại`
              );
            });
          })
      );
    }

    // Chờ tất cả các promises hoàn thành (query DB và xử lý song song)
    await Promise.allSettled(promises);

    // Tổng kết kết quả
    const totalSuccess =
      results.campaigns.success +
      results.adsets.success +
      results.ads.success;
    const totalFailed =
      results.campaigns.failed + results.adsets.failed + results.ads.failed;

    console.log(
      `[AutoRule] Hoàn thành ${actionName}: ${totalSuccess} thành công, ${totalFailed} thất bại`
    );

    return results;
  } catch (error) {
    console.error("[AutoRule] Error executing TURN_ON/OFF:", error);
    throw error;
  }
}

/**
 * Thực thi action SEND_NOTIFICATION
 */
async function executeSendNotification(rule) {
  try {
    // Lấy user email từ subscriber_id hoặc created_by
    const userId = rule.subscriber_id || rule.created_by;
    if (!userId) {
      throw new Error("No user ID found for notification");
    }

    const user = await User.findById(userId).lean();
    if (!user || !user.email) {
      throw new Error("User not found or no email");
    }

    // Lấy thông tin entities
    const { campaign_ids, adset_ids, ad_ids } = rule.apply_to_ids || {};
    const entities = {
      campaigns: [],
      adsets: [],
      ads: [],
    };

    if (campaign_ids && campaign_ids.length > 0) {
      const campaigns = await AdsCampaign.find({
        _id: { $in: campaign_ids },
      })
        .select("name external_id")
        .lean();
      entities.campaigns = campaigns.map((c) => c.name || c.external_id);
    }

    if (adset_ids && adset_ids.length > 0) {
      const adsets = await AdsSet.find({
        _id: { $in: adset_ids },
      })
        .select("name external_id")
        .lean();
      entities.adsets = adsets.map((a) => a.name || a.external_id);
    }

    if (ad_ids && ad_ids.length > 0) {
      const ads = await Ads.find({
        _id: { $in: ad_ids },
      })
        .select("name external_id")
        .lean();
      entities.ads = ads.map((a) => a.name || a.external_id);
    }

    // Gửi email notification
    await sendAutoRuleNotificationEmail(user.email, user.full_name || user.email, {
      ruleName: rule.name,
      conditions: rule.conditions,
      action: rule.action,
      entities,
    });

    return { success: true };
  } catch (error) {
    console.error("Error executing SEND_NOTIFICATION:", error);
    throw error;
  }
}

/**
 * Thực thi action
 */
export async function executeAction(rule, accessToken) {
  try {
    const { action } = rule;

    if (action === "TURN_ON") {
      return await executeTurnOnOff(rule, accessToken, "ACTIVE");
    } else if (action === "TURN_OFF") {
      return await executeTurnOnOff(rule, accessToken, "PAUSED");
    } else if (action === "SEND_NOTIFICATION") {
      return await executeSendNotification(rule);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Error executing action:", error);
    throw error;
  }
}

/**
 * Xử lý một rule (hàm chính)
 */
export async function processRule(rule) {
  let errorMessage = null;

  try {
    // Update last_run_at
    rule.last_run_at = new Date();
    rule.run_count = (rule.run_count || 0) + 1;

    // Lấy access token
    const accessToken = await getAccessTokenForRule(rule);

    // Evaluate conditions
    const conditionsMet = await evaluateConditions(rule);

    if (conditionsMet) {
      // Thực thi action
      await executeAction(rule, accessToken);

      // Update trigger info và set status = TRIGGERED
      rule.last_triggered_at = new Date();
      rule.trigger_count = (rule.trigger_count || 0) + 1;
      rule.status = "TRIGGERED";

      console.log(
        `Rule "${rule.name}" (${rule._id}) triggered. Action: ${rule.action}. Status updated to TRIGGERED.`
      );
    }

    // Tính toán next_run_at
    const nextRunAt = calculateNextRunAt(rule.schedule);
    rule.next_run_at = nextRunAt;

    // Nếu không có next_run_at (ví dụ: CUSTOM schedule không có ngày nào được chọn), disable rule
    if (!nextRunAt && rule.schedule?.type === "CUSTOM") {
      rule.enabled = false;
      console.warn(
        `Rule "${rule.name}" (${rule._id}) disabled: No valid schedule found`
      );
    }

    // Clear error nếu thành công
    rule.last_error = null;
    rule.last_error_at = null;

    // Save rule
    await rule.save();

    return { success: true, triggered: conditionsMet };
  } catch (error) {
    errorMessage = error.message || String(error);
    console.error(`Error processing rule "${rule.name}" (${rule._id}):`, error);

    // Update error info
    rule.last_error = errorMessage;
    rule.last_error_at = new Date();

    // Tính toán next_run_at ngay cả khi có lỗi (để rule vẫn tiếp tục chạy)
    const nextRunAt = calculateNextRunAt(rule.schedule);
    rule.next_run_at = nextRunAt;

    // Save rule với error info
    await rule.save();

    return { success: false, error: errorMessage, triggered: false };
  }
}


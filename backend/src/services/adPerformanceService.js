import AdPerformance from "../models/ads/adPerformance.model.js";
import Ads from "../models/ads/ads.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import axios from "axios";
import mongoose from "mongoose";

const FB_API_VERSION = "v23.0";
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

export const fetchAdInsightsFromFacebook = async (adId, accessToken, datePreset = "last_30d") => {
  try {
    const fields = [
      "campaign_name",
      "adset_name",
      "ad_name",
      "impressions",
      "reach",
      "clicks",
      "spend",
      "frequency",
      "cpc",
      "cpm",
      "ctr",
      "actions",
      "date_start",
      "date_stop"
    ].join(",");

    const response = await axios.get(`${FB_GRAPH_URL}/${adId}/insights`, {
      params: {
        access_token: accessToken,
        fields,
        date_preset: datePreset,
        time_increment: 1
      }
    });

    const insightsData = response.data.data || [];
    if (insightsData.length === 0) {
      console.log(`⚠️ No insights returned from Facebook API for ad ${adId} (date_preset: ${datePreset})`);
    }
    return insightsData;
  } catch (error) {
    if (error.response?.data?.error?.code === 17 || 
        error.response?.data?.error?.error_subcode === 2446079) {
      throw error;
    }
    const errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code;
    console.error(`❌ Error fetching insights for ad ${adId}:`, {
      code: errorCode,
      message: errorMessage,
      datePreset
    });
    return [];
  }
};

export const syncAdPerformanceData = async (accountId = null) => {
  try {
    const accountFilter = accountId ? `for account: ${accountId}` : "(all accounts)";
    console.log(`Starting ad performance sync... ${accountFilter}`);

    const query = { status: { $in: ["ACTIVE", "PAUSED", "DRAFT"] } };
    
    if (accountId) {
      let account;
      
      if (mongoose.Types.ObjectId.isValid(accountId)) {
        account = await AdsAccount.findOne({
          $or: [
            { external_id: accountId },
            { _id: accountId }
          ]
        }).lean();
      } else {
        account = await AdsAccount.findOne({ external_id: accountId }).lean();
      }
      
      if (account) {
        const normalizedAccountId = account.external_id.startsWith("act_") 
          ? account.external_id.substring(4) 
          : account.external_id;
        
        query.$or = [
          { account_id: account._id },
          { external_account_id: account.external_id },
          { external_account_id: normalizedAccountId }
        ];
        console.log(`Filtering ads for account: ${account.name} (${account.external_id})`);
      } else {
        console.log(`Account not found: ${accountId}`);
        return { success: true, synced: 0, skipped: 0 };
      }
    }

    const activeAds = await Ads.find(query)
      .populate({
        path: "account_id",
        populate: {
          path: "shop_admin_id",
          select: "facebookAccessToken email"
        }
      })
      .populate({
        path: "set_id",
        select: "name campaign_id account_id page_name",
        populate: [
          {
            path: "account_id",
            populate: {
              path: "shop_admin_id",
              select: "facebookAccessToken email"
            }
          },
          {
            path: "campaign_id",
            select: "name account_id page_name",
            populate: {
              path: "account_id",
              populate: {
                path: "shop_admin_id",
                select: "facebookAccessToken email"
              }
            }
          }
        ]
      })
      .populate("created_by", "facebookAccessToken email")
      .lean();

    if (!activeAds.length) {
      console.log(`No ads found (ACTIVE/PAUSED/DRAFT) ${accountFilter}`);
      return { success: true, synced: 0, skipped: 0 };
    }

    let syncedCount = 0;
    let skippedCount = 0;
    let rateLimitReached = false;

    for (const ad of activeAds) {
      if (rateLimitReached) {
        console.log(`⏩ Stopping sync due to rate limit, ${skippedCount} ads remaining`);
        break;
      }

      try {
        if (!ad.external_id) {
          console.log(`⏭️ Skipping ad ${ad.name || ad._id}: No external_id (draft)`);
          skippedCount++;
          continue;
        }

        let accountData = ad.account_id;

        if (!accountData && ad.set_id?.account_id) {
          accountData = ad.set_id.account_id;
        }

        if (!accountData && ad.set_id?.campaign_id?.account_id) {
          accountData = ad.set_id.campaign_id.account_id;
        }

        if (!accountData || !accountData._id) {
          if (ad.external_account_id) {
            accountData = await AdsAccount.findOne({ 
              external_id: ad.external_account_id 
            }).populate('shop_admin_id', 'facebookAccessToken email').lean();
          }
        }

        if (!accountData || !accountData._id) {
          console.log(`⏭️ Skipping ad ${ad.external_id} (${ad.name}): Cannot resolve account_id`);
          skippedCount++;
          continue;
        }

        let accessToken = ad.created_by?.facebookAccessToken;
        let tokenSource = ad.created_by?.email || 'created_by';

        if (!accessToken && accountData?.shop_admin_id?.facebookAccessToken) {
          accessToken = accountData.shop_admin_id.facebookAccessToken;
          tokenSource = `shop_admin (${accountData.shop_admin_id.email || 'admin'})`;
        }

        if (!accessToken && ad.set_id?.account_id?.shop_admin_id?.facebookAccessToken) {
          accessToken = ad.set_id.account_id.shop_admin_id.facebookAccessToken;
          tokenSource = `shop_admin via set (${ad.set_id.account_id.shop_admin_id.email || 'admin'})`;
        }

        if (!accessToken) {
          console.log(`⏭️ Skipping ad ${ad.external_id} (${ad.name}): No Facebook access token available`);
          skippedCount++;
          continue;
        }

        console.log(`✅ Using token from ${tokenSource} for ad ${ad.external_id}`);

        const insights = await fetchAdInsightsFromFacebook(
          ad.external_id,
          accessToken,
          "last_7d"
        );

        if (!insights || insights.length === 0) {
          console.log(`⚠️ No insights for ad ${ad.external_id} (${ad.name}), creating zero-value record`);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          await AdPerformance.findOneAndUpdate(
            {
              ads_id: ad._id,
              date: today
            },
            {
              $set: {
                campaign_id: ad.campaign_id || ad.set_id?.campaign_id?._id || null,
                set_id: ad.set_id?._id || null,
                account_id: accountData._id,
                campaign_name: ad.set_id?.campaign_id?.name || "",
                adset_name: ad.set_id?.name || "",
                ad_name: ad.name || "",
                page_name: ad.set_id?.page_name || ad.set_id?.campaign_id?.page_name || "",
                ad_text: ad.ad_text || "",
                age_range: "",
                campaign_objective: ad.campaign_objective || "",
                date: today,
                spend: 0,
                impressions: 0,
                reach: 0,
                clicks: 0,
                results: 0,
                cost_per_result: null,
                delivery: ad.delivery || "",
                frequency: null,
                link_clicks: 0,
                cpc: null,
                cpm: null,
                ctr: null,
                results_roas: null,
                actions: [],
              }
            },
            { upsert: true, new: true }
          );
          
          syncedCount++;
          console.log(`✅ Created zero-value record for ad ${ad.external_id}`);
          continue;
        }

        console.log(`📊 Found ${insights.length} insight records for ad ${ad.external_id}`);

        for (const insight of insights) {
          const actions = insight.actions || [];
          
          const results = actions.find(a => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value || 0;
          const linkClicks = actions.find(a => a.action_type === "link_click")?.value || 0;
          const purchaseRoas = actions.find(a => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value || null;

          await AdPerformance.findOneAndUpdate(
            {
              ads_id: ad._id,
              date: new Date(insight.date_start)
            },
            {
              $set: {
                campaign_id: ad.campaign_id || ad.set_id?.campaign_id?._id || null,
                set_id: ad.set_id?._id || null,
                account_id: accountData._id,
                campaign_name: insight.campaign_name || ad.set_id?.campaign_id?.name || "",
                adset_name: insight.adset_name || ad.set_id?.name || "",
                ad_name: insight.ad_name || ad.name || "",
                page_name: ad.set_id?.page_name || ad.set_id?.campaign_id?.page_name || "",
                ad_text: ad.ad_text || "",
                age_range: insight.age || "",
                campaign_objective: ad.campaign_objective || "",
                date: new Date(insight.date_start),
                spend: parseFloat(insight.spend) || 0,
                impressions: parseInt(insight.impressions) || 0,
                reach: parseInt(insight.reach) || 0,
                clicks: parseInt(insight.clicks) || 0,
                results: parseInt(results),
                cost_per_result: results > 0 ? parseFloat(insight.spend) / parseInt(results) : null,
                delivery: ad.delivery || "",
                frequency: parseFloat(insight.frequency) || null,
                link_clicks: parseInt(linkClicks),
                cpc: parseFloat(insight.cpc) || null,
                cpm: parseFloat(insight.cpm) || null,
                ctr: parseFloat(insight.ctr) || null,
                results_roas: purchaseRoas ? parseFloat(purchaseRoas) : null,
                actions: actions,
              }
            },
            { upsert: true, new: true }
          );

          syncedCount++;
        }
      } catch (error) {
        if (error.response?.data?.error?.code === 17 || 
            error.response?.data?.error?.error_subcode === 2446079) {
          console.warn(`⚠️ Rate limit reached at ad ${ad.external_id}, stopping sync`);
          rateLimitReached = true;
          skippedCount++;
          break;
        }
        console.error(`Error syncing ad ${ad.external_id}:`, error.message);
        skippedCount++;
      }
    }

    const message = rateLimitReached 
      ? `⚠️ Synced ${syncedCount} records, stopped due to rate limit (${skippedCount} skipped)`
      : `✅ Synced ${syncedCount} records, skipped ${skippedCount} ads`;
    
    console.log(message);
    return { success: true, synced: syncedCount, skipped: skippedCount, rateLimitReached };
  } catch (error) {
    console.error("Error in syncAdPerformanceData:", error);
    throw error;
  }
};

export const getAdPerformanceFromDB = async (filters = {}) => {
  try {
    const query = {};

    // 🔹 Convert account_id từ string "act_xxx" sang ObjectId
    if (filters.account_id) {
      // Tìm account theo external_id (account_id từ Facebook)
      const account = await AdsAccount.findOne({ external_id: filters.account_id }).lean();
      if (account) {
        query.account_id = account._id;
      } else {
        // Nếu không tìm thấy account, return empty
        console.log(`Account not found: ${filters.account_id}`);
        return [];
      }
    }
    
    if (filters.campaign_id) {
      if (mongoose.Types.ObjectId.isValid(filters.campaign_id)) {
        query.campaign_id = filters.campaign_id;
      }
    }
    
    if (filters.set_id) {
      if (mongoose.Types.ObjectId.isValid(filters.set_id)) {
        query.set_id = filters.set_id;
      }
    }
    
    if (filters.ads_id) {
      if (mongoose.Types.ObjectId.isValid(filters.ads_id)) {
        query.ads_id = filters.ads_id;
      }
    }
    
    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
    }

    const performances = await AdPerformance.find(query)
      .sort({ date: -1 })
      .lean();

    return performances;
  } catch (error) {
    console.error("Error getting ad performance from DB:", error);
    throw error;
  }
};
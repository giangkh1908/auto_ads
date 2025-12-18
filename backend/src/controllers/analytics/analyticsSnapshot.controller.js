import AdPerformance from "../../models/ads/adPerformance.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import { syncInsightsForAccount } from "../../services/ads/insightsSyncService.js";

/**
 * List analytics data - query from AdPerformance (populated by cron job)
 * Supports pagination for infinite scroll
 */
/**
 * Parse date range string (DD/MM/YYYY - DD/MM/YYYY) to { dateFrom, dateTo } in ISO format
 */
function parseDateRange(dateRange) {
  if (!dateRange || typeof dateRange !== 'string') {
    return { dateFrom: null, dateTo: null };
  }

  const parts = dateRange.split(' - ');
  if (parts.length !== 2) {
    return { dateFrom: null, dateTo: null };
  }

  const parseDate = (dateStr) => {
    // Handle DD/MM/YYYY format
    const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      // Create date in Vietnam timezone (00:00:00)
      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
      return date;
    }
    return null;
  };

  return {
    dateFrom: parseDate(parts[0]),
    dateTo: parseDate(parts[1])
  };
}

/**
 * Normalize date to Vietnam midnight (00:00:00 UTC)
 */
function normalizeToVietnamMidnight(date) {
  if (!date) return null;
  const d = new Date(date);
  const vietnamFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const vietnamDateStr = vietnamFormatter.format(d);
  return new Date(vietnamDateStr + 'T00:00:00.000Z');
}

export async function listAnalyticsSnapshotsCtrl(req, res) {
  try {
    const { account_id, objective, search, date_range, page = 1, limit = 50 } = req.query;

    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Normalize account_id
    const withoutPrefix = account_id.replace(/^act_/, '');
    const withPrefix = account_id.startsWith('act_') ? account_id : `act_${account_id}`;

    // Parse date range if provided (for filtering by ad.created_at)
    let adDateFilter = null; // Will be used after $lookup with ads
    let dateFilter = {}; // For AdPerformance.date (if no date range)
    let queryDate = null;
    
    if (date_range) {
      const { dateFrom, dateTo } = parseDateRange(date_range);
      if (dateFrom && dateTo) {
        // Normalize dates to Vietnam midnight
        const normalizedFrom = normalizeToVietnamMidnight(dateFrom);
        const normalizedTo = normalizeToVietnamMidnight(dateTo);
        
        // Set to end of day for dateTo
        const endOfDay = new Date(normalizedTo);
        endOfDay.setUTCHours(23, 59, 59, 999);
        
        // Store date range for filtering ad.created_at after $lookup
        adDateFilter = {
          dateFrom: normalizedFrom,
          dateTo: endOfDay
        };
        
        // Still need to query latest date from AdPerformance for response
        const latestRecord = await AdPerformance.findOne({
          external_account_id: { $in: [withoutPrefix, withPrefix] }
        }).sort({ date: -1 }).lean();
        
        queryDate = latestRecord?.date || normalizedTo;
        dateFilter = {}; // No filter on AdPerformance.date when filtering by ad.created_at
      }
    }
    
    // If no date range, get latest date from AdPerformance
    if (!adDateFilter) {
      const latestRecord = await AdPerformance.findOne({
        external_account_id: { $in: [withoutPrefix, withPrefix] }
      }).sort({ date: -1 }).lean();

      if (!latestRecord) {
        return res.status(200).json({ items: [], total: 0, hasMore: false });
      }

      queryDate = latestRecord.date;
      dateFilter = { date: queryDate };
    }

    // Build objective filter for MongoDB query
    let objectiveFilter = {};
    if (objective && objective !== "ALL") {
      // Map objective to possible values in DB
      const objectiveValues = [];
      switch (objective) {
        case "OUTCOME_TRAFFIC":
          objectiveValues.push("OUTCOME_TRAFFIC", "LINK_CLICKS");
          break;
        case "OUTCOME_AWARENESS":
          objectiveValues.push("OUTCOME_AWARENESS", "BRAND_AWARENESS", "REACH");
          break;
        case "OUTCOME_ENGAGEMENT":
          objectiveValues.push("OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", "PAGE_LIKES", "EVENT_RESPONSES");
          break;
        case "OUTCOME_LEADS":
          objectiveValues.push("OUTCOME_LEADS", "LEAD_GENERATION", "MESSAGES");
          break;
        case "OUTCOME_SALES":
          objectiveValues.push("OUTCOME_SALES", "CONVERSIONS", "CATALOG_SALES", "STORE_VISITS");
          break;
        case "OUTCOME_APP_PROMOTION":
          objectiveValues.push("OUTCOME_APP_PROMOTION", "APP_INSTALLS");
          break;
        default:
          objectiveValues.push(objective);
      }
      
      // Filter by campaign objective (need to query campaign_id first)
      // For now, we'll filter after populate, but count correctly
      objectiveFilter = { objective: { $in: objectiveValues } };
    }

    // Build base filter
    let filter = { 
      external_account_id: { $in: [withoutPrefix, withPrefix] },
      ...dateFilter, // Use dateFilter (single date or date range)
      // Only get records with actual data
      $or: [
        { spend: { $gt: 0 } },
        { impressions: { $gt: 0 } },
        { clicks: { $gt: 0 } },
        { reach: { $gt: 0 } }
      ]
    };

    // Get accurate total count FIRST (before pagination)
    let totalCount = 0;
    if (objective && objective !== "ALL") {
      // Count with objective filter using aggregation
      const objectiveValues = [];
      switch (objective) {
        case "OUTCOME_TRAFFIC":
          objectiveValues.push("OUTCOME_TRAFFIC", "LINK_CLICKS");
          break;
        case "OUTCOME_AWARENESS":
          objectiveValues.push("OUTCOME_AWARENESS", "BRAND_AWARENESS", "REACH");
          break;
        case "OUTCOME_ENGAGEMENT":
          objectiveValues.push("OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", "PAGE_LIKES", "EVENT_RESPONSES");
          break;
        case "OUTCOME_LEADS":
          objectiveValues.push("OUTCOME_LEADS", "LEAD_GENERATION", "MESSAGES");
          break;
        case "OUTCOME_SALES":
          objectiveValues.push("OUTCOME_SALES", "CONVERSIONS", "CATALOG_SALES", "STORE_VISITS");
          break;
        case "OUTCOME_APP_PROMOTION":
          objectiveValues.push("OUTCOME_APP_PROMOTION", "APP_INSTALLS");
          break;
        default:
          objectiveValues.push(objective);
      }
      
      const countPipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "adscampaigns",
            localField: "campaign_id",
            foreignField: "_id",
            as: "campaign"
          }
        },
        { $unwind: { path: "$campaign", preserveNullAndEmptyArrays: false } },
        { $match: { "campaign.objective": { $in: objectiveValues } } }
      ];
      
      // Add ad.created_at filter if date range is provided
      if (adDateFilter) {
        countPipeline.push(
          {
            $lookup: {
              from: "ads",
              localField: "ads_id",
              foreignField: "_id",
              as: "ad"
            }
          },
          { $unwind: { path: "$ad", preserveNullAndEmptyArrays: false } },
          {
            $match: {
              "ad.created_at": {
                ...(adDateFilter.dateFrom && { $gte: adDateFilter.dateFrom }),
                ...(adDateFilter.dateTo && { $lte: adDateFilter.dateTo })
              }
            }
          }
        );
      }
      
      countPipeline.push({ $count: "total" });
      
      const countResult = await AdPerformance.aggregate(countPipeline);
      totalCount = countResult[0]?.total || 0;
    } else {
      // If no objective filter but has date range, need to filter by ad.created_at
      if (adDateFilter) {
        const countPipeline = [
          { $match: filter },
          {
            $lookup: {
              from: "ads",
              localField: "ads_id",
              foreignField: "_id",
              as: "ad"
            }
          },
          { $unwind: { path: "$ad", preserveNullAndEmptyArrays: false } },
          {
            $match: {
              "ad.created_at": {
                ...(adDateFilter.dateFrom && { $gte: adDateFilter.dateFrom }),
                ...(adDateFilter.dateTo && { $lte: adDateFilter.dateTo })
              }
            }
          },
          { $count: "total" }
        ];
        const countResult = await AdPerformance.aggregate(countPipeline);
        totalCount = countResult[0]?.total || 0;
      } else {
        totalCount = await AdPerformance.countDocuments(filter);
      }
    }

    // Build objective filter values if needed
    let objectiveValues = [];
    if (objective && objective !== "ALL") {
      switch (objective) {
        case "OUTCOME_TRAFFIC":
          objectiveValues = ["OUTCOME_TRAFFIC", "LINK_CLICKS"];
          break;
        case "OUTCOME_AWARENESS":
          objectiveValues = ["OUTCOME_AWARENESS", "BRAND_AWARENESS", "REACH"];
          break;
        case "OUTCOME_ENGAGEMENT":
          objectiveValues = ["OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", "PAGE_LIKES", "EVENT_RESPONSES"];
          break;
        case "OUTCOME_LEADS":
          objectiveValues = ["OUTCOME_LEADS", "LEAD_GENERATION", "MESSAGES"];
          break;
        case "OUTCOME_SALES":
          objectiveValues = ["OUTCOME_SALES", "CONVERSIONS", "CATALOG_SALES", "STORE_VISITS"];
          break;
        case "OUTCOME_APP_PROMOTION":
          objectiveValues = ["OUTCOME_APP_PROMOTION", "APP_INSTALLS"];
          break;
        default:
          objectiveValues = [objective];
      }
    }

    // Use aggregation pipeline to filter and paginate correctly
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "adscampaigns",
          localField: "campaign_id",
          foreignField: "_id",
          as: "campaign"
        }
      },
      { $unwind: { path: "$campaign", preserveNullAndEmptyArrays: objective === "ALL" } },
    ];

    // Add objective filter if needed
    if (objective && objective !== "ALL") {
      pipeline.push({ $match: { "campaign.objective": { $in: objectiveValues } } });
    }

    // Add lookups for ads_id and set_id
    pipeline.push(
      {
        $lookup: {
          from: "ads",
          localField: "ads_id",
          foreignField: "_id",
          as: "ad"
        }
      },
      { $unwind: { path: "$ad", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "adsets",
          localField: "set_id",
          foreignField: "_id",
          as: "adset"
        }
      },
      { $unwind: { path: "$adset", preserveNullAndEmptyArrays: true } }
    );

    // Filter by ad.created_at if date range is provided
    if (adDateFilter) {
      pipeline.push({
        $match: {
          "ad.created_at": {
            ...(adDateFilter.dateFrom && { $gte: adDateFilter.dateFrom }),
            ...(adDateFilter.dateTo && { $lte: adDateFilter.dateTo })
          }
        }
      });
    }

    // Sort and paginate
    pipeline.push(
      { $sort: { spend: -1 } },
      { $skip: skip },
      { $limit: limitNum }
    );

    const performances = await AdPerformance.aggregate(pipeline);

    // Map to analytics format
    const items = performances.map(perf => {
      const ad = perf.ad || {};
      const adset = perf.adset || {};
      const campaign = perf.campaign || {};

      // Get age range from adset targeting
      let ageRange = 'N/A';
      if (adset.targeting) {
        const ageMin = adset.targeting.age_min;
        const ageMax = adset.targeting.age_max;
        if (ageMin !== undefined && ageMax !== undefined) {
          ageRange = `${ageMin}-${ageMax}`;
        } else if (ageMin !== undefined) {
          ageRange = `${ageMin}+`;
        } else if (ageMax !== undefined) {
          ageRange = `≤${ageMax}`;
        }
      }

      // Map campaign objective to standard format
      let campaignObjective = campaign.objective || perf.objective;
      if (campaignObjective === "LINK_CLICKS") campaignObjective = "OUTCOME_TRAFFIC";
      if (campaignObjective === "BRAND_AWARENESS" || campaignObjective === "REACH") campaignObjective = "OUTCOME_AWARENESS";
      if (campaignObjective === "POST_ENGAGEMENT" || campaignObjective === "PAGE_LIKES" || campaignObjective === "EVENT_RESPONSES") campaignObjective = "OUTCOME_ENGAGEMENT";
      if (campaignObjective === "LEAD_GENERATION" || campaignObjective === "MESSAGES") campaignObjective = "OUTCOME_LEADS";
      if (campaignObjective === "CONVERSIONS" || campaignObjective === "CATALOG_SALES" || campaignObjective === "STORE_VISITS") campaignObjective = "OUTCOME_SALES";
      if (campaignObjective === "APP_INSTALLS") campaignObjective = "OUTCOME_APP_PROMOTION";

      return {
        _id: perf._id,
        ad_id: perf.ads_id,
        external_ad_id: perf.external_ad_id,
        ad_name: perf.ad_name || ad.name,
        ad_status: ad.status,
        campaign_name: perf.campaign_name || campaign.name,
        campaign_objective: campaignObjective,
        adset_name: perf.adset_name || adset.name,
        page_name: perf.page_name || 'N/A',
        age_range: ageRange,
        last_synced: perf.createdAt || perf.created_at || latestDate,

        // Core metrics
        spend: perf.spend || 0,
        impressions: perf.impressions || 0,
        clicks: perf.clicks || 0,
        reach: perf.reach || 0,
        frequency: perf.frequency || 0,
        cpm: perf.cpm || 0,
        cpc: perf.cpc || 0,
        ctr: perf.ctr || 0,

        // Traffic metrics
        link_clicks: perf.link_clicks || 0,
        link_cpc: perf.link_cpc || 0,
        link_ctr: perf.link_ctr || 0,

        // Engagement metrics
        post_engagement: perf.post_engagement || 0,
        cost_per_inline_post_engagement: perf.post_engagement > 0 ? (perf.spend || 0) / perf.post_engagement : 0,
        quality_ranking: perf.quality_ranking,

        // Leads metrics
        leads: perf.leads || 0,
        cost_per_lead: perf.cost_per_lead || 0,
        conversions: perf.conversions || 0,
        conversion_rate: perf.conversion_rate || 0,

        // Sales metrics
        website_purchases: perf.website_purchases || 0,
        cost_per_conversion: perf.cost_per_conversion || 0,
        website_purchase_roas: perf.website_purchase_roas || 0,
        cost_per_action: perf.conversions > 0 ? (perf.spend || 0) / perf.conversions : 0,

        // Awareness metrics
        cost_per_result: perf.cost_per_result || 0,

        // App promotion metrics
        mobile_app_install: perf.mobile_app_install || 0,
        cost_per_mobile_app_install: perf.cost_per_mobile_app_install || 0,
      };
    });

    // Filter by search (client-side for now)
    let filteredItems = items;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.ad_name?.toLowerCase().includes(searchLower) ||
        item.campaign_name?.toLowerCase().includes(searchLower) ||
        item.adset_name?.toLowerCase().includes(searchLower)
      );
      // Adjust total count if search filter is applied (approximate)
      // For exact count, would need to query again with search filter
    }

    const hasMore = skip + filteredItems.length < totalCount;

    return res.status(200).json({
      items: filteredItems,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      hasMore,
      dataDate: queryDate, // Latest date in range or latest date overall
      dateRange: date_range || null, // Include date range if provided
    });
  } catch (error) {
    console.error("GET Analytics error:", error);
    return res.status(500).json({
      message: "Error fetching analytics",
      error: error.message,
    });
  }
}

/**
 * Trigger manual sync for an account - uses insights sync from cron job
 */
export async function syncAnalyticsSnapshotsCtrl(req, res) {
  try {
    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ message: "account_id is required" });
    }

    // Find account
    let account;
    const withoutPrefix = account_id.replace(/^act_/, '');
    const withPrefix = account_id.startsWith('act_') ? account_id : `act_${account_id}`;

    if (account_id.match(/^[0-9a-fA-F]{24}$/)) {
      account = await AdsAccount.findById(account_id);
    } else {
      account = await AdsAccount.findOne({ 
        external_id: { $in: [withoutPrefix, withPrefix] }
      });
    }

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Trigger insights sync (same as cron job)
    await syncInsightsForAccount(account._id);

    // Count results
    const latestRecord = await AdPerformance.findOne({
      external_account_id: { $in: [withoutPrefix, withPrefix] }
    }).sort({ date: -1 }).lean();

    const count = latestRecord 
      ? await AdPerformance.countDocuments({
          external_account_id: { $in: [withoutPrefix, withPrefix] },
          date: latestRecord.date
        })
      : 0;

    return res.status(200).json({
      message: "Sync completed",
      synced: count,
      errors: 0,
    });
  } catch (error) {
    console.error("Sync Analytics error:", error);
    
    const fbError = error.response?.data?.error;
    if (fbError?.code === 17 || fbError?.code === 4) {
      return res.status(429).json({
        message: fbError?.error_user_msg || "Rate limit exceeded. Please try again later.",
        synced: 0,
        errors: 1,
        rateLimitReached: true,
        retryAfter: 60,
      });
    }

    return res.status(500).json({
      message: "Error syncing analytics",
      error: error.message,
    });
  }
}

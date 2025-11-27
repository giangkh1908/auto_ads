import axios from "axios";
import AdsAccount from "../models/ads/adsAccount.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";

const FB_API = "https://graph.facebook.com/v23.0";

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? String(accountId).substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

function buildFbAuthParams(accessToken) {
  return { access_token: accessToken };
}

async function findAdsAccountByExternalId(accountId) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(accountId);
  return AdsAccount.findOne({
    external_id: { $in: [withPrefix, withoutPrefix] },
  });
}

async function* fetchPagedEntities(url, accessToken, params = {}) {
  let nextUrl = url;
  let pagingCursor = null;

  while (nextUrl) {
    try {
      const response = await axios.get(nextUrl, {
        params: {
          ...buildFbAuthParams(accessToken),
          limit: 100,
          ...params,
          ...(pagingCursor ? { after: pagingCursor } : {}),
        },
      });

      const data = response.data?.data || [];
      if (!data.length) {
        break;
      }

      yield data;

      await new Promise((resolve) => setTimeout(resolve, 500)); // Increased delay to 500ms to reduce rate limit

      const next = response.data?.paging?.next;
      const cursors = response.data?.paging?.cursors;
      if (next) {
        nextUrl = next;
        pagingCursor = null;
      } else if (cursors?.after) {
        nextUrl = url;
        pagingCursor = cursors.after;
      } else {
        break;
      }
    } catch (err) {
      console.error(`[entitySyncService] Error fetching from ${url}:`, {
        message: err.message,
        status: err.response?.status,
        error: err.response?.data?.error,
      });
      throw err;
    }
  }
}

async function syncCampaignsWithPagination(adsAccount, accessToken) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(adsAccount.external_id);
  const url = `${FB_API}/${withPrefix}/campaigns`;

  const fetchedIds = [];

  for await (const page of fetchPagedEntities(url, accessToken, {
    fields:
      "id,name,status,objective,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time,effective_status",
  })) {
    const bulkOps = [];

    for (const c of page) {
      const data = {
        shop_id: adsAccount.shop_id || null,
        account_id: adsAccount._id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        external_id: c.id,
        external_account_id: withoutPrefix,
        effective_status: c.effective_status,
        special_ad_categories: c.special_ad_categories,
        daily_budget: c.daily_budget,
        lifetime_budget: c.lifetime_budget,
        start_time: c.start_time,
        stop_time: c.stop_time,
      };

      bulkOps.push({
        updateOne: {
          filter: { external_id: c.id },
          update: { $set: data },
          upsert: true,
        },
      });

      fetchedIds.push(c.id);
    }

    if (bulkOps.length > 0) {
      await AdsCampaign.bulkWrite(bulkOps, { ordered: false });
    }
  }

  if (fetchedIds.length > 0) {
    const now = new Date();
    await AdsCampaign.updateMany(
      {
        external_account_id: normalizeAccountPair(adsAccount.external_id).withoutPrefix,
        external_id: { $nin: fetchedIds },
        status: { $nin: ["DELETED", "ARCHIVED"] },
      },
      { $set: { status: "DELETED", deleted_at: now } }
    );
  }
}

async function syncAdSetsWithPagination(adsAccount, accessToken) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(adsAccount.external_id);
  const url = `${FB_API}/${withPrefix}/adsets`;

  const fetchedIds = [];

  for await (const page of fetchPagedEntities(url, accessToken, {
    fields:
      "id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,targeting,start_time,end_time,effective_status",
  })) {
    const campaignExternalIds = [...new Set(page.map((s) => s.campaign_id).filter(Boolean))];
    const campaigns = await AdsCampaign.find({
      external_id: { $in: campaignExternalIds },
    }).select("_id external_id");
    const campaignsMap = new Map(campaigns.map((c) => [c.external_id, c._id]));

    const bulkOps = [];

    for (const s of page) {
      const campaignId = campaignsMap.get(s.campaign_id);
      if (!campaignId) {
        continue;
      }

      const data = {
        name: s.name,
        status: s.status,
        external_id: s.id,
        external_account_id: withoutPrefix,
        campaign_id: campaignId,
        effective_status: s.effective_status,
        daily_budget: s.daily_budget,
        lifetime_budget: s.lifetime_budget,
        targeting: s.targeting,
        start_time: s.start_time,
        end_time: s.end_time,
        optimization_goal: s.optimization_goal,
      };

      bulkOps.push({
        updateOne: {
          filter: { external_id: s.id },
          update: { $set: data },
          upsert: true,
        },
      });

      fetchedIds.push(s.id);
    }

    if (bulkOps.length > 0) {
      await AdsSet.bulkWrite(bulkOps, { ordered: false });
    }
  }

  if (fetchedIds.length > 0) {
    const now = new Date();
    await AdsSet.updateMany(
      {
        external_account_id: normalizeAccountPair(adsAccount.external_id).withoutPrefix,
        external_id: { $nin: fetchedIds },
        status: { $nin: ["DELETED", "ARCHIVED", "FAILED"] },
      },
      { $set: { status: "DELETED", deleted_at: now } }
    );
  }
}

async function syncAdsWithPagination(adsAccount, accessToken) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(adsAccount.external_id);
  const url = `${FB_API}/${withPrefix}/ads`;

  const fetchedIds = [];

  for await (const page of fetchPagedEntities(url, accessToken, {
    fields: "id,name,status,adset_id,creative,effective_status",
  })) {
    const adsetExternalIds = [...new Set(page.map((a) => a.adset_id).filter(Boolean))];
    const adsets = await AdsSet.find({
      external_id: { $in: adsetExternalIds },
    }).select("_id external_id");
    const adsetsMap = new Map(adsets.map((a) => [a.external_id, a._id]));

    const bulkOps = [];

    for (const a of page) {
      const adsetId = adsetsMap.get(a.adset_id);
      if (!adsetId) {
        continue;
      }

      const data = {
        name: a.name,
        status: a.status,
        external_id: a.id,
        external_account_id: withoutPrefix,
        set_id: adsetId,
        effective_status: a.effective_status,
        creative: a.creative,
      };

      bulkOps.push({
        updateOne: {
          filter: { external_id: a.id },
          update: { $set: data },
          upsert: true,
        },
      });

      fetchedIds.push(a.id);
    }

    if (bulkOps.length > 0) {
      await Ads.bulkWrite(bulkOps, { ordered: false });
    }
  }

  if (fetchedIds.length > 0) {
    const now = new Date();
    await Ads.updateMany(
      {
        external_account_id: normalizeAccountPair(adsAccount.external_id).withoutPrefix,
        external_id: { $nin: fetchedIds },
        status: { $nin: ["DELETED", "ARCHIVED"] },
      },
      { $set: { status: "DELETED", deleted_at: now } }
    );
  }
}

export async function syncEntitiesForAccount(accountExternalId, accessToken) {
  const account = await findAdsAccountByExternalId(accountExternalId);
  if (!account) {
    throw new Error("AdsAccount not found");
  }

  if (account.sync_metadata?.entities_status === "syncing") {
    console.log(`⏭️ Skip sync - already syncing for account ${accountExternalId}`);
    return;
  }

  await AdsAccount.updateOne(
    { _id: account._id },
    {
      $set: {
        "sync_metadata.entities_status": "syncing",
        "sync_metadata.entities_error": null,
      },
    }
  );

  const startedAt = new Date();

  try {
    await syncCampaignsWithPagination(account, accessToken);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay to 2 seconds
    
    await syncAdSetsWithPagination(account, accessToken);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay to 2 seconds
    
    await syncAdsWithPagination(account, accessToken);

    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.entities_status": "done",
          "sync_metadata.entities_last_synced_at": startedAt,
        },
      }
    );
  } catch (err) {
    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.entities_status": "failed",
          "sync_metadata.entities_error": err.message || String(err),
        },
      }
    );
    throw err;
  }
}



import pLimit from "p-limit";
import AdsAccount from "../models/ads/adsAccount.model.js";
import Ads from "../models/ads/ads.model.js";
import { fetchAdInsights, saveInsightsToAdPerformance } from "./fbAdsService.js";
import User from "../models/user.model.js";

const BATCH_SIZE = 50;
const CONCURRENCY = 2;

async function getAccessTokenForAccount(account) {
  if (!account?.shop_admin_id) {
    return null;
  }
  const user = await User.findById(account.shop_admin_id).select("+facebookAccessToken");
  return user?.facebookAccessToken || null;
}

export async function syncInsightsForAccount(accountId) {
  const account = await AdsAccount.findById(accountId);
  if (!account) {
    throw new Error("AdsAccount not found");
  }

  if (account.sync_metadata?.insights_status === "syncing") {
    return;
  }

  const accessToken = await getAccessTokenForAccount(account);
  if (!accessToken) {
    throw new Error("Missing Facebook access token for account");
  }

  await AdsAccount.updateOne(
    { _id: account._id },
    {
      $set: {
        "sync_metadata.insights_status": "syncing",
        "sync_metadata.insights_error": null,
      },
    }
  );

  const { withoutPrefix } = (function normalizeAccountPair(accountIdValue) {
    const hasPrefix = String(accountIdValue).startsWith("act_");
    const withPrefix = hasPrefix ? String(accountIdValue) : `act_${accountIdValue}`;
    const withoutPrefixValue = hasPrefix ? String(accountIdValue).substring(4) : String(accountIdValue);
    return { withPrefix, withoutPrefix: withoutPrefixValue };
  })(account.external_id);

  const ads = await Ads.find({
    external_account_id: { $in: [withoutPrefix, `act_${withoutPrefix}`] },
    status: { $in: ["ACTIVE", "PAUSED"] },
  }).select("external_id");

  if (ads.length === 0) {
    console.log(`⏭️ Skip insights sync - no active ads for account ${account.external_id}`);

    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.insights_status": "done",
          "sync_metadata.insights_last_synced_at": new Date(),
        },
      }
    );

    return;
  }

  console.log(`📊 Syncing insights for ${ads.length} active ads`);

  const adIds = ads.map((a) => a.external_id).filter(Boolean);

  const limit = pLimit(CONCURRENCY);
  let hasError = null;

  try {
    const batches = [];
    for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
      batches.push(adIds.slice(i, i + BATCH_SIZE));
    }

    const tasks = batches.map((batch) =>
      limit(async () => {
        const insights = await fetchAdInsights(accessToken, batch);
        if (insights && insights.length > 0) {
          const flattened = insights
            .map((item) => ({
              ad_id: item.id,
              ...(item.insights || {}),
            }))
            .flatMap((entry) => {
              const data = entry.data || [];
              if (!Array.isArray(data) || data.length === 0) {
                return [];
              }
              return data.map((row) => ({
                ...row,
                ad_id: entry.ad_id,
              }));
            });

          if (flattened.length > 0) {
            await saveInsightsToAdPerformance(flattened, account._id.toString());
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      })
    );

    await Promise.all(tasks);

    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.insights_status": "done",
          "sync_metadata.insights_last_synced_at": new Date(),
        },
      }
    );
  } catch (err) {
    hasError = err;
    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.insights_status": "failed",
          "sync_metadata.insights_error": err.message || String(err),
        },
      }
    );
  }

  if (hasError) {
    throw hasError;
  }
}

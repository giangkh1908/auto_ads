import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import Ads from "../models/ads/ads.model.js";
import User from "../models/user.model.js";
import { fetchAdInsights, saveInsightsToAdPerformance } from "../services/fbAdsService.js";

dotenv.config();

const BATCH_SIZE = 20;
const DELAY_MS = 1500;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? String(accountId).substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

async function getAccountAndToken(externalAccountId) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(externalAccountId);

  const account = await AdsAccount.findOne({
    external_id: { $in: [withPrefix, withoutPrefix] },
    status: "ACTIVE",
  }).populate("shop_admin_id", "+facebookAccessToken");

  if (!account) {
    throw new Error(`AdsAccount not found for external_id=${externalAccountId}`);
  }

  const accessToken = account.shop_admin_id?.facebookAccessToken || null;
  if (!accessToken) {
    throw new Error(`Missing Facebook access token for account ${account.external_id}`);
  }

  return { account, accessToken };
}

async function syncInsightsForSingleAccountSafe(externalAccountId) {
  console.log(`\n🚀 Safe insights sync for account ${externalAccountId}`);

  const { account, accessToken } = await getAccountAndToken(externalAccountId);
  const { withoutPrefix } = normalizeAccountPair(account.external_id);

  const ads = await Ads.find({
    external_account_id: { $in: [withoutPrefix, `act_${withoutPrefix}`] },
    status: { $nin: ["DELETED", "ARCHIVED"] },
  }).select("external_id");

  const adIds = ads.map((a) => a.external_id).filter(Boolean);
  console.log(`📊 Ads in DB for account ${account.external_id}: ${adIds.length}`);

  if (!adIds.length) {
    console.log("ℹ️ No ads to sync insights for.");
    return;
  }

  let totalBatches = 0;
  let totalFlattened = 0;
  let totalErrors = 0;

  for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
    const batch = adIds.slice(i, i + BATCH_SIZE);
    totalBatches += 1;

    console.log(
      `\n[Batch ${totalBatches}] Fetching insights for ${batch.length} ads (index ${i} - ${i +
        batch.length - 1})`
    );

    try {
      const insights = await fetchAdInsights(accessToken, batch);

      if (!insights || insights.length === 0) {
        console.log("  ⚠️ No insights returned for this batch.");
        await delay(DELAY_MS);
        continue;
      }

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

      if (flattened.length === 0) {
        console.log("  ℹ️ No per-day rows in this batch after flatten.");
        await delay(DELAY_MS);
        continue;
      }

      totalFlattened += flattened.length;
      console.log(`  ✅ Flattened ${flattened.length} rows, saving to AdPerformance...`);

      await saveInsightsToAdPerformance(flattened, account._id.toString());

      await delay(DELAY_MS);
    } catch (err) {
      totalErrors += 1;
      const fbErr = err?.response?.data?.error;
      if (fbErr?.code === 4) {
        console.error(
          "  ❌ Rate limit reached (code 4). Stopping safe sync for this account. Try again later."
        );
        break;
      }

      console.error("  ❌ Error fetching or saving insights for this batch:", err.message);
      await delay(DELAY_MS);
    }
  }

  console.log("\n📌 Safe sync summary:", {
    account_external_id: account.external_id,
    ads_count: adIds.length,
    batches: totalBatches,
    flattened_rows: totalFlattened,
    batch_errors: totalErrors,
  });
}

async function main() {
  try {
    const externalAccountId = process.argv[2];
    if (!externalAccountId) {
      console.error("Usage: node src/scripts/syncSingleAccountInsightsSafe.js <account_external_id>");
      process.exit(1);
    }

    await connectDB();
    console.log("✅ Connected to database");

    await syncInsightsForSingleAccountSafe(externalAccountId);

    console.log("\n✅ Safe insights sync completed.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error during safe insights sync:", err.message);
    process.exit(1);
  }
}

main();



import cron from "node-cron";
import UserPackage from "../models/package/userPackage.model.js";

const ACTIVE_STATUSES = ["active", "expiring soon", "new signup"];
const RECENTLY_EXPIRED_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SCHEDULE = "0 * * * *"; // Every hour at minute 0

let isRunning = false;

const determineExpiredStatus = (toDate, nowMs) => {
  if (!toDate) return "expired";
  const toDateMs = toDate instanceof Date ? toDate.getTime() : new Date(toDate).getTime();
  const daysSinceExpiry = Math.floor((nowMs - toDateMs) / MS_PER_DAY);
  return daysSinceExpiry <= RECENTLY_EXPIRED_WINDOW_DAYS ? "recently expired" : "expired";
};

const buildBulkOpsForPackages = (packages, now) => {
  const nowMs = now.getTime();
  return packages.map((pkg) => ({
    updateOne: {
      filter: { _id: pkg._id },
      update: {
        $set: {
          status: determineExpiredStatus(pkg.to_date, nowMs),
          updated_at: now,
        },
      },
    },
  }));
};

const markActivePackagesAsExpired = async (now) => {
  const expiringPackages = await UserPackage.find({
    status: { $in: ACTIVE_STATUSES },
    to_date: { $ne: null, $lte: now },
    deleted_at: null,
  }).select("_id to_date");

  if (!expiringPackages.length) return 0;

  const bulkOps = buildBulkOpsForPackages(expiringPackages, now);
  const result = await UserPackage.bulkWrite(bulkOps);
  return result.modifiedCount || 0;
};

const markRecentlyExpiredAsExpired = async (now) => {
  const threshold = new Date(now.getTime() - RECENTLY_EXPIRED_WINDOW_DAYS * MS_PER_DAY);

  const outdatedPackages = await UserPackage.find({
    status: "recently expired",
    to_date: { $ne: null, $lt: threshold },
    deleted_at: null,
  }).select("_id to_date");

  if (!outdatedPackages.length) return 0;

  const bulkOps = outdatedPackages.map((pkg) => ({
    updateOne: {
      filter: { _id: pkg._id },
      update: {
        $set: {
          status: "expired",
          updated_at: now,
        },
      },
    },
  }));

  const result = await UserPackage.bulkWrite(bulkOps);
  return result.modifiedCount || 0;
};

const runUserPackageExpiryCheck = async () => {
  if (isRunning) {
    console.warn("⚠️ User package expiry cron is still running. Skipping this interval.");
    return;
  }

  isRunning = true;
  const now = new Date();
  const startTime = now.toISOString();

  try {
    const [newlyExpired, fullyExpired] = await Promise.all([
      markActivePackagesAsExpired(now),
      markRecentlyExpiredAsExpired(now),
    ]);

    if (newlyExpired || fullyExpired) {
      console.log(
        `📦 [${startTime}] User package expiry cron updated ${newlyExpired} newly expired and ${fullyExpired} fully expired package(s).`
      );
    } else {
      console.log(`📦 [${startTime}] User package expiry cron completed. No packages required updates.`);
    }
  } catch (error) {
    console.error("❌ User package expiry cron failed:", error);
  } finally {
    isRunning = false;
  }
};

export const startUserPackageExpiryCron = (schedule = DEFAULT_SCHEDULE) => {
  cron.schedule(schedule, runUserPackageExpiryCheck);
  console.log(`✅ User package expiry cron started with schedule "${schedule}" (hourly).`);
};



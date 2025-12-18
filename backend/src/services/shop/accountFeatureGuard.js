import { userHasFeature } from "../admin/entitlementService.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";

function resolveOwnerId(account) {
  if (!account?.shop_admin_id) return null;
  const owner = account.shop_admin_id;
  if (typeof owner === "object" && owner._id) {
    return owner._id.toString();
  }
  return owner.toString();
}

export async function getAccountsWithFeature(featureKey) {
  try {
    const accounts = await AdsAccount.find({
      status: "ACTIVE",
    })
      .populate("shop_admin_id", "_id")
      .lean();

    if (accounts.length === 0) {
      return [];
    }

    const ownerFeatureMap = new Map();
    accounts.forEach((account) => {
      const ownerId = resolveOwnerId(account);
      if (ownerId) {
        ownerFeatureMap.set(ownerId, null);
      }
    });

    await Promise.all(
      Array.from(ownerFeatureMap.keys()).map(async (ownerId) => {
        const allowed = await userHasFeature(ownerId, featureKey);
        ownerFeatureMap.set(ownerId, allowed);
      })
    );

    const eligibleAccounts = accounts.filter((account) => {
      const ownerId = resolveOwnerId(account);
      if (!ownerId) return false;
      return ownerFeatureMap.get(ownerId) === true;
    });

    return eligibleAccounts;
  } catch (error) {
    console.error("[Account Feature Guard] Error getting accounts with feature:", error);
    return [];
  }
}

export async function filterAccountsByFeature(accounts = [], featureKey) {
  if (!Array.isArray(accounts) || accounts.length === 0 || !featureKey) {
    return { eligibleAccounts: [], skippedAccounts: accounts.length || 0 };
  }

  const ownerFeatureMap = new Map();
  accounts.forEach((account) => {
    const ownerId = resolveOwnerId(account);
    if (ownerId) {
      ownerFeatureMap.set(ownerId, null);
    }
  });

  await Promise.all(
    Array.from(ownerFeatureMap.keys()).map(async (ownerId) => {
      const allowed = await userHasFeature(ownerId, featureKey);
      ownerFeatureMap.set(ownerId, allowed);
    })
  );

  const eligibleAccounts = [];
  let skippedAccounts = 0;

  accounts.forEach((account) => {
    const ownerId = resolveOwnerId(account);
    if (!ownerId) {
      skippedAccounts++;
      return;
    }
    const allowed = ownerFeatureMap.get(ownerId);
    if (allowed) {
      eligibleAccounts.push(account);
    } else {
      skippedAccounts++;
    }
  });

  return { eligibleAccounts, skippedAccounts };
}



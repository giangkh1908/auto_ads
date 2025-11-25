import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS } from "../constants/app.constants";
import axiosInstance from "../utils/axios.js";
import { useAuth } from "./useAuth";
import { getShopCache } from "../utils/shopCache";

export const useMyPackage = () => {
  const [pkg, setPkg] = useState(null);
  const [userPkg, setUserPkg] = useState(null); // Lưu package gốc của user
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();

  // Convert shop package format sang user package format
  // Sử dụng useCallback để tránh recreate function mỗi lần render
  const convertShopPackageToUserPackageFormat = useCallback((shopPackage, currentUserPkg = null) => {
    if (!shopPackage) return null;

    // Sử dụng currentUserPkg nếu được truyền vào, nếu không thì dùng userPkg từ state
    const userPkgToUse = currentUserPkg || userPkg;

    return {
      package: {
        _id: shopPackage.id,
        name: shopPackage.name,
        features: shopPackage.features || [],
        pages: shopPackage.pages || 0,
        employees: shopPackage.employees || 0,
        shops: shopPackage.shops || 0,
      },
      limits: {
        pages: shopPackage.pages || 0,
        employees: shopPackage.employees || 0,
        shops: shopPackage.shops || 0,
      },
      usage: userPkgToUse?.usage || {
        pages: 0,
        employees: 0,
        shops: 0,
      },
      period: userPkgToUse?.period || {
        from_date: null,
        to_date: null,
      },
      status: "active",
    };
  }, [userPkg]);

  // Fetch user package (package gốc)
  useEffect(() => {
    const fetchUserPackage = async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          setUserPkg(null);
          setPkg(null);
          setError(null);
          setLoading(false);
          return;
        }

        const res = await axiosInstance.get("/api/user-package/me/package", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data;

        if (!data.success) {
          throw new Error(data.message || "Lấy gói thất bại");
        }

        setUserPkg(data.data);
        console.log("Gói người dùng (gốc):", data.data);
      } catch (err) {
        console.error("Lỗi fetch user package:", err);
        setUserPkg(null);
      }
    };

    if (isAuthenticated) {
      fetchUserPackage();
    } else {
      setUserPkg(null);
    }
  }, [isAuthenticated]);

  // Fetch và set package dựa trên shop hiện tại
  useEffect(() => {
    const updatePackageFromShop = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          setPkg(null);
          setLoading(false);
          return;
        }

        // Kiểm tra shop cache trước (chỉ dùng để hiển thị tạm thời)
        const cachedShop = getShopCache();
        if (cachedShop?.package) {
          // Convert shop package sang format giống user package
          const shopPackageData = convertShopPackageToUserPackageFormat(cachedShop.package, userPkg);
          setPkg(shopPackageData);
          setLoading(false);
          console.log("Gói shop (từ cache - tạm thời):", shopPackageData);
          // Vẫn fetch từ API để đảm bảo dữ liệu mới nhất
          // (không return, tiếp tục fetch từ API)
        }

        // Fetch shop package từ API
        try {
          const res = await axiosInstance.get("/api/shops/current/package", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

        const data = res.data;
        if (data.success && data.data?.package) {
          // Sử dụng usage và limits từ API response nếu có
          const shopPackageData = convertShopPackageToUserPackageFormat(data.data.package, userPkg);
          // Override usage và limits từ API nếu có
          if (data.data.usage) {
            shopPackageData.usage = data.data.usage;
          }
          if (data.data.limits) {
            shopPackageData.limits = data.data.limits;
          }
          setPkg(shopPackageData);
          console.log("Gói shop (từ API):", shopPackageData);
        } else {
          // Fallback về user package nếu shop không có package
          setPkg(userPkg);
        }
        } catch (shopErr) {
          console.warn("Không thể lấy shop package, dùng user package:", shopErr);
          // Fallback về user package
          setPkg(userPkg);
        }
      } catch (err) {
        console.error("Lỗi updatePackageFromShop:", err);
        setError(err.message || "Lỗi kết nối");
        // Fallback về user package
        setPkg(userPkg);
      } finally {
        setLoading(false);
      }
    };

    // Chỉ update khi đã authenticated
    if (isAuthenticated) {
      updatePackageFromShop();
    } else {
      setPkg(null);
      setError(null);
      setLoading(false);
    }
  }, [isAuthenticated, userPkg, convertShopPackageToUserPackageFormat]);

  // Lắng nghe sự kiện thay đổi shop
  useEffect(() => {
    const handleShopChange = async (event) => {
      const newShop = event.detail;
      if (!newShop) {
        // Nếu shop bị clear, fallback về user package
        setPkg(userPkg);
        return;
      }

      // Nếu có package trong cache, dùng ngay để hiển thị tức thì
      if (newShop?.package) {
        const shopPackageData = convertShopPackageToUserPackageFormat(newShop.package, userPkg);
        setPkg(shopPackageData);
        console.log("Gói shop (từ cache - tạm thời):", shopPackageData);
      }

      // Sau đó fetch từ API để đảm bảo dữ liệu mới nhất
      // Thêm delay nhỏ để đảm bảo database đã commit
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          setPkg(userPkg);
          return;
        }

        const res = await axiosInstance.get("/api/shops/current/package", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data;
        if (data.success && data.data?.package) {
          const shopPackageData = convertShopPackageToUserPackageFormat(data.data.package, userPkg);
          // Override usage và limits từ API nếu có
          if (data.data.usage) {
            shopPackageData.usage = data.data.usage;
          }
          if (data.data.limits) {
            shopPackageData.limits = data.data.limits;
          }
          setPkg(shopPackageData);
          console.log("Gói shop (từ API - sau khi đổi shop):", shopPackageData);
        } else {
          // Nếu shop không có package, fallback về user package
          setPkg(userPkg);
        }
      } catch (err) {
        console.warn("Lỗi fetch shop package sau khi đổi shop:", err);
        // Fallback về cache nếu có, nếu không thì dùng user package
        if (newShop?.package) {
          const shopPackageData = convertShopPackageToUserPackageFormat(newShop.package, userPkg);
          setPkg(shopPackageData);
        } else {
          setPkg(userPkg);
        }
      }
    };

    window.addEventListener("shopChanged", handleShopChange);
    return () => window.removeEventListener("shopChanged", handleShopChange);
  }, [userPkg, convertShopPackageToUserPackageFormat]);

  const hasFeature = (feature) => {
    return pkg?.package?.features?.includes(feature) || false;
  };

  const canAdd = (type) => {
    if (!pkg) return false; // Không có gói → không được thêm
    const used = pkg.usage[type] || 0;
    const limit = pkg.limits[type] || 0;
    return used < limit;
  };
  const refetch = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      setPkg(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Fetch cả user package và shop package
      const [userRes, shopRes] = await Promise.allSettled([
        axiosInstance.get("/api/user-package/me/package", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axiosInstance.get("/api/shops/current/package", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      // Update user package
      if (userRes.status === "fulfilled" && userRes.value.data.success) {
        setUserPkg(userRes.value.data.data);
      }

      // Update shop package (ưu tiên shop package)
      const updatedUserPkg = userRes.status === "fulfilled" && userRes.value.data.success 
        ? userRes.value.data.data 
        : userPkg;
      
      if (shopRes.status === "fulfilled" && shopRes.value.data.success && shopRes.value.data.data?.package) {
        const shopPackageData = convertShopPackageToUserPackageFormat(shopRes.value.data.data.package, updatedUserPkg);
        setPkg(shopPackageData);
      } else {
        // Fallback về user package
        if (userRes.status === "fulfilled" && userRes.value.data.success) {
          setPkg(userRes.value.data.data);
        }
      }
    } catch (err) {
      console.error("Lỗi refetch package:", err);
      setError(err.message || "Lỗi kết nối");
      // Fallback về user package
      setPkg(userPkg);
    } finally {
      setLoading(false);
    }
  };

  return { pkg, loading, error, hasFeature, canAdd, refetch };
};
import { useState, useEffect } from "react";
import { STORAGE_KEYS } from "../constants/app.constants";
import axiosInstance from "../utils/axios.js";
import { useAuth } from "./useAuth";
import { getShopCache } from "../utils/shopCache";

/**
 * Hook để quản lý package của shop hiện tại
 * Package này được xác định dựa trên shop đang được chọn
 */
export const useShopPackage = () => {
  const [shopPkg, setShopPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchShopPackage = async () => {
      // Reset state khi fetch package
      setShopPkg(null);
      setError(null);
      setLoading(true);

      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          setShopPkg(null);
          setError(null);
          setLoading(false);
          return;
        }

        // Kiểm tra cache trước
        const cachedShop = getShopCache();
        if (cachedShop?.package) {
          setShopPkg({
            package: cachedShop.package,
            shop: {
              id: cachedShop.id,
              shop_name: cachedShop.shop_name,
            },
          });
          setLoading(false);
          // Vẫn fetch từ API để đảm bảo dữ liệu mới nhất
          fetchFromAPI();
          return;
        }

        await fetchFromAPI();
      } catch (err) {
        console.error("Lỗi useShopPackage:", err);
        setError(err.message || "Lỗi kết nối");
        setShopPkg(null);
        setLoading(false);
      }
    };

    const fetchFromAPI = async () => {
      try {
        const res = await axiosInstance.get("/api/shops/current/package", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`,
          },
        });

        const data = res.data;

        if (!data.success) {
          throw new Error(data.message || "Lấy gói shop thất bại");
        }

        setShopPkg(data.data);
        console.log("Gói shop hiện tại:", data.data);
      } catch (err) {
        console.error("Lỗi fetch shop package:", err);
        setError(err.message || "Lỗi kết nối");
        setShopPkg(null);
      } finally {
        setLoading(false);
      }
    };

    // Chỉ fetch khi đã authenticated
    if (isAuthenticated) {
      fetchShopPackage();
    } else {
      setShopPkg(null);
      setError(null);
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Lắng nghe sự kiện thay đổi shop
  useEffect(() => {
    const handleShopChange = async (event) => {
      const newShop = event.detail;
      console.log("useShopPackage - shopChanged event:", newShop);
      
      if (!newShop) {
        setShopPkg(null);
        setLoading(false);
        return;
      }

      // Nếu có package trong cache, dùng ngay để hiển thị tức thì
      if (newShop?.package) {
        setShopPkg({
          package: newShop.package,
          shop: {
            id: newShop.id,
            shop_name: newShop.shop_name,
          },
        });
        setLoading(false);
        console.log("useShopPackage - Using cache package (tạm thời):", newShop.package);
      }

      // Thêm delay nhỏ để đảm bảo database đã commit trước khi fetch từ API
      await new Promise(resolve => setTimeout(resolve, 150));

      // Sau đó fetch từ API để đảm bảo dữ liệu mới nhất
      setLoading(true);
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          setShopPkg(null);
          setLoading(false);
          return;
        }

        const res = await axiosInstance.get("/api/shops/current/package", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data;
        console.log("useShopPackage - API response after shop change:", data);
        
        if (data.success && data.data) {
          setShopPkg(data.data);
          console.log("useShopPackage - Updated shopPkg from API:", data.data);
        } else {
          // Fallback về cache nếu API không trả về data
          if (newShop?.package) {
            setShopPkg({
              package: newShop.package,
              shop: {
                id: newShop.id,
                shop_name: newShop.shop_name,
              },
            });
            console.log("useShopPackage - Using cache package (fallback):", newShop.package);
          } else {
            setShopPkg(null);
          }
        }
      } catch (err) {
        console.error("Lỗi fetch shop package sau khi đổi shop:", err);
        // Fallback về cache nếu có
        if (newShop?.package) {
          setShopPkg({
            package: newShop.package,
            shop: {
              id: newShop.id,
              shop_name: newShop.shop_name,
            },
          });
        } else {
          setShopPkg(null);
        }
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener("shopChanged", handleShopChange);
    return () => window.removeEventListener("shopChanged", handleShopChange);
  }, []);

  const hasFeature = (feature) => {
    if (!shopPkg || !shopPkg.package) {
      return false;
    }
    const features = shopPkg.package.features || [];
    return features.includes(feature);
  };

  const refetch = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      setShopPkg(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await axiosInstance.get("/api/shops/current/package", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data;
      if (!data.success) {
        throw new Error(data.message || "Lấy gói shop thất bại");
      }

      setShopPkg(data.data);
    } catch (err) {
      console.error("Lỗi refetch shop package:", err);
      setError(err.message || "Lỗi kết nối");
      setShopPkg(null);
    } finally {
      setLoading(false);
    }
  };

  return { shopPkg, loading, error, hasFeature, refetch };
};


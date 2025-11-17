import { useState, useEffect } from "react";
import { STORAGE_KEYS } from "../constants/app.constants";
import axiosInstance from "../utils/axios.js";

export const useMyPackage = () => {
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          throw new Error("Không tìm thấy token");
        }

        // Axios trả về res.data (đã parse JSON)
        const res = await axiosInstance.get("/api/user-package/me/package", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // res.data là object từ BE
        const data = res.data;

        if (!data.success) {
          throw new Error(data.message || "Lấy gói thất bại");
        }

        setPkg(data.data);
        console.log("Gói người dùng:", data.data); // In đúng
      } catch (err) {
        console.error("Lỗi useMyPackage:", err);
        setError(err.message || "Lỗi kết nối");
      } finally {
        setLoading(false);
      }
    };

    fetchPackage();
  }, []);

  const hasFeature = (feature) => {
    return pkg?.package?.features?.includes(feature) || false;
  };

  const canAdd = (type) => {
    if (!pkg) return false; // Không có gói → không được thêm
    const used = pkg.usage[type] || 0;
    const limit = pkg.limits[type] || 0;
    return used < limit;
  };
  const refetch = () => {
    setLoading(true);
    setError(null);
    // Gọi lại hàm bên trong useEffect
    const fetchAgain = async () => {
      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const res = await axiosInstance.get("/api/user-package/me/package", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPkg(res.data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAgain();
  };

  return { pkg, loading, error, hasFeature, canAdd, refetch };
};
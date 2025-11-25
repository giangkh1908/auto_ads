import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./CustomerPage.css";
import axiosInstance from "../../../../../utils/axios";
import { API_ENDPOINTS } from "../../../../../config/api.config";
import { X } from "lucide-react";

export default function ViewDetails({ isOpen, onClose, userId }) {
  const { t } = useTranslation("admin");
  const [shopData, setShopData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserShops = async () => {
      if (!isOpen || !userId) {
        // Reset data khi đóng modal
        setShopData([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await axiosInstance.get(API_ENDPOINTS.USERS.SHOPS(userId));
        
        if (response.data.success) {
          setShopData(response.data.data || []);
        } else {
          setError(t("viewShop.messages.errorGeneric"));
        }
      } catch (err) {
        console.error("Error fetching user shops:", err);
        setError(err.response?.data?.message || t("viewShop.messages.error"));
      } finally {
        setLoading(false);
      }
    };

    fetchUserShops();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="amu-shop-details-overlay" onClick={onClose}>
      <div className="amu-shop-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="amu-shop-details-header">
          <h3 className="amu-shop-details-title">{t("viewShop.title")}</h3>
          <button className="amu-shop-details-close-btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="amu-shop-details-body">
          {loading ? (
            <div className="amu-shop-details-loading">{t("viewShop.messages.loading")}</div>
          ) : error ? (
            <div className="amu-shop-details-error">{error}</div>
          ) : shopData.length === 0 ? (
            <div className="amu-shop-details-empty">{t("viewShop.messages.empty")}</div>
          ) : (
            <table className="amu-shop-details-table">
              <thead>
                <tr>
                  <th>{t("viewShop.columns.shopName")}</th>
                  <th>{t("viewShop.columns.role")}</th>
                </tr>
              </thead>
              <tbody>
                {shopData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.shop || item.shop_name || "N/A"}</td>
                    <td>
                      <span className={`amu-shop-details-role-badge ${(item.role || "").toLowerCase()}`}>
                        {item.role || "N/A"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


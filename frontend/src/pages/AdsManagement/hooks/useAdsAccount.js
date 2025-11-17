import { useState, useEffect } from "react";
import axiosInstance from "../../../utils/axios";

const STORAGE_KEY = "selectedAdAccount";

/**
 * Custom hook to manage ad account selection
 * Handles loading/saving from localStorage and fetching accounts
 */
export function useAdsAccount() {
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load selectedAccountId from localStorage when component mounts
  useEffect(() => {
    const savedAccountId = localStorage.getItem(STORAGE_KEY);
    if (savedAccountId) {
      setSelectedAccountId(savedAccountId);
    }
  }, []);

  // Fetch ad accounts
  useEffect(() => {
    const fetchAdAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await axiosInstance.get("/api/ads-accounts", {
          params: { status: 'ACTIVE' }
        });
        
        if (response.data?.items) {
          setAdAccounts(response.data.items);
          
          // Chỉ load tài khoản đã chọn từ localStorage nếu nó tồn tại trong danh sách
          // Không tự động chọn account đầu tiên
          const savedAccountId = localStorage.getItem(STORAGE_KEY);
          if (savedAccountId && !selectedAccountId) {
            // Kiểm tra account có tồn tại trong danh sách không
            const account = response.data.items.find(
              (acc) => acc.external_id === savedAccountId
            );
            if (account) {
              setSelectedAccountId(savedAccountId);
            } else {
              // Nếu account không tồn tại, xóa khỏi localStorage và không chọn gì
              localStorage.removeItem(STORAGE_KEY);
            }
          }
          
          setInitialized(true);
        }
      } catch (error) {
        console.error("Error fetching ad accounts:", error);
      } finally {
        setLoadingAccounts(false);
      }
    };
    
    if (!initialized) {
      fetchAdAccounts();
    }
  }, [initialized, selectedAccountId]);

  const handleAccountChange = (accountId) => {
    setSelectedAccountId(accountId);
    if (accountId) {
      localStorage.setItem(STORAGE_KEY, accountId);
    }
  };

  return {
    adAccounts,
    selectedAccountId,
    loadingAccounts,
    initialized,
    setSelectedAccountId,
    handleAccountChange,
  };
}


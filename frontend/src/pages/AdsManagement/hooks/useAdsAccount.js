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
          
          const savedAccountId = localStorage.getItem(STORAGE_KEY);
          
          if (savedAccountId && !selectedAccountId) {
            // Kiểm tra account đã lưu có tồn tại trong danh sách không
            const account = response.data.items.find(
              (acc) => acc.external_id === savedAccountId
            );
            if (account) {
              setSelectedAccountId(savedAccountId);
            } else {
              // Nếu account không tồn tại, xóa khỏi localStorage
              localStorage.removeItem(STORAGE_KEY);
              // Tự động chọn account đầu tiên nếu có
              if (response.data.items.length > 0) {
                const firstAccount = response.data.items[0];
                setSelectedAccountId(firstAccount.external_id);
                localStorage.setItem(STORAGE_KEY, firstAccount.external_id);
              }
            }
          } else if (!selectedAccountId && response.data.items.length > 0) {
            // Nếu chưa có selection, tự động chọn account đầu tiên
            const firstAccount = response.data.items[0];
            setSelectedAccountId(firstAccount.external_id);
            localStorage.setItem(STORAGE_KEY, firstAccount.external_id);
          } else if (response.data.items.length === 0) {
            // Nếu không có account, clear selection
            setSelectedAccountId("");
            localStorage.removeItem(STORAGE_KEY);
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


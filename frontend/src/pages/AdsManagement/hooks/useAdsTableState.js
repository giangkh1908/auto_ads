import { useState, useEffect, useMemo, useRef } from "react";
import { getFilteredRows } from "../services/adsDataService";

/**
 * Custom hook to manage table state
 * Handles pagination, filtering, sorting, and search
 */
export function useAdsTableState(datasets, activeTab, selectedCampaign, selectedAdset) {
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("");
  
  // Use ref to track previous values to avoid infinite loops
  const prevLimitRef = useRef(pagination.limit);
  const prevActiveTabRef = useRef(activeTab);

  // Get filtered and sorted rows
  const filteredRows = useMemo(() => {
    return getFilteredRows(datasets, activeTab, selectedCampaign, selectedAdset);
  }, [datasets, activeTab, selectedCampaign, selectedAdset]);

  // Update pagination when filtered rows change
  useEffect(() => {
    const total = filteredRows.length;
    const totalPages = Math.ceil(total / pagination.limit) || 1;
    
    setPagination(prev => ({
      ...prev,
      total,
      totalPages,
      // Reset to page 1 if current page is out of bounds
      page: prev.page > totalPages ? 1 : prev.page
    }));
  }, [filteredRows.length, pagination.limit]);

  // Reset page when tab changes
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [activeTab]);

  // Get paginated rows
  const rows = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, pagination.page, pagination.limit]);

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (limit) => {
    prevLimitRef.current = limit;
    setPagination(prev => ({ ...prev, page: 1, limit }));
  };

  return {
    pagination,
    rows,
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    handlePageChange,
    handleItemsPerPageChange,
  };
}


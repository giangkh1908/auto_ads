import { useState, useMemo } from 'react';

/**
 * Custom hook để quản lý logic phân trang
 * @param {Object} options
 * @param {number} options.totalItems - Tổng số items
 * @param {number} options.initialPage - Trang khởi tạo (default: 1)
 * @param {number} options.initialItemsPerPage - Số items mỗi trang (default: 10)
 * @returns {Object} Pagination state và methods
 */
export const usePagination = ({
  totalItems = 0,
  initialPage = 1,
  initialItemsPerPage = 10
}) => {
  // States
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  // Tính toán các giá trị pagination
  const paginationRange = useMemo(() => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Reset về trang 1 nếu trang hiện tại vượt quá tổng số trang
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }

    // Tính start và end index cho items của trang hiện tại
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    return {
      totalPages,
      startIndex,
      endIndex,
      isFirstPage: currentPage === 1,
      isLastPage: currentPage === totalPages || totalPages === 0
    };
  }, [totalItems, itemsPerPage, currentPage]);

  // Actions
  const goToPage = (pageNumber) => {
    const page = Math.max(1, Math.min(pageNumber, paginationRange.totalPages));
    setCurrentPage(page);
  };

  const nextPage = () => {
    if (!paginationRange.isLastPage) {
      goToPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (!paginationRange.isFirstPage) {
      goToPage(currentPage - 1);
    }
  };

  const changeItemsPerPage = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Reset về trang 1 khi đổi size
  };

  return {
    // States
    currentPage,
    itemsPerPage,
    totalItems,
    
    // Computed values
    ...paginationRange,
    
    // Actions
    goToPage,
    nextPage,
    prevPage,
    changeItemsPerPage
  };
};

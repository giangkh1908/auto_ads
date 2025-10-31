import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPaginationRange, getPaginationInfo } from '../../../utils/paginationUtils';
import './Pagination.css';

const PAGE_SIZES = [10, 20, 50, 100];

const Pagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onItemsPerPageChange,
  disabled = false
}) => {
  const paginationRange = getPaginationRange(currentPage, totalPages);
  const paginationInfo = getPaginationInfo(startIndex, endIndex, totalItems);

  return (
    <div className="pagination-container">
      {/* Thông tin phân trang */}
      <div className="pagination-info">
        {paginationInfo}
      </div>

      <div className="pagination-controls">
        {/* Điều khiển phân trang */}
        <div className="pagination-buttons">
          {/* Nút Previous */}
          <button
            className="pagination-button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage === 1}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Các nút số trang */}
          {paginationRange.map((pageNumber, index) => (
            <button
              key={index}
              className={`pagination-button ${
                pageNumber === currentPage ? 'active' : ''
              } ${pageNumber === '...' ? 'dots' : ''}`}
              onClick={() => pageNumber !== '...' && onPageChange(pageNumber)}
              disabled={disabled || pageNumber === '...'}
            >
              {pageNumber}
            </button>
          ))}

          {/* Nút Next */}
          <button
            className="pagination-button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Dropdown chọn số items/trang */}
        <div className="items-per-page">
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            disabled={disabled}
          >
            {PAGE_SIZES.map(size => (
              <option key={size} value={size}>
                {size} mục/trang
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default Pagination;

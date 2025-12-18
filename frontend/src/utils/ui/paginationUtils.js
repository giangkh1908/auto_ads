/**
 * Lấy dữ liệu cho trang hiện tại
 * @param {Array} items - Mảng dữ liệu gốc
 * @param {number} currentPage - Trang hiện tại
 * @param {number} itemsPerPage - Số items mỗi trang
 * @returns {Array} Mảng dữ liệu đã được phân trang
 */
export const getPageData = (items = [], currentPage = 1, itemsPerPage = 10) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, items.length);
  return items.slice(startIndex, endIndex);
};

/**
 * Tạo mảng các số trang để hiển thị, bao gồm ellipsis (...)
 * @param {number} currentPage - Trang hiện tại
 * @param {number} totalPages - Tổng số trang
 * @returns {Array} Mảng các số trang và ellipsis
 */
export const getPaginationRange = (currentPage, totalPages) => {
  const delta = 2; // Số trang hiển thị trước và sau trang hiện tại
  const range = [];
  const rangeWithDots = [];

  // Luôn hiển thị trang 1
  range.push(1);

  // Tính toán range
  for (let i = currentPage - delta; i <= currentPage + delta; i++) {
    if (i > 1 && i < totalPages) {
      range.push(i);
    }
  }

  // Luôn hiển thị trang cuối
  if (totalPages > 1) {
    range.push(totalPages);
  }

  // Thêm dấu ... vào các khoảng trống
  let prev = 0;
  for (const i of range) {
    if (prev) {
      if (i - prev === 2) {
        rangeWithDots.push(prev + 1);
      } else if (i - prev !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    prev = i;
  }

  return rangeWithDots;
};

/**
 * Format text hiển thị thông tin phân trang
 * @param {number} startIndex - Index bắt đầu
 * @param {number} endIndex - Index kết thúc
 * @param {number} totalItems - Tổng số items
 * @returns {string} Text hiển thị
 */
export const getPaginationInfo = (startIndex, endIndex, totalItems) => {
  if (totalItems === 0) return 'Không có dữ liệu';
  return `Hiển thị ${startIndex + 1}-${endIndex} trong ${totalItems} mục`;
};

import { useState, useEffect } from 'react';

/**
 * Custom hook để debounce một giá trị
 * Trả về giá trị sau khi delay ms không có thay đổi
 * 
 * @param {any} value - Giá trị cần debounce
 * @param {number} delay - Thời gian delay (ms), mặc định 500ms
 * @returns {any} - Giá trị đã được debounce
 * 
 * @example
 * const [searchText, setSearchText] = useState('');
 * const debouncedSearch = useDebounce(searchText, 500);
 * 
 * useEffect(() => {
 *   // API call với debouncedSearch
 * }, [debouncedSearch]);
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set timeout để cập nhật debouncedValue sau delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: clear timeout nếu value thay đổi trước khi delay kết thúc
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;

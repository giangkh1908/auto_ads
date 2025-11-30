import { useState, useCallback, useRef } from 'react';
import axiosInstance from '../utils/axios';

/**
 * Hook for searching detailed targeting options (interests, behaviors, demographics)
 * from Facebook Marketing API via backend
 * 
 * @param {Object} options - Hook options
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 300)
 * @param {string[]} options.types - Targeting types to search (default: ['interest', 'behavior', 'demographic'])
 * @returns {Object} { results, loading, error, search, clear }
 */
export function useTargetingSearch(options = {}) {
  const { 
    debounceMs = 300, 
    types = ['interest', 'behavior', 'demographic'] 
  } = options;

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for debouncing
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Search for targeting options
   * @param {string} query - Search query (empty string = get suggestions)
   */
  const search = useCallback((query) => {
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Set loading immediately
    setLoading(true);

    // Use shorter debounce for empty query (instant), longer for search
    const delay = query?.trim() ? debounceMs : 0;

    // Debounce the actual API call
    debounceTimerRef.current = setTimeout(async () => {
      setError(null);

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // If empty query, get suggestions; otherwise search
        const endpoint = query?.trim() 
          ? '/api/targeting/search' 
          : '/api/targeting/suggestions';
        
        const params = query?.trim()
          ? { q: query.trim(), types: types.join(',') }
          : { types: types.join(',') };

        console.log('🔍 Targeting request:', endpoint, params);
        
        const response = await axiosInstance.get(endpoint, {
          params,
          signal: abortControllerRef.current.signal,
        });

        console.log('✅ Targeting response:', response.data);

        if (response.data.success) {
          setResults(response.data.data || []);
        } else {
          setError(response.data.message || 'Failed to search targeting');
          setResults([]);
        }
      } catch (err) {
        // Ignore abort errors
        if (err.name === 'AbortError' || err.name === 'CanceledError') {
          return;
        }
        
        console.error('❌ Targeting error:', err);
        setError(err.response?.data?.message || err.message || 'Failed to search targeting');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);
  }, [types, debounceMs]);

  /**
   * Clear search results
   */
  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setResults([]);
    setLoading(false);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clear,
  };
}

export default useTargetingSearch;


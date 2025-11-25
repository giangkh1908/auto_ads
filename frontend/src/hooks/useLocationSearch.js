import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../utils/axios';

/**
 * Custom hook for searching ad locations from Facebook API
 * @param {string} adAccountId - Facebook Ad Account ID
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @returns {Object} { results, loading, error, search }
 */
export function useLocationSearch(adAccountId, debounceMs = 300) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState(new Map());

  const search = useCallback(
    async (query, types = ['city', 'region']) => {
      if (!query || !query.trim()) {
        setResults([]);
        return;
      }

      if (!adAccountId) {
        setError('Ad Account ID is required');
        setResults([]);
        return;
      }

      // Check cache first
      const cacheKey = `${query.toLowerCase()}_${types.join(',')}`;
      if (cache.has(cacheKey)) {
        setResults(cache.get(cacheKey));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get('/api/location/search', {
          params: {
            q: query,
            types: types.join(','),
            ad_account_id: adAccountId,
          },
        });

        if (response.data.success) {
          const locations = response.data.data || [];
          setResults(locations);

          // Update cache
          setCache((prev) => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, locations);
            // Limit cache size
            if (newCache.size > 100) {
              const firstKey = newCache.keys().next().value;
              newCache.delete(firstKey);
            }
            return newCache;
          });
        } else {
          setError(response.data.message || 'Search failed');
          setResults([]);
        }
      } catch (err) {
        console.error('Location search error:', err);
        setError(err.response?.data?.message || err.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [adAccountId, cache]
  );

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchTypes, setSearchTypes] = useState(['city', 'region']);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedQuery) {
        search(debouncedQuery, searchTypes);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debouncedQuery, searchTypes, debounceMs, search]);

  const debouncedSearch = useCallback((query, types = ['city', 'region']) => {
    setDebouncedQuery(query);
    setSearchTypes(types);
  }, []);

  return {
    results,
    loading,
    error,
    search: debouncedSearch,
    searchImmediate: search,
  };
}

/**
 * Hook to get popular Vietnam locations
 * @returns {Object} { locations, loading, error }
 */
export function usePopularLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const response = await axiosInstance.get('/api/location/popular');
        if (response.data.success) {
          setLocations(response.data.data || []);
        } else {
          setError(response.data.message);
        }
      } catch (err) {
        console.error('Failed to fetch popular locations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPopular();
  }, []);

  return { locations, loading, error };
}

export default useLocationSearch;


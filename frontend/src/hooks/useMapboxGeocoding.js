import { useState, useCallback, useEffect } from 'react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

/**
 * Custom hook for Mapbox Geocoding API
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @returns {Object} { search, results, loading, error }
 */
export function useMapboxGeocoding(debounceMs = 300) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState(new Map());

  const search = useCallback(
    async (query) => {
      if (!query || !query.trim()) {
        setResults([]);
        return;
      }

      if (!MAPBOX_TOKEN) {
        setError('Mapbox access token not configured');
        setResults([]);
        return;
      }

      // Check cache first
      const cacheKey = query.toLowerCase();
      if (cache.has(cacheKey)) {
        setResults(cache.get(cacheKey));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?` +
          `access_token=${MAPBOX_TOKEN}&` +
          `country=vn&` +
          `language=vi&` +
          `limit=10`
        );

        if (!response.ok) {
          throw new Error(`Mapbox API error: ${response.statusText}`);
        }

        const data = await response.json();
        const features = data.features || [];

        const formattedResults = features.map((feature) => {
          const [lng, lat] = feature.center;
          return {
            id: feature.id,
            name: feature.place_name,
            address: feature.place_name,
            coordinates: { lat, lng },
            context: feature.context || [],
          };
        });

        setResults(formattedResults);

        // Update cache
        setCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(cacheKey, formattedResults);
          // Limit cache size
          if (newCache.size > 100) {
            const firstKey = newCache.keys().next().value;
            newCache.delete(firstKey);
          }
          return newCache;
        });
      } catch (err) {
        console.error('Mapbox geocoding error:', err);
        setError(err.message || 'Geocoding failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [cache]
  );

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedQuery) {
        search(debouncedQuery);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debouncedQuery, debounceMs, search]);

  const debouncedSearch = useCallback((query) => {
    setDebouncedQuery(query);
  }, []);

  return {
    results,
    loading,
    error,
    search: debouncedSearch,
    searchImmediate: search,
  };
}

export default useMapboxGeocoding;


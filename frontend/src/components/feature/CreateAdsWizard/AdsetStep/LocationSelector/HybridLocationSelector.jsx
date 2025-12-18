import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, X, Search } from 'lucide-react';
import { useMapboxGeocoding } from '../../../../../hooks/targeting/useMapboxGeocoding';
import MapboxMap from './MapboxMap';
import './HybridLocationSelector.css';

/**
 * HybridLocationSelector - Pin Drop (Mapbox) targeting for location selection
 * @param {Object} value - Current location value (backward compatible with existing structure)
 * @param {Function} onChange - Callback when location changes
 * @param {string} placeholder - Placeholder text
 */
const HybridLocationSelector = ({ value, onChange }) => {
  // Pin drop mode state
  const [pinSelection, setPinSelection] = useState([]);
  const [mapboxSearchQuery, setMapboxSearchQuery] = useState('');
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const nextPinIdRef = useRef(1);

  // Hooks
  const { results: mapboxResults, loading: mapboxLoading, search: searchMapbox } = useMapboxGeocoding();

  // Initialize from existing value (backward compatibility)
  // Only initialize once when value is first provided
  const [isInitialized, setIsInitialized] = useState(false);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (value && !isInitialized && !isInitializingRef.current) {
      isInitializingRef.current = true;

      // Parse existing value structure - only use custom_locations
      const customLocations = value.custom_locations || [];

      // Set pins from custom_locations
      if (customLocations.length > 0) {
        const pins = customLocations.map((loc, index) => ({
          id: `pin-${index + 1}`,
          lat: loc.lat,
          lng: loc.lng,
          radius: loc.radius || 10,
          address: loc.address || `Vị trí ${index + 1}`,
        }));
        setPinSelection(pins);
        nextPinIdRef.current = pins.length + 1;
      }

      setIsInitialized(true);
      isInitializingRef.current = false;
    }
  }, [value, isInitialized]);

  // Helper function to create merged value
  const createMergedValue = useCallback(() => {
    return {
      regions: [],
      cities: [],
      custom_locations: pinSelection.map(p => ({
        lat: p.lat,
        lng: p.lng,
        radius: p.radius,
        address: p.address,
      })),
      excluded_ids: value?.excluded_ids || [],
      _regionNames: {},
    };
  }, [pinSelection, value]);

  // Only call onChange when user makes changes (not during initialization)
  const prevPinSelectionRef = useRef(pinSelection);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevPinSelectionRef.current = pinSelection;
      return;
    }

    // Skip if we're currently initializing from props
    if (isInitializingRef.current) {
      prevPinSelectionRef.current = pinSelection;
      return;
    }

    // Check if pin selection actually changed
    const pinChanged =
      JSON.stringify(prevPinSelectionRef.current) !== JSON.stringify(pinSelection);

    if (pinChanged) {
      prevPinSelectionRef.current = pinSelection;
      const merged = createMergedValue();
      onChange(merged);
    }
  }, [pinSelection, createMergedValue, onChange]);

  // Pin drop mode handlers
  const handleMapboxSearch = (query) => {
    setMapboxSearchQuery(query);
    searchMapbox(query);
  };

  const handleMapboxResultSelect = (result) => {
    // Add pin from search result
    const newPin = {
      id: `pin-${nextPinIdRef.current++}`,
      lat: result.coordinates.lat,
      lng: result.coordinates.lng,
      radius: 10, // Default 10km
      address: result.address,
    };
    setPinSelection(prev => [...prev, newPin]);
    setSelectedSearchResult(result);
    setMapboxSearchQuery('');
  };

  const handlePinAdd = (lat, lng) => {
    const newPin = {
      id: `pin-${nextPinIdRef.current++}`,
      lat,
      lng,
      radius: 10, // Default 10km
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
    setPinSelection(prev => [...prev, newPin]);
  };

  const handlePinRemove = (pinId) => {
    setPinSelection(prev => prev.filter(p => p.id !== pinId));
  };

  const handlePinUpdate = (pinId, updates) => {
    setPinSelection(prev =>
      prev.map(p => p.id === pinId ? { ...p, ...updates } : p)
    );
  };

  const handlePinRadiusChange = (pinId, radius) => {
    const clampedRadius = Math.max(1, Math.min(80, parseInt(radius) || 1));
    setPinSelection(prev =>
      prev.map(p => p.id === pinId ? { ...p, radius: clampedRadius } : p)
    );
  };

  // Calculate total locations
  const totalLocations = pinSelection.length;
  const isNearLimit = totalLocations > 200;
  const isAtLimit = totalLocations >= 250;

  return (
    <div className="hybrid-location-selector">
      {/* Pin Drop Mode */}
      <div className="pin-mode">
        {/* Mapbox Search */}
        <div className="mapbox-search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="mapbox-search-input"
            placeholder="Tìm kiếm địa chỉ..."
            value={mapboxSearchQuery}
            onChange={(e) => handleMapboxSearch(e.target.value)}
          />
          {mapboxLoading && <div className="search-loading">...</div>}
        </div>

        {/* Mapbox Search Results */}
        {mapboxSearchQuery && mapboxResults.length > 0 && (
          <div className="mapbox-suggestions">
            {mapboxResults.map(result => (
              <div
                key={result.id}
                className="mapbox-suggestion-item"
                onClick={() => handleMapboxResultSelect(result)}
              >
                <MapPin size={14} />
                <span>{result.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        <div className="mapbox-map-wrapper">
          <MapboxMap
            pins={pinSelection}
            onPinAdd={handlePinAdd}
            onPinRemove={handlePinRemove}
            onPinUpdate={handlePinUpdate}
            onRadiusChange={handlePinRadiusChange}
            searchResult={selectedSearchResult}
          />
        </div>

        {/* Selected Pins List */}
        {pinSelection.length > 0 && (
          <div className="selected-pins">
            <div className="section-title">Vị trí đã chọn:</div>
            <div className="selected-pins-list">
              {pinSelection.map(pin => (
                <div key={pin.id} className="pin-chip">
                  <MapPin size={14} />
                  <div className="chip-content">
                    <span className="chip-name">{pin.address}</span>
                    <div className="chip-radius">
                      <label>
                        Bán kính:
                        <input
                          type="number"
                          min="1"
                          max="80"
                          value={pin.radius}
                          onChange={(e) => handlePinRadiusChange(pin.id, e.target.value)}
                          className="radius-input"
                        />
                        km
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() => handlePinRemove(pin.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Location Counter */}
      <div className={`location-counter ${isNearLimit ? 'warning' : ''} ${isAtLimit ? 'error' : ''}`}>
        <span>Đã chọn: {totalLocations}/250 vị trí</span>
        {isAtLimit && <span className="limit-text">Đã đạt giới hạn</span>}
      </div>

      {/* Empty State */}
      {totalLocations === 0 && (
        <div className="location-empty-state">
          <MapPin size={32} />
          <p>Chưa có vị trí nào được chọn</p>
          <p className="empty-hint">
            Tìm kiếm địa chỉ hoặc click trên bản đồ để thêm vị trí
          </p>
        </div>
      )}
    </div>
  );
};

export default HybridLocationSelector;


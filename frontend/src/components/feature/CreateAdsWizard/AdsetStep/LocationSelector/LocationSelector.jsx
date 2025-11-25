import { useState, useRef } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useLocationSearch } from '../../../../../hooks/useLocationSearch';
import { useOnClickOutside } from '../../../../../utils/useOnClickOutside';
import './LocationSelector.css';

const LocationSelector = ({ value, onChange, placeholder, adAccountId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  
  const { results, loading, search, error } = useLocationSearch(adAccountId);

  // Close suggestions when clicking outside
  useOnClickOutside(searchRef, () => setShowSuggestions(false));

  // Initialize value structure if undefined
  const currentValue = value || {
    regions: [],
    cities: [],
    custom_locations: [],
    excluded_ids: []
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim()) {
      search(query, ['city', 'region', 'district']);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle location selection from suggestions
  const handleSelectLocation = (location) => {
    const isRegion = location.type === 'region';
    const isCity = location.type === 'city';
    const isDistrict = location.type === 'district'; // Quận/Huyện

    // FIX Error 1487756: Check if already selected (prevent duplicates)
    const alreadySelectedRegion = currentValue.regions?.includes(location.key);
    const alreadySelectedCity = currentValue.cities?.some(c => c.key === location.key);

    if (alreadySelectedRegion || alreadySelectedCity) {
      return; // Already selected, don't add duplicate
    }

    let newValue = { ...currentValue };

    if (isRegion) {
      newValue.regions = [...(currentValue.regions || []), location.key];
      newValue._regionNames = {
        ...(currentValue._regionNames || {}),
        [location.key]: location.name
      };
    } else if (isCity || isDistrict) {
      // Cities and districts are both added to cities array
      // Default radius 20km (will be clamped to 17-80km in backend)
      newValue.cities = [
        ...(currentValue.cities || []),
        { key: location.key, radius: 20, name: location.name }
      ];
    }

    onChange(newValue);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  // Handle remove region
  const handleRemoveRegion = (regionKey) => {
    const newValue = {
      ...currentValue,
      regions: currentValue.regions?.filter(k => k !== regionKey) || []
    };
    if (newValue._regionNames) {
      delete newValue._regionNames[regionKey];
    }
    onChange(newValue);
  };

  // Handle remove city
  const handleRemoveCity = (cityKey) => {
    const newValue = {
      ...currentValue,
      cities: currentValue.cities?.filter(c => c.key !== cityKey) || []
    };
    onChange(newValue);
  };

  // Handle radius change for city (enforced 17-80km range)
  const handleRadiusChange = (cityKey, radius) => {
    const parsedRadius = parseInt(radius) || 20;
    // UI-level clamping (backend will also clamp for safety)
    const clampedRadius = Math.max(17, Math.min(80, parsedRadius));
    
    const newValue = {
      ...currentValue,
      cities: currentValue.cities?.map(c => 
        c.key === cityKey ? { ...c, radius: clampedRadius } : c
      ) || []
    };
    onChange(newValue);
  };

  // Calculate total locations
  const totalLocations = (currentValue.regions?.length || 0) + (currentValue.cities?.length || 0);
  const isNearLimit = totalLocations > 200;
  const isAtLimit = totalLocations >= 250;

  return (
    <div className="location-selector">
      {/* Search Box */}
      <div className="location-search-wrapper" ref={searchRef}>
        <div className="location-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="location-search-input"
            placeholder={placeholder || "Tìm kiếm thành phố, tỉnh thành..."}
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchQuery && setShowSuggestions(true)}
            disabled={isAtLimit}
          />
          {loading && <div className="search-loading">...</div>}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div className="location-suggestions">
            {results.length > 0 ? (
              <>
                {results.map((location) => {
                  const isSelected = 
                    currentValue.regions?.includes(location.key) ||
                    currentValue.cities?.some(c => c.key === location.key);

                  return (
                    <div
                      key={location.key}
                      className={`location-suggestion-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => !isSelected && handleSelectLocation(location)}
                    >
                      <MapPin size={14} />
                      <span className="location-name">{location.name}</span>
                      <span className="location-type">
                        {location.type === 'city' ? 'Thành phố' : 
                         location.type === 'district' ? 'Quận/Huyện' : 
                         'Tỉnh/Vùng'}
                      </span>
                      {isSelected && <span className="selected-badge">✓</span>}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="location-no-results">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        )}
      </div>

      {/* Location Counter */}
      <div className={`location-counter ${isNearLimit ? 'warning' : ''} ${isAtLimit ? 'error' : ''}`}>
        <span>Đã chọn: {totalLocations}/250 vị trí</span>
        {isAtLimit && <span className="limit-text">Đã đạt giới hạn</span>}
      </div>

      {/* Selected Regions */}
      {currentValue.regions && currentValue.regions.length > 0 && (
        <div className="selected-locations-section">
          <div className="section-title">Tỉnh/Vùng đã chọn:</div>
          <div className="selected-locations-list">
            {currentValue.regions.map((regionKey) => (
              <div key={regionKey} className="location-chip region-chip">
                <MapPin size={14} />
                <span className="chip-name">
                  {currentValue._regionNames?.[regionKey] || regionKey}
                </span>
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => handleRemoveRegion(regionKey)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Cities with Radius Control */}
      {currentValue.cities && currentValue.cities.length > 0 && (
        <div className="selected-locations-section">
          <div className="section-title">Thành phố đã chọn:</div>
          <div className="selected-locations-list">
            {currentValue.cities.map((city) => (
              <div key={city.key} className="location-chip city-chip">
                <MapPin size={14} />
                <div className="chip-content">
                  <span className="chip-name">{city.name || city.key}</span>
                  <div className="chip-radius">
                    <label>
                      Bán kính:
                      <input
                        type="number"
                        min="17"
                        max="80"
                        value={city.radius || 20}
                        onChange={(e) => handleRadiusChange(city.key, e.target.value)}
                        className="radius-input"
                      />
                      km (17-80)
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => handleRemoveCity(city.key)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="location-error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {totalLocations === 0 && !error && (
        <div className="location-empty-state">
          <MapPin size={32} />
          <p>Chưa có vị trí nào được chọn</p>
          <p className="empty-hint">Sử dụng ô tìm kiếm phía trên để thêm vị trí</p>
          {!adAccountId && (
            <p className="empty-hint error-text">⚠️ Vui lòng chọn Ads Account trước</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSelector;


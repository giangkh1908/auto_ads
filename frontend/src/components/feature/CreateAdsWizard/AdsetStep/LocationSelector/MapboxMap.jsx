import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import { circle } from '@turf/turf';
import { MapPin, X } from 'lucide-react';
import './MapboxMap.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

/**
 * MapboxMap component for pin drop targeting
 * @param {Array} pins - Array of {id, lat, lng, radius, address}
 * @param {Function} onPinAdd - Callback when pin is added (lat, lng)
 * @param {Function} onPinRemove - Callback when pin is removed (id)
 * @param {Function} onPinUpdate - Callback when pin is updated (id, updates)
 * @param {Function} onRadiusChange - Callback when radius changes (id, radius)
 * @param {Object} searchResult - Selected search result from geocoding
 */
const MapboxMap = ({
  pins = [],
  onPinAdd,
  onPinRemove,
  onPinUpdate,
  onRadiusChange,
  searchResult = null,
}) => {
  const [viewState, setViewState] = useState({
    longitude: 108.2772, // Center of Vietnam
    latitude: 14.0583,
    zoom: 6,
  });
  const [selectedPinId, setSelectedPinId] = useState(null);
  const mapRef = useRef(null);

  // Center map on search result
  useEffect(() => {
    if (searchResult && searchResult.coordinates) {
      setViewState({
        longitude: searchResult.coordinates.lng,
        latitude: searchResult.coordinates.lat,
        zoom: 13,
      });
    }
  }, [searchResult]);

  // Handle map click to add pin
  const handleMapClick = useCallback((event) => {
    // Prevent adding pin when clicking on UI elements
    const target = event.originalEvent?.target;
    if (!target) return;

    if (target.closest('.mapboxgl-popup') || 
        target.closest('.mapboxgl-marker') ||
        target.closest('.mapbox-pin-info')) {
      return; // Don't add pin if clicking on popup, marker, or info panel
    }

    const { lng, lat } = event.lngLat;
    if (onPinAdd && lng && lat) {
      onPinAdd(lat, lng);
    }
  }, [onPinAdd]);

  // Generate circle GeoJSON for each pin
  const generateCircleGeoJson = useCallback((pin) => {
    if (!pin.lat || !pin.lng || !pin.radius) return null;

    const center = [pin.lng, pin.lat];
    const radius = pin.radius; // in kilometers
    const steps = 64; // Circle smoothness

    return circle(center, radius, { steps, units: 'kilometers' });
  }, []);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback((pinId, event) => {
    const { lng, lat } = event.lngLat;
    if (onPinUpdate) {
      onPinUpdate(pinId, { lat, lng });
    }
  }, [onPinUpdate]);

  // Debug: Log token status
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      console.warn('⚠️ Mapbox access token not found. Please set VITE_MAPBOX_ACCESS_TOKEN in your .env file');
    }
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="mapbox-map-error">
        <p>⚠️ Mapbox access token not configured</p>
        <p>Please set VITE_MAPBOX_ACCESS_TOKEN in your .env file</p>
        <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>
          Current token: {MAPBOX_TOKEN ? 'Set' : 'Not set'}
        </p>
      </div>
    );
  }

  return (
    <div className="mapbox-map-container">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        reuseMaps={true}
      >
        {/* Render circles for each pin */}
        {pins.map((pin) => {
          const circleGeoJson = generateCircleGeoJson(pin);
          if (!circleGeoJson) return null;

          return (
            <Source key={`circle-${pin.id}`} type="geojson" data={circleGeoJson}>
              <Layer
                id={`circle-fill-${pin.id}`}
                type="fill"
                paint={{
                  'fill-color': '#3b82f6',
                  'fill-opacity': 0.2,
                }}
              />
              <Layer
                id={`circle-stroke-${pin.id}`}
                type="line"
                paint={{
                  'line-color': '#3b82f6',
                  'line-width': 2,
                  'line-opacity': 0.8,
                }}
              />
            </Source>
          );
        })}

        {/* Render markers for each pin */}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            longitude={pin.lng}
            latitude={pin.lat}
            anchor="bottom"
            draggable
            onDragEnd={(event) => handleMarkerDragEnd(pin.id, event)}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedPinId(pin.id);
            }}
          >
            <div className={`mapbox-marker ${selectedPinId === pin.id ? 'selected' : ''}`}>
              <MapPin size={24} fill="#ef4444" color="#ffffff" />
            </div>
          </Marker>
        ))}

        {/* Render search result marker if provided */}
        {searchResult && searchResult.coordinates && !pins.find(p => p.id === 'search-result') && (
          <Marker
            longitude={searchResult.coordinates.lng}
            latitude={searchResult.coordinates.lat}
            anchor="bottom"
          >
            <div className="mapbox-marker search-result">
              <MapPin size={24} fill="#10b981" color="#ffffff" />
            </div>
          </Marker>
        )}
      </Map>

      {/* Pin info panel */}
      {selectedPinId && (
        <div className="mapbox-pin-info">
          {(() => {
            const pin = pins.find(p => p.id === selectedPinId);
            if (!pin) return null;

            return (
              <>
                <div className="pin-info-header">
                  <h4>{pin.address || `Pin ${pin.id}`}</h4>
                  <button
                    type="button"
                    className="pin-info-close"
                    onClick={() => setSelectedPinId(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="pin-info-content">
                  <div className="pin-coordinates">
                    <span>Lat: {pin.lat.toFixed(6)}</span>
                    <span>Lng: {pin.lng.toFixed(6)}</span>
                  </div>
                  <div className="pin-radius-control">
                    <label>
                      Bán kính (km):
                      <input
                        type="range"
                        min="1"
                        max="80"
                        value={pin.radius || 10}
                        onChange={(e) => {
                          const newRadius = parseInt(e.target.value);
                          if (onRadiusChange) {
                            onRadiusChange(pin.id, newRadius);
                          }
                        }}
                      />
                      <span className="radius-value">{pin.radius || 10} km</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="pin-remove-btn"
                    onClick={() => {
                      if (onPinRemove) {
                        onPinRemove(pin.id);
                      }
                      setSelectedPinId(null);
                    }}
                  >
                    Xóa pin
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default MapboxMap;


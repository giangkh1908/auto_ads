import { useState, useRef, useCallback, useMemo } from 'react';
import { Search, X, Users, Heart, ShoppingBag, Briefcase, GraduationCap, Star } from 'lucide-react';
import { useTargetingSearch } from '../../../../../hooks/useTargetingSearch';
import { useOnClickOutside } from '../../../../../utils/useOnClickOutside';
import './DetailedTargetingSelector.css';

/**
 * Format audience size for display
 * @param {number} size - Audience size
 * @returns {string} Formatted size (e.g., "1.2M", "500K")
 */
function formatAudienceSize(size) {
  if (!size || size === 0) return '';
  if (size >= 1000000000) {
    return `${(size / 1000000000).toFixed(1)}B`;
  }
  if (size >= 1000000) {
    return `${(size / 1000000).toFixed(1)}M`;
  }
  if (size >= 1000) {
    return `${(size / 1000).toFixed(0)}K`;
  }
  return size.toString();
}

/**
 * Get icon for targeting type
 * @param {string} type - Targeting type
 * @returns {JSX.Element} Icon component
 */
function getTypeIcon(type) {
  switch (type) {
    case 'interest':
      return <Heart size={14} />;
    case 'behavior':
      return <ShoppingBag size={14} />;
    case 'life_event':
      return <Star size={14} />;
    case 'family_status':
      return <Users size={14} />;
    case 'work':
    case 'employer':
    case 'job_title':
      return <Briefcase size={14} />;
    case 'education':
    case 'school':
      return <GraduationCap size={14} />;
    default:
      return <Heart size={14} />;
  }
}

/**
 * Get display label for targeting type
 * @param {string} type - Targeting type
 * @returns {string} Display label
 */
function getTypeLabel(type) {
  const labels = {
    interest: 'Sở thích',
    behavior: 'Hành vi',
    life_event: 'Sự kiện cuộc sống',
    family_status: 'Tình trạng gia đình',
    work: 'Công việc',
    employer: 'Nhà tuyển dụng',
    job_title: 'Chức danh',
    education: 'Học vấn',
    school: 'Trường học',
    demographic: 'Nhân khẩu học',
  };
  return labels[type] || type;
}

/**
 * DetailedTargetingSelector Component
 * Allows users to search and select interests, behaviors, and demographics
 * for Facebook ad targeting
 * 
 * @param {Object} props
 * @param {Array} props.value - Currently selected targeting items
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Input placeholder text
 */
const DetailedTargetingSelector = ({ 
  value = [], 
  onChange, 
  placeholder = "Tìm kiếm sở thích, hành vi, nhân khẩu học..." 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  // Use targeting search hook
  const { results, loading, error, search, clear } = useTargetingSearch({
    debounceMs: 300,
    types: ['interest', 'behavior', 'demographic'],
  });

  // Filter results to only show items that match the search query (client-side filtering)
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim() || results.length === 0) {
      return results;
    }
    
    const queryLower = searchQuery.trim().toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);
    
    return results.filter(item => {
      const nameLower = (item.name || '').toLowerCase();
      // Check if name contains all query words (fuzzy match)
      return queryWords.every(word => nameLower.includes(word));
    });
  }, [results, searchQuery]);

  // Close suggestions when clicking outside
  useOnClickOutside(searchRef, () => {
    setShowSuggestions(false);
  });

  // Load initial suggestions when component mounts or on first focus
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Ensure value is always an array
  const selectedItems = useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  // Check if an item is already selected
  const isSelected = useCallback((item) => {
    return selectedItems.some(selected => selected.id === item.id);
  }, [selectedItems]);

  // Handle input focus - load initial suggestions
  const handleFocus = () => {
    setShowSuggestions(true);
    // Load initial suggestions if not loaded yet or no search query
    if (!hasLoadedInitial && !searchQuery.trim()) {
      search(''); // Search with empty string to get popular suggestions
      setHasLoadedInitial(true);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSuggestions(true);
    
    // Always search - empty query will get default suggestions
    search(query || '');
  };

  // Handle selecting an item from suggestions
  const handleSelectItem = (item) => {
    // Don't add if already selected
    if (isSelected(item)) {
      return;
    }

    // Add item to selection
    const newValue = [
      ...selectedItems,
      {
        id: item.id,
        name: item.name,
        type: item.type,
        audience_size: item.audience_size,
      },
    ];

    onChange(newValue);
    setSearchQuery('');
    clear();
    setShowSuggestions(false);
  };

  // Handle removing an item
  const handleRemoveItem = (itemId) => {
    const newValue = selectedItems.filter(item => item.id !== itemId);
    onChange(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      clear();
    }
  };

  // Group selected items by type for display
  const groupedItems = useMemo(() => {
    const groups = {};
    selectedItems.forEach(item => {
      const type = item.type || 'interest';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
    });
    return groups;
  }, [selectedItems]);

  return (
    <div className="detailed-targeting-selector">
      {/* Search Input */}
      <div className="targeting-search-wrapper" ref={searchRef}>
        <div className="targeting-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="targeting-search-input"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
          />
          {loading && <div className="search-loading-spinner" />}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div className="targeting-suggestions">
            {error && (
              <div className="targeting-error">
                {error}
              </div>
            )}
            
            {filteredResults.length > 0 ? (
              <>
                {filteredResults.map((item) => {
                  const selected = isSelected(item);
                  return (
                    <div
                      key={item.id}
                      className={`targeting-suggestion-item ${selected ? 'selected' : ''}`}
                      onClick={() => !selected && handleSelectItem(item)}
                    >
                      <div className="suggestion-icon">
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="suggestion-content">
                        <span className="suggestion-name">{item.name}</span>
                        <span className="suggestion-meta">
                          <span className="suggestion-type">{getTypeLabel(item.type)}</span>
                          {item.audience_size > 0 && (
                            <span className="suggestion-audience">
                              <Users size={12} />
                              {formatAudienceSize(item.audience_size)}
                            </span>
                          )}
                        </span>
                      </div>
                      {selected && <span className="selected-badge">✓</span>}
                    </div>
                  );
                })}
              </>
            ) : !loading && searchQuery.trim() ? (
              <div className="targeting-no-results">
                Không tìm thấy kết quả cho "{searchQuery}"
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="targeting-selected">
          {Object.entries(groupedItems).map(([type, items]) => (
            <div key={type} className="targeting-group">
              <div className="targeting-group-label">
                {getTypeIcon(type)}
                <span>{getTypeLabel(type)}</span>
              </div>
              <div className="targeting-tags">
                {items.map((item) => (
                  <span key={item.id} className={`targeting-tag targeting-tag-${item.type}`}>
                    <span className="tag-name">{item.name}</span>
                    {item.audience_size > 0 && (
                      <span className="tag-audience">
                        {formatAudienceSize(item.audience_size)}
                      </span>
                    )}
                    <button
                      type="button"
                      className="tag-remove-btn"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {selectedItems.length > 0 && (
        <div className="targeting-summary">
          <span className="summary-count">
            {selectedItems.length} mục tiêu đã chọn
          </span>
          <button
            type="button"
            className="clear-all-btn"
            onClick={() => onChange([])}
          >
            Xóa tất cả
          </button>
        </div>
      )}
    </div>
  );
};

export default DetailedTargetingSelector;


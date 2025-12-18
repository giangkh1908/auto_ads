/**
 * Utility functions for handling selection (select all and individual selection)
 */

/**
 * Handle select all functionality
 * @param {boolean} isChecked - Whether the select all checkbox is checked
 * @param {Array} items - Array of items to select/deselect
 * @param {string} idField - Field name for the id (default: 'id')
 * @param {string} checkedField - Field name for the checked state (default: 'isChecked')
 * @returns {Array} Updated items array with all items checked/unchecked
 */
export const handleSelectAll = (isChecked, items, checkedField = 'isChecked') => {
  return items.map(item => ({
    ...item,
    [checkedField]: isChecked
  }))
}

/**
 * Handle individual item selection
 * @param {number|string} itemId - ID of the item to toggle
 * @param {Array} items - Array of items
 * @param {string} idField - Field name for the id (default: 'id')
 * @param {string} checkedField - Field name for the checked state (default: 'isChecked')
 * @returns {Object} Object containing updated items and whether all items are selected
 */
export const handleSelectItem = (itemId, items, idField = 'id', checkedField = 'isChecked') => {
  const updatedItems = items.map(item => 
    item[idField] === itemId 
      ? { ...item, [checkedField]: !item[checkedField] } 
      : item
  )
  
  const allChecked = updatedItems.every(item => item[checkedField])
  
  return {
    updatedItems,
    allChecked
  }
}

/**
 * Handle selection with filter condition (for ConnectPage)
 * @param {boolean} isChecked - Whether the select all checkbox is checked
 * @param {Array} items - Array of items to select/deselect
 * @param {Function} filterFn - Function to filter selectable items
 * @param {string} idField - Field name for the id (default: 'id')
 * @param {string} checkedField - Field name for the checked state (default: 'isChecked')
 * @returns {Object} Object containing updated items and selected IDs
 */
export const handleSelectAllWithFilter = (isChecked, items, filterFn, idField = 'id', checkedField = 'isChecked') => {
  const selectableItems = items.filter(filterFn)
  const selectableIds = selectableItems.map(item => item[idField])
  
  if (isChecked) {
    // Select all selectable items
    return {
      updatedItems: items.map(item => ({
        ...item,
        [checkedField]: selectableIds.includes(item[idField])
      })),
      selectedIds: selectableIds
    }
  } else {
    // Deselect all items
    return {
      updatedItems: items.map(item => ({
        ...item,
        [checkedField]: false
      })),
      selectedIds: []
    }
  }
}

/**
 * Handle individual selection with filter condition
 * @param {number|string} itemId - ID of the item to toggle
 * @param {Array} items - Array of items
 * @param {Function} filterFn - Function to filter selectable items
 * @param {string} idField - Field name for the id (default: 'id')
 * @param {string} checkedField - Field name for the checked state (default: 'isChecked')
 * @returns {Object} Object containing updated items, selected IDs, and whether all selectable items are selected
 */
export const handleSelectItemWithFilter = (itemId, items, filterFn, idField = 'id', checkedField = 'isChecked') => {
  const updatedItems = items.map(item => 
    item[idField] === itemId 
      ? { ...item, [checkedField]: !item[checkedField] } 
      : item
  )
  
  const selectableItems = updatedItems.filter(filterFn)
  const selectedIds = updatedItems.filter(item => item[checkedField]).map(item => item[idField])
  const allSelectableChecked = selectableItems.every(item => item[checkedField])
  
  return {
    updatedItems,
    selectedIds,
    allSelectableChecked
  }
}

/**
 * Get selected items from an array
 * @param {Array} items - Array of items
 * @param {string} checkedField - Field name for the checked state (default: 'isChecked')
 * @returns {Array} Array of selected items
 */
export const getSelectedItems = (items, checkedField = 'isChecked') => {
  return items.filter(item => item[checkedField])
}

/**
 * Get selected item IDs from an array
 * @param {Array} items - Array of items
 * @param {string} idField - Field name for the id (default: 'id')
 * @param {string} checkedField - Field name for the checked state (default: 'isChecked')
 * @returns {Array} Array of selected item IDs
 */
export const getSelectedIds = (items, idField = 'id', checkedField = 'isChecked') => {
  return items.filter(item => item[checkedField]).map(item => item[idField])
}

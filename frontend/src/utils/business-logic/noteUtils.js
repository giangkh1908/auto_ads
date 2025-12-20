import axiosInstance from "../api/axios";
import { API_ENDPOINTS } from "../../config/api.config";

/**
 * Lấy ID từ entity (xử lý cả _id và id)
 * @param {Object} entity - Entity object
 * @returns {string|null} - ID dưới dạng string hoặc null
 */
export const getEntityId = (entity) => {
  if (!entity) return null;

  // Ưu tiên _id (MongoDB ObjectId)
  if (entity._id) {
    return entity._id.toString ? entity._id.toString() : String(entity._id);
  }

  // Fallback sang id
  if (entity.id) {
    return entity.id.toString ? entity.id.toString() : String(entity.id);
  }

  return null;
};

/**
 * Tạo key để match note với entity
 * Format: "targetType_targetId"
 * @param {string} targetType - Loại entity (User, PaymentTransaction, etc.)
 * @param {string} targetId - ID của entity
 * @returns {string|null} - Key hoặc null nếu thiếu thông tin
 */
export const createNoteKey = (targetType, targetId) => {
  if (!targetType || !targetId) return null;

  const idString = targetId.toString ? targetId.toString() : String(targetId);
  return `${targetType}_${idString}`;
};

/**
 * Chuẩn bị items để query notes (batch)
 * @param {Array} entities - Mảng các entities
 * @param {string} targetType - Loại entity
 * @returns {Array} - Mảng items để query
 */
export const prepareNoteItems = (entities, targetType) => {
  return entities
    .map((entity) => {
      const entityId = getEntityId(entity);
      if (!entityId) return null;

      return {
        target_type: targetType,
        target_id: entityId,
      };
    })
    .filter((item) => item !== null);
};

/**
 * Tạo Map từ response notes để lookup nhanh
 * @param {Object} notesResponse - Response từ API batch
 * @returns {Map} - Map với key là `${target_type}_${target_id}`, value là note object
 */
export const createNotesMap = (notesResponse) => {
  const notesMap = new Map();

  if (!notesResponse?.data?.data) return notesMap;

  notesResponse.data.data.forEach((item) => {
    const key = createNoteKey(item.target_type, item.target_id);
    if (key) {
      // item.note có thể là note object hoặc null
      notesMap.set(key, item.note);
    }
  });

  return notesMap;
};

/**
 * Merge note vào entity
 * @param {Object} entity - Entity object
 * @param {string} targetType - Loại entity
 * @param {Map} notesMap - Map chứa notes
 * @returns {Object} - Entity đã được merge với note
 */
export const mergeNoteToEntity = (entity, targetType, notesMap) => {
  const entityId = getEntityId(entity);
  if (!entityId) {
    return {
      ...entity,
      note: "",
      noteId: null,
    };
  }

  const key = createNoteKey(targetType, entityId);
  const note = notesMap.get(key);

  // note có thể là note object (có _id và note) hoặc null
  if (!note) {
    return {
      ...entity,
      note: "",
      noteId: null,
    };
  }

  return {
    ...entity,
    note: note.note || "",
    noteId: note._id ? (note._id.toString ? note._id.toString() : String(note._id)) : null,
  };
};

/**
 * Fetch latest notes cho nhiều entities cùng lúc (tối ưu cho table)
 * @param {Array} items - [{ target_type, target_id }, ...]
 * @returns {Map} - Map với key là `${target_type}_${target_id}`, value là note object
 */
export const fetchLatestNotesBatch = async (items) => {
  try {
    if (!items || items.length === 0) {
      return new Map();
    }

    const response = await axiosInstance.post(API_ENDPOINTS.NOTES.BATCH, {
      items,
    });

    if (response.data.success) {
      const notesMap = new Map();
      response.data.data.forEach((item) => {
        const key = createNoteKey(item.target_type, item.target_id);
        if (key) {
          // item.note có thể là note object hoặc null
          notesMap.set(key, item.note);
        }
      });
      return notesMap;
    }
    return new Map();
  } catch (error) {
    //console.error("Error fetching notes batch:", error);
    return new Map();
  }
};

/**
 * Fetch latest note cho một entity
 * @param {string} targetType - "User", "PaymentTransaction", etc.
 * @param {string} targetId - ID của entity
 * @returns {Object|null} - Note object hoặc null
 */
export const fetchLatestNote = async (targetType, targetId) => {
  try {
    const response = await axiosInstance.get(
      API_ENDPOINTS.NOTES.LATEST(targetType, targetId)
    );

    if (response.data.success) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    //console.error("Error fetching latest note:", error);
    return null;
  }
};

/**
 * Create hoặc update note
 * @param {string} targetType - Loại entity
 * @param {string} targetId - ID của entity
 * @param {string} noteText - Nội dung note
 * @param {string|null} existingNoteId - Nếu có thì update, không thì create
 * @returns {Object|null} - Note object hoặc null
 */
export const saveNote = async (
  targetType,
  targetId,
  noteText,
  existingNoteId = null
) => {
  try {
    if (existingNoteId) {
      // Update existing note
      const response = await axiosInstance.put(
        API_ENDPOINTS.NOTES.UPDATE(existingNoteId),
        { note: noteText }
      );
      return response.data.success ? response.data.data : null;
    } else {
      // Create new note
      const response = await axiosInstance.post(API_ENDPOINTS.NOTES.CREATE, {
        target_type: targetType,
        target_id: targetId,
        note: noteText,
      });
      return response.data.success ? response.data.data : null;
    }
  } catch (error) {
    //console.error("Error saving note:", error);
    throw error;
  }
};


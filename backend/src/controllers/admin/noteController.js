import Note from "../../models/admin/note.model.js";
import mongoose from "mongoose";

// Get all notes of an entity (with history)
export const getNotes = async (req, res) => {
  try {
    const { target_type, target_id } = req.query;

    if (!target_type || !target_id) {
      return res.status(400).json({
        success: false,
        message: "target_type và target_id là bắt buộc",
      });
    }

    // Validate target_id is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(target_id)) {
      return res.status(400).json({
        success: false,
        message: "target_id không hợp lệ",
      });
    }

    const notes = await Note.find({
      target_type,
      target_id: new mongoose.Types.ObjectId(target_id),
      deleted_at: null,
    })
      .populate("created_by", "full_name email internal_role")
      .populate("updated_by", "full_name email internal_role")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get latest note of an entity
export const getLatestNote = async (req, res) => {
  try {
    const { target_type, target_id } = req.query;

    if (!target_type || !target_id) {
      return res.status(400).json({
        success: false,
        message: "target_type và target_id là bắt buộc",
      });
    }

    // Validate target_id is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(target_id)) {
      return res.status(400).json({
        success: false,
        message: "target_id không hợp lệ",
      });
    }

    const note = await Note.findOne({
      target_type,
      target_id: new mongoose.Types.ObjectId(target_id),
      deleted_at: null,
    })
      .sort({ created_at: -1 })
      .populate("created_by", "full_name email")
      .lean();

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Batch get latest notes of multiple entities (optimized for table)
export const getLatestNotesBatch = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "items phải là mảng không rỗng",
      });
    }

    // Validate target_id and convert to ObjectId
    const validItems = [];
    for (const item of items) {
      if (!item.target_type || !item.target_id) {
        continue; // Skip invalid item
      }

      if (!mongoose.Types.ObjectId.isValid(item.target_id)) {
        continue; // Bỏ qua nếu target_id không hợp lệ
      }

      validItems.push({
        target_type: item.target_type,
        target_id: new mongoose.Types.ObjectId(item.target_id),
      });
    }

    if (validItems.length === 0) {
      return res.json({
        success: true,
        data: items.map((item) => ({
          target_type: item.target_type,
          target_id: item.target_id,
          note: null,
        })),
      });
    }

    // Query all notes of the entities
    const allNotes = await Note.find({
      $or: validItems.map((item) => ({
        target_type: item.target_type,
        target_id: item.target_id,
        deleted_at: null,
      })),
    })
      .sort({ created_at: -1 })
      .lean();

    // Group and get the latest note for each entity
    const notesMap = new Map();
    allNotes.forEach((note) => {
      const key = `${note.target_type}_${note.target_id.toString()}`;
      if (!notesMap.has(key)) {
        notesMap.set(key, note);
      }
    });

    // Format response
    const result = items.map((item) => {
      const key = `${item.target_type}_${item.target_id}`;
      const note = notesMap.get(key);
      return {
        target_type: item.target_type,
        target_id: item.target_id,
        note: note || null,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new note
export const createNote = async (req, res) => {
  try {
    const { target_type, target_id, note } = req.body;
    const userId = req.user._id;

    if (!target_type || !target_id || !note) {
      return res.status(400).json({
        success: false,
        message: "target_type, target_id và note là bắt buộc",
      });
    }

    // Validate target_id is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(target_id)) {
      return res.status(400).json({
        success: false,
        message: "target_id không hợp lệ",
      });
    }

    const newNote = await Note.create({
      target_type,
      target_id: new mongoose.Types.ObjectId(target_id),
      note: note.trim(),
      created_by: userId,
      updated_by: userId,
    });

    await newNote.populate("created_by", "full_name email internal_role");

    res.status(201).json({
      success: true,
      data: newNote,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update note
export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user._id;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: "note là bắt buộc",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const updatedNote = await Note.findByIdAndUpdate(
      id,
      {
        note: note.trim(),
        updated_by: userId,
      },
      { new: true }
    )
      .populate("created_by", "full_name email internal_role")
      .populate("updated_by", "full_name email internal_role");

    if (!updatedNote) {
      return res.status(404).json({
        success: false,
        message: "Note không tồn tại",
      });
    }

    res.json({
      success: true,
      data: updatedNote,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete note (soft delete)
export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const note = await Note.findByIdAndUpdate(
      id,
      {
        deleted_at: new Date(),
      },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note không tồn tại",
      });
    }

    res.json({
      success: true,
      message: "Note đã được xóa",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


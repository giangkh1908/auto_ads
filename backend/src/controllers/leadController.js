import Lead from "../models/lead.model.js";
import Note from "../models/note.model.js";
import validator from "validator";
import mongoose from "mongoose";

// Tạo lead mới (form công khai, không cần đăng nhập)
export const createLead = async (req, res) => {
  try {
    const { lead_name, phone } = req.body;

    // Validation
    if (!lead_name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Tên và số điện thoại là bắt buộc",
      });
    }

    // Validate phone number
    if (!validator.isMobilePhone(phone.replace(/\s/g, ""), "vi-VN")) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại không hợp lệ",
      });
    }

    // Kiểm tra xem phone đã tồn tại chưa (chưa bị xóa)
    const existingLead = await Lead.findOne({
      phone: phone.trim(),
      deleted_at: null,
    });

    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại này đã được đăng ký",
      });
    }

    // Tạo lead mới
    const lead = new Lead({
      lead_name: lead_name.trim(),
      phone: phone.trim(),
      status: "new",
      source: "website",
    });

    await lead.save();

    res.status(201).json({
      success: true,
      message: "Đăng ký tư vấn thành công! Chúng tôi sẽ liên hệ với bạn sớm nhất.",
      data: {
        id: lead._id,
        lead_name: lead.lead_name,
        phone: lead.phone,
        status: lead.status,
        created_at: lead.created_at,
      },
    });
  } catch (error) {
    // Xử lý lỗi duplicate phone (unique index)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại này đã được đăng ký",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Có lỗi xảy ra khi tạo lead",
    });
  }
};

// Lấy danh sách leads (cần authenticate - chỉ CS Staff/Admin)
export const getLeads = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      assigned_status, 
      date_from, 
      date_to,
      page = 1, 
      limit = 100 
    } = req.query;

    // Xây dựng filter
    const filter = {
      deleted_at: null, // Chỉ lấy leads chưa bị xóa
    };

    // Filter theo search (name hoặc phone)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { lead_name: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Filter theo status
    if (status && status !== "All") {
      // Map UI status to DB status
      const statusMap = {
        "New": "new",
        "Contacted": "contacted",
        "Qualified": "qualified",
        "Lost": "lost",
      };
      const dbStatus = statusMap[status] || status.toLowerCase();
      filter.status = dbStatus;
    }

    // Filter theo assigned status
    if (assigned_status && assigned_status !== "All") {
      if (assigned_status === "Assigned") {
        filter.assigned_to = { $ne: null };
      } else if (assigned_status === "Unassigned") {
        filter.assigned_to = null;
      }
    }

    // Filter theo date range
    if (date_from || date_to) {
      filter.created_at = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        filter.created_at.$gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        filter.created_at.$lte = toDate;
      }
    }

    // Lấy dữ liệu
    const skip = (Number(page) - 1) * Number(limit);
    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate("assigned_to", "full_name email")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Lead.countDocuments(filter),
    ]);

    // Lấy notes mới nhất cho các leads
    const leadIds = leads.map((lead) => lead._id);
    const notes = await Note.find({
      target_type: "Lead",
      target_id: { $in: leadIds },
      deleted_at: null,
    })
      .sort({ created_at: -1 })
      .lean();

    // Group notes by lead_id và lấy note mới nhất (lưu cả note object để có _id)
    const notesMap = new Map();
    notes.forEach((note) => {
      const leadId = note.target_id.toString();
      if (!notesMap.has(leadId)) {
        notesMap.set(leadId, note); // Lưu cả note object thay vì chỉ note text
      }
    });

    // Format response
    const formattedLeads = leads.map((lead) => {
      const leadId = lead._id.toString();
      const noteObj = notesMap.get(leadId);
      return {
        id: leadId,
        lead_name: lead.lead_name,
        phone: lead.phone,
        created_at: lead.created_at,
        status: lead.status,
        assigned_to: lead.assigned_to ? {
          _id: lead.assigned_to._id ? lead.assigned_to._id.toString() : String(lead.assigned_to._id),
          full_name: lead.assigned_to.full_name,
          email: lead.assigned_to.email,
        } : null,
        source: lead.source,
        note: noteObj ? noteObj.note : "",
        noteId: noteObj ? (noteObj._id ? noteObj._id.toString() : String(noteObj._id)) : null,
      };
    });

    res.json({
      success: true,
      data: formattedLeads,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Có lỗi xảy ra khi lấy danh sách leads",
    });
  }
};

// Cập nhật status của lead
export const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentUserId = req.user?._id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status là bắt buộc",
      });
    }

    // Tìm lead hiện tại để check assigned status
    const existingLead = await Lead.findById(id);

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lead",
      });
    }

    // Check: chỉ user được assign mới có thể update status
    if (existingLead.assigned_to) {
      const assignedUserId = existingLead.assigned_to.toString();
      const currentUserIdStr = currentUserId ? currentUserId.toString() : null;

      if (!currentUserIdStr || assignedUserId !== currentUserIdStr) {
        return res.status(403).json({
          success: false,
          message: "Chỉ người dùng được gán lead mới có thể thay đổi status. Vui lòng làm mới trang để xem thông tin mới nhất.",
        });
      }
    } else {
      // Nếu lead chưa được assign, không cho phép update status
      return res.status(403).json({
        success: false,
        message: "Lead chưa được gán. Vui lòng gán lead trước khi thay đổi status.",
      });
    }

    // Map UI status to DB status
    const statusMap = {
      "New": "new",
      "Contacted": "contacted",
      "Qualified": "qualified",
      "Lost": "lost",
    };
    const dbStatus = statusMap[status] || status.toLowerCase();

    if (!["new", "contacted", "qualified", "lost"].includes(dbStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status không hợp lệ",
      });
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      { 
        status: dbStatus,
        updated_by: currentUserId || null,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Cập nhật status thành công",
      data: lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Có lỗi xảy ra khi cập nhật status",
    });
  }
};

// Gán lead cho user
export const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    const currentUserId = req.user?._id;

    // Tìm lead hiện tại để check assigned status
    const existingLead = await Lead.findById(id);

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lead",
      });
    }

    // Nếu đang cố gán lead (assigned_to có giá trị) và lead đã được assign cho user khác
    if (assigned_to && existingLead.assigned_to) {
      const existingAssignedId = existingLead.assigned_to.toString();
      const newAssignedId = assigned_to.toString();
      
      // Nếu đang cố assign cho user khác (không phải user hiện tại đang được assign)
      if (existingAssignedId !== newAssignedId) {
        return res.status(400).json({
          success: false,
          message: "Lead này đã được gán cho người dùng khác. Vui lòng làm mới trang để xem thông tin mới nhất.",
        });
      }
    }

    // Update lead
    const lead = await Lead.findByIdAndUpdate(
      id,
      { 
        assigned_to: assigned_to || null,
        updated_by: currentUserId || null,
      },
      { new: true }
    ).populate("assigned_to", "full_name email");

    res.json({
      success: true,
      message: assigned_to ? "Gán lead thành công" : "Hủy gán lead thành công",
      data: lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Có lỗi xảy ra khi gán lead",
    });
  }
};


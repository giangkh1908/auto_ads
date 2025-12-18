import Log from "../models/admin/log.model.js";

export const saveLog = async (logData) => {
  try {
    // DEBUG: Log the incoming data
    // console.log("[saveLog] 📝 Receiving logData:", {
    //   action: logData.action,
    //   shop_id: logData.shop_id,
    //   user_id: logData.user_id,
    //   target_name: logData.target_name,
    // });

    // Nếu không có shop_id, log warning và skip
    if (!logData.shop_id) {
      console.warn("[saveLog] ⚠️ shop_id is null/undefined! Log will NOT be visible in Shop History.");
    }

    // Tạo description tự động theo action
    let description = "";

    const userName = logData.user_name || "Người dùng";
    const shopName = logData.shop_name || "Shop";
    const targetName = logData.target_name || "đối tượng";


    switch (logData.action) {
      case "CREATE_SHOP":
        description = `${userName} đã tạo cửa hàng mới: "${logData.request?.shop_name || shopName}"`;
        break;

      case "UPDATE_SHOP":
        description = `${userName} đã cập nhật thông tin cửa hàng: "${shopName}"`;
        break;

      case "DELETE_SHOP":
        description = `${userName} đã xóa tạm thời cửa hàng: "${shopName}"`;
        break;

      case "ACTIVATE_SHOP":
        description = `${userName} đã kích hoạt cửa hàng: "${shopName}"`;
        break;

      case "DEACTIVATE_SHOP":
        description = `${userName} đã vô hiệu hóa cửa hàng: "${shopName}"`;
        break;

      case "SWITCH_CURRENT_SHOP":
        description = `${userName} đã chuyển sang sử dụng cửa hàng: "${shopName}"`;
        break;

      case "CONNECT_FACEBOOK_PAGE":
        const pageName = logData.page_info?.name || logData.request?.pageId || "Fanpage";
        description = `${userName} đã kết nối fanpage: "${pageName}" vào cửa hàng: "${shopName}"`;
        break;

      case "DISCONNECT_FACEBOOK_PAGE":
        const disconnectedPage = logData.request?.pageId || "Fanpage";
        description = `${userName} đã ngắt kết nối fanpage: "${disconnectedPage}" khỏi cửa hàng: "${shopName}"`;
        break;

      case "PAUSE_FACEBOOK_PAGE":
        const pausedPage = logData.request?.pageId || logData.target_name || "Fanpage";
        description = `${userName} đã tạm dừng fanpage: "${pausedPage}" trong cửa hàng: "${shopName}"`;
        break;

      case "RESUME_FACEBOOK_PAGE":
        const resumedPage = logData.request?.pageId || logData.target_name || "Fanpage";
        description = `${userName} đã kích hoạt lại fanpage: "${resumedPage}" trong cửa hàng: "${shopName}"`;
        break;

      case "ADD_EMPLOYEE":
        description = `${userName} đã thêm nhân viên mới: "${logData.target_name || "Nhân viên"}" vào cửa hàng: "${shopName}"`;
        break;

      case "UPDATE_USER_STATUS":
        description = logData.description || `${userName} đã cập nhật trạng thái nhân viên: "${logData.target_name || "Nhân viên"}" trong cửa hàng: "${shopName}"`;
        break;

      case "UPDATE_USER_ROLE":
        description = logData.description || `${userName} đã cập nhật vai trò nhân viên: "${logData.target_name || "Nhân viên"}" trong cửa hàng: "${shopName}"`;
        break;

      case "TRANSFER_OWNERSHIP":
        description = logData.description || `${userName} đã chuyển quyền sở hữu cửa hàng: "${shopName}" cho "${logData.target_name || "Người dùng"}"`;
        break;

      case "REMOVE_EMPLOYEE":
        description = `${userName} đã xóa nhân viên: "${logData.target_name || "Nhân viên"}" ra khỏi cửa hàng: "${shopName}"`;
        break;

      case "ASSIGN_PAGES":
        description = logData.description || `${userName} đã phân quyền cho nhân viên: "${logData.target_name || "Nhân viên"}" vào các trang trong cửa hàng: "${shopName}"`;
        break;

      case "UPDATE_EMPLOYEE_ROLE":
        const pagesList = logData.page_list?.length > 0
          ? logData.page_list.map(p => p.name).join("; ")
          : "Tất cả trang";
        description = `Phân quyền cho nhân viên ${logData.target_name} vào các page: ${pagesList}; ${shopName}`;
        break;

      case "REFRESH_FACEBOOK_TOKEN":
        description = `${userName} đã làm mới access token Facebook thành công`;
        break;

      case "UPGRADE_SHOP":
        const packageName = logData.meta?.package_name || logData.request?.package_name || "Gói dịch vụ";
        description = logData.description || `${userName} đã nâng cấp cửa hàng "${shopName}" lên gói "${packageName}"`;
        break;

      // ===== CAMPAIGN ACTIONS =====
      case "CREATE_CAMPAIGN":
        description = `${userName} vừa tạo chiến dịch: "${targetName}"`;
        break;

      case "UPDATE_CAMPAIGN":
        description = `${userName} vừa cập nhật chiến dịch: "${targetName}"`;
        break;

      case "DELETE_CAMPAIGN":
        description = `${userName} vừa xóa chiến dịch: "${targetName}"`;
        break;

      case "ARCHIVE_CAMPAIGN":
        description = `${userName} vừa lưu trữ chiến dịch: "${targetName}"`;
        break;

      // ===== ADSET ACTIONS =====
      case "CREATE_ADSET":
        description = `${userName} vừa tạo nhóm quảng cáo: "${targetName}"`;
        break;

      case "UPDATE_ADSET":
        description = `${userName} vừa cập nhật nhóm quảng cáo: "${targetName}"`;
        break;

      case "DELETE_ADSET":
        description = `${userName} vừa xóa nhóm quảng cáo: "${targetName}"`;
        break;

      case "ARCHIVE_ADSET":
        description = `${userName} vừa lưu trữ nhóm quảng cáo: "${targetName}"`;
        break;

      // ===== AD ACTIONS =====
      case "CREATE_AD":
        description = `${userName} vừa tạo quảng cáo: "${targetName}"`;
        break;

      case "UPDATE_AD":
        description = `${userName} vừa cập nhật quảng cáo: "${targetName}"`;
        break;

      case "DELETE_AD":
        description = `${userName} vừa xóa quảng cáo: "${targetName}"`;
        break;

      case "ARCHIVE_AD":
        description = `${userName} vừa lưu trữ quảng cáo: "${targetName}"`;
        break;

      default:
        description = `${userName} đã thực hiện hành động: ${logData.action} trên ${targetName}`;
    }

    const log = new Log({
      user_id: logData.user_id,
      shop_id: logData.shop_id,
      action: logData.action,
      target_type: logData.target_type,
      target_id: logData.target_id,
      description, // ← TỰ ĐỘNG TẠO
      request: logData.request,
      response: logData.response,
      ip_address: logData.ip_address,
      user_agent: logData.user_agent || "Unknown",
    });

    await log.save();
    return log;
  } catch (error) {
    console.error("Lỗi khi lưu log:", error);
    return null;
  }
};
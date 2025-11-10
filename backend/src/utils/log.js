import Log from "../models/log.model.js";

export const saveLog = async (logData) => {
  try {
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
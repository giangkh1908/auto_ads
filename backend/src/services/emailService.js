import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Tạo transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // App password cho Gmail
        },
    });
};

// Gửi email xác nhận
export const sendVerificationEmail = async (email, name, verificationToken) => {
    try {
        const transporter = createTransporter();
        
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Xác nhận địa chỉ email của bạn',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Chào ${name}!</h2>
                    <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào link bên dưới để xác nhận địa chỉ email của bạn:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" 
                           style="background-color: #007bff; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Xác nhận Email
                        </a>
                    </div>
                    <p>Hoặc copy và paste link sau vào trình duyệt:</p>
                    <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                    <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 24 giờ.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
                    </p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('Không thể gửi email xác nhận');
    }
};

// Gửi email reset password
export const sendPasswordResetEmail = async (email, name, resetToken) => {
    try {
        const transporter = createTransporter();
        
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Đặt lại mật khẩu',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Chào ${name}!</h2>
                    <p>Bạn đã yêu cầu đặt lại mật khẩu. Click vào link bên dưới để tạo mật khẩu mới:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #dc3545; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Đặt lại mật khẩu
                        </a>
                    </div>
                    <p>Hoặc copy và paste link sau vào trình duyệt:</p>
                    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                    <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 10 phút.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">
                        Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                    </p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Không thể gửi email đặt lại mật khẩu');
    }
};

export const sendInvitationEmail = async (email, token) => {
  try {
    const transporter = createTransporter();

    const inviteUrl = `${process.env.FRONTEND_URL}`;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Lời mời tham gia cửa hàng",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🎉 Bạn được mời tham gia cửa hàng!</h2>
          <p>Bạn vừa được mời làm nhân viên trong hệ thống của chúng tôi.</p>
          <p>Vui lòng click vào link bên dưới để đăng nhập hoặc tạo tài khoản và xác nhận lời mời:</p>
          <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}"
                style="background-color: #28a745; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 5px; display: inline-block;">
                Chấp nhận lời mời
              </a>
          </div>
          <p>Hoặc copy link sau: <br><span style="word-break: break-all; color: #555;">${inviteUrl}</span></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw new Error("Không thể gửi email mời nhân viên");
  }
};

/**
 * Gửi email thông báo khi AutoRule được trigger
 */
export const sendAutoRuleNotificationEmail = async (email, name, ruleData) => {
  try {
    const transporter = createTransporter();

    const { ruleName, conditions, action, entities } = ruleData;

    // Map action name
    const actionNames = {
      TURN_ON: "Bật",
      TURN_OFF: "Tắt",
      SEND_NOTIFICATION: "Gửi thông báo",
    };
    const actionName = actionNames[action] || action;

    // Format conditions
    const conditionText = conditions
      ?.map((c) => {
        const metricNames = {
          spend: "Chi tiêu",
          daily_budget: "Ngân sách hàng ngày",
          daily_spend_rate: "Tỷ lệ chi tiêu hàng ngày",
          website_purchase_roas: "ROAS mua hàng trên website",
          link_ctr: "CTR liên kết",
          impressions: "Lượt hiển thị",
          link_cpc: "CPC liên kết",
          cost_per_result: "Chi phí trên mỗi kết quả",
          results: "Kết quả",
          frequency: "Tần suất",
          website_purchases: "Lượt mua trên website",
          total_amount_spent: "Tổng số tiền đã chi",
          link_clicks: "Lượt click liên kết",
          cpm: "CPM",
          audience_reach_percentage: "Phần trăm tiếp cận đối tượng",
        };
        const operatorNames = {
          GREATER_THAN: "lớn hơn",
          LESS_THAN: "nhỏ hơn",
          EQUAL_TO: "bằng",
        };
        const metric = metricNames[c.metric] || c.metric;
        const operator = operatorNames[c.operator] || c.operator;
        return `${metric} ${operator} ${c.value}`;
      })
      .join(", ");

    // Format entities
    const entityText = [];
    if (entities.campaigns && entities.campaigns.length > 0) {
      entityText.push(`Chiến dịch: ${entities.campaigns.join(", ")}`);
    }
    if (entities.adsets && entities.adsets.length > 0) {
      entityText.push(`Nhóm quảng cáo: ${entities.adsets.join(", ")}`);
    }
    if (entities.ads && entities.ads.length > 0) {
      entityText.push(`Quảng cáo: ${entities.ads.join(", ")}`);
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: `Thông báo: Quy tắc tự động "${ruleName}" đã được kích hoạt`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">🔔 Thông báo quy tắc tự động</h2>
          <p>Chào ${name},</p>
          <p>Quy tắc tự động <strong>"${ruleName}"</strong> đã được kích hoạt.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Điều kiện đã thỏa mãn:</h3>
            <p>${conditionText || "Không có điều kiện"}</p>
          </div>
          
          <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Hành động đã thực thi:</h3>
            <p><strong>${actionName}</strong></p>
          </div>
          
          ${entityText.length > 0 ? `
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Đối tượng bị ảnh hưởng:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              ${entityText.map((text) => `<li>${text}</li>`).join("")}
            </ul>
          </div>
          ` : ""}
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Email này được gửi tự động bởi hệ thống quản lý quảng cáo.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`AutoRule notification email sent to ${email}`);
  } catch (error) {
    console.error("Error sending AutoRule notification email:", error);
    throw new Error("Không thể gửi email thông báo quy tắc tự động");
  }
};

/**
 * Gửi email thông tin đăng nhập cho nhân viên nội bộ mới
 */
export const sendStaffCredentialsEmail = async (email, password) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Thông tin đăng nhập tài khoản nhân viên",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Chào mừng bạn đến với hệ thống!</h2>
          <p>Tài khoản nhân viên của bạn đã được tạo thành công. Dưới đây là thông tin đăng nhập của bạn:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
            <h3 style="color: #333; margin-top: 0;">Thông tin đăng nhập:</h3>
            <p style="margin: 10px 0;"><strong>Email:</strong> <span style="color: #007bff;">${email}</span></p>
            <p style="margin: 10px 0;"><strong>Mật khẩu:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 3px; font-size: 14px;">${password}</code></p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ Lưu ý quan trọng:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu</li>
              <li>Không chia sẻ thông tin đăng nhập với bất kỳ ai</li>
              <li>Bảo mật thông tin tài khoản của bạn</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Đăng nhập ngay
            </a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Email này được gửi tự động bởi hệ thống. Nếu bạn không mong đợi email này, vui lòng liên hệ với quản trị viên.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Staff credentials email sent to ${email}`);
  } catch (error) {
    console.error("Error sending staff credentials email:", error);
    throw new Error("Không thể gửi email thông tin đăng nhập");
  }
};

/**
 * Gửi email thông báo khi package được approve
 */
export const sendPackageApprovalEmail = async (userEmail, userName, packageData) => {
  try {
    const transporter = createTransporter();

    const { packageName, price, duration, fromDate, toDate, pages, employees, shops, features } = packageData;

    // Format dates
    const formatDate = (date) => {
      if (!date) return "N/A";
      return new Date(date).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Format duration
    const durationText = duration === "12months" ? "1 năm" : duration === "6months" ? "6 tháng" : "3 tháng";

    // Format features
    const featureLabels = {
      analytics_chat_ai: "ChatBot AI",
      content_ai: "AI tạo nội dung",
      ads_auto_run: "Quảng cáo tự động",
    };
    const formattedFeatures = features?.map(f => featureLabels[f] || f).join(", ") || "Không có";

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: userEmail,
      subject: `Gói dịch vụ "${packageName}" đã được kích hoạt thành công!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981; text-align: center;">Chúc mừng!</h2>
          <p>Chào <strong>${userName}</strong>,</p>
          <p>Gói dịch vụ của bạn đã được kích hoạt thành công. Dưới đây là thông tin chi tiết:</p>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="color: #333; margin-top: 0;">Thông tin gói dịch vụ:</h3>
            <p style="margin: 10px 0;"><strong>Tên gói:</strong> <span style="color: #10b981; font-size: 18px;">${packageName}</span></p>
            <p style="margin: 10px 0;"><strong>Giá:</strong> ${price?.toLocaleString("vi-VN") || "N/A"} VNĐ / tháng</p>
            <p style="margin: 10px 0;"><strong>Thời hạn:</strong> ${durationText}</p>
            <p style="margin: 10px 0;"><strong>Ngày bắt đầu:</strong> ${formatDate(fromDate)}</p>
            <p style="margin: 10px 0;"><strong>Ngày kết thúc:</strong> ${formatDate(toDate)}</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Tính năng bao gồm:</h3>
            <p style="margin: 10px 0;">${formattedFeatures}</p>
          </div>

          <div style="background-color: #eff6ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Giới hạn sử dụng:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${pages ? `<li><strong>Pages:</strong> ${pages}</li>` : ""}
              ${employees ? `<li><strong>Nhân viên:</strong> ${employees}</li>` : ""}
              ${shops ? `<li><strong>Shops:</strong> ${shops}</li>` : ""}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
               style="background-color: #10b981; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Truy cập Dashboard
            </a>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Lưu ý:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>Gói dịch vụ của bạn đã được kích hoạt và sẵn sàng sử dụng</li>
              <li>Bạn có thể bắt đầu sử dụng các tính năng ngay bây giờ</li>
              <li>Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi</li>
            </ul>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            Email này được gửi tự động bởi hệ thống. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Package approval email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending package approval email:", error);
    throw new Error("Không thể gửi email thông báo kích hoạt gói dịch vụ");
  }
};

/**
 * Gửi email thông báo khi đơn hàng bị hủy do hết thời gian thanh toán
 */
export const sendOrderTimeoutEmail = async (userEmail, userName, orderData) => {
  try {
    const transporter = createTransporter();

    const { orderId, packageName, amount } = orderData;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: userEmail,
      subject: "Đơn hàng đã bị hủy do hết thời gian thanh toán",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545; text-align: center;">Thông báo về đơn hàng</h2>
          <p>Chào <strong>${userName}</strong>,</p>
          <p>Rất tiếc, đơn hàng của bạn đã bị hủy tự động do hết thời gian thanh toán (10 phút).</p>
          
          <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="color: #333; margin-top: 0;">Thông tin đơn hàng:</h3>
            <p style="margin: 10px 0;"><strong>Mã đơn hàng:</strong> ${orderId}</p>
            ${packageName ? `<p style="margin: 10px 0;"><strong>Gói dịch vụ:</strong> ${packageName}</p>` : ""}
            ${amount ? `<p style="margin: 10px 0;"><strong>Số tiền:</strong> ${amount.toLocaleString("vi-VN")} VNĐ</p>` : ""}
            <p style="margin: 10px 0;"><strong>Lý do hủy:</strong> Hết thời gian thanh toán (10 phút)</p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Bạn có thể:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>Tạo đơn hàng mới để tiếp tục thanh toán</li>
              <li>Liên hệ với chúng tôi nếu bạn đã thực hiện thanh toán</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/service-package" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Đặt hàng lại
            </a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            Email này được gửi tự động bởi hệ thống. Nếu bạn có thắc mắc, vui lòng liên hệ với chúng tôi.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order timeout email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending order timeout email:", error);
    throw new Error("Không thể gửi email thông báo đơn hàng hết hạn");
  }
};
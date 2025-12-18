
import { useState, useEffect } from "react";
import { Search, BookOpen, User, Home, Store, Megaphone, BarChart3, Zap, Package, CreditCard, Settings, Shield, Users, FileText, Bell, Key } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./Guide.css";

const GUIDE_SECTIONS = [
  { id: "overview", titleKey: "sections.overview.title", icon: BookOpen },
  { id: "getting-started", titleKey: "sections.gettingStarted.title", icon: User },
  { id: "dashboard", titleKey: "sections.dashboard.title", icon: Home },
  { id: "shop-management", titleKey: "sections.shopManagement.title", icon: Store },
  { id: "ads-management", titleKey: "sections.adsManagement.title", icon: Megaphone },
  { id: "analytics", titleKey: "sections.analytics.title", icon: BarChart3 },
  { id: "automation", titleKey: "sections.automation.title", icon: Zap },
  { id: "service-package", titleKey: "sections.servicePackage.title", icon: Package },
  { id: "ad-account", titleKey: "sections.adAccount.title", icon: CreditCard },
  { id: "profile", titleKey: "sections.profile.title", icon: Settings },
  //   { id: "admin-system", titleKey: "Admin - System Admin", icon: Shield },
  //   { id: "admin-cs", titleKey: "Admin - CS Staff", icon: Users },
  //   { id: "admin-accountant", titleKey: "Admin - Accountant", icon: FileText },
];

function Guide() {
  const { t } = useTranslation('guide');
  const [activeSection, setActiveSection] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const contentElement = document.querySelector(".guide-content-wrapper");
    if (contentElement) {
      contentElement.scrollTop = 0;
    }
  }, [activeSection]);

  const filteredSections = GUIDE_SECTIONS.filter((section) =>
    t(section.titleKey).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="guide-page-container">
      <div className="guide-page-main">
        <aside className="guide-page-sidebar">
          <div className="guide-page-search-box">
            <Search size={18} className="guide-page-search-icon" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="guide-page-search-input"
            />
          </div>

          <nav className="guide-page-nav">
            <h3 className="guide-page-nav-title">{t('tableOfContents')}</h3>
            <ul className="guide-page-nav-list">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <li key={section.id} className="guide-page-nav-item">
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`guide-page-nav-link ${activeSection === section.id ? "active" : ""}`}
                    >
                      <Icon size={18} className="guide-page-nav-icon" />
                      <span>{t(section.titleKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="guide-page-content">
          <div className="guide-content-wrapper">
            {/* Tổng quan */}
            <section id="overview" className="guide-section">
              <h2 className="guide-section-title">
                <BookOpen size={24} className="guide-section-icon" />
                Tổng quan hệ thống
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Hệ thống Quản lý Quảng cáo Tự động là một nền tảng toàn diện giúp bạn quản lý các chiến dịch quảng cáo Facebook,
                  tự động hóa quy trình, và theo dõi hiệu suất một cách hiệu quả.
                </p>
                <div className="guide-features-grid">
                  <div className="guide-feature-card">
                    <Megaphone size={24} className="guide-feature-icon" />
                    <h3>Quản lý Quảng cáo</h3>
                    <p>Tạo, chỉnh sửa và quản lý các chiến dịch, ad sets và quảng cáo Facebook</p>
                  </div>
                  <div className="guide-feature-card">
                    <BarChart3 size={24} className="guide-feature-icon" />
                    <h3>Phân tích & Báo cáo</h3>
                    <p>Theo dõi hiệu suất quảng cáo với các báo cáo chi tiết và biểu đồ trực quan</p>
                  </div>
                  <div className="guide-feature-card">
                    <Zap size={24} className="guide-feature-icon" />
                    <h3>Tự động hóa</h3>
                    <p>Thiết lập các quy tắc tự động để tối ưu hóa chiến dịch quảng cáo</p>
                  </div>
                  <div className="guide-feature-card">
                    <Store size={24} className="guide-feature-icon" />
                    <h3>Quản lý Shop</h3>
                    <p>Quản lý nhiều cửa hàng, nhân viên và kết nối Facebook Pages</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Bắt đầu */}
            <section id="getting-started" className="guide-section">
              <h2 className="guide-section-title">
                <User size={24} className="guide-section-icon" />
                Bắt đầu sử dụng
              </h2>
              <div className="guide-section-content">
                <h3 className="guide-subsection-title">1. Đăng ký tài khoản</h3>
                <ol className="guide-steps-list">
                  <li>Truy cập trang chủ và nhấn nút <strong>"Đăng ký"</strong></li>
                  <li>Điền đầy đủ thông tin: Họ tên, Email, Số điện thoại, Mật khẩu</li>
                  <li>Xác nhận email qua link được gửi đến hộp thư</li>
                  <li>Đăng nhập với tài khoản vừa tạo</li>
                </ol>

                <h3 className="guide-subsection-title">2. Đăng nhập</h3>
                <ol className="guide-steps-list">
                  <li>Nhấn nút <strong>"Đăng nhập"</strong> ở góc trên bên phải</li>
                  <li>Nhập Email và Mật khẩu</li>
                  <li>Nhấn <strong>"Đăng nhập"</strong> để truy cập hệ thống</li>
                  <li>Hoặc đăng nhập với Facebook sẽ không cần phải đăng ký tài khoản</li>
                  <li>Nếu quên mật khẩu, sử dụng chức năng <strong>"Quên mật khẩu"</strong></li>
                </ol>

                <h3 className="guide-subsection-title">3. Mua gói dịch vụ</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Gói dịch vụ"</strong> từ menu</li>
                  <li>Chọn gói phù hợp (Chatbot, Chatbot AI)</li>
                  <li>Chọn thời hạn: 3 tháng hoặc 12 tháng</li>
                  <li>Chọn số lượng Pages, Employees, và Shops cần thiết</li>
                  <li>Thanh toán qua Bank transfer, VNPAY</li>
                  <li>Chờ admin duyệt giao dịch</li>
                </ol>
              </div>
            </section>

            {/* Dashboard */}
            <section id="dashboard" className="guide-section">
              <h2 className="guide-section-title">
                <Home size={24} className="guide-section-icon" />
                Dashboard - Quản lý Facebook Pages
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Dashboard là trang chính để quản lý các Facebook Pages đã kết nối và theo dõi trạng thái của chúng.
                </p>

                <h3 className="guide-subsection-title">Kết nối Facebook Page mới</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Dashboard"</strong> từ menu chính</li>
                  <li>Nhấn nút <strong>"Connect New Page"</strong> (nếu chưa đạt giới hạn)</li>
                  <li>Chọn Page từ danh sách Facebook Pages của bạn</li>
                  <li>Xác nhận quyền truy cập</li>
                  <li>Page sẽ xuất hiện trong danh sách sau khi kết nối thành công</li>
                </ol>

                <h3 className="guide-subsection-title">Quản lý Pages</h3>
                <ul className="guide-features-list">
                  <li><strong>Xem danh sách:</strong> Tất cả Pages đã kết nối hiển thị dưới dạng cards</li>
                  <li><strong>Lọc theo trạng thái:</strong> All, Active, Inactive</li>
                  <li><strong>Tìm kiếm:</strong> Sử dụng thanh search để tìm Page theo tên</li>
                  <li><strong>Xem chi tiết:</strong> Click vào Page để xem thông tin chi tiết</li>
                  <li><strong>Ngắt kết nối:</strong> Sử dụng menu dropdown để ngắt kết nối Page</li>
                </ul>

                <div className="guide-note-box">
                  <Bell size={20} className="guide-note-icon" />
                  <p><strong>Lưu ý:</strong> Số lượng Pages có thể kết nối phụ thuộc vào gói dịch vụ đã mua. Kiểm tra giới hạn trong phần "Gói dịch vụ".</p>
                </div>
              </div>
            </section>

            {/* Quản lý Shop */}
            <section id="shop-management" className="guide-section">
              <h2 className="guide-section-title">
                <Store size={24} className="guide-section-icon" />
                Quản lý Shop
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Quản lý Shop cho phép bạn tạo và quản lý nhiều cửa hàng, mỗi shop có thể có nhiều nhân viên và Facebook Pages.
                </p>

                <h3 className="guide-subsection-title">Tạo Shop mới</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Shop"</strong> từ menu chính</li>
                  <li>Nhấn nút <strong>"Thêm Shop"</strong></li>
                  <li>Điền thông tin:
                    <ul className="guide-nested-list">
                      <li>Tên Shop</li>
                      <li>Email liên hệ</li>
                      <li>Số điện thoại</li>
                      <li>Danh mục (Category)</li>
                    </ul>
                  </li>
                  <li>Nhấn <strong>"Lưu"</strong> để tạo Shop</li>
                </ol>

                <h3 className="guide-subsection-title">Quản lý Nhân viên</h3>
                <ol className="guide-steps-list">
                  <li>Chọn Shop từ danh sách</li>
                  <li>Vào tab <strong>"Nhân viên"</strong></li>
                  <li>Nhấn <strong>"Thêm nhân viên"</strong></li>
                  <li>Nhập email của nhân viên (phải đã đăng ký trong hệ thống)</li>
                  <li>Chọn quyền: Admin hoặc Employee</li>
                  <li>Nhấn <strong>"Thêm"</strong> để hoàn tất</li>
                </ol>

                <h3 className="guide-subsection-title">Lịch sử hoạt động</h3>
                <ul className="guide-features-list">
                  <li>Xem lịch sử các thao tác trong Shop</li>
                  <li>Lọc theo ngày, người thực hiện, hoặc loại hành động</li>
                  <li>Xuất báo cáo nếu cần</li>
                </ul>

                <div className="guide-note-box">
                  <Store size={20} className="guide-note-icon" />
                  <p><strong>Lưu ý:</strong> Số lượng Shops và Employees có thể tạo phụ thuộc vào gói dịch vụ. Mỗi Shop có thể kết nối nhiều Facebook Pages.</p>
                </div>
              </div>
            </section>

            {/* Quản lý Quảng cáo */}
            <section id="ads-management" className="guide-section">
              <h2 className="guide-section-title">
                <Megaphone size={24} className="guide-section-icon" />
                Quản lý Quảng cáo
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Quản lý Quảng cáo là nơi bạn tạo, chỉnh sửa và quản lý tất cả các chiến dịch quảng cáo Facebook của mình.
                </p>

                <h3 className="guide-subsection-title">Cấu trúc Quảng cáo</h3>
                <ul className="guide-features-list">
                  <li><strong>Campaign (Chiến dịch):</strong> Cấp cao nhất, chứa nhiều Ad Sets</li>
                  <li><strong>Ad Set (Nhóm quảng cáo):</strong> Chứa nhiều Ads, định nghĩa đối tượng và ngân sách</li>
                  <li><strong>Ad (Quảng cáo):</strong> Cấp thấp nhất, chứa creative (hình ảnh, video, text)</li>
                </ul>

                <h3 className="guide-subsection-title">Tạo Chiến dịch mới</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Quản lý Quảng cáo"</strong> từ menu</li>
                  <li>Chọn tài khoản quảng cáo từ dropdown (nếu có nhiều tài khoản)</li>
                  <li>Nhấn nút <strong>"Tạo mới"</strong> hoặc <strong>"Create Campaign"</strong></li>
                  <li>Điền thông tin Campaign:
                    <ul className="guide-nested-list">
                      <li>Tên Campaign</li>
                      <li>Mục tiêu (Objective): Traffic, Conversions, Engagement, etc.</li>
                      <li>Ngân sách (Budget)</li>
                    </ul>
                  </li>
                  <li>Tiếp tục tạo Ad Set:
                    <ul className="guide-nested-list">
                      <li>Chọn đối tượng (Audience)</li>
                      <li>Thiết lập ngân sách Ad Set</li>
                      <li>Chọn vị trí đặt quảng cáo (Placements)</li>
                    </ul>
                  </li>
                  <li>Cuối cùng, tạo Ad:
                    <ul className="guide-nested-list">
                      <li>Chọn format: Single Image, Video, Carousel, etc.</li>
                      <li>Upload hình ảnh/video</li>
                      <li>Nhập nội dung quảng cáo (Ad Text)</li>
                      <li>Thêm Call-to-Action (CTA) button</li>
                    </ul>
                  </li>
                  <li>Xem lại và nhấn <strong>"Publish"</strong> để xuất bản</li>
                </ol>

                <h3 className="guide-subsection-title">Quản lý Quảng cáo</h3>
                <ul className="guide-features-list">
                  <li><strong>Xem danh sách:</strong> Chuyển đổi giữa tabs Campaigns, Ad Sets, Ads</li>
                  <li><strong>Chỉnh sửa:</strong> Click vào item để chỉnh sửa</li>
                  <li><strong>Bật/Tắt:</strong> Sử dụng toggle để bật/tắt Campaign, Ad Set, hoặc Ad</li>
                  <li><strong>Xóa:</strong> Chọn item và nhấn nút Xóa (có xác nhận)</li>
                  <li><strong>Lưu trữ:</strong> Archive để ẩn khỏi danh sách chính</li>
                  <li><strong>Đồng bộ:</strong> Nhấn nút Sync để đồng bộ dữ liệu từ Facebook</li>
                </ul>

                <h3 className="guide-subsection-title">Tìm kiếm và Lọc</h3>
                <ul className="guide-features-list">
                  <li>Sử dụng thanh search để tìm theo tên</li>
                  <li>Lọc theo trạng thái: Active, Paused, Archived</li>
                  <li>Lọc theo ngày tạo hoặc ngày chỉnh sửa</li>
                </ul>
              </div>
            </section>

            {/* Analytics */}
            <section id="analytics" className="guide-section">
              <h2 className="guide-section-title">
                <BarChart3 size={24} className="guide-section-icon" />
                Phân tích & Báo cáo
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Analytics cung cấp các báo cáo chi tiết về hiệu suất quảng cáo với nhiều metrics và breakdown options.
                </p>

                <h3 className="guide-subsection-title">Xem Báo cáo</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Analytics"</strong> từ menu</li>
                  <li>Chọn tài khoản quảng cáo</li>
                  <li>Chọn khoảng thời gian (Date Range)</li>
                  <li>Chọn các metrics muốn xem:
                    <ul className="guide-nested-list">
                      <li>Amount Spent (Chi phí)</li>
                      <li>Impressions (Lượt hiển thị)</li>
                      <li>Reach (Lượt tiếp cận)</li>
                      <li>Results (Kết quả)</li>
                      <li>CPC, CPM, CTR (Các chỉ số hiệu quả)</li>
                    </ul>
                  </li>
                  <li>Chọn breakdown columns:
                    <ul className="guide-nested-list">
                      <li>Campaign Name, Ad Set Name, Ad Name</li>
                      <li>Page Name, Date, Age Range, etc.</li>
                    </ul>
                  </li>
                  <li>Xem bảng dữ liệu và biểu đồ</li>
                </ol>

                <h3 className="guide-subsection-title">Xuất Báo cáo</h3>
                <ul className="guide-features-list">
                  <li>Xuất dữ liệu ra file Excel/CSV</li>
                  <li>Lưu các cấu hình báo cáo yêu thích</li>
                  <li>Lên lịch gửi báo cáo tự động</li>
                </ul>
              </div>
            </section>

            {/* Automation */}
            <section id="automation" className="guide-section">
              <h2 className="guide-section-title">
                <Zap size={24} className="guide-section-icon" />
                Tự động hóa Quảng cáo
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Automation Rules cho phép bạn thiết lập các quy tắc tự động để tối ưu hóa chiến dịch quảng cáo dựa trên hiệu suất.
                </p>

                <h3 className="guide-subsection-title">Tạo Quy tắc Tự động</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Automation Rule"</strong> từ menu</li>
                  <li>Nhấn <strong>"Tạo quy tắc mới"</strong></li>
                  <li>Đặt tên và mô tả cho quy tắc</li>
                  <li>Chọn điều kiện (Conditions):
                    <ul className="guide-nested-list">
                      <li>Khi CPC {">"} X VND</li>
                      <li>Khi CTR {"<"} Y%</li>
                      <li>Khi Results {"<"} Z</li>
                      <li>Khi Amount Spent {">"} W VND</li>
                    </ul>
                  </li>
                  <li>Chọn hành động (Actions):
                    <ul className="guide-nested-list">
                      <li>Pause Campaign/Ad Set/Ad</li>
                      <li>Increase Budget</li>
                      <li>Decrease Budget</li>
                      <li>Send Notification</li>
                    </ul>
                  </li>
                  <li>Thiết lập lịch kiểm tra (Schedule)</li>
                  <li>Kích hoạt quy tắc</li>
                </ol>

                <h3 className="guide-subsection-title">Quản lý Quy tắc</h3>
                <ul className="guide-features-list">
                  <li>Xem danh sách tất cả quy tắc</li>
                  <li>Bật/Tắt quy tắc</li>
                  <li>Chỉnh sửa hoặc xóa quy tắc</li>
                  <li>Xem lịch sử thực thi quy tắc</li>
                </ul>

                <div className="guide-note-box">
                  <Zap size={20} className="guide-note-icon" />
                  <p><strong>Lưu ý:</strong> Quy tắc tự động sẽ chạy theo lịch đã thiết lập. Đảm bảo tài khoản quảng cáo đã được kết nối và có quyền truy cập.</p>
                </div>
              </div>
            </section>

            {/* Service Package */}
            <section id="service-package" className="guide-section">
              <h2 className="guide-section-title">
                <Package size={24} className="guide-section-icon" />
                Gói dịch vụ & Thanh toán
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Hệ thống cung cấp các gói dịch vụ với các mức giới hạn khác nhau về Pages, Employees, và Shops.
                </p>

                <h3 className="guide-subsection-title">Các loại Gói dịch vụ</h3>
                <ul className="guide-features-list">
                  <li><strong>Chatbot:</strong> Gói cơ bản với giới hạn Pages, Employees, Shops</li>
                  <li><strong>Chatbot AI:</strong> Gói nâng cao với nhiều tính năng và giới hạn cao hơn</li>
                </ul>

                <h3 className="guide-subsection-title">Mua Gói dịch vụ</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Gói dịch vụ"</strong> từ menu</li>
                  <li>Xem thông tin các gói có sẵn</li>
                  <li>Chọn gói và thời hạn (3/6/12 tháng)</li>
                  <li>Chọn số lượng:
                    <ul className="guide-nested-list">
                      <li>Pages (Facebook Pages)</li>
                      <li>Employees (Nhân viên)</li>
                      <li>Shops (Cửa hàng)</li>
                    </ul>
                  </li>
                  <li>Nhấn <strong>"Đặt hàng"</strong></li>
                  <li>Chọn phương thức thanh toán:
                    <ul className="guide-nested-list">
                      <li>Momo</li>
                      <li>VietQR</li>
                      <li>Chuyển khoản ngân hàng</li>
                    </ul>
                  </li>
                  <li>Hoàn tất thanh toán</li>
                  <li>Chờ admin duyệt giao dịch</li>
                </ol>

                <h3 className="guide-subsection-title">Xem Gói hiện tại</h3>
                <ul className="guide-features-list">
                  <li>Xem thông tin gói đang sử dụng</li>
                  <li>Kiểm tra giới hạn và mức sử dụng hiện tại</li>
                  <li>Xem ngày hết hạn</li>
                  <li>Nâng cấp gói nếu cần</li>
                </ul>
              </div>
            </section>

            {/* Ad Account */}
            <section id="ad-account" className="guide-section">
              <h2 className="guide-section-title">
                <CreditCard size={24} className="guide-section-icon" />
                Quản lý Tài khoản Quảng cáo
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Kết nối và quản lý các tài khoản quảng cáo Facebook để sử dụng trong hệ thống.
                </p>

                <h3 className="guide-subsection-title">Kết nối Tài khoản Quảng cáo</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Kết nối Tài khoản Quảng cáo"</strong> từ menu</li>
                  <li>Nhấn nút <strong>"Kết nối"</strong></li>
                  <li>Đăng nhập Facebook và cấp quyền truy cập</li>
                  <li>Chọn tài khoản quảng cáo muốn kết nối</li>
                  <li>Xác nhận kết nối</li>
                  <li>Tài khoản sẽ xuất hiện trong danh sách</li>
                </ol>

                <h3 className="guide-subsection-title">Quản lý Tài khoản</h3>
                <ul className="guide-features-list">
                  <li><strong>Xem danh sách:</strong> Tất cả tài khoản đã kết nối</li>
                  <li><strong>Ngắt kết nối:</strong> Xóa tài khoản khỏi hệ thống</li>
                  <li><strong>Đồng bộ:</strong> Đồng bộ dữ liệu từ Facebook</li>
                  <li><strong>Chọn tài khoản mặc định:</strong> Chọn tài khoản để sử dụng khi tạo quảng cáo</li>
                </ul>

                <div className="guide-note-box">
                  <Key size={20} className="guide-note-icon" />
                  <p><strong>Lưu ý:</strong> Đảm bảo tài khoản Facebook của bạn có quyền quản lý tài khoản quảng cáo. Sau khi ngắt kết nối, tất cả dữ liệu liên quan sẽ bị xóa.</p>
                </div>
              </div>
            </section>

            {/* Profile */}
            <section id="profile" className="guide-section">
              <h2 className="guide-section-title">
                <Settings size={24} className="guide-section-icon" />
                Hồ sơ & Cài đặt
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Quản lý thông tin cá nhân và cài đặt tài khoản của bạn.
                </p>

                <h3 className="guide-subsection-title">Cập nhật Thông tin</h3>
                <ol className="guide-steps-list">
                  <li>Vào <strong>"Hồ sơ"</strong> từ menu</li>
                  <li>Cập nhật thông tin:
                    <ul className="guide-nested-list">
                      <li>Họ và tên</li>
                      <li>Email</li>
                      <li>Số điện thoại</li>
                      <li>Ảnh đại diện</li>
                    </ul>
                  </li>
                  <li>Nhấn <strong>"Lưu"</strong> để cập nhật</li>
                </ol>

                <h3 className="guide-subsection-title">Đổi Mật khẩu</h3>
                <ol className="guide-steps-list">
                  <li>Vào phần <strong>"Đổi mật khẩu"</strong> trong Hồ sơ</li>
                  <li>Nhập mật khẩu hiện tại</li>
                  <li>Nhập mật khẩu mới</li>
                  <li>Xác nhận mật khẩu mới</li>
                  <li>Nhấn <strong>"Đổi mật khẩu"</strong></li>
                </ol>

                <h3 className="guide-subsection-title">Cài đặt Khác</h3>
                <ul className="guide-features-list">
                  <li>Ngôn ngữ (Tiếng Việt / English)</li>
                  <li>Thông báo email</li>
                  <li>Xác thực 2 yếu tố (sắp ra mắt)</li>
                </ul>
              </div>
            </section>

            {/* Admin - System Admin */}
            {/* <section id="admin-system" className="guide-section">
              <h2 className="guide-section-title">
                <Shield size={24} className="guide-section-icon" />
                Admin Panel - System Admin
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  System Admin có quyền quản lý toàn bộ hệ thống, bao gồm người dùng, thanh toán, và giám sát hệ thống.
                </p>

                <h3 className="guide-subsection-title">Quản lý Thanh toán</h3>
                <ul className="guide-features-list">
                  <li>Xem tất cả giao dịch thanh toán</li>
                  <li>Duyệt/Từ chối giao dịch</li>
                  <li>Xem chi tiết giao dịch</li>
                  <li>Lọc theo trạng thái, phương thức, gói dịch vụ</li>
                  <li>Thêm ghi chú cho giao dịch</li>
                </ul>

                <h3 className="guide-subsection-title">Quản lý Người dùng</h3>
                <ul className="guide-features-list">
                  <li><strong>Customer:</strong> Xem, chỉnh sửa, xóa khách hàng</li>
                  <li><strong>Internal:</strong> Quản lý nhân viên nội bộ (System Admin, CS Staff, Accountant)</li>
                  <li>Phân quyền và vai trò</li>
                  <li>Xem lịch sử hoạt động</li>
                </ul>

                <h3 className="guide-subsection-title">Giám sát Hệ thống</h3>
                <ul className="guide-features-list">
                  <li><strong>System Log:</strong> Xem log hệ thống, lỗi, và sự kiện</li>
                  <li><strong>Customer Log:</strong> Xem log hoạt động của khách hàng</li>
                  <li>Lọc và tìm kiếm log</li>
                  <li>Xuất báo cáo log</li>
                </ul>
              </div>
            </section> */}

            {/* Admin - CS Staff */}
            {/* <section id="admin-cs" className="guide-section">
              <h2 className="guide-section-title">
                <Users size={24} className="guide-section-icon" />
                Admin Panel - CS Staff
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  CS Staff (Customer Service) hỗ trợ quản lý khách hàng, gói dịch vụ, và thanh toán.
                </p>

                <h3 className="guide-subsection-title">Quản lý Leads</h3>
                <ul className="guide-features-list">
                  <li>Xem danh sách leads (khách hàng tiềm năng)</li>
                  <li>Gán leads cho nhân viên xử lý</li>
                  <li>Thêm ghi chú và cập nhật trạng thái</li>
                  <li>Lọc theo trạng thái, người được gán, segment</li>
                </ul>

                <h3 className="guide-subsection-title">Quản lý Gói dịch vụ</h3>
                <ul className="guide-features-list">
                  <li>Xem tất cả gói dịch vụ của khách hàng</li>
                  <li>Gán salesman cho gói dịch vụ</li>
                  <li>Theo dõi trạng thái: Active, Pending, Cancelled, Expired</li>
                  <li>Xem các segment: New Signup, Expiring Soon, Recently Expired</li>
                  <li>Thêm ghi chú</li>
                </ul>

                <h3 className="guide-subsection-title">Quản lý Thanh toán</h3>
                <ul className="guide-features-list">
                  <li>Xem giao dịch thanh toán</li>
                  <li>Nhận giao dịch để xử lý (Assign)</li>
                  <li>Thêm ghi chú cho giao dịch</li>
                  <li>Lọc theo trạng thái, phương thức, gói dịch vụ</li>
                </ul>
              </div>
            </section> */}

            {/* Admin - Accountant */}
            {/* <section id="admin-accountant" className="guide-section">
              <h2 className="guide-section-title">
                <FileText size={24} className="guide-section-icon" />
                Admin Panel - Accountant
              </h2>
              <div className="guide-section-content">
                <p className="guide-text">
                  Accountant quản lý các giao dịch tài chính và tạo báo cáo doanh thu.
                </p>

                <h3 className="guide-subsection-title">Quản lý Giao dịch</h3>
                <ul className="guide-features-list">
                  <li>Xem tất cả giao dịch thanh toán</li>
                  <li>Lọc theo trạng thái, phương thức, gói dịch vụ</li>
                  <li>Xem chi tiết giao dịch</li>
                  <li>Thêm ghi chú (Remark) cho giao dịch</li>
                  <li>Xuất dữ liệu giao dịch</li>
                </ul>

                <h3 className="guide-subsection-title">Báo cáo Doanh thu</h3>
                <ul className="guide-features-list">
                  <li>Xem báo cáo doanh thu theo gói dịch vụ</li>
                  <li>Tổng doanh thu và số lượng giao dịch</li>
                  <li>Lọc theo phương thức thanh toán</li>
                  <li>Lọc theo khoảng thời gian</li>
                  <li>Xuất báo cáo</li>
                </ul>
              </div>
            </section> */}

            {/* Footer */}
            <footer className="guide-page-footer">
              <p className="guide-footer-text">
                Cần hỗ trợ thêm? Liên hệ với chúng tôi qua email hoặc hotline.
              </p>
              <p className="guide-footer-copyright">
                © 2025 create by AAMS FPT Team. Tất cả quyền được bảo lưu.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Guide;

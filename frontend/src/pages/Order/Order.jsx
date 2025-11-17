import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import "./Order.css";
import axiosInstance from '../../utils/axios';
import { toast } from 'sonner';


function Order() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get selected package from navigation state (from ServicePackage page)
  const selectedPackageFromNav = location.state?.selectedPackage;

  // State management
  const [currentPackage] = useState({
    name: "STARTER",
    customers: 1,
    pages: 1,
    duration: "Không giới hạn",
  });

  // Map package name to type
  const mapPackageName = (name) => {
    if (!name) return "CHATBOT";

    const lower = name.toLowerCase();

    if (lower.includes("chatbot ai")) return "CHATBOT AI";
    if (lower.includes("chatbot")) return "CHATBOT";

    return "CHATBOT";
  };

  const [packages, setPackages] = useState([]);
  // Order form state
  const [packageType, setPackageType] = useState(
    mapPackageName(selectedPackageFromNav?.name)
  );
  const [pages, setPages] = useState(selectedPackageFromNav?.pages);

  const [employees, setEmployees] = useState(selectedPackageFromNav?.employees);
  const [duration, setDuration] = useState(
    selectedPackageFromNav?.duration || "12months"
  );
  const [minPages, setMinPages] = useState("");
  const [minEmployees, setMinEmployees] = useState("");

  const [discountCode, setDiscountCode] = useState("");
  const [includeVAT, setIncludeVAT] = useState(false);

  // VAT information
  const [taxCode, setTaxCode] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Package pricing (per month in VND)
  const [packagePricing, setPackagePricing] = useState({
    CHATBOT: {},
    "CHATBOT AI": {},
  });

  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const res = await axiosInstance.get(`/api/package/`);
        const list = res.data.data;
        if (res.data.success) {
          const mappedPrice = {
            CHATBOT: {},
            "CHATBOT AI": {},
          };
          list.forEach(pkg => {
            const lower = pkg.name.toLowerCase();

            const type =
              lower.includes("chatbot ai") ? "CHATBOT AI" :
                lower.includes("chatbot") ? "CHATBOT" : null;

            const duration =
              lower.includes("3") ? "3months" :
                lower.includes("6") ? "6months" :
                  lower.includes("12") ? "12months" : null;

            if (type && duration) {
              mappedPrice[type][duration] = pkg.price;
            }
          });
          setPackages(list);
          setPackagePricing(mappedPrice);
        } else {
          console.error("Failed to load packages:", res.data.message);
          toast.error(res.data.message || "Không thể tải danh sách packages");
          setPackages([]);
        }
      } catch (error) {
        console.error("Lỗi tải package pricing:", error);
      }
    };

    fetchPackage();
  }, []);

  useEffect(() => {
    if (!packages.length) return;

    // tìm package đầu tiên đúng loại
    const matchedPackage = packages.find(pkg => {
      const lower = pkg.name.toLowerCase();

      if (packageType === "CHATBOT AI" && lower.includes("chatbot ai"))
        return true;
      if (packageType === "CHATBOT" && lower.includes("chatbot") && !lower.includes("ai"))
        return true;

      return false;
    });

    if (matchedPackage) {
      setMinPages(matchedPackage.pages);
      setMinEmployees(matchedPackage.employees);

      // auto set pages / employees nếu chưa có hoặc nhỏ hơn min
      setPages(matchedPackage.pages);
      setEmployees(matchedPackage.employees);
    }
  }, [packageType, packages]);

  // Calculate total price
  const calculateTotal = () => {
    const basePrice = packagePricing[packageType]?.[duration] || 0;
    const durationMultiplier =
      duration === "12months" ? 12 : duration === "6months" ? 6 : 3;
    const employee = (employees - minEmployees) * 20000 * durationMultiplier || 0;
    const page = (pages - minPages) * 20000 * durationMultiplier || 0;
    // const creditAI = credit * 1000 || 0;
    return basePrice * durationMultiplier + employee + page;
  };

  const totalPrice = calculateTotal();

  // Handle upgrade button
  const handleUpgrade = async () => {
    // if (!selectedShop) {
    //   alert("Vui lòng chọn shop để nâng cấp");
    //   return;
    // }

    // Prepare order data
    const orderData = {
      packageType,
      pages,
      employees,
      duration,
      totalPrice,
      discountCode,
      includeVAT,
      taxCode: includeVAT ? taxCode : null,
      companyName: includeVAT ? companyName : null,
    };

    console.log("Order data:", orderData);

    // Gọi API
    try {
      const res = await axiosInstance.post("/api/user-package/order", orderData);

      if (res.data.success) {
        const { transaction } = res.data;

        // Điều hướng sang checkout và truyền transactionId
        navigate("/checkout", {
          state: {
            orderData,
            orderId: transaction._id,
          },
        });
        console.log("order: ", orderData, transaction._id);
      } else {
        alert("Không thể tạo đơn hàng!");
      }
    } catch (error) {
      console.error("Order error:", error);
      alert("Lỗi tạo đơn hàng");
    }
  };

  return (
    <div className="or-page-wrapper">
      <div className="or-container">
        {/* Header */}
        <div className="or-header">
          {/* <h1 className="or-title">VUI LÒNG CHỌN SHOP ĐỂ NÂNG CẤP</h1> */}

          {/* Shop Selector */}
          {/* <select
            className="or-shop-select"
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            <option value="">-- Chọn Shop --</option>
            {shops.map((shop) => (
              <option key={shop._id} value={shop._id}>
                {shop.shop_name}
              </option>
            ))}
          </select> */}
          <br />
          {/* Current Package Info */}
          <div className="or-current-package">
            Đang dùng <strong>{currentPackage.name}</strong> |{" "}
            {currentPackage.customers} Khách | {currentPackage.pages} pages |
            Thời hạn: <strong>{currentPackage.duration}</strong>
          </div>
        </div>

        {/* Order Form */}
        <div className="or-order-card">
          <h2 className="or-order-title">ĐƠN HÀNG CỦA BẠN</h2>

          <div className="or-form-grid">
            {/* Package Type */}
            <div className="or-form-row">
              <label className="or-label">Gói dịch vụ</label>
              <select
                className="or-select"
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
              >
                {/* <option value="MIỄN PHÍ">MIỄN PHÍ</option> */}
                {/* <option value="LIVECHAT">LIVECHAT</option> */}
                <option value="CHATBOT">CHATBOT</option>
                <option value="CHATBOT AI">CHATBOT AI</option>
              </select>
            </div>

            {/* Pages, Customers, Employees */}
            <div className="or-form-row">
              <label className="or-label"></label>
              <div className="or-input-group">
                <div className="or-input-item">
                  <input
                    type="number"
                    className="or-input"
                    value={pages}
                    onChange={(e) => setPages(Number(e.target.value))}
                    min={minPages}
                  />
                  <span className="or-input-label">Pages</span>
                </div>
              </div>
            </div>

            <div className="or-form-row">
              <label className="or-label"></label>
              <div className="or-input-group">
                <div className="or-input-item">
                  <input
                    type="number"
                    className="or-input"
                    value={employees}
                    onChange={(e) => setEmployees(Number(e.target.value))}
                    min={minEmployees}
                  />
                  <span className="or-input-label">Nhân viên</span>
                </div>
              </div>
            </div>

            {/* {packageType === "CHATBOT AI" && (
            <div className="or-form-row">
              <label className="or-label"></label>
              <div className="or-input-group">
                <div className="or-input-item">
                  <input
                    type="number"
                    className="or-input"
                    value={credit}
                    onChange={(e) => setCredit(Number(e.target.value))}
                    min="1000"
                    step="1000"
                  />
                  <span className="or-input-label" title="Số lượt yêu cầu sử dụng AI tạo quảng cáo">Credit AI</span>
                </div>
              </div>
            </div>
            )} */}

            {/* Unit Price */}
            <div className="or-form-row">
              <label className="or-label">Đơn giá</label>
              <div className="or-price-display">
                {(packagePricing[packageType]?.[duration] || 0).toLocaleString("vi-VN")}đ / tháng
              </div>
            </div>

            {/* Duration */}
            <div className="or-form-row">
              <label className="or-label">Thời hạn gói</label>
              <select
                className="or-select"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="3months">3 tháng</option>
                {/* <option value="6months">6 tháng</option> */}
                <option value="12months">1 năm</option>
              </select>
            </div>

            {/* Total */}
            <div className="or-form-row or-total-row">
              <label className="or-label">TỔNG TIỀN</label>
              <div className="or-total-price">
                {totalPrice.toLocaleString("vi-VN")}đ
              </div>
            </div>

            {/* Discount Code */}
            <div className="or-form-row or-discount-row">
              <input
                type="text"
                className="or-discount-input"
                placeholder="Mã giảm giá"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />
              <button className="or-discount-btn">Áp dụng</button>
            </div>

            {/* VAT Checkbox */}
            <div className="or-form-row or-vat-row">
              <label className="or-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeVAT}
                  onChange={(e) => setIncludeVAT(e.target.checked)}
                />
                <span>Xuất hóa đơn VAT</span>
              </label>
            </div>

            {/* VAT Information (shown when checkbox is checked) */}
            {includeVAT && (
              <>
                <div className="or-form-row">
                  <label className="or-label">Mã số thuế</label>
                  <input
                    type="text"
                    className="or-input"
                    placeholder="Nhập mã số thuế"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                  />
                </div>
                <div className="or-form-row">
                  <label className="or-label">Tên đơn vị</label>
                  <input
                    type="text"
                    className="or-input"
                    placeholder="Nhập tên đơn vị"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Upgrade Button */}
            <div className="or-form-row">
              <button className="or-upgrade-btn" onClick={handleUpgrade}>
                <ShoppingCart /> NÂNG CẤP NGAY
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Order;
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import shopService from "../../services/shopService";
import { ShoppingCart } from "lucide-react";
import "./Order.css";

function Order() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get selected package from navigation state (from ServicePackage page)
  const selectedPackageFromNav = location.state?.selectedPackage;

  // State management
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState("");
  const [currentPackage] = useState({
    name: "STARTER",
    customers: 1,
    pages: 1,
    duration: "Không giới hạn",
  });

  // Order form state
  const [packageType, setPackageType] = useState(
    selectedPackageFromNav?.name || "CHATBOT"
  );
  const [pages, setPages] = useState(selectedPackageFromNav?.pages || 5);
  const [customers, setCustomers] = useState(
    selectedPackageFromNav?.customers || 10000
  );
  const [employees, setEmployees] = useState(3);
  const [duration, setDuration] = useState(
    selectedPackageFromNav?.duration || "1 năm"
  );
  const [credit, setCredit] = useState(1000); // Credit for CHATBOT AI
  
  const [discountCode, setDiscountCode] = useState("");
  const [includeVAT, setIncludeVAT] = useState(false);

  // VAT information
  const [taxCode, setTaxCode] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Package pricing (per month in VND)
  const packagePricing = {
    LIVECHAT: 98000,
    CHATBOT: 290000,
    "CHATBOT AI": 980000,
  };

  // Fetch shops
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const response = await shopService.getMyShops();
        if (response?.items && response.items.length > 0) {
          setShops(response.items);
          // Auto-select first shop or saved shop
          const savedShopId = localStorage.getItem("selectedShopId");
          const shopToSelect = savedShopId
            ? response.items.find((s) => s._id === savedShopId)?._id
            : response.items[0]._id;
          setSelectedShop(shopToSelect || "");
        }
      } catch (error) {
        console.error("Error fetching shops:", error);
      }
    };
    fetchShops();
  }, []);

  // Calculate total price
  const calculateTotal = () => {
    const basePrice = packagePricing[packageType] || 0;
    const durationMultiplier =
      duration === "1 năm" ? 12 : duration === "6 tháng" ? 6 : 3;
    return basePrice * durationMultiplier;
  };

  const totalPrice = calculateTotal();

  // Handle upgrade button
  const handleUpgrade = () => {
    if (!selectedShop) {
      alert("Vui lòng chọn shop để nâng cấp");
      return;
    }
    
    // Prepare order data
    const orderData = {
      shop: selectedShop,
      packageType,
      pages,
      customers,
      employees,
      credit: packageType === "CHATBOT AI" ? credit : null,
      duration,
      totalPrice,
      discountCode,
      includeVAT,
      taxCode: includeVAT ? taxCode : null,
      companyName: includeVAT ? companyName : null,
    };

    console.log("Order data:", orderData);

    // Navigate to checkout page with order data
    navigate("/checkout", { state: { orderData } });
  };

  return (
    <div className="or-page-wrapper">
      <div className="or-container">
        {/* Header */}
        <div className="or-header">
          <h1 className="or-title">VUI LÒNG CHỌN SHOP ĐỂ NÂNG CẤP</h1>

          {/* Shop Selector */}
          <select
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
          </select>
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
              <label className="or-label">Gói phần mềm</label>
              <select
                className="or-select"
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
              >
                {/* <option value="MIỄN PHÍ">MIỄN PHÍ</option> */}
                <option value="LIVECHAT">LIVECHAT</option>
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
                    min="5"
                  />
                  <span className="or-input-label">Pages</span>
                </div>
              </div>
            </div>

            {/* Customers - only show if NOT LIVECHAT */}
            {packageType !== "LIVECHAT" && (
              <div className="or-form-row">
                <label className="or-label"></label>
                <div className="or-input-group">
                  <div className="or-input-item">
                    <select
                      className="or-select"
                      value={customers}
                      onChange={(e) => setCustomers(Number(e.target.value))}
                    >
                      <option value="1000">1,000</option>
                      <option value="5000">5,000</option>
                      <option value="10000">10,000</option>
                      <option value="20000">20,000</option>
                      <option value="50000">50,000</option>
                    </select>
                    <span className="or-input-label">Khách hàng</span>
                  </div>
                </div>
              </div>
            )}

            <div className="or-form-row">
              <label className="or-label"></label>
              <div className="or-input-group">
                <div className="or-input-item">
                  <input
                    type="number"
                    className="or-input"
                    value={employees}
                    onChange={(e) => setEmployees(Number(e.target.value))}
                    min="3"
                  />
                  <span className="or-input-label">Nhân viên</span>
                </div>
              </div>
            </div>

            {packageType === "CHATBOT AI" && (
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
            )}

            {/* Unit Price */}
            <div className="or-form-row">
              <label className="or-label">Đơn giá</label>
              <div className="or-price-display">
                {packagePricing[packageType]?.toLocaleString("vi-VN")}đ / tháng
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
                <option value="3 tháng">3 tháng</option>
                <option value="6 tháng">6 tháng</option>
                <option value="1 năm">1 năm</option>
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

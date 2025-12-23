import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./Order.css";
import axiosInstance from '../../utils/api/axios';
import { toast } from 'sonner';


function Order() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Get selected package from navigation state (from ServicePackage page)
  const selectedPackageFromNav = location.state?.selectedPackage;

  // State management
  // const [currentPackage] = useState({
  //   name: "STARTER",
  //   customers: 1,
  //   pages: 1,
  //   duration: "Không giới hạn",
  // });

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

  const [shops, setShops] = useState(selectedPackageFromNav?.shops);

  // Map duration từ planType (DB format) sang UI format
  const mapDurationFromPlanType = (planType) => {
    if (planType === "1year" || planType === "12months") return "12months";
    if (planType === "3months") return "3months";
    return "12months"; // default
  };

  const [duration, setDuration] = useState(() => {
    const initialDuration = selectedPackageFromNav?.duration
      ? mapDurationFromPlanType(selectedPackageFromNav.duration)
      : "12months";
    return initialDuration;
  });
  const [minPages, setMinPages] = useState("");
  const [minEmployees, setMinEmployees] = useState("");

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

            // Map planType từ DB sang duration format trong UI
            // DB có: "3months", "12months"
            // UI dùng: "3months", "12months"
            let duration = null;
            if (pkg.planType === "3months") {
              duration = "3months";
            } else if (pkg.planType === "12months" || pkg.planType === "1year") {
              // Hỗ trợ cả "12months" và "1year" (nếu có)
              duration = "12months";
            }

            if (type && duration) {
              mappedPrice[type][duration] = pkg.price;
            }
          });
          setPackages(list);
          setPackagePricing(mappedPrice);
        } else {
          console.error("Failed to load packages:", res.data.message);
          toast.error(res.data.message || t("order.messages.loadError"));
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
      setShops(matchedPackage.shops);
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
      shops,
      duration,
      totalPrice,
    };

    // console.log("Order data:", orderData);

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
        // console.log("order: ", orderData, transaction._id);
      } else {
        toast.error(t("order.messages.createError"));
      }
    } catch (error) {
      console.error("Order error:", error);
      toast.error(t("order.messages.createErrorGeneric"));
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
          {/* <div className="or-current-package">
            {t("order.currentPackage")} <strong>{currentPackage.name}</strong> |{" "}
            {currentPackage.customers} {t("order.customers")} | {currentPackage.pages} {t("order.pages")} |
            {t("order.duration")}: <strong>{currentPackage.duration}</strong>
          </div> */}
        </div>

        {/* Order Form */}
        <div className="or-order-card">
          <h2 className="or-order-title">{t("order.title")}</h2>

          <div className="or-form-grid">
            {/* Package Type */}
            <div className="or-form-row">
              <label className="or-label">{t("order.labels.packageType")}</label>
              <select
                className="or-select"
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
              >
                {/* <option value="MIỄN PHÍ">MIỄN PHÍ</option> */}
                {/* <option value="LIVECHAT">LIVECHAT</option> */}
                <option value="CHATBOT">{t("order.packageTypes.chatbot")}</option>
                <option value="CHATBOT AI">{t("order.packageTypes.chatbotAi")}</option>
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
                  <span className="or-input-label">{t("servicePackage.stats.pages")}</span>
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
                  <span className="or-input-label">{t("order.labels.employees")}</span>
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
              <label className="or-label">{t("order.labels.unitPrice")}</label>
              <div className="or-price-display" style={{ fontWeight: 'bold', fontSize: '16px', color: '#2563eb' }}>
                {packagePricing[packageType]?.[duration]
                  ? `${(packagePricing[packageType][duration]).toLocaleString("vi-VN")}đ ${t("order.price.perMonth")}`
                  : `0đ ${t("order.price.perMonth")}`}
              </div>
            </div>

            {/* Duration */}
            <div className="or-form-row">
              <label className="or-label">{t("order.labels.packageDuration")}</label>
              <select
                className="or-select"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="3months">{t("order.durations.3months")}</option>
                {/* <option value="6months">{t("order.durations.6months")}</option> */}
                <option value="12months">{t("order.durations.12months")}</option>
              </select>
            </div>

            {/* Total */}
            <div className="or-form-row or-total-row">
              <label className="or-label">{t("order.labels.total")}</label>
              <div className="or-total-price">
                {totalPrice.toLocaleString("vi-VN")}đ
              </div>
            </div>

            {/* Upgrade Button */}
            <div className="or-form-row">
              <button className="or-upgrade-btn" onClick={handleUpgrade}>
                <ShoppingCart /> {t("order.buttons.upgrade")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Order;
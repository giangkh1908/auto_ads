import Invoice from "../../models/invoice.model.js";
import PaymentTransaction from "../../models/paymentTransaction.model.js";
import Package from "../../models/package.model.js";
import { generateInvoiceNumber } from "../../utils/invoiceUtils.js";

/**
 * Tạo invoice tự động từ transaction
 */
export const createInvoice = async (transactionId) => {
  try {
    // Kiểm tra xem invoice đã tồn tại chưa
    const existingInvoice = await Invoice.findOne({
      transaction_id: transactionId,
      deleted_at: null,
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    // Lấy transaction với populate (cần planType để kiểm tra)
    const transaction = await PaymentTransaction.findById(transactionId)
      .populate("user_id", "full_name email phone")
      .populate("package_id", "name price planType");

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "success") {
      throw new Error("Can only create invoice for successful transactions");
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Lấy metadata
    const metadata = transaction.metadata || {};
    const pages = metadata.pages || transaction.package_id?.pages || 0;
    const employees = metadata.employees || transaction.package_id?.employees || 0;
    const duration = metadata.duration || "12months";
    const discountCode = metadata.discountCode || null;
    const includeVAT = metadata.includeVAT || false;
    const taxCode = metadata.taxCode || null;
    const companyName = metadata.companyName || null;

    // Tính toán unit_price
    // Package đã được chọn đúng theo planType khi tạo order
    // Nhưng để chắc chắn, kiểm tra lại package có đúng planType không
    const packagePlanType = transaction.package_id?.planType;
    const durationPlanType = duration === "12months" || duration === "1year" ? "12months" : "3months";
    
    // Nếu package planType không khớp với duration, cần tìm lại package đúng
    let unitPrice = transaction.package_id?.price || transaction.amount;
    
    if (packagePlanType && packagePlanType !== durationPlanType) {
      // Package không khớp, cần tìm lại package đúng theo duration
      const correctPackage = await Package.findOne({
        name: transaction.package_id?.name,
        planType: durationPlanType,
        status: "active",
        deleted_at: null,
      });
      
      if (correctPackage) {
        unitPrice = correctPackage.price;
      }
    }
    
    // Tính subtotal
    const durationMonths = duration === "12months" ? 12 : duration === "6months" ? 6 : 3;
    const subtotal = unitPrice * durationMonths;
    
    // Tính discount (nếu có)
    const discount = 0; // TODO: Tính discount từ discountCode nếu có
    const subtotalAfterDiscount = subtotal - discount;
    
    // Tính VAT (10% nếu includeVAT = true)
    const vatRate = includeVAT ? 0.1 : 0;
    const vat = subtotalAfterDiscount * vatRate;
    const grandTotal = subtotalAfterDiscount + vat;

    // Map payment method
    const methodMap = {
      momo: "Momo",
      vnpay: "VietQR",
      vietqr: "VietQR",
      "manual banking": "Manual Banking",
    };
    const paymentMethod = methodMap[transaction.method?.toLowerCase()] || transaction.method || "-";

    // Tạo invoice
    const invoice = await Invoice.create({
      invoice_number: invoiceNumber,
      transaction_id: transactionId,
      user_id: transaction.user_id._id,
      package_id: transaction.package_id._id,
      seller_info: {
        company_name: "AAMS Platform Co., Ltd",
        address: "Hoa Lac, Hanoi",
      },
      buyer_info: {
        name: transaction.user_id.full_name || "-",
        email: transaction.user_id.email || "",
        phone: transaction.user_id.phone || "",
      },
      invoice_details: {
        invoice_date: transaction.payment_at || transaction.created_at,
        payment_method: paymentMethod,
        payment_time: transaction.payment_at || transaction.created_at,
        status: "PAID",
      },
      service_details: {
        package_name: transaction.package_id?.name || "-",
        pages: pages,
        employees: employees,
        unit_price: unitPrice,
        duration: duration,
        subtotal: subtotal,
        grand_total: grandTotal,
      },
      metadata: {
        discount: discount,
        vat: vat,
        tax_code: taxCode,
        company_name: companyName,
        discount_code: discountCode,
      },
      created_by: transaction.created_by,
    });

    return invoice;
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
};

/**
 * Lấy invoice theo transaction ID
 */
export const getInvoiceByTransactionId = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const invoice = await Invoice.findOne({
      transaction_id: transactionId,
      deleted_at: null,
    })
      .populate("user_id", "full_name email phone")
      .populate("package_id", "name price")
      .populate("transaction_id");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error getting invoice by transaction ID:", error);
    res.status(500).json({
      success: false,
      message: "Error getting invoice",
      error: error.message,
    });
  }
};

/**
 * Lấy invoice theo ID
 */
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate("user_id", "full_name email phone")
      .populate("package_id", "name price")
      .populate("transaction_id");

    if (!invoice || invoice.deleted_at) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Error getting invoice by ID:", error);
    res.status(500).json({
      success: false,
      message: "Error getting invoice",
      error: error.message,
    });
  }
};


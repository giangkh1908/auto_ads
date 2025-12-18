import Invoice from "../models/invoice/invoice.model.js";

/**
 * Generate invoice number với format: INV-YYYYMMDD-XXX
 * Tự động tăng số thứ tự trong ngày
 */
export const generateInvoiceNumber = async () => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const datePrefix = `${year}${month}${day}`;

    // Tìm invoice mới nhất trong ngày
    const startOfDay = new Date(year, today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(year, today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const latestInvoice = await Invoice.findOne({
      invoice_number: { $regex: `^INV-${datePrefix}-` },
      deleted_at: null,
    })
      .sort({ invoice_number: -1 })
      .select("invoice_number");

    let sequenceNumber = 1;

    if (latestInvoice) {
      // Lấy số thứ tự từ invoice number cuối cùng
      const parts = latestInvoice.invoice_number.split("-");
      if (parts.length === 3) {
        const lastSequence = parseInt(parts[2], 10);
        if (!isNaN(lastSequence)) {
          sequenceNumber = lastSequence + 1;
        }
      }
    }

    // Format số thứ tự với 3 chữ số
    const sequenceStr = String(sequenceNumber).padStart(3, "0");
    const invoiceNumber = `INV-${datePrefix}-${sequenceStr}`;

    return invoiceNumber;
  } catch (error) {
    console.error("Error generating invoice number:", error);
    throw error;
  }
};


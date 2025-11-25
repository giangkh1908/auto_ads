import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    // Số hóa đơn (unique, format: INV-YYYYMMDD-XXX)
    invoice_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Transaction liên quan
    transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      required: true,
      unique: true,
    },

    // User (người mua)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Package
    package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },

    // Thông tin người bán (hardcode)
    seller_info: {
      company_name: {
        type: String,
        default: "AAMS Platform Co., Ltd",
      },
      address: {
        type: String,
        default: "Hoa Lac, Hanoi",
      },
    },

    // Thông tin người mua
    buyer_info: {
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
      },
      phone: {
        type: String,
      },
    },

    // Chi tiết hóa đơn
    invoice_details: {
      invoice_date: {
        type: Date,
        required: true,
        default: Date.now,
      },
      payment_method: {
        type: String,
      },
      payment_time: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["PAID", "PENDING", "FAILED"],
        default: "PAID",
      },
    },

    // Chi tiết dịch vụ
    service_details: {
      package_name: {
        type: String,
        required: true,
      },
      pages: {
        type: Number,
        default: 0,
      },
      employees: {
        type: Number,
        default: 0,
      },
      unit_price: {
        type: Number,
        required: true,
      },
      duration: {
        type: String,
      },
      subtotal: {
        type: Number,
        required: true,
      },
      grand_total: {
        type: Number,
        required: true,
      },
    },

    // Metadata bổ sung
    metadata: {
      discount: {
        type: Number,
        default: 0,
      },
      vat: {
        type: Number,
        default: 0,
      },
      tax_code: {
        type: String,
      },
      company_name: {
        type: String,
      },
      discount_code: {
        type: String,
      },
    },

    // Audit
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Indexes
invoiceSchema.index({ invoice_number: 1 }, { unique: true });
invoiceSchema.index({ transaction_id: 1 }, { unique: true });
invoiceSchema.index({ user_id: 1 });
invoiceSchema.index({ created_at: -1 });

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;


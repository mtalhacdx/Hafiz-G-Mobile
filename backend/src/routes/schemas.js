const { z } = require("zod");

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const isTodayOrFuture = (value) => {
  const dateValue = new Date(value);
  const inputDay = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return inputDay >= today;
};

const bootstrapAuthSchema = z.object({
  email: z.email("Valid email is required").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(/[A-Z]/, "New password must include at least one uppercase letter")
    .regex(/[a-z]/, "New password must include at least one lowercase letter")
    .regex(/[0-9]/, "New password must include at least one number"),
});

const managerCreateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  username: z.string().min(1, "Username is required").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

const managerResetPasswordSchema = z.object({
  newPassword: z.string().min(1, "Password is required"),
});

const managerStatusSchema = z.object({
  isActive: z.boolean(),
});

const categoryCreateSchema = z.object({
  categoryName: z.string().min(2, "Category name is required"),
  description: z.string().optional().default(""),
});

const categoryUpdateSchema = z.object({
  categoryName: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const brandCreateSchema = z.object({
  brandName: z.string().min(2, "Brand name is required"),
  description: z.string().optional().default(""),
});

const brandUpdateSchema = z.object({
  brandName: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const productCreateSchema = z
  .object({
    name: z.string().min(2, "Product name is required"),
    brandName: z.string().min(2, "Brand name is required"),
    categoryId: objectId,
    purchasePrice: z.number().nonnegative().multipleOf(10, "Purchase price must be in tens"),
    salePrice: z.number().nonnegative().multipleOf(10, "Sale price must be in tens"),
    stockQuantity: z.number().int().nonnegative().default(0),
    minStockLevel: z.number().int().nonnegative().default(10),
    supplierId: objectId.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.purchasePrice >= value.salePrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sale price must be greater than purchase price",
        path: ["salePrice"],
      });
    }
  });

const productUpdateSchema = z
  .object({
    name: z.string().min(2).optional(),
    brandName: z.string().min(2).optional(),
    categoryId: objectId.optional(),
    purchasePrice: z
      .number()
      .nonnegative()
      .multipleOf(10, "Purchase price must be in tens")
      .optional(),
    salePrice: z.number().nonnegative().multipleOf(10, "Sale price must be in tens").optional(),
    minStockLevel: z.number().int().nonnegative().optional(),
    supplierId: objectId.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      typeof value.purchasePrice === "number" &&
      typeof value.salePrice === "number" &&
      value.purchasePrice >= value.salePrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sale price must be greater than purchase price",
        path: ["salePrice"],
      });
    }
  });

const supplierCreateSchema = z.object({
  name: z.string().min(2, "Supplier name is required"),
  phone: z.string().min(5, "Supplier phone is required"),
  address: z.string().optional().default(""),
});

const supplierUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

const customerCreateSchema = z.object({
  name: z.string().min(2, "Customer name is required"),
  phone: z.string().min(5, "Customer phone is required"),
  address: z.string().optional().default(""),
});

const customerUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

const purchaseItemSchema = z.object({
  productId: objectId,
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

const purchaseCreateSchema = z.object({
  supplierId: objectId,
  date: z.coerce.date().refine(isTodayOrFuture, "Purchase date cannot be in the past"),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]).default("unpaid"),
  paidAmount: z.number().nonnegative().optional().default(0),
});

const salesItemSchema = z.object({
  productId: objectId,
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

const salesCreateSchema = z.object({
  customerId: objectId.optional().nullable(),
  date: z.coerce.date().refine(isTodayOrFuture, "Invoice date cannot be in the past"),
  items: z.array(salesItemSchema).min(1, "At least one item is required"),
  discount: z.number().nonnegative().optional().default(0),
  tax: z.number().nonnegative().optional().default(0),
  paymentMethod: z.enum(["cash", "bank", "card", "upi", "other"]).default("cash"),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]).default("paid"),
  paidAmount: z.number().nonnegative().optional(),
});

const salesPaymentUpdateSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.enum(["cash", "bank", "card", "upi", "other"]),
});

const purchasePaymentUpdateSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.enum(["cash", "bank", "card", "upi", "other"]),
});

const returnItemSchema = z.object({
  productId: objectId,
  quantity: z.number().int().positive(),
  reason: z.string().optional().default(""),
});

const returnCreateSchema = z.object({
  saleInvoiceId: objectId,
  date: z.coerce.date(),
  items: z.array(returnItemSchema).min(1, "At least one return line is required"),
  refundMethod: z.enum(["cash", "bank", "card", "upi", "other", "adjustment"]).default("adjustment"),
  notes: z.string().optional().default(""),
});

const claimCreateSchema = z
  .object({
    invoiceId: objectId,
    purchaseInvoiceId: objectId.optional(),
    productId: objectId,
    quantity: z.number().int().positive(),
    reason: z.string().min(3, "Claim reason is required"),
    replacementGiven: z.boolean().default(false),
    refundGiven: z.boolean().default(false),
    refundAmount: z.number().nonnegative().optional().default(0),
    notes: z.string().optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.replacementGiven === value.refundGiven) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select exactly one: replacement or refund",
        path: ["replacementGiven"],
      });
    }

    if (value.refundGiven && Number(value.refundAmount || 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Refund amount must be greater than zero",
        path: ["refundAmount"],
      });
    }
  });

const claimSendSchema = z.object({
  notes: z.string().optional().default(""),
});

const claimAcceptSchema = z.object({
  notes: z.string().optional().default(""),
});

const claimRejectSchema = z.object({
  notes: z.string().optional().default(""),
});

const claimCloseSchema = z.object({
  notes: z.string().optional().default(""),
});

module.exports = {
  bootstrapAuthSchema,
  loginSchema,
  passwordChangeSchema,
  managerCreateSchema,
  managerResetPasswordSchema,
  managerStatusSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  brandCreateSchema,
  brandUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  customerCreateSchema,
  customerUpdateSchema,
  purchaseCreateSchema,
  salesCreateSchema,
  salesPaymentUpdateSchema,
  purchasePaymentUpdateSchema,
  returnCreateSchema,
  claimCreateSchema,
  claimSendSchema,
  claimAcceptSchema,
  claimRejectSchema,
  claimCloseSchema,
};

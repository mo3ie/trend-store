// Client-safe labels for the marketplace UI.
export const COND: Record<string, string> = { like_new: "كالجديد", good: "جيد", fair: "مقبول", parts: "قطع غيار" };
export const ORDER_LABEL: Record<string, string> = {
  held: "مدفوع — المبلغ محجوز عند ترند", handed_over: "تم التسليم — فترة الفحص", completed: "مكتمل — المبلغ عند البائع",
  disputed: "في نزاع — الإدارة تراجع", refunded: "مسترجع للمشتري", cancelled: "ملغي",
};
export const LISTING_LABEL: Record<string, string> = { pending: "قيد المراجعة", active: "منشور", reserved: "محجوز", sold: "مباع", rejected: "مرفوض", removed: "محذوف" };

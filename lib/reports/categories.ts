// ─────────────────────────────────────────────────────────────────────────────
// Reports Engine — Category & Report Definitions (Config-Driven)
// ─────────────────────────────────────────────────────────────────────────────

import type { ReportCategory, ReportCategoryId, ReportDefinition } from "./types";

// ─── Revenue Reports ─────────────────────────────────────────────────────────

const revenueReports: ReportDefinition[] = [
  {
    id: "revenue_total",
    label: "סה\"כ הכנסות",
    category: "revenue",
    entity: "payments",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "area", "stacked_bar", "pie", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["day", "week", "month", "year", "room", "room_type", "building", "channel", "source", "country", "guest", "employee"],
    kpis: [
      { id: "total_revenue", label: "סה\"כ הכנסות", format: "currency", tone: "tone-card-blue" },
      { id: "revenue_growth", label: "צמיחה", format: "percent", tone: "tone-card-mint" },
      { id: "avg_booking_value", label: "ממוצע הזמנה", format: "currency", tone: "tone-card-violet" },
      { id: "unpaid_amount", label: "יתרת חוב", format: "currency", tone: "tone-card-rose" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "transactions", header: "עסקאות", format: "number", sortable: true },
      { key: "avg_value", header: "ממוצע", format: "currency", sortable: true },
      { key: "growth", header: "צמיחה", format: "percent", sortable: true },
    ],
    defaultSort: "newest",
  },
  {
    id: "revenue_by_room",
    label: "הכנסות לפי חדר",
    category: "revenue",
    entity: "payments",
    defaultChart: "bar",
    supportedCharts: ["bar", "stacked_bar", "pie", "table", "leaderboard"],
    defaultGroupBy: "room",
    supportedGroupBy: ["room", "room_type", "building", "floor"],
    kpis: [
      { id: "top_room", label: "חדר מוביל", format: "currency", tone: "tone-card-blue" },
      { id: "avg_room_revenue", label: "ממוצע לחדר", format: "currency", tone: "tone-card-mint" },
      { id: "total_rooms", label: "חדרים פעילים", format: "number", tone: "tone-card-violet" },
      { id: "revpar", label: "RevPAR", format: "currency", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "room", header: "חדר", format: "text" },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "nights", header: "לילות", format: "number", sortable: true },
      { key: "adr", header: "ADR", format: "currency", sortable: true },
      { key: "occupancy", header: "תפוסה", format: "percent", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "revenue_by_channel",
    label: "הכנסות לפי ערוץ",
    category: "revenue",
    entity: "payments",
    defaultChart: "pie",
    supportedCharts: ["pie", "bar", "stacked_bar", "table"],
    defaultGroupBy: "channel",
    supportedGroupBy: ["channel", "source", "month"],
    kpis: [
      { id: "top_channel", label: "ערוץ מוביל", format: "currency", tone: "tone-card-blue" },
      { id: "direct_share", label: "אחוז ישיר", format: "percent", tone: "tone-card-mint" },
      { id: "ota_share", label: "אחוז OTA", format: "percent", tone: "tone-card-violet" },
      { id: "adr", label: "ADR", format: "currency", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "channel", header: "ערוץ", format: "text" },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "bookings", header: "הזמנות", format: "number", sortable: true },
      { key: "share", header: "נתח", format: "percent", sortable: true },
      { key: "avg_value", header: "ממוצע", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "revenue_by_payment_method",
    label: "הכנסות לפי אמצעי תשלום",
    category: "revenue",
    entity: "payments",
    defaultChart: "pie",
    supportedCharts: ["pie", "bar", "table"],
    defaultGroupBy: "payment_status",
    supportedGroupBy: ["payment_status", "month"],
    kpis: [
      { id: "cash_total", label: "מזומן", format: "currency", tone: "tone-card-blue" },
      { id: "credit_total", label: "אשראי", format: "currency", tone: "tone-card-mint" },
      { id: "transfer_total", label: "העברה", format: "currency", tone: "tone-card-violet" },
      { id: "pending_total", label: "ממתין", format: "currency", tone: "tone-card-rose" },
    ],
    columns: [
      { key: "method", header: "אמצעי תשלום", format: "text" },
      { key: "amount", header: "סכום", format: "currency", sortable: true },
      { key: "count", header: "עסקאות", format: "number", sortable: true },
      { key: "share", header: "נתח", format: "percent", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "outstanding_balance",
    label: "יתרות חוב פתוחות",
    category: "revenue",
    entity: "payments",
    defaultChart: "bar",
    supportedCharts: ["bar", "table", "leaderboard"],
    defaultGroupBy: "guest",
    supportedGroupBy: ["guest", "room", "building", "month"],
    kpis: [
      { id: "total_outstanding", label: "סה\"כ חוב", format: "currency", tone: "tone-card-rose" },
      { id: "debtors_count", label: "חייבים", format: "number", tone: "tone-card-amber" },
      { id: "avg_debt", label: "חוב ממוצע", format: "currency", tone: "tone-card-violet" },
      { id: "overdue_count", label: "באיחור", format: "number", tone: "tone-card-rose" },
    ],
    columns: [
      { key: "name", header: "שם", format: "text" },
      { key: "unit", header: "דירה", format: "text" },
      { key: "amount", header: "סכום חוב", format: "currency", sortable: true },
      { key: "due_date", header: "תאריך יעד", format: "date", sortable: true },
      { key: "status", header: "סטטוס", format: "status" },
    ],
    defaultSort: "highest",
  },
];

// ─── Occupancy Reports ───────────────────────────────────────────────────────

const occupancyReports: ReportDefinition[] = [
  {
    id: "occupancy_overview",
    label: "סקירת תפוסה",
    category: "occupancy",
    entity: "reservations",
    defaultChart: "area",
    supportedCharts: ["area", "bar", "line", "stacked_bar", "heatmap", "calendar", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["day", "week", "month", "year", "room", "room_type", "building", "floor", "channel", "country"],
    kpis: [
      { id: "occupancy_rate", label: "אחוז תפוסה", format: "percent", tone: "tone-card-blue" },
      { id: "available_rooms", label: "חדרים פנויים", format: "number", tone: "tone-card-mint" },
      { id: "occupied_rooms", label: "חדרים תפוסים", format: "number", tone: "tone-card-violet" },
      { id: "avg_stay", label: "ממוצע שהייה", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "occupancy", header: "תפוסה", format: "percent", sortable: true },
      { key: "rooms_occupied", header: "תפוסים", format: "number", sortable: true },
      { key: "rooms_available", header: "פנויים", format: "number", sortable: true },
      { key: "avg_stay", header: "ממוצע שהייה", format: "number", sortable: true },
    ],
    defaultSort: "newest",
  },
  {
    id: "occupancy_by_room_type",
    label: "תפוסה לפי סוג חדר",
    category: "occupancy",
    entity: "reservations",
    defaultChart: "stacked_bar",
    supportedCharts: ["stacked_bar", "bar", "pie", "table"],
    defaultGroupBy: "room_type",
    supportedGroupBy: ["room_type", "room", "building", "floor", "month"],
    kpis: [
      { id: "most_occupied_type", label: "סוג מוביל", format: "percent", tone: "tone-card-blue" },
      { id: "least_occupied_type", label: "סוג נמוך", format: "percent", tone: "tone-card-rose" },
      { id: "total_nights", label: "סה\"כ לילות", format: "number", tone: "tone-card-mint" },
      { id: "peak_day", label: "יום שיא", format: "text" as "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "room_type", header: "סוג חדר", format: "text" },
      { key: "occupancy", header: "תפוסה", format: "percent", sortable: true },
      { key: "nights", header: "לילות", format: "number", sortable: true },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "occupancy_forecast",
    label: "תחזית תפוסה",
    category: "occupancy",
    entity: "reservations",
    defaultChart: "line",
    supportedCharts: ["line", "area", "bar", "table"],
    defaultGroupBy: "day",
    supportedGroupBy: ["day", "week", "month"],
    kpis: [
      { id: "forecast_occupancy", label: "תפוסה צפויה", format: "percent", tone: "tone-card-blue" },
      { id: "confirmed_bookings", label: "הזמנות מאושרות", format: "number", tone: "tone-card-mint" },
      { id: "pending_bookings", label: "ממתינות", format: "number", tone: "tone-card-amber" },
      { id: "empty_rooms_forecast", label: "חדרים פנויים", format: "number", tone: "tone-card-violet" },
    ],
    columns: [
      { key: "date", header: "תאריך", format: "date", sortable: true },
      { key: "forecast", header: "תחזית", format: "percent" },
      { key: "confirmed", header: "מאושר", format: "number" },
      { key: "pending", header: "ממתין", format: "number" },
      { key: "available", header: "פנוי", format: "number" },
    ],
    defaultSort: "newest",
  },
];

// ─── Reservation Reports ─────────────────────────────────────────────────────

const reservationReports: ReportDefinition[] = [
  {
    id: "reservations_overview",
    label: "סקירת הזמנות",
    category: "reservations",
    entity: "reservations",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "area", "stacked_bar", "pie", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["day", "week", "month", "year", "room", "room_type", "building", "channel", "source", "country", "employee", "reservation_status"],
    kpis: [
      { id: "total_reservations", label: "סה\"כ הזמנות", format: "number", tone: "tone-card-blue" },
      { id: "confirmed", label: "מאושרות", format: "number", tone: "tone-card-mint" },
      { id: "cancelled", label: "מבוטלות", format: "number", tone: "tone-card-rose" },
      { id: "no_shows", label: "לא הגיעו", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "total", header: "סה\"כ", format: "number", sortable: true },
      { key: "confirmed", header: "מאושרות", format: "number", sortable: true },
      { key: "cancelled", header: "מבוטלות", format: "number", sortable: true },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
    ],
    defaultSort: "newest",
  },
  {
    id: "reservations_by_status",
    label: "הזמנות לפי סטטוס",
    category: "reservations",
    entity: "reservations",
    defaultChart: "pie",
    supportedCharts: ["pie", "bar", "table"],
    defaultGroupBy: "reservation_status",
    supportedGroupBy: ["reservation_status", "month", "channel"],
    kpis: [
      { id: "pending_checkin", label: "ממתינים לצ׳ק-אין", format: "number", tone: "tone-card-blue" },
      { id: "pending_checkout", label: "ממתינים לצ׳ק-אאוט", format: "number", tone: "tone-card-mint" },
      { id: "future_reservations", label: "הזמנות עתידיות", format: "number", tone: "tone-card-violet" },
      { id: "unpaid_reservations", label: "לא שולמו", format: "number", tone: "tone-card-rose" },
    ],
    columns: [
      { key: "status", header: "סטטוס", format: "status" },
      { key: "count", header: "כמות", format: "number", sortable: true },
      { key: "share", header: "נתח", format: "percent", sortable: true },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "booking_lead_time",
    label: "זמן הזמנה מראש",
    category: "reservations",
    entity: "reservations",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "channel", "source"],
    kpis: [
      { id: "avg_lead_days", label: "ממוצע ימים", format: "number", tone: "tone-card-blue" },
      { id: "same_day", label: "הזמנות באותו יום", format: "number", tone: "tone-card-amber" },
      { id: "advance_30", label: "מעל 30 יום", format: "number", tone: "tone-card-mint" },
      { id: "advance_90", label: "מעל 90 יום", format: "number", tone: "tone-card-violet" },
    ],
    columns: [
      { key: "range", header: "טווח ימים", format: "text" },
      { key: "count", header: "הזמנות", format: "number", sortable: true },
      { key: "share", header: "נתח", format: "percent", sortable: true },
      { key: "avg_value", header: "ערך ממוצע", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
];

// ─── Guest Reports ───────────────────────────────────────────────────────────

const guestReports: ReportDefinition[] = [
  {
    id: "guest_overview",
    label: "סקירת אורחים",
    category: "guests",
    entity: "guests",
    defaultChart: "bar",
    supportedCharts: ["bar", "pie", "leaderboard", "table"],
    defaultGroupBy: "country",
    supportedGroupBy: ["country", "city", "month", "channel", "source"],
    kpis: [
      { id: "total_guests", label: "סה\"כ אורחים", format: "number", tone: "tone-card-blue" },
      { id: "repeat_guests", label: "חוזרים", format: "number", tone: "tone-card-mint" },
      { id: "vip_guests", label: "VIP", format: "number", tone: "tone-card-violet" },
      { id: "avg_spend", label: "הוצאה ממוצעת", format: "currency", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "name", header: "שם", format: "text" },
      { key: "country", header: "מדינה", format: "text" },
      { key: "visits", header: "ביקורים", format: "number", sortable: true },
      { key: "total_spend", header: "סה\"כ הוצאה", format: "currency", sortable: true },
      { key: "last_visit", header: "ביקור אחרון", format: "date", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "top_guests",
    label: "אורחים מובילים",
    category: "guests",
    entity: "guests",
    defaultChart: "leaderboard",
    supportedCharts: ["leaderboard", "bar", "table"],
    defaultGroupBy: "guest",
    supportedGroupBy: ["guest", "country"],
    kpis: [
      { id: "top_guest_revenue", label: "הכנסה מאורח מוביל", format: "currency", tone: "tone-card-blue" },
      { id: "top_guest_stays", label: "שהיות אורח מוביל", format: "number", tone: "tone-card-mint" },
      { id: "avg_guest_revenue", label: "הכנסה ממוצעת", format: "currency", tone: "tone-card-violet" },
      { id: "repeat_rate", label: "אחוז חזרה", format: "percent", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "rank", header: "#", format: "number" },
      { key: "name", header: "שם", format: "text" },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "stays", header: "שהיות", format: "number", sortable: true },
      { key: "avg_stay", header: "ממוצע שהייה", format: "number", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "guest_nationality",
    label: "אורחים לפי לאום",
    category: "guests",
    entity: "guests",
    defaultChart: "pie",
    supportedCharts: ["pie", "bar", "table"],
    defaultGroupBy: "country",
    supportedGroupBy: ["country", "city", "month"],
    kpis: [
      { id: "top_country", label: "מדינה מובילה", format: "number", tone: "tone-card-blue" },
      { id: "countries_count", label: "מדינות", format: "number", tone: "tone-card-mint" },
      { id: "domestic_share", label: "אחוז מקומי", format: "percent", tone: "tone-card-violet" },
      { id: "international_share", label: "אחוז בינ\"ל", format: "percent", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "country", header: "מדינה", format: "text" },
      { key: "guests", header: "אורחים", format: "number", sortable: true },
      { key: "share", header: "נתח", format: "percent", sortable: true },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "avg_stay", header: "ממוצע שהייה", format: "number", sortable: true },
    ],
    defaultSort: "highest",
  },
];

// ─── Room Reports ────────────────────────────────────────────────────────────

const roomReports: ReportDefinition[] = [
  {
    id: "room_performance",
    label: "ביצועי חדרים",
    category: "rooms",
    entity: "rooms",
    defaultChart: "bar",
    supportedCharts: ["bar", "stacked_bar", "leaderboard", "table"],
    defaultGroupBy: "room",
    supportedGroupBy: ["room", "room_type", "building", "floor"],
    kpis: [
      { id: "best_room", label: "חדר מוביל", format: "currency", tone: "tone-card-blue" },
      { id: "worst_room", label: "חדר נמוך", format: "currency", tone: "tone-card-rose" },
      { id: "avg_revenue", label: "ממוצע לחדר", format: "currency", tone: "tone-card-mint" },
      { id: "out_of_order", label: "לא זמין", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "room", header: "חדר", format: "text" },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "occupancy", header: "תפוסה", format: "percent", sortable: true },
      { key: "adr", header: "ADR", format: "currency", sortable: true },
      { key: "issues", header: "תקלות", format: "number", sortable: true },
      { key: "status", header: "סטטוס", format: "status" },
    ],
    defaultSort: "highest",
  },
  {
    id: "room_maintenance",
    label: "תחזוקת חדרים",
    category: "rooms",
    entity: "rooms",
    defaultChart: "bar",
    supportedCharts: ["bar", "stacked_bar", "table"],
    defaultGroupBy: "room",
    supportedGroupBy: ["room", "room_type", "building", "month"],
    kpis: [
      { id: "total_issues", label: "סה\"כ תקלות", format: "number", tone: "tone-card-rose" },
      { id: "avg_resolution", label: "זמן טיפול ממוצע", format: "number", tone: "tone-card-blue" },
      { id: "open_issues", label: "תקלות פתוחות", format: "number", tone: "tone-card-amber" },
      { id: "downtime_days", label: "ימי השבתה", format: "number", tone: "tone-card-violet" },
    ],
    columns: [
      { key: "room", header: "חדר", format: "text" },
      { key: "issues", header: "תקלות", format: "number", sortable: true },
      { key: "avg_resolution", header: "זמן טיפול", format: "text" },
      { key: "downtime", header: "השבתה", format: "number", sortable: true },
      { key: "cost", header: "עלות", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
];

// ─── Channel Reports ─────────────────────────────────────────────────────────

const channelReports: ReportDefinition[] = [
  {
    id: "channel_performance",
    label: "ביצועי ערוצים",
    category: "channels",
    entity: "reservations",
    defaultChart: "bar",
    supportedCharts: ["bar", "pie", "stacked_bar", "table"],
    defaultGroupBy: "channel",
    supportedGroupBy: ["channel", "source", "month"],
    kpis: [
      { id: "top_channel_revenue", label: "ערוץ מוביל", format: "currency", tone: "tone-card-blue" },
      { id: "direct_vs_ota", label: "ישיר vs OTA", format: "percent", tone: "tone-card-mint" },
      { id: "cancel_rate", label: "אחוז ביטול", format: "percent", tone: "tone-card-rose" },
      { id: "avg_lead_time", label: "זמן הזמנה ממוצע", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "channel", header: "ערוץ", format: "text" },
      { key: "reservations", header: "הזמנות", format: "number", sortable: true },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
      { key: "cancel_rate", header: "ביטולים", format: "percent", sortable: true },
      { key: "no_show_rate", header: "לא הגיעו", format: "percent", sortable: true },
      { key: "adr", header: "ADR", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "channel_comparison",
    label: "השוואת ערוצים",
    category: "channels",
    entity: "reservations",
    defaultChart: "stacked_bar",
    supportedCharts: ["stacked_bar", "bar", "line", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "week", "day"],
    kpis: [
      { id: "booking_share", label: "נתח Booking", format: "percent", tone: "tone-card-blue" },
      { id: "airbnb_share", label: "נתח Airbnb", format: "percent", tone: "tone-card-rose" },
      { id: "direct_share", label: "נתח ישיר", format: "percent", tone: "tone-card-mint" },
      { id: "other_share", label: "אחר", format: "percent", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "booking", header: "Booking", format: "number", sortable: true },
      { key: "airbnb", header: "Airbnb", format: "number", sortable: true },
      { key: "direct", header: "ישיר", format: "number", sortable: true },
      { key: "other", header: "אחר", format: "number", sortable: true },
    ],
    defaultSort: "newest",
  },
];

// ─── Marketing Reports ───────────────────────────────────────────────────────

const marketingReports: ReportDefinition[] = [
  {
    id: "marketing_leads",
    label: "לידים לפי מקור",
    category: "marketing",
    entity: "guests",
    defaultChart: "pie",
    supportedCharts: ["pie", "bar", "funnel", "table"],
    defaultGroupBy: "source",
    supportedGroupBy: ["source", "channel", "month"],
    kpis: [
      { id: "total_leads", label: "סה\"כ לידים", format: "number", tone: "tone-card-blue" },
      { id: "conversion_rate", label: "המרה", format: "percent", tone: "tone-card-mint" },
      { id: "cost_per_lead", label: "עלות ליד", format: "currency", tone: "tone-card-amber" },
      { id: "cost_per_booking", label: "עלות הזמנה", format: "currency", tone: "tone-card-violet" },
    ],
    columns: [
      { key: "source", header: "מקור", format: "text" },
      { key: "leads", header: "לידים", format: "number", sortable: true },
      { key: "conversions", header: "המרות", format: "number", sortable: true },
      { key: "rate", header: "אחוז המרה", format: "percent", sortable: true },
      { key: "revenue", header: "הכנסות", format: "currency", sortable: true },
    ],
    defaultSort: "highest",
  },
  {
    id: "whatsapp_marketing",
    label: "שיווק WhatsApp",
    category: "marketing",
    entity: "whatsapp",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "week", "day"],
    kpis: [
      { id: "messages_sent", label: "הודעות נשלחו", format: "number", tone: "tone-card-blue" },
      { id: "response_rate", label: "אחוז תגובה", format: "percent", tone: "tone-card-mint" },
      { id: "avg_response_time", label: "זמן תגובה", format: "number", tone: "tone-card-amber" },
      { id: "conversions", label: "המרות", format: "number", tone: "tone-card-violet" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "sent", header: "נשלחו", format: "number", sortable: true },
      { key: "received", header: "התקבלו", format: "number", sortable: true },
      { key: "response_rate", header: "תגובה", format: "percent", sortable: true },
      { key: "conversions", header: "המרות", format: "number", sortable: true },
    ],
    defaultSort: "newest",
  },
];

// ─── Payment Reports ─────────────────────────────────────────────────────────

const paymentReports: ReportDefinition[] = [
  {
    id: "payment_overview",
    label: "סקירת תשלומים",
    category: "payments",
    entity: "payments",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "pie", "stacked_bar", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "week", "day", "payment_status", "guest", "room"],
    kpis: [
      { id: "total_collected", label: "נגבה", format: "currency", tone: "tone-card-mint" },
      { id: "total_pending", label: "ממתין", format: "currency", tone: "tone-card-amber" },
      { id: "total_overdue", label: "באיחור", format: "currency", tone: "tone-card-rose" },
      { id: "collection_rate", label: "אחוז גבייה", format: "percent", tone: "tone-card-blue" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "collected", header: "נגבה", format: "currency", sortable: true },
      { key: "pending", header: "ממתין", format: "currency", sortable: true },
      { key: "overdue", header: "באיחור", format: "currency", sortable: true },
      { key: "rate", header: "גבייה", format: "percent", sortable: true },
    ],
    defaultSort: "newest",
  },
];

// ─── Cancellation Reports ────────────────────────────────────────────────────

const cancellationReports: ReportDefinition[] = [
  {
    id: "cancellation_overview",
    label: "סקירת ביטולים",
    category: "cancellations",
    entity: "reservations",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "pie", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "channel", "source", "room_type", "country"],
    kpis: [
      { id: "total_cancellations", label: "סה\"כ ביטולים", format: "number", tone: "tone-card-rose" },
      { id: "cancel_rate", label: "אחוז ביטול", format: "percent", tone: "tone-card-amber" },
      { id: "lost_revenue", label: "הכנסה שאבדה", format: "currency", tone: "tone-card-rose" },
      { id: "avg_cancel_lead", label: "ימים לפני הגעה", format: "number", tone: "tone-card-blue" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "cancellations", header: "ביטולים", format: "number", sortable: true },
      { key: "rate", header: "אחוז", format: "percent", sortable: true },
      { key: "lost_revenue", header: "הכנסה שאבדה", format: "currency", sortable: true },
      { key: "avg_lead", header: "ימים לפני", format: "number", sortable: true },
    ],
    defaultSort: "newest",
  },
];

// ─── Housekeeping Reports ────────────────────────────────────────────────────

const housekeepingReports: ReportDefinition[] = [
  {
    id: "housekeeping_overview",
    label: "סקירת ניקיון",
    category: "housekeeping",
    entity: "tasks",
    defaultChart: "bar",
    supportedCharts: ["bar", "stacked_bar", "table"],
    defaultGroupBy: "room",
    supportedGroupBy: ["room", "room_type", "building", "floor", "employee", "month"],
    kpis: [
      { id: "total_cleanings", label: "סה\"כ ניקיונות", format: "number", tone: "tone-card-blue" },
      { id: "avg_time", label: "זמן ממוצע", format: "number", tone: "tone-card-mint" },
      { id: "pending_rooms", label: "ממתינים", format: "number", tone: "tone-card-amber" },
      { id: "avg_turnaround", label: "זמן מחזור", format: "number", tone: "tone-card-violet" },
    ],
    columns: [
      { key: "room", header: "חדר", format: "text" },
      { key: "cleanings", header: "ניקיונות", format: "number", sortable: true },
      { key: "avg_time", header: "זמן ממוצע", format: "text" },
      { key: "employee", header: "עובד", format: "text" },
      { key: "status", header: "סטטוס", format: "status" },
    ],
    defaultSort: "highest",
  },
];

// ─── Maintenance Reports ─────────────────────────────────────────────────────

const maintenanceReports: ReportDefinition[] = [
  {
    id: "maintenance_overview",
    label: "סקירת תחזוקה",
    category: "maintenance",
    entity: "issues",
    defaultChart: "bar",
    supportedCharts: ["bar", "stacked_bar", "pie", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "room", "building", "employee"],
    kpis: [
      { id: "total_tickets", label: "סה\"כ תקלות", format: "number", tone: "tone-card-blue" },
      { id: "open_tickets", label: "פתוחות", format: "number", tone: "tone-card-amber" },
      { id: "avg_resolution", label: "זמן טיפול", format: "number", tone: "tone-card-mint" },
      { id: "total_cost", label: "עלות כוללת", format: "currency", tone: "tone-card-rose" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "tickets", header: "תקלות", format: "number", sortable: true },
      { key: "resolved", header: "טופלו", format: "number", sortable: true },
      { key: "open", header: "פתוחות", format: "number", sortable: true },
      { key: "cost", header: "עלות", format: "currency", sortable: true },
    ],
    defaultSort: "newest",
  },
];

// ─── Staff Reports ───────────────────────────────────────────────────────────

const staffReports: ReportDefinition[] = [
  {
    id: "staff_performance",
    label: "ביצועי עובדים",
    category: "staff",
    entity: "employees",
    defaultChart: "leaderboard",
    supportedCharts: ["leaderboard", "bar", "table"],
    defaultGroupBy: "employee",
    supportedGroupBy: ["employee", "month"],
    kpis: [
      { id: "total_staff", label: "סה\"כ עובדים", format: "number", tone: "tone-card-blue" },
      { id: "tasks_completed", label: "משימות שהושלמו", format: "number", tone: "tone-card-mint" },
      { id: "avg_tasks", label: "ממוצע למשתמש", format: "number", tone: "tone-card-violet" },
      { id: "top_performer", label: "עובד מוביל", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "rank", header: "#", format: "number" },
      { key: "name", header: "שם", format: "text" },
      { key: "tasks", header: "משימות", format: "number", sortable: true },
      { key: "completed", header: "הושלמו", format: "number", sortable: true },
      { key: "avg_time", header: "זמן ממוצע", format: "text" },
    ],
    defaultSort: "highest",
  },
];

// ─── WhatsApp Reports ────────────────────────────────────────────────────────

const whatsappReports: ReportDefinition[] = [
  {
    id: "whatsapp_overview",
    label: "סקירת WhatsApp",
    category: "whatsapp",
    entity: "whatsapp",
    defaultChart: "bar",
    supportedCharts: ["bar", "line", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "week", "day", "employee"],
    kpis: [
      { id: "total_conversations", label: "שיחות", format: "number", tone: "tone-card-blue" },
      { id: "messages_sent", label: "נשלחו", format: "number", tone: "tone-card-mint" },
      { id: "messages_received", label: "התקבלו", format: "number", tone: "tone-card-violet" },
      { id: "unread", label: "לא נקראו", format: "number", tone: "tone-card-rose" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "conversations", header: "שיחות", format: "number", sortable: true },
      { key: "sent", header: "נשלחו", format: "number", sortable: true },
      { key: "received", header: "התקבלו", format: "number", sortable: true },
      { key: "avg_response", header: "זמן תגובה", format: "text" },
    ],
    defaultSort: "newest",
  },
];

// ─── Document Reports ────────────────────────────────────────────────────────

const documentReports: ReportDefinition[] = [
  {
    id: "document_overview",
    label: "סקירת מסמכים",
    category: "documents",
    entity: "tasks",
    defaultChart: "bar",
    supportedCharts: ["bar", "pie", "table"],
    defaultGroupBy: "month",
    supportedGroupBy: ["month", "employee"],
    kpis: [
      { id: "total_documents", label: "סה\"כ מסמכים", format: "number", tone: "tone-card-blue" },
      { id: "uploaded_this_month", label: "החודש", format: "number", tone: "tone-card-mint" },
      { id: "by_type", label: "סוגים", format: "number", tone: "tone-card-violet" },
      { id: "total_size", label: "נפח כולל", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "uploads", header: "העלאות", format: "number", sortable: true },
      { key: "by_user", header: "לפי משתמש", format: "text" },
      { key: "types", header: "סוגים", format: "text" },
    ],
    defaultSort: "newest",
  },
];

// ─── System Activity Reports ─────────────────────────────────────────────────

const systemReports: ReportDefinition[] = [
  {
    id: "system_activity",
    label: "פעילות מערכת",
    category: "system",
    entity: "employees",
    defaultChart: "line",
    supportedCharts: ["line", "bar", "table"],
    defaultGroupBy: "day",
    supportedGroupBy: ["day", "week", "month", "employee"],
    kpis: [
      { id: "total_actions", label: "סה\"כ פעולות", format: "number", tone: "tone-card-blue" },
      { id: "active_users", label: "משתמשים פעילים", format: "number", tone: "tone-card-mint" },
      { id: "logins", label: "התחברויות", format: "number", tone: "tone-card-violet" },
      { id: "changes", label: "שינויים", format: "number", tone: "tone-card-amber" },
    ],
    columns: [
      { key: "period", header: "תקופה", format: "text" },
      { key: "actions", header: "פעולות", format: "number", sortable: true },
      { key: "users", header: "משתמשים", format: "number", sortable: true },
      { key: "logins", header: "התחברויות", format: "number", sortable: true },
      { key: "changes", header: "שינויים", format: "number", sortable: true },
    ],
    defaultSort: "newest",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// Category Registry
// ═════════════════════════════════════════════════════════════════════════════

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "revenue",
    label: "הכנסות",
    description: "דוחות הכנסות, ADR, RevPAR ויתרות חוב",
    icon: "DollarSign",
    tone: "tone-card-blue",
    reports: revenueReports,
  },
  {
    id: "occupancy",
    label: "תפוסה",
    description: "תפוסה, תחזיות וניתוח חדרים",
    icon: "BedDouble",
    tone: "tone-card-mint",
    reports: occupancyReports,
  },
  {
    id: "reservations",
    label: "הזמנות",
    description: "ניתוח הזמנות, סטטוסים וזמני הזמנה",
    icon: "CalendarCheck",
    tone: "tone-card-violet",
    reports: reservationReports,
  },
  {
    id: "guests",
    label: "אורחים",
    description: "ניתוח אורחים, VIP, חוזרים ולאום",
    icon: "Users",
    tone: "tone-card-amber",
    reports: guestReports,
  },
  {
    id: "rooms",
    label: "חדרים",
    description: "ביצועי חדרים, תחזוקה ורווחיות",
    icon: "DoorOpen",
    tone: "tone-card-blue",
    reports: roomReports,
  },
  {
    id: "channels",
    label: "ערוצים",
    description: "ביצועי ערוצי הזמנה והשוואות",
    icon: "Share2",
    tone: "tone-card-mint",
    reports: channelReports,
  },
  {
    id: "marketing",
    label: "שיווק",
    description: "לידים, המרות, ROI וקמפיינים",
    icon: "Megaphone",
    tone: "tone-card-violet",
    reports: marketingReports,
  },
  {
    id: "payments",
    label: "תשלומים",
    description: "גבייה, חובות ואמצעי תשלום",
    icon: "CreditCard",
    tone: "tone-card-amber",
    reports: paymentReports,
  },
  {
    id: "cancellations",
    label: "ביטולים",
    description: "ניתוח ביטולים, No-Show והכנסה שאבדה",
    icon: "XCircle",
    tone: "tone-card-rose",
    reports: cancellationReports,
  },
  {
    id: "housekeeping",
    label: "ניקיון",
    description: "ניקיון חדרים, זמני מחזור ועובדים",
    icon: "Sparkles",
    tone: "tone-card-blue",
    reports: housekeepingReports,
  },
  {
    id: "maintenance",
    label: "תחזוקה",
    description: "תקלות, טיפולים ועלויות",
    icon: "Wrench",
    tone: "tone-card-amber",
    reports: maintenanceReports,
  },
  {
    id: "staff",
    label: "עובדים",
    description: "ביצועי עובדים ומשימות",
    icon: "UserCheck",
    tone: "tone-card-mint",
    reports: staffReports,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "שיחות, הודעות וזמני תגובה",
    icon: "MessageCircle",
    tone: "tone-card-mint",
    reports: whatsappReports,
  },
  {
    id: "documents",
    label: "מסמכים",
    description: "העלאות, נפח ופעילות",
    icon: "FileText",
    tone: "tone-card-violet",
    reports: documentReports,
  },
  {
    id: "system",
    label: "מערכת",
    description: "פעילות משתמשים ולוג מערכת",
    icon: "Activity",
    tone: "tone-card-blue",
    reports: systemReports,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getCategoryById(id: ReportCategoryId): ReportCategory | undefined {
  return REPORT_CATEGORIES.find((c) => c.id === id);
}

export function getReportById(id: string): ReportDefinition | undefined {
  for (const cat of REPORT_CATEGORIES) {
    const report = cat.reports.find((r) => r.id === id);
    if (report) return report;
  }
  return undefined;
}

export function getAllReports(): ReportDefinition[] {
  return REPORT_CATEGORIES.flatMap((c) => c.reports);
}

import { 
  generatePptExecutiveSummary, 
  generateMonthlyTrajectorySummary,
  getPreviousMonthsAndCurrent,
  formatCurrency, 
  formatCompactCurrency, 
  formatPercentage, 
  SALES_OFFICERS, 
  FINANCIAL_YEAR_MONTHS 
} from "./productionPlanData";
import dayjs from "dayjs";

/**
 * Dynamically resolves or loads PptxGenJS in the browser
 */
async function getPptxGen() {
  if (typeof window !== "undefined" && window.PptxGenJS) {
    return window.PptxGenJS;
  }
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.PptxGenJS) {
      return resolve(window.PptxGenJS);
    }
    const existingScript = document.querySelector('script[src*="pptxgen"]');
    if (existingScript) {
      if (window.PptxGenJS) return resolve(window.PptxGenJS);
      existingScript.addEventListener("load", () => resolve(window.PptxGenJS));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
    script.async = true;
    script.onload = () => {
      if (window.PptxGenJS) {
        resolve(window.PptxGenJS);
      } else {
        reject(new Error("PptxGenJS not found after loading bundle script."));
      }
    };
    script.onerror = () => reject(new Error("Failed to load PowerPoint export library from CDN."));
    document.head.appendChild(script);
  });
}

/**
 * Generates a polished executive PowerPoint presentation (.pptx) strictly within 16:9 widescreen page limits
 * @param {Array} rows - Filtered list of forecast entries
 * @param {Object} options - Configuration options (title, periodLabel, filename, activeRoleView)
 */
export async function exportForecastToPowerPoint(rows = [], options = {}) {
  const PptxGenJS = await getPptxGen();
  const pptx = new PptxGenJS();

  // Explicitly define 16:9 widescreen layout with exact dimensions (13.333 in x 7.5 in)
  pptx.defineLayout({ name: "LAYOUT_16x9_HD", width: 13.333, height: 7.5 });
  pptx.layout = "LAYOUT_16x9_HD";
  pptx.author = "Toyo Cushion Lanka Pvt Ltd / Hayleys Fibre";
  pptx.company = "Hayleys Fibre";
  pptx.subject = "Production Forecast & Actual Performance Review";

  const periodLabel = options.periodLabel || "Production Forecast & Performance Review";
  const activeRoleView = options.activeRoleView || "all_editable";
  const filename = options.filename || `Production_Forecast_${dayjs().format("YYYY-MM-DD")}.pptx`;
  const allDataset = options.allDataset && options.allDataset.length > 0 ? options.allDataset : rows;
  const targetMonthKey = options.targetMonthKey || (rows[0]?.monthKey) || "2026-09";
  const executiveData = generatePptExecutiveSummary(rows);
  const total = executiveData.total;

  // Primary Color Tokens
  const C_NAVY = "0F172A";
  const C_BLUE = "1D4ED8";
  const C_PURPLE = "6D28D9";
  const C_EMERALD = "059669";
  const C_TEAL = "0F766E";
  const C_GRAY = "64748B";
  const C_LIGHT_GRAY = "F8FAFC";
  const C_BORDER = "CBD5E1";
  const C_DARK = "1E293B";
  const C_WHITE = "FFFFFF";

  // View label for cover slide
  const viewDescriptions = {
    all_editable: "👑 Full Management Executive Review",
    marketing_actuals: "📈 Marketing Team View: Budget vs Actuals Fulfilment",
    factory_performance: "🏭 Factory Operations View: Capability & Confirmation",
    read_only: "👁️ Executive Auditor Summary"
  };
  const currentViewTitle = viewDescriptions[activeRoleView] || "Executive Performance Review";

  // ==========================================
  // SLIDE 1: TITLE & COVER SLIDE
  // ==========================================
  const slide1 = pptx.addSlide();
  slide1.background = { color: C_NAVY };

  // Decorative top gradient bar
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 0.6,
    w: 11.73,
    h: 0.08,
    fill: { color: C_BLUE }
  });

  // Top Company Tag
  slide1.addText("HAYLEYS FIBRE  |  TOYO CUSHION LANKA PVT LTD", {
    x: 0.8,
    y: 0.9,
    w: 11.73,
    h: 0.35,
    fontSize: 11,
    bold: true,
    color: "93C5FD",
    fontFace: "Arial"
  });

  // Title
  slide1.addText("Production Forecast & Performance Review", {
    x: 0.8,
    y: 1.35,
    w: 11.73,
    h: 0.85,
    fontSize: 26,
    bold: true,
    color: C_WHITE,
    fontFace: "Arial"
  });

  // Period & View Subtitle
  slide1.addText(`Reporting Period: ${periodLabel}  •  ${currentViewTitle}`, {
    x: 0.8,
    y: 2.30,
    w: 11.73,
    h: 0.45,
    fontSize: 13,
    color: "E2E8F0",
    fontFace: "Arial"
  });

  // 4 Key KPI summary boxes in cover slide (Exact horizontal grid)
  const bToFormatted = formatCompactCurrency(total.budget.to);
  const aToFormatted = formatCompactCurrency(total.actual.to);
  const fToFormatted = formatCompactCurrency(total.factory.to);
  const achFormatted = `${Math.round(total.variance.achievementRate)}%`;

  const coverTiles = [
    { label: "BUDGET TARGET", val: `LKR ${bToFormatted}`, sub: `${total.budget.teu.toFixed(1)} TEUs Target`, color: C_BLUE },
    { label: "ACTUAL ACHIEVED", val: `LKR ${aToFormatted}`, sub: `${total.actual.teu.toFixed(1)} TEUs Delivered`, color: C_PURPLE },
    { label: "FACTORY CONFIRMED", val: `LKR ${fToFormatted}`, sub: `${total.factory.teu.toFixed(1)} Capable TEUs`, color: C_TEAL },
    { label: "ACHIEVEMENT RATE", val: achFormatted, sub: `Diff: LKR ${formatCompactCurrency(total.variance.to)}`, color: total.variance.to >= 0 ? C_EMERALD : "DC2626" }
  ];

  coverTiles.forEach((tile, idx) => {
    const tileX = 0.8 + idx * 3.0;
    slide1.addShape(pptx.ShapeType.roundRect, {
      x: tileX,
      y: 3.20,
      w: 2.75,
      h: 2.30,
      rectRadius: 0.15,
      fill: { color: "1E293B" },
      line: { color: tile.color, width: 1.5 }
    });

    slide1.addText(tile.label, {
      x: tileX + 0.15,
      y: 3.40,
      w: 2.45,
      h: 0.3,
      fontSize: 9.5,
      bold: true,
      color: "94A3B8"
    });

    slide1.addText(tile.val, {
      x: tileX + 0.15,
      y: 3.80,
      w: 2.45,
      h: 0.6,
      fontSize: 18,
      bold: true,
      color: C_WHITE
    });

    slide1.addText(tile.sub, {
      x: tileX + 0.15,
      y: 4.60,
      w: 2.45,
      h: 0.45,
      fontSize: 11,
      color: "CBD5E1"
    });
  });

  // Footer metadata
  slide1.addText(`Generated on: ${dayjs().format("DD MMM YYYY, HH:mm")}  •  Total Active Records: ${rows.length}  •  Toyo Cushion Lanka Pvt Ltd`, {
    x: 0.8,
    y: 6.40,
    w: 11.73,
    h: 0.4,
    fontSize: 9.5,
    color: "64748B"
  });


  // ==========================================
  // SLIDE 2: EXECUTIVE SUMMARY PERFORMANCE (Sheet 3)
  // ==========================================
  const slide2 = pptx.addSlide();
  slide2.background = { color: C_LIGHT_GRAY };

  // Slide Header
  slide2.addText("Executive Performance Summary: Budget vs Actuals", {
    x: 0.66,
    y: 0.40,
    w: 12.0,
    h: 0.40,
    fontSize: 18,
    bold: true,
    color: C_NAVY,
    fontFace: "Arial"
  });

  slide2.addText(`Period: ${periodLabel}  |  Department Performance Split (Horticulture vs Bedding)`, {
    x: 0.66,
    y: 0.82,
    w: 12.0,
    h: 0.28,
    fontSize: 10.5,
    color: C_GRAY
  });

  // Table Data Preparation
  const formatDeptRow = (dept) => [
    { text: dept.category, options: { bold: true, color: dept.category === "Total" ? C_NAVY : C_BLUE } },
    { text: dept.budget.teu.toFixed(1), options: { align: "right" } },
    { text: formatCompactCurrency(dept.budget.to), options: { align: "right" } },
    { text: formatCompactCurrency(dept.budget.cont), options: { align: "right" } },
    { text: formatPercentage(dept.budget.margin), options: { align: "right", color: C_BLUE } },
    { text: dept.actual.teu.toFixed(1), options: { align: "right", bold: true } },
    { text: formatCompactCurrency(dept.actual.to), options: { align: "right", bold: true, color: C_PURPLE } },
    { text: formatCompactCurrency(dept.actual.cont), options: { align: "right" } },
    { text: formatPercentage(dept.actual.margin), options: { align: "right", color: C_PURPLE } },
    { text: dept.factory.teu > 0 ? dept.factory.teu.toFixed(1) : "-", options: { align: "right" } },
    { text: dept.factory.to > 0 ? formatCompactCurrency(dept.factory.to) : "-", options: { align: "right", color: C_TEAL } },
    { text: (dept.variance.teu >= 0 ? "+" : "") + dept.variance.teu.toFixed(1), options: { align: "right", bold: true, color: dept.variance.teu >= 0 ? C_EMERALD : "DC2626" } },
    { text: (dept.variance.to >= 0 ? "+" : "") + formatCompactCurrency(dept.variance.to), options: { align: "right", bold: true, color: dept.variance.to >= 0 ? C_EMERALD : "DC2626" } },
    { text: `${Math.round(dept.variance.achievementRate)}%`, options: { align: "center", bold: true, color: dept.variance.achievementRate >= 100 ? C_EMERALD : "D97706" } }
  ];

  const execTableHeaders = [
    [
      { text: "DEPARTMENT", options: { bold: true, fill: "1E3A8A", color: C_WHITE, align: "left" } },
      { text: "BUDGET TARGETS", options: { bold: true, fill: "1D4ED8", color: C_WHITE, colspan: 4, align: "center" } },
      { text: "ACTUAL PERFORMANCE", options: { bold: true, fill: "5B21B6", color: C_WHITE, colspan: 4, align: "center" } },
      { text: "FACTORY PERFORMANCE", options: { bold: true, fill: "0F766E", color: C_WHITE, colspan: 2, align: "center" } },
      { text: "VARIANCE & MET", options: { bold: true, fill: "334155", color: C_WHITE, colspan: 3, align: "center" } }
    ],
    [
      { text: "Category", options: { bold: true, fill: "DBEAFE", color: C_NAVY } },
      { text: "TEU", options: { bold: true, fill: "DBEAFE", color: C_NAVY, align: "right" } },
      { text: "TO (FOB)", options: { bold: true, fill: "DBEAFE", color: C_NAVY, align: "right" } },
      { text: "Contri", options: { bold: true, fill: "DBEAFE", color: C_NAVY, align: "right" } },
      { text: "Margin", options: { bold: true, fill: "DBEAFE", color: C_NAVY, align: "right" } },
      { text: "TEU", options: { bold: true, fill: "EDE9FE", color: C_PURPLE, align: "right" } },
      { text: "TO (FOB)", options: { bold: true, fill: "EDE9FE", color: C_PURPLE, align: "right" } },
      { text: "Contri", options: { bold: true, fill: "EDE9FE", color: C_PURPLE, align: "right" } },
      { text: "Margin", options: { bold: true, fill: "EDE9FE", color: C_PURPLE, align: "right" } },
      { text: "TEU", options: { bold: true, fill: "CCFBF1", color: "0F766E", align: "right" } },
      { text: "TO (Ratio)", options: { bold: true, fill: "CCFBF1", color: "0F766E", align: "right" } },
      { text: "Diff TEU", options: { bold: true, fill: "F1F5F9", color: C_DARK, align: "right" } },
      { text: "Diff TO", options: { bold: true, fill: "F1F5F9", color: C_DARK, align: "right" } },
      { text: "% Met", options: { bold: true, fill: "F1F5F9", color: C_DARK, align: "center" } }
    ]
  ];

  const execTableRows = [
    ...execTableHeaders,
    formatDeptRow(executiveData.horticulture),
    formatDeptRow(executiveData.bedding),
    formatDeptRow(executiveData.total)
  ];

  // Exact 14 column widths strictly summing to 12.0 in (fits within 13.33 in layout with 0.66 in safety margin)
  slide2.addTable(execTableRows, {
    x: 0.66,
    y: 1.20,
    w: 12.0,
    colW: [1.60, 0.65, 1.00, 0.85, 0.75, 0.65, 1.05, 0.85, 0.75, 0.65, 1.00, 0.70, 0.90, 0.60],
    fontSize: 8.5,
    rowH: [0.32, 0.30, 0.38, 0.38, 0.42],
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE }
  });

  // 4 Highlight Cards beneath table with safe vertical bounds
  const cards = [
    { title: "Horticulture Share", val: `${Math.round((executiveData.horticulture.actual.to / (total.actual.to || 1)) * 100)}%`, sub: `LKR ${formatCompactCurrency(executiveData.horticulture.actual.to)} Achieved` },
    { title: "Bedding Share", val: `${Math.round((executiveData.bedding.actual.to / (total.actual.to || 1)) * 100)}%`, sub: `LKR ${formatCompactCurrency(executiveData.bedding.actual.to)} Achieved` },
    { title: "Overall Margin", val: formatPercentage(total.actual.margin), sub: `Budget Target: ${formatPercentage(total.budget.margin)}` },
    { title: "Factory Confirmed", val: `${executiveData.total.factory.teu.toFixed(1)} TEUs`, sub: `LKR ${formatCompactCurrency(executiveData.total.factory.to)}` }
  ];

  cards.forEach((c, i) => {
    const cx = 0.66 + i * 3.05;
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: cx,
      y: 3.35,
      w: 2.85,
      h: 2.20,
      rectRadius: 0.1,
      fill: { color: C_WHITE },
      line: { color: C_BORDER, width: 1 }
    });

    slide2.addText(c.title, { x: cx + 0.15, y: 3.55, w: 2.55, h: 0.3, fontSize: 10, bold: true, color: C_GRAY });
    slide2.addText(c.val, { x: cx + 0.15, y: 3.95, w: 2.55, h: 0.5, fontSize: 18, bold: true, color: C_NAVY });
    slide2.addText(c.sub, { x: cx + 0.15, y: 4.70, w: 2.55, h: 0.45, fontSize: 9.5, color: C_GRAY });
  });

  slide2.addText(`Toyo Cushion Lanka Pvt Ltd • Sheet 3 Standard Executive Report • ${periodLabel}`, {
    x: 0.66,
    y: 6.40,
    w: 12.0,
    h: 0.30,
    fontSize: 9,
    color: "94A3B8"
  });


  // ==========================================
  // SLIDE 3: FACTORY PERFORMANCE & PRODUCTION CONFIRMATION
  // ==========================================
  const slide3 = pptx.addSlide();
  slide3.background = { color: C_LIGHT_GRAY };

  slide3.addText("Factory Performance & Production Confirmation", {
    x: 0.66,
    y: 0.40,
    w: 12.0,
    h: 0.40,
    fontSize: 18,
    bold: true,
    color: C_TEAL,
    fontFace: "Arial"
  });

  slide3.addText(`Capable TEU Capacity, Proportional Ratio Calculation, and Production Confirmation Status (${periodLabel})`, {
    x: 0.66,
    y: 0.82,
    w: 12.0,
    h: 0.28,
    fontSize: 10.5,
    color: C_GRAY
  });

  // Factory Top Rows (sort by capable TEU descending)
  const factoryRows = [...rows]
    .sort((a, b) => (parseFloat(b.factoryTeu) || 0) - (parseFloat(a.factoryTeu) || 0))
    .slice(0, 10);

  const factoryTableHeaders = [
    [
      { text: "Month", options: { bold: true, fill: "0F766E", color: C_WHITE, align: "left" } },
      { text: "Off.", options: { bold: true, fill: "0F766E", color: C_WHITE, align: "center" } },
      { text: "Buyer / Customer", options: { bold: true, fill: "0F766E", color: C_WHITE, align: "left" } },
      { text: "Department", options: { bold: true, fill: "0F766E", color: C_WHITE, align: "left" } },
      { text: "Actual TEU", options: { bold: true, fill: "5B21B6", color: C_WHITE, align: "right" } },
      { text: "Actual TO (LKR)", options: { bold: true, fill: "5B21B6", color: C_WHITE, align: "right" } },
      { text: "Capable TEU", options: { bold: true, fill: "0D9488", color: C_WHITE, align: "right" } },
      { text: "Factory TO (Ratio)", options: { bold: true, fill: "0D9488", color: C_WHITE, align: "right" } },
      { text: "Factory Contri", options: { bold: true, fill: "0D9488", color: C_WHITE, align: "right" } },
      { text: "Confirmed", options: { bold: true, fill: "334155", color: C_WHITE, align: "center" } },
      { text: "Notes / Remarks", options: { bold: true, fill: "334155", color: C_WHITE, align: "left" } }
    ]
  ];

  const factoryTableContent = factoryRows.map(r => {
    const aTeu = parseFloat(r.actualTeu) || 0;
    const aTo = parseFloat(r.actualTurnover) || 0;
    const fTeu = parseFloat(r.factoryTeu) || 0;
    const fTo = parseFloat(r.factoryTurnover) || 0;
    const fCont = parseFloat(r.factoryContribution) || 0;
    const isConfirmed = !!r.factoryConfirmed;

    return [
      { text: r.monthName || r.month || "SEP", options: { fontSize: 8.5 } },
      { text: r.salesOfficer || "MM", options: { align: "center", bold: true, fontSize: 8.5 } },
      { text: (r.buyer || "Customer").slice(0, 24), options: { bold: true, color: C_DARK, fontSize: 8.5 } },
      { text: (r.department || "Horti").slice(0, 10), options: { fontSize: 8.5 } },
      { text: aTeu.toFixed(1), options: { align: "right", fontSize: 8.5 } },
      { text: formatCurrency(aTo), options: { align: "right", fontSize: 8.5 } },
      { text: fTeu.toFixed(1), options: { align: "right", bold: true, color: C_TEAL, fontSize: 8.5 } },
      { text: formatCurrency(fTo), options: { align: "right", bold: true, color: C_TEAL, fontSize: 8.5 } },
      { text: formatCurrency(fCont), options: { align: "right", fontSize: 8.5 } },
      { text: isConfirmed ? "✓ YES" : "PENDING", options: { align: "center", bold: true, color: isConfirmed ? C_EMERALD : "D97706", fontSize: 8 } },
      { text: (r.notes || "").slice(0, 20), options: { fontSize: 8, color: C_GRAY } }
    ];
  });

  // Exact 11 column widths summing to 12.0 in
  slide3.addTable([...factoryTableHeaders, ...factoryTableContent], {
    x: 0.66,
    y: 1.20,
    w: 12.0,
    colW: [1.10, 0.55, 2.45, 0.95, 0.75, 1.20, 0.85, 1.25, 1.10, 0.80, 1.00],
    fontSize: 8.5,
    rowH: 0.33,
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE }
  });

  // Summary box at bottom within safety boundary
  const confirmedCount = rows.filter(r => !!r.factoryConfirmed).length;
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 0.66,
    y: 5.15,
    w: 12.0,
    h: 1.10,
    rectRadius: 0.08,
    fill: { color: "F0FDFA" },
    line: { color: "99F6E4", width: 1 }
  });

  slide3.addText(`🏭 FACTORY CONFIRMATION SUMMARY: ${confirmedCount} of ${rows.length} accounts confirmed (${rows.length > 0 ? Math.round((confirmedCount / rows.length) * 100) : 0}%) • Total Capable: ${total.factory.teu.toFixed(1)} TEUs • Total Factory TO (Ratio): LKR ${formatCompactCurrency(total.factory.to)}`, {
    x: 0.86,
    y: 5.35,
    w: 11.6,
    h: 0.70,
    fontSize: 10.5,
    bold: true,
    color: C_TEAL
  });

  slide3.addText(`Toyo Cushion Lanka Pvt Ltd • Factory Operations & Confirmation Report • ${periodLabel}`, {
    x: 0.66,
    y: 6.45,
    w: 12.0,
    h: 0.30,
    fontSize: 9,
    color: "94A3B8"
  });


  // ==========================================
  // SLIDE 4: FORECAST & ACTUALS KEY ACCOUNTS TABLE
  // ==========================================
  const slide4 = pptx.addSlide();
  slide4.background = { color: C_LIGHT_GRAY };

  slide4.addText("Customer Forecast & Actual Fulfilment Breakdown", {
    x: 0.66,
    y: 0.40,
    w: 12.0,
    h: 0.40,
    fontSize: 18,
    bold: true,
    color: C_NAVY,
    fontFace: "Arial"
  });

  slide4.addText(`Displaying key buyers and operational tracking for ${periodLabel}`, {
    x: 0.66,
    y: 0.82,
    w: 12.0,
    h: 0.28,
    fontSize: 10.5,
    color: C_GRAY
  });

  // Sort rows by actual turnover descending, top 11
  const topRows = [...rows]
    .sort((a, b) => (parseFloat(b.actualTurnover) || 0) - (parseFloat(a.actualTurnover) || 0))
    .slice(0, 11);

  const customerTableHeaders = [
    [
      { text: "Month", options: { bold: true, fill: "1E3A8A", color: C_WHITE, align: "left" } },
      { text: "Off.", options: { bold: true, fill: "1E3A8A", color: C_WHITE, align: "center" } },
      { text: "Buyer / Customer", options: { bold: true, fill: "1E3A8A", color: C_WHITE, align: "left" } },
      { text: "Dept", options: { bold: true, fill: "1E3A8A", color: C_WHITE, align: "left" } },
      { text: "Budg TEU", options: { bold: true, fill: "1D4ED8", color: C_WHITE, align: "right" } },
      { text: "Budg TO (LKR)", options: { bold: true, fill: "1D4ED8", color: C_WHITE, align: "right" } },
      { text: "Act TEU", options: { bold: true, fill: "5B21B6", color: C_WHITE, align: "right" } },
      { text: "Act TO (LKR)", options: { bold: true, fill: "5B21B6", color: C_WHITE, align: "right" } },
      { text: "Diff TO", options: { bold: true, fill: "334155", color: C_WHITE, align: "right" } },
      { text: "Achieve %", options: { bold: true, fill: "334155", color: C_WHITE, align: "center" } },
      { text: "Status", options: { bold: true, fill: "334155", color: C_WHITE, align: "center" } }
    ]
  ];

  const customerRows = topRows.map(r => {
    const bTo = parseFloat(r.budgetTurnover) || 0;
    const aTo = parseFloat(r.actualTurnover) || 0;
    const diffTo = aTo - bTo;
    const ach = bTo > 0 ? Math.round((aTo / bTo) * 100) : (aTo > 0 ? 100 : 0);
    const statusText = (r.status || "pending").toUpperCase();

    return [
      { text: r.monthName || r.month || "SEP", options: { fontSize: 8.5 } },
      { text: r.salesOfficer || "MM", options: { align: "center", bold: true, fontSize: 8.5 } },
      { text: (r.buyer || "Customer").slice(0, 26), options: { bold: true, color: C_DARK, fontSize: 8.5 } },
      { text: (r.department || "Horti").slice(0, 8), options: { fontSize: 8.5 } },
      { text: (parseFloat(r.budgetTeu) || 0).toFixed(1), options: { align: "right", fontSize: 8.5 } },
      { text: formatCurrency(bTo), options: { align: "right", fontSize: 8.5 } },
      { text: (parseFloat(r.actualTeu) || 0).toFixed(1), options: { align: "right", bold: true, fontSize: 8.5 } },
      { text: formatCurrency(aTo), options: { align: "right", bold: true, color: C_PURPLE, fontSize: 8.5 } },
      { text: (diffTo >= 0 ? "+" : "") + formatCurrency(diffTo), options: { align: "right", color: diffTo >= 0 ? C_EMERALD : "DC2626", fontSize: 8.5 } },
      { text: `${ach}%`, options: { align: "center", bold: true, color: ach >= 100 ? C_EMERALD : "D97706", fontSize: 8.5 } },
      { text: statusText, options: { align: "center", bold: true, fontSize: 8 } }
    ];
  });

  // Exact 11 column widths summing strictly to 12.0 in
  slide4.addTable([...customerTableHeaders, ...customerRows], {
    x: 0.66,
    y: 1.20,
    w: 12.0,
    colW: [1.10, 0.55, 2.65, 0.85, 0.75, 1.20, 0.75, 1.25, 1.10, 0.80, 1.00],
    fontSize: 8.5,
    rowH: 0.34,
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE }
  });

  slide4.addText(`Toyo Cushion Lanka Pvt Ltd • Key Buyer Portfolios • ${periodLabel}`, {
    x: 0.66,
    y: 6.45,
    w: 12.0,
    h: 0.30,
    fontSize: 9,
    color: "94A3B8"
  });


  // ==========================================
  // SLIDE 5: SALES OFFICER PERFORMANCE
  // ==========================================
  const slide5 = pptx.addSlide();
  slide5.background = { color: C_LIGHT_GRAY };

  slide5.addText("Sales Officer Achievement & Ranking", {
    x: 0.66,
    y: 0.40,
    w: 12.0,
    h: 0.40,
    fontSize: 18,
    bold: true,
    color: C_NAVY,
    fontFace: "Arial"
  });

  slide5.addText(`Officer contribution and portfolio performance for ${periodLabel}`, {
    x: 0.66,
    y: 0.82,
    w: 12.0,
    h: 0.28,
    fontSize: 10.5,
    color: C_GRAY
  });

  // Calculate officer breakdown
  const officersMap = {};
  SALES_OFFICERS.forEach(s => {
    officersMap[s.code] = {
      code: s.code,
      name: s.name,
      department: s.department,
      bTo: 0, aTo: 0, bTeu: 0, aTeu: 0, bCont: 0, aCont: 0, count: 0
    };
  });

  rows.forEach(r => {
    const code = r.salesOfficer || "MM";
    if (!officersMap[code]) {
      officersMap[code] = { code, name: code, department: r.department || "Horticulture", bTo: 0, aTo: 0, bTeu: 0, aTeu: 0, bCont: 0, aCont: 0, count: 0 };
    }
    officersMap[code].bTo += parseFloat(r.budgetTurnover) || 0;
    officersMap[code].aTo += parseFloat(r.actualTurnover) || 0;
    officersMap[code].bTeu += parseFloat(r.budgetTeu) || 0;
    officersMap[code].aTeu += parseFloat(r.actualTeu) || 0;
    officersMap[code].bCont += parseFloat(r.budgetContribution) || 0;
    officersMap[code].aCont += parseFloat(r.actualContribution) || 0;
    officersMap[code].count++;
  });

  const officerList = Object.values(officersMap).map(o => {
    const ach = o.bTo > 0 ? (o.aTo / o.bTo) * 100 : (o.aTo > 0 ? 100 : 0);
    const margin = o.aTo > 0 ? (o.aCont / o.aTo) : 0;
    return { ...o, achRate: Math.round(ach), margin };
  }).sort((a, b) => b.aTo - a.aTo);

  // 4 Officer Cards strictly within layout limits
  officerList.forEach((off, i) => {
    const colX = 0.66 + (i % 4) * 3.05;
    const cardY = 1.25;

    slide5.addShape(pptx.ShapeType.roundRect, {
      x: colX,
      y: cardY,
      w: 2.85,
      h: 4.90,
      rectRadius: 0.15,
      fill: { color: C_WHITE },
      line: { color: C_BLUE, width: 1.5 }
    });

    slide5.addText(off.code, {
      x: colX + 0.2,
      y: cardY + 0.20,
      w: 2.45,
      h: 0.35,
      fontSize: 18,
      bold: true,
      color: C_NAVY
    });

    slide5.addText(`Dept: ${off.department}  •  ${off.count} Records`, {
      x: colX + 0.2,
      y: cardY + 0.57,
      w: 2.45,
      h: 0.25,
      fontSize: 9.5,
      color: C_GRAY
    });

    // Achievement Rate Large
    slide5.addText(`${off.achRate}% Achieved`, {
      x: colX + 0.2,
      y: cardY + 0.95,
      w: 2.45,
      h: 0.40,
      fontSize: 15,
      bold: true,
      color: off.achRate >= 100 ? C_EMERALD : C_PURPLE
    });

    const offStats = [
      { label: "Actual Turnover", val: `LKR ${formatCompactCurrency(off.aTo)}` },
      { label: "Budget Target", val: `LKR ${formatCompactCurrency(off.bTo)}` },
      { label: "Actual TEUs", val: `${off.aTeu.toFixed(1)} TEU` },
      { label: "Actual Margin", val: formatPercentage(off.margin) }
    ];

    offStats.forEach((st, sIdx) => {
      const sy = cardY + 1.55 + sIdx * 0.70;
      slide5.addText(st.label, { x: colX + 0.2, y: sy, w: 2.45, h: 0.25, fontSize: 9, color: C_GRAY });
      slide5.addText(st.val, { x: colX + 0.2, y: sy + 0.22, w: 2.45, h: 0.35, fontSize: 12, bold: true, color: C_DARK });
    });
  });

  slide5.addText(`Toyo Cushion Lanka Pvt Ltd • Sales Officer Performance Matrix • ${periodLabel}`, {
    x: 0.66,
    y: 6.45,
    w: 12.0,
    h: 0.30,
    fontSize: 9,
    color: "94A3B8"
  });


  // ==========================================
  // SLIDE 6: 4-MONTH PERFORMANCE TRAJECTORY & TRENDS (Previous 3 Months + Current Month)
  // ==========================================
  const slide6 = pptx.addSlide();
  slide6.background = { color: C_LIGHT_GRAY };

  const trajectoryData = generateMonthlyTrajectorySummary(allDataset, targetMonthKey);
  const currentMonthObj = trajectoryData[trajectoryData.length - 1];
  const currentMonthName = currentMonthObj?.monthName || "Current Month";
  const prevMonthsRange = trajectoryData.length > 1 
    ? `${trajectoryData[0]?.monthName} – ${trajectoryData[trajectoryData.length - 2]?.monthName}`
    : "Previous Months";

  slide6.addText("Monthly Performance Trajectory & Trend Analysis", {
    x: 0.66,
    y: 0.40,
    w: 12.0,
    h: 0.40,
    fontSize: 18,
    bold: true,
    color: C_NAVY,
    fontFace: "Arial"
  });

  slide6.addText(`4-Month Performance Horizon: Previous 3 Months (${prevMonthsRange}) + Current Month (${currentMonthName})`, {
    x: 0.66,
    y: 0.82,
    w: 12.0,
    h: 0.28,
    fontSize: 10.5,
    color: C_GRAY
  });

  // Chart 1: Grouped Column Chart for Turnover (LKR Millions)
  const chart1Labels = trajectoryData.map(t => t.shortLabel);
  const chart1Data = [
    {
      name: "Budget TO (LKR M)",
      labels: chart1Labels,
      values: trajectoryData.map(t => parseFloat((t.budget.to / 1000000).toFixed(1)))
    },
    {
      name: "Actual TO (LKR M)",
      labels: chart1Labels,
      values: trajectoryData.map(t => parseFloat((t.actual.to / 1000000).toFixed(1)))
    }
  ];

  slide6.addChart(pptx.ChartType.bar, chart1Data, {
    x: 0.66,
    y: 1.15,
    w: 5.85,
    h: 2.90,
    barDir: "col",
    chartColors: ["1D4ED8", "7C3AED"], // Deep Blue (Budget) vs Purple (Actual)
    showTitle: true,
    title: "Turnover Comparison (LKR Millions)",
    titleFontSize: 10.5,
    titleColor: C_NAVY,
    titleBold: true,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 8.5,
    showValue: true,
    dataLabelPosition: "outEnd",
    dataLabelFontSize: 8,
    dataLabelColor: "334155",
    plotArea: { fill: { color: C_WHITE } }
  });

  // Chart 2: Line / Trend Chart for TEU Volume Trajectory
  const chart2Data = [
    {
      name: "Budget TEU",
      labels: chart1Labels,
      values: trajectoryData.map(t => parseFloat(t.budget.teu.toFixed(1)))
    },
    {
      name: "Actual TEU",
      labels: chart1Labels,
      values: trajectoryData.map(t => parseFloat(t.actual.teu.toFixed(1)))
    }
  ];

  slide6.addChart(pptx.ChartType.line, chart2Data, {
    x: 6.81,
    y: 1.15,
    w: 5.85,
    h: 2.90,
    chartColors: ["3B82F6", "059669"], // Blue (Budget) vs Emerald (Actual)
    showTitle: true,
    title: "Volume Delivery Trend (TEUs)",
    titleFontSize: 10.5,
    titleColor: C_NAVY,
    titleBold: true,
    showLegend: true,
    legendPos: "b",
    legendFontSize: 8.5,
    showValue: true,
    dataLabelPosition: "top",
    dataLabelFontSize: 8,
    dataLabelColor: C_TEAL,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 6,
    plotArea: { fill: { color: C_WHITE } }
  });

  // 4-Month Trajectory Grid Table (Below Charts)
  const trajectoryHeaders = [
    [
      { text: "Month / Year", options: { bold: true, fill: "1E3A8A", color: C_WHITE, align: "left" } },
      { text: "Budget TO (LKR)", options: { bold: true, fill: "1D4ED8", color: C_WHITE, align: "right" } },
      { text: "Budget TEU", options: { bold: true, fill: "1D4ED8", color: C_WHITE, align: "right" } },
      { text: "Actual TO (LKR)", options: { bold: true, fill: "5B21B6", color: C_WHITE, align: "right" } },
      { text: "Actual TEU", options: { bold: true, fill: "5B21B6", color: C_WHITE, align: "right" } },
      { text: "Diff TO (LKR)", options: { bold: true, fill: "334155", color: C_WHITE, align: "right" } },
      { text: "Diff TEU", options: { bold: true, fill: "334155", color: C_WHITE, align: "right" } },
      { text: "Achievement %", options: { bold: true, fill: "334155", color: C_WHITE, align: "center" } },
      { text: "Status", options: { bold: true, fill: "334155", color: C_WHITE, align: "center" } }
    ]
  ];

  let sumBTo = 0, sumBTeu = 0, sumATo = 0, sumATeu = 0;
  const trajectoryRows = trajectoryData.map(t => {
    sumBTo += t.budget.to;
    sumBTeu += t.budget.teu;
    sumATo += t.actual.to;
    sumATeu += t.actual.teu;

    const diffTo = t.variance.to;
    const diffTeu = t.variance.teu;
    const isCurrent = t.monthKey === targetMonthKey;

    return [
      { text: `${t.monthName} ${isCurrent ? "(Current)" : ""}`, options: { bold: true, color: isCurrent ? C_BLUE : C_NAVY, fontSize: 8.5 } },
      { text: formatCurrency(t.budget.to), options: { align: "right", fontSize: 8.5 } },
      { text: t.budget.teu.toFixed(1), options: { align: "right", fontSize: 8.5 } },
      { text: t.actual.to > 0 ? formatCurrency(t.actual.to) : "-", options: { align: "right", bold: true, color: C_PURPLE, fontSize: 8.5 } },
      { text: t.actual.teu > 0 ? t.actual.teu.toFixed(1) : "-", options: { align: "right", fontSize: 8.5 } },
      { text: (diffTo >= 0 ? "+" : "") + formatCurrency(diffTo), options: { align: "right", color: diffTo >= 0 ? C_EMERALD : "DC2626", bold: true, fontSize: 8.5 } },
      { text: (diffTeu >= 0 ? "+" : "") + diffTeu.toFixed(1), options: { align: "right", color: diffTeu >= 0 ? C_EMERALD : "DC2626", fontSize: 8.5 } },
      { text: t.actual.to > 0 ? `${t.variance.achievementRate}%` : "-", options: { align: "center", bold: true, color: t.variance.achievementRate >= 100 ? C_EMERALD : "D97706", fontSize: 8.5 } },
      { text: t.status, options: { align: "center", bold: true, color: t.status === "MET" ? C_EMERALD : (t.status === "VARIANCE" ? "D97706" : C_GRAY), fontSize: 8 } }
    ];
  });

  const totDiffTo = sumATo - sumBTo;
  const totDiffTeu = sumATeu - sumBTeu;
  const totAch = sumBTo > 0 ? Math.round((sumATo / sumBTo) * 100) : 0;

  const summaryRow = [
    { text: "4-Month Cumulative Total", options: { bold: true, fill: "F1F5F9", color: C_NAVY, fontSize: 8.5 } },
    { text: formatCurrency(sumBTo), options: { bold: true, fill: "F1F5F9", align: "right", fontSize: 8.5 } },
    { text: sumBTeu.toFixed(1), options: { bold: true, fill: "F1F5F9", align: "right", fontSize: 8.5 } },
    { text: formatCurrency(sumATo), options: { bold: true, fill: "F1F5F9", align: "right", color: C_PURPLE, fontSize: 8.5 } },
    { text: sumATeu.toFixed(1), options: { bold: true, fill: "F1F5F9", align: "right", fontSize: 8.5 } },
    { text: (totDiffTo >= 0 ? "+" : "") + formatCurrency(totDiffTo), options: { bold: true, fill: "F1F5F9", align: "right", color: totDiffTo >= 0 ? C_EMERALD : "DC2626", fontSize: 8.5 } },
    { text: (totDiffTeu >= 0 ? "+" : "") + totDiffTeu.toFixed(1), options: { bold: true, fill: "F1F5F9", align: "right", color: totDiffTeu >= 0 ? C_EMERALD : "DC2626", fontSize: 8.5 } },
    { text: `${totAch}%`, options: { bold: true, fill: "F1F5F9", align: "center", color: totAch >= 100 ? C_EMERALD : "D97706", fontSize: 8.5 } },
    { text: totAch >= 100 ? "MET" : "VARIANCE", options: { bold: true, fill: "F1F5F9", align: "center", color: totAch >= 100 ? C_EMERALD : "D97706", fontSize: 8 } }
  ];

  // Exactly 9 columns summing to 12.0 in: [1.80, 1.45, 1.05, 1.45, 1.05, 1.40, 1.05, 1.35, 1.40]
  slide6.addTable([...trajectoryHeaders, ...trajectoryRows, summaryRow], {
    x: 0.66,
    y: 4.15,
    w: 12.0,
    colW: [1.80, 1.45, 1.05, 1.45, 1.05, 1.40, 1.05, 1.35, 1.40],
    fontSize: 8.5,
    rowH: 0.30,
    border: { pt: 0.5, color: C_BORDER },
    fill: { color: C_WHITE }
  });

  slide6.addText(`Toyo Cushion Lanka Pvt Ltd • 4-Month Performance Horizon (Previous 3 Months + Current) • ${periodLabel}`, {
    x: 0.66,
    y: 6.45,
    w: 12.0,
    h: 0.30,
    fontSize: 9,
    color: "94A3B8"
  });

  // Generate and download PPTX
  await pptx.writeFile({ fileName: filename });
  return true;
}

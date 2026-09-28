/**
 * Price Quotation Calculation Engine & Presets
 * Implements mathematical models and formulas matching PriceQuotation.xlsx
 */

export const DEFAULT_FINANCIAL_PARAMS = {
  exportExpense: 150000, // LKR (S2)
  exchangeRate: 305,     // LKR/USD (S3)
  margin: 0.40,          // 40% (S4)
  cifRate: 3500,         // USD (S5)
  vat: 0.20              // 20% (S6)
};

export const DEFAULT_COMPANY_DETAILS = {
  shipperName: "Toyo Cushion Lanka",
  companyNo: "PV 5492",
  address: "400 Deans Road Colombo 10 01000 Sri Lanka",
  phone: "94112232939-Fixed",
  signatory: "Manager - Sales & Marketing"
};

export const DEFAULT_TERMS = {
  paymentTerms: "100% Advance (For the first order delivery)",
  leadTime: "+/- 10% 4-5 weeks",
  validityDays: 30, // 1 month
  packingBedding: "Floor load / Pallet",
  packingHorti: "Carton Boxes / Floor load / Pallet"
};

/**
 * Built-in Library of Saved Product Presets (Images & Descriptions)
 */
export const DEFAULT_SAVED_PRODUCTS = [];

/**
 * Parse dimensions string (e.g., "57X51X58CM", "57 x 51 x 58", "57*51*58")
 */
export function parseDimensions(dimStr) {
  if (!dimStr) return { length: 0, width: 0, height: 0 };
  if (typeof dimStr === "object") {
    return {
      length: parseFloat(dimStr.length || dimStr.l) || 0,
      width: parseFloat(dimStr.width || dimStr.w) || 0,
      height: parseFloat(dimStr.height || dimStr.h) || 0
    };
  }
  const clean = dimStr.toString().replace(/cm|mm|m/gi, "").trim();
  const match = clean.match(/(\d+(\.\d+)?)\s*[*xX×]\s*(\d+(\.\d+)?)\s*[*xX×]\s*(\d+(\.\d+)?)/);
  if (match) {
    return {
      length: parseFloat(match[1]) || 0,
      width: parseFloat(match[3]) || 0,
      height: parseFloat(match[5]) || 0
    };
  }
  return { length: 0, width: 0, height: 0 };
}

/**
 * Parse Roll Dimensions and calculate Roll CBM:
 * Roll CBM = (Roll Length in CM * Roll Diameter in CM * Roll Diameter in CM) / 1,000,000
 */
export function parseRollDimensions(rollLengthStr, rollDiameterStr) {
  let lengthCm = 0;
  let diameterCm = 0;

  if (rollDiameterStr !== undefined && rollDiameterStr !== null) {
    const cleanD = String(rollDiameterStr).replace(/cm|mm|m/gi, "").trim();
    const dMatch = cleanD.match(/(\d+(\.\d+)?)/);
    if (dMatch) {
      diameterCm = parseFloat(dMatch[1]) || 0;
    }
  }

  if (rollLengthStr !== undefined && rollLengthStr !== null) {
    const rawL = String(rollLengthStr).trim();
    const isMeter = /m/i.test(rawL) && !/cm|mm/i.test(rawL);
    const cleanL = rawL.replace(/cm|mm|m/gi, "").trim();
    const lMatch = cleanL.match(/(\d+(\.\d+)?)/);
    if (lMatch) {
      const num = parseFloat(lMatch[1]) || 0;
      // If specified with 'm' or small number (< 200), treat as meters
      if (isMeter || (num > 0 && num < 200)) {
        lengthCm = num * 100;
      } else {
        lengthCm = num;
      }
    }
  }

  const rollCbm = (lengthCm > 0 && diameterCm > 0)
    ? (lengthCm * diameterCm * diameterCm) / 1000000
    : 0;

  return { lengthCm, diameterCm, rollCbm };
}

/**
 * Format merged description combining product description, production spec, gsm, and latex ratio
 */
export function formatMergedDescription(item, fallback = "") {
  if (!item) return fallback;
  const desc = (item.description || item.productDescription || item.name || "").trim();
  const spec = (item.specifications || item.productionSpec || item.productSpecifications || "").trim();
  const gsm = item.gsm ? (String(item.gsm).toLowerCase().includes("gsm") ? String(item.gsm).trim() : `${item.gsm} GSM`) : "";
  const latex = item.latexRatio ? (String(item.latexRatio).toLowerCase().includes("latex") ? String(item.latexRatio).trim() : `${item.latexRatio} Latex`) : "";

  const parts = [];
  if (desc) parts.push(desc);
  if (spec && !desc.toLowerCase().includes(spec.toLowerCase())) parts.push(spec);
  if (gsm && !desc.toLowerCase().includes(gsm.toLowerCase()) && !spec.toLowerCase().includes(gsm.toLowerCase())) parts.push(gsm);
  if (latex && !desc.toLowerCase().includes(latex.toLowerCase()) && !spec.toLowerCase().includes(latex.toLowerCase())) parts.push(latex);

  if (parts.length > 0) {
    return parts.join(" | ");
  }
  return desc || spec || fallback;
}

/**
 * Resolve effective margin for an item, falling back to global margin
 */
export function getEffectiveMargin(item, defaultMargin = 0.40) {
  if (item && item.margin !== undefined && item.margin !== null && item.margin !== "" && item.margin !== "Default") {
    const cleanStr = String(item.margin).replace("%", "").trim();
    const parsed = parseFloat(cleanStr);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed > 1 ? parsed / 100 : parsed;
    }
  }
  const fallback = typeof defaultMargin === "number" && !isNaN(defaultMargin) ? defaultMargin : 0.40;
  return fallback > 1 ? fallback / 100 : fallback;
}

/**
 * Calculate Bedding Item quantities and prices
 */
export function calculateBeddingItem(item, params = DEFAULT_FINANCIAL_PARAMS) {
  const length = parseFloat(item.length || item.l) || 0;
  const width = parseFloat(item.width || item.w) || 0;
  const height = parseFloat(item.height || item.h) || 0;
  const qtyPerBundle = parseFloat(item.qtyPerBundle || item.qty_bundle || item.packing) || 1;
  const unitCost = parseFloat(item.unitCost || item.unit_cost) || 0;
  
  const palletsPer40ft = parseFloat(item.palletsPer40ft || item.pallets_40ft) || 0;
  const palletsPer20ft = parseFloat(item.palletsPer20ft || item.pallets_20ft) || 0;
  const bundlesPerPallet = parseFloat(item.bundlesPerPallet || item.bundles_per_pallet) || 0;
  const palletSize = item.palletSize || item.pallet_size || "";

  // Volume in CBM of 1 piece: (L * W * H) / 1,000,000
  const pieceCbm = (length * width * height) / 1000000;
  const bundleCbm = pieceCbm * qtyPerBundle;
  
  let bundlesPer20ft = 0;
  let bundlesPer40ft = 0;
  let qtyPer40ft = 0;
  let qtyPer20ft = 0;

  // Check if Pallet loading is present
  const isPalletLoaded = (palletSize && palletSize !== "TBA" && palletSize !== "-") || (bundlesPerPallet > 0);

  if (isPalletLoaded && bundlesPerPallet > 0 && (palletsPer40ft > 0 || palletsPer20ft > 0)) {
    // Pallet Calculation:
    // Bundles = Pallets * BundlesPerPallet
    // Qty = Pallets * BundlesPerPallet * QtyPerBundle (Formula: L * J * H and M * J * H)
    bundlesPer40ft = Math.round(palletsPer40ft * bundlesPerPallet);
    bundlesPer20ft = Math.round(palletsPer20ft * bundlesPerPallet);
    qtyPer40ft = bundlesPer40ft * qtyPerBundle;
    qtyPer20ft = bundlesPer20ft * qtyPerBundle;
  } else {
    // Floor loading formula with practical CBM tolerance:
    // 20ft (26 CBM tolerance) => 26 / (vol) / qtyPerBundle
    // 40ft (66 CBM tolerance) => 66 / (vol) / qtyPerBundle
    if (pieceCbm > 0 && qtyPerBundle > 0) {
      bundlesPer20ft = Math.round(26 / pieceCbm / qtyPerBundle);
      bundlesPer40ft = Math.round(66 / pieceCbm / qtyPerBundle);
      qtyPer40ft = bundlesPer40ft * qtyPerBundle;
      qtyPer20ft = bundlesPer20ft * qtyPerBundle;
    } else {
      bundlesPer20ft = Math.round(parseFloat(item.bundlesPer20ft) || 0);
      bundlesPer40ft = Math.round(parseFloat(item.bundlesPer40ft) || 0);
      qtyPer40ft = parseFloat(item.qtyPer40ft) || (bundlesPer40ft * qtyPerBundle);
      qtyPer20ft = parseFloat(item.qtyPer20ft) || (bundlesPer20ft * qtyPerBundle);
    }
  }

  // Financial calculations
  const { exportExpense, exchangeRate, margin, cifRate, vat } = params;
  const effectiveMargin = getEffectiveMargin(item, margin);

  // FOB 40ft: (((Export Expense / Qty40 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice40ft = (qtyPer40ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer40ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;

  // FOB 20ft: (((Export Expense / Qty20 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice20ft = (qtyPer20ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer20ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;

  // CIF 40ft: FOB_40ft + (CIF Rate / Qty40)
  const cifPrice40ft = (qtyPer40ft > 0)
    ? (fobPrice40ft + (cifRate / qtyPer40ft))
    : 0;

  // CIF 20ft: FOB_20ft + (CIF Rate / Qty20)
  const cifPrice20ft = (qtyPer20ft > 0)
    ? (fobPrice20ft + (cifRate / qtyPer20ft))
    : 0;

  // Ex Works Price: (UnitCost / Margin) * (1 + VAT)
  const exWorksPrice = (effectiveMargin > 0)
    ? ((unitCost / effectiveMargin) * (1 + vat))
    : 0;

  // Customer Order Volume & Auto Calculations
  const orderVolume = parseFloat(item.orderVolume) || 0;
  const orderCartons = (qtyPerBundle > 0 && orderVolume > 0) ? Math.round(orderVolume / qtyPerBundle) : 0;
  const qtyPerPallet = (bundlesPerPallet > 0 && qtyPerBundle > 0) ? (bundlesPerPallet * qtyPerBundle) : 0;
  const orderPallets = (qtyPerPallet > 0 && orderVolume > 0) ? Number((orderVolume / qtyPerPallet).toFixed(2)) : 0;
  const orderTotalCbm = (pieceCbm > 0 && orderVolume > 0) ? Number((pieceCbm * orderVolume).toFixed(3)) : 0;

  return {
    ...item,
    length,
    width,
    height,
    qtyPerBundle,
    unitCost,
    margin: item.margin !== undefined ? item.margin : "",
    effectiveMargin,
    palletsPer40ft,
    palletsPer20ft,
    bundlesPerPallet,
    pieceCbm,
    bundleCbm,
    bundlesPer20ft: Math.round(bundlesPer20ft),
    bundlesPer40ft: Math.round(bundlesPer40ft),
    qtyPer40ft: Math.round(qtyPer40ft),
    qtyPer20ft: Math.round(qtyPer20ft),
    fobPrice40ft,
    fobPrice20ft,
    cifPrice40ft,
    cifPrice20ft,
    exWorksPrice,
    orderVolume,
    orderCartons,
    orderPallets,
    orderTotalCbm
  };
}

/**
 * Calculate Horticulture Item quantities and prices
 */
export function calculateHorticultureItem(item, params = DEFAULT_FINANCIAL_PARAMS) {
  const dims = parseDimensions(item.cartonSize || item.carton_size);
  const packing = parseFloat(item.packing || item.piecesPerCarton || item.pieces_per_carton) || 1;
  const unitCost = parseFloat(item.unitCost || item.unit_cost) || 0;
  
  const palletsPer40ft = parseFloat(item.palletsPer40ft || item.pallets_40ft) || 0;
  const palletsPer20ft = parseFloat(item.palletsPer20ft || item.pallets_20ft) || 0;
  const cartonsPerPallet = parseFloat(item.cartonsPerPallet || item.cartons_per_pallet) || 0;
  const palletSize = item.palletSize || item.pallet_size || "";
  
  const hasRollDiameter = Boolean(
    item.rollDiameter && 
    item.rollDiameter !== "TBA" && 
    item.rollDiameter !== "-" && 
    String(item.rollDiameter).trim() !== ""
  );

  const rollDims = parseRollDimensions(item.rollLength || item.roll_length, item.rollDiameter || item.roll_diameter);
  const isRoll = hasRollDiameter || item.loadingType === "roll" || rollDims.rollCbm > 0;
  const loadingType = item.loadingType || (isRoll ? "roll" : (cartonsPerPallet > 0 ? "pallet" : "carton_floor"));

  const cartonCbm = (dims.length * dims.width * dims.height) / 1000000;
  const itemCbm = isRoll && rollDims.rollCbm > 0 ? rollDims.rollCbm : cartonCbm;

  let cartonsPer20ft = 0;
  let cartonsPer40ft = 0;
  let bundlesPer20ft = 0;
  let bundlesPer40ft = 0;
  let qtyPer40ft = 0;
  let qtyPer20ft = 0;

  if (loadingType === "roll" || isRoll) {
    if (rollDims.rollCbm > 0) {
      // Auto cal roll loadability based on Roll CBM:
      // Rolls 20ft: 26 / Roll_CBM
      // Rolls 40ft: 66 / Roll_CBM
      cartonsPer20ft = Math.round(26 / rollDims.rollCbm);
      cartonsPer40ft = Math.round(66 / rollDims.rollCbm);
      bundlesPer20ft = cartonsPer20ft;
      bundlesPer40ft = cartonsPer40ft;
      qtyPer40ft = cartonsPer40ft * packing;
      qtyPer20ft = cartonsPer20ft * packing;
    } else {
      qtyPer40ft = parseFloat(item.qtyPer40ft) || 0;
      qtyPer20ft = parseFloat(item.qtyPer20ft) || 0;
      bundlesPer20ft = Math.round(parseFloat(item.bundlesPer20ft) || 0);
      bundlesPer40ft = Math.round(parseFloat(item.bundlesPer40ft) || 0);
      cartonsPer20ft = Math.round(parseFloat(item.cartonsPer20ft || item.bundlesPer20ft) || 0);
      cartonsPer40ft = Math.round(parseFloat(item.cartonsPer40ft || item.bundlesPer40ft) || 0);
    }
  } else if (loadingType === "pallet" && cartonsPerPallet > 0 && (palletsPer40ft > 0 || palletsPer20ft > 0)) {
    // Pallet loading situation: Auto cal = (L x I x F) and (M x I x F)
    cartonsPer40ft = Math.round(palletsPer40ft * cartonsPerPallet);
    cartonsPer20ft = Math.round(palletsPer20ft * cartonsPerPallet);
    bundlesPer40ft = cartonsPer40ft;
    bundlesPer20ft = cartonsPer20ft;
    qtyPer40ft = cartonsPer40ft * packing;
    qtyPer20ft = cartonsPer20ft * packing;
  } else if (loadingType === "bundle_floor") {
    // No cartons, bundle pack floor loaded: Auto cal (O x F) and (N x F)
    bundlesPer20ft = Math.round(parseFloat(item.bundlesPer20ft || item.cartonsPer20ft) || 0);
    bundlesPer40ft = Math.round(parseFloat(item.bundlesPer40ft || item.cartonsPer40ft) || 0);
    cartonsPer20ft = bundlesPer20ft;
    cartonsPer40ft = bundlesPer40ft;
    qtyPer40ft = cartonsPer40ft * packing;
    qtyPer20ft = cartonsPer20ft * packing;
  } else {
    // Standard Carton / Bundle floor loaded situation with CBM tolerance:
    // 20ft: 26 / Carton_CBM
    // 40ft: 66 / Carton_CBM - 7
    if (cartonCbm > 0) {
      cartonsPer20ft = Math.round(26 / cartonCbm);
      cartonsPer40ft = Math.max(0, Math.round((66 / cartonCbm) - 7));
      bundlesPer20ft = cartonsPer20ft;
      bundlesPer40ft = cartonsPer40ft;
      qtyPer40ft = cartonsPer40ft * packing;
      qtyPer20ft = cartonsPer20ft * packing;
    } else {
      cartonsPer20ft = Math.round(parseFloat(item.cartonsPer20ft || item.bundlesPer20ft) || 0);
      cartonsPer40ft = Math.round(parseFloat(item.cartonsPer40ft || item.bundlesPer40ft) || 0);
      bundlesPer20ft = Math.round(parseFloat(item.bundlesPer20ft || item.cartonsPer20ft) || 0);
      bundlesPer40ft = Math.round(parseFloat(item.bundlesPer40ft || item.cartonsPer40ft) || 0);
      qtyPer40ft = parseFloat(item.qtyPer40ft) || (cartonsPer40ft * packing);
      qtyPer20ft = parseFloat(item.qtyPer20ft) || (cartonsPer20ft * packing);
    }
  }

  // Financial calculations
  const { exportExpense, exchangeRate, margin, cifRate, vat } = params;
  const effectiveMargin = getEffectiveMargin(item, margin);

  // FOB 40ft: (((Export Expense / Qty40 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice40ft = (qtyPer40ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer40ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;

  // FOB 20ft: (((Export Expense / Qty20 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice20ft = (qtyPer20ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer20ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;

  // CIF 40ft: FOB_40ft + (CIF Rate / Qty40)
  const cifPrice40ft = (qtyPer40ft > 0)
    ? (fobPrice40ft + (cifRate / qtyPer40ft))
    : 0;

  // CIF 20ft: FOB_20ft + (CIF Rate / Qty20)
  const cifPrice20ft = (qtyPer20ft > 0)
    ? (fobPrice20ft + (cifRate / qtyPer20ft))
    : 0;

  // Ex Works Price: (UnitCost / Margin) * (1 + VAT)
  const exWorksPrice = (effectiveMargin > 0)
    ? ((unitCost / effectiveMargin) * (1 + vat))
    : 0;

  // Customer Order Volume & Auto Calculations
  const orderVolume = parseFloat(item.orderVolume) || 0;
  const orderCartons = (packing > 0 && orderVolume > 0) ? Math.round(orderVolume / packing) : 0;
  const qtyPerPallet = (cartonsPerPallet > 0 && packing > 0) ? (cartonsPerPallet * packing) : 0;
  const orderPallets = (qtyPerPallet > 0 && orderVolume > 0) ? Number((orderVolume / qtyPerPallet).toFixed(2)) : 0;
  const orderTotalCbm = (itemCbm > 0 && orderCartons > 0) ? Number((itemCbm * orderCartons).toFixed(3)) : 0;

  return {
    ...item,
    dims,
    rollDims,
    packing,
    unitCost,
    margin: item.margin !== undefined ? item.margin : "",
    effectiveMargin,
    palletsPer40ft,
    palletsPer20ft,
    cartonsPerPallet,
    cartonCbm,
    rollCbm: rollDims.rollCbm,
    itemCbm,
    loadingType,
    hasRollDiameter,
    bundlesPer20ft: Math.round(bundlesPer20ft),
    bundlesPer40ft: Math.round(bundlesPer40ft),
    cartonsPer20ft: Math.round(cartonsPer20ft),
    cartonsPer40ft: Math.round(cartonsPer40ft),
    qtyPer40ft: Math.round(qtyPer40ft),
    qtyPer20ft: Math.round(qtyPer20ft),
    fobPrice40ft,
    fobPrice20ft,
    cifPrice40ft,
    cifPrice20ft,
    exWorksPrice,
    orderVolume,
    orderCartons,
    orderPallets,
    orderTotalCbm
  };
}

/**
 * Resolves the display price for quotation based on selected term and container size
 */
export function getDisplayPrice(calculatedItem, priceTerm, containerSize, cifRate = 3500) {
  if (!calculatedItem) return { label: "$0.00", value: 0, subText: "" };
  
  const is20ft = containerSize === "20ft";
  const fob = is20ft ? calculatedItem.fobPrice20ft : calculatedItem.fobPrice40ft;
  const cif = is20ft ? calculatedItem.cifPrice20ft : calculatedItem.cifPrice40ft;
  const exw = calculatedItem.exWorksPrice;
  const qty = is20ft ? calculatedItem.qtyPer20ft : calculatedItem.qtyPer40ft;

  switch (priceTerm) {
    case "FOB":
      return {
        label: `$${(fob || 0).toFixed(4)}`,
        value: fob || 0,
        subText: `FOB ${is20ft ? "20ft" : "40ft"}`
      };
    case "CIF":
      return {
        label: `$${(cif || 0).toFixed(4)}`,
        value: cif || 0,
        subText: `CIF ${is20ft ? "20ft" : "40ft"}`
      };
    case "EX_WORKS":
    case "EX works":
      return {
        label: `LKR ${(exw || 0).toFixed(2)}`,
        value: exw || 0,
        subText: "EX Works"
      };
    case "FOB_SEPARATE_CIF":
    case "FOB with separate CIF":
      {
        const freightPerUnit = qty > 0 ? (cifRate / qty) : 0;
        return {
          label: `$${(fob || 0).toFixed(4)}`,
          value: fob || 0,
          freightPerUnit,
          exWorksPrice: exw,
          subText: `FOB + CIF ($${freightPerUnit.toFixed(4)} freight/unit)`
        };
      }
    default:
      return {
        label: `$${(fob || 0).toFixed(4)}`,
        value: fob || 0,
        subText: priceTerm
      };
  }
}

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
  shipperName: "Toyo Cushion Lanka (PVT) LTD",
  companyNo: "PV 5492",
  address: "400 Deans Road Colombo 10 01000 Sri Lanka",
  phone: "+9474 216 8231",
  email: "Info@hayleysfibre.com",
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
  const match = clean.match(/(\d+(\.\d+)?)\s*[*xX×,\/\-:\s]\s*(\d+(\.\d+)?)\s*[*xX×,\/\-:\s]\s*(\d+(\.\d+)?)/);
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

  if (rollDiameterStr !== undefined && rollDiameterStr !== null && rollDiameterStr !== "") {
    const rawD = String(rollDiameterStr).trim();
    const isMeter = /m/i.test(rawD) && !/cm|mm/i.test(rawD);
    const cleanD = rawD.replace(/cm|mm|m/gi, "").trim();
    const dMatch = cleanD.match(/(\d+(\.\d+)?)/);
    if (dMatch) {
      const num = parseFloat(dMatch[1]) || 0;
      diameterCm = isMeter ? num * 100 : num;
    }
  }

  if (rollLengthStr !== undefined && rollLengthStr !== null && rollLengthStr !== "") {
    const rawL = String(rollLengthStr).trim();
    const isMeter = /m/i.test(rawL) && !/cm|mm/i.test(rawL);
    const cleanL = rawL.replace(/cm|mm|m/gi, "").trim();
    const lMatch = cleanL.match(/(\d+(\.\d+)?)/);
    if (lMatch) {
      const num = parseFloat(lMatch[1]) || 0;
      lengthCm = isMeter ? num * 100 : num;
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
  const isNoLatex = !item.latexRatio || String(item.latexRatio).toLowerCase().trim() === "no latex" || String(item.latexRatio).toLowerCase().trim() === "none";
  const latex = !isNoLatex ? (String(item.latexRatio).toLowerCase().includes("latex") ? String(item.latexRatio).trim() : `${item.latexRatio} Latex`) : "";

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
  
  let palletsPer40ft = parseFloat(item.palletsPer40ft || item.pallets_40ft) || 0;
  let palletsPer20ft = parseFloat(item.palletsPer20ft || item.pallets_20ft) || 0;
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

  if (isPalletLoaded && bundlesPerPallet > 0) {
    // Pallet per 20ft defaults to 10, pallet per 40ft defaults to 20
    if (!palletsPer20ft || palletsPer20ft <= 0) palletsPer20ft = 10;
    if (!palletsPer40ft || palletsPer40ft <= 0) palletsPer40ft = 20;

    // Pallet Calculation:
    // Bundles = Pallets * BundlesPerPallet
    // Qty = pcs per carton/bundle * Pallets * BundlesPerPallet
    bundlesPer20ft = Math.round(palletsPer20ft * bundlesPerPallet);
    bundlesPer40ft = Math.round(palletsPer40ft * bundlesPerPallet);
    qtyPer20ft = Math.round(qtyPerBundle * palletsPer20ft * bundlesPerPallet);
    qtyPer40ft = Math.round(qtyPerBundle * palletsPer40ft * bundlesPerPallet);
  } else {
    // Bundle Floor Loaded calculation: 27 / ((L x W x H)/1000000) and 67 / ((L x W x H)/1000000)
    if (bundleCbm > 0 && qtyPerBundle > 0) {
      bundlesPer20ft = Math.round(27 / bundleCbm);
      bundlesPer40ft = Math.round(67 / bundleCbm);
      qtyPer20ft = Math.round(bundlesPer20ft * qtyPerBundle);
      qtyPer40ft = Math.round(bundlesPer40ft * qtyPerBundle);
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
  let rawFob40 = (qtyPer40ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer40ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;
  const fobPrice40ft = isFinite(rawFob40) && !isNaN(rawFob40) ? rawFob40 : 0;

  // FOB 20ft: (((Export Expense / Qty20 + UnitCost) / ExchangeRate)) / (1 - Margin)
  let rawFob20 = (qtyPer20ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer20ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;
  const fobPrice20ft = isFinite(rawFob20) && !isNaN(rawFob20) ? rawFob20 : 0;

  // CIF 40ft: FOB_40ft + (CIF Rate / Qty40)
  let rawCif40 = (qtyPer40ft > 0)
    ? (fobPrice40ft + (cifRate / qtyPer40ft))
    : 0;
  const cifPrice40ft = isFinite(rawCif40) && !isNaN(rawCif40) ? rawCif40 : 0;

  // CIF 20ft: FOB_20ft + (CIF Rate / Qty20)
  let rawCif20 = (qtyPer20ft > 0)
    ? (fobPrice20ft + (cifRate / qtyPer20ft))
    : 0;
  const cifPrice20ft = isFinite(rawCif20) && !isNaN(rawCif20) ? rawCif20 : 0;

  // Ex Works Price: (UnitCost / Margin) * (1 + VAT)
  let rawExw = (effectiveMargin > 0)
    ? ((unitCost / effectiveMargin) * (1 + vat))
    : 0;
  const exWorksPrice = isFinite(rawExw) && !isNaN(rawExw) ? rawExw : 0;

  // Customer Order Volume & Auto Calculations
  const orderVolume = parseFloat(item.orderVolume) || 0;
  const orderCartons = (qtyPerBundle > 0 && orderVolume > 0) ? Math.round(orderVolume / qtyPerBundle) : 0;
  const qtyPerPallet = (bundlesPerPallet > 0 && qtyPerBundle > 0) ? (bundlesPerPallet * qtyPerBundle) : 0;
  const rawPallets = (qtyPerPallet > 0 && orderVolume > 0) ? Number((orderVolume / qtyPerPallet).toFixed(2)) : 0;
  const orderPallets = isFinite(rawPallets) && !isNaN(rawPallets) ? rawPallets : 0;
  const rawTotalCbm = (pieceCbm > 0 && orderVolume > 0) ? Number((pieceCbm * orderVolume).toFixed(3)) : 0;
  const orderTotalCbm = isFinite(rawTotalCbm) && !isNaN(rawTotalCbm) ? rawTotalCbm : 0;

  return {
    ...item,
    length: isFinite(length) ? length : 0,
    width: isFinite(width) ? width : 0,
    height: isFinite(height) ? height : 0,
    qtyPerBundle: isFinite(qtyPerBundle) ? qtyPerBundle : 1,
    unitCost: isFinite(unitCost) ? unitCost : 0,
    margin: item.margin !== undefined ? item.margin : "",
    effectiveMargin: isFinite(effectiveMargin) ? effectiveMargin : 0.40,
    palletsPer40ft: isFinite(palletsPer40ft) ? palletsPer40ft : 0,
    palletsPer20ft: isFinite(palletsPer20ft) ? palletsPer20ft : 0,
    bundlesPerPallet: isFinite(bundlesPerPallet) ? bundlesPerPallet : 0,
    pieceCbm: isFinite(pieceCbm) ? pieceCbm : 0,
    bundleCbm: isFinite(bundleCbm) ? bundleCbm : 0,
    bundlesPer20ft: isFinite(bundlesPer20ft) ? Math.round(bundlesPer20ft) : 0,
    bundlesPer40ft: isFinite(bundlesPer40ft) ? Math.round(bundlesPer40ft) : 0,
    qtyPer40ft: isFinite(qtyPer40ft) ? Math.round(qtyPer40ft) : 0,
    qtyPer20ft: isFinite(qtyPer20ft) ? Math.round(qtyPer20ft) : 0,
    fobPrice40ft: Number(fobPrice40ft.toFixed(2)),
    fobPrice20ft: Number(fobPrice20ft.toFixed(2)),
    cifPrice40ft: Number(cifPrice40ft.toFixed(2)),
    cifPrice20ft: Number(cifPrice20ft.toFixed(2)),
    exWorksPrice: Number(exWorksPrice.toFixed(2)),
    orderVolume: isFinite(orderVolume) ? orderVolume : 0,
    orderCartons: isFinite(orderCartons) ? orderCartons : 0,
    orderPallets,
    orderTotalCbm
  };
}

/**
 * Calculate Horticulture Item quantities and prices
 */
export function calculateHorticultureItem(item, params = DEFAULT_FINANCIAL_PARAMS) {
  const dims = parseDimensions(
    item.cartonSize || item.carton_size || item.bundleSize || item.bundle_size || item.specifications || (item.length && item.width && item.height ? `${item.length}x${item.width}x${item.height}` : "")
  );
  let packing = parseFloat(item.packing || item.piecesPerCarton || item.pieces_per_carton) || 1;
  const unitCost = parseFloat(item.unitCost || item.unit_cost) || 0;
  
  let palletsPer40ft = parseFloat(item.palletsPer40ft || item.pallets_40ft) || 0;
  let palletsPer20ft = parseFloat(item.palletsPer20ft || item.pallets_20ft) || 0;
  const cartonsPerPallet = parseFloat(item.cartonsPerPallet || item.cartons_per_pallet || item.bundlesPerPallet || item.bundles_per_pallet) || 0;
  const palletSize = item.palletSize || item.pallet_size || "";
  
  // Normalize packing configuration if specified
  const normConfig = String(item.packingConfiguration || "").trim().toLowerCase();
  const rollDiaRaw = item.rollDiameter || item.roll_diameter || item.rollDia || item.spec_rollDiameter || "";
  const rollLenRaw = item.rollLength || item.roll_length || item.rollLen || item.spec_rollLength || "";
  const rollDiaNum = parseFloat(rollDiaRaw) || 0;
  const rollLenNum = parseFloat(rollLenRaw) || 0;
  const rollDims = parseRollDimensions(rollLenRaw, rollDiaRaw);

  // An item is a roll ONLY if its config is roll, or if loadingType is roll, or if it has positive roll diameter/length and is NOT carton or bundle
  const isRoll = (
    normConfig.includes("roll") ||
    item.loadingType === "roll" ||
    item.loadingType === "roll_floor" ||
    item.loadingType === "roll_pallet" ||
    ((rollDiaNum > 0 || rollLenNum > 0 || rollDims.rollCbm > 0) && !normConfig.includes("carton") && !normConfig.includes("bundle"))
  );

  const isPalletConfig = (
    normConfig.includes("pallet") ||
    item.loadingType === "pallet" ||
    item.loadingType === "bundle_pallet" ||
    item.loadingType === "roll_pallet" ||
    (cartonsPerPallet > 0) ||
    (palletSize && palletSize !== "TBA" && palletSize !== "-" && palletSize !== "0" && String(palletSize).trim() !== "")
  );

  let loadingType = item.loadingType;
  if (!loadingType) {
    if (isRoll) {
      loadingType = isPalletConfig ? "roll_pallet" : "roll_floor";
    } else if (isPalletConfig) {
      loadingType = normConfig.includes("bundle") ? "bundle_pallet" : "pallet";
    } else if (normConfig.includes("bundle")) {
      loadingType = "bundle_floor";
    } else {
      loadingType = "carton_floor";
    }
  }

  // Pallet loading defaults: 10 for 20ft, 20 for 40ft
  if (isPalletConfig || loadingType === "pallet" || loadingType === "bundle_pallet" || loadingType === "roll_pallet") {
    if (!palletsPer20ft || palletsPer20ft <= 0) palletsPer20ft = 10;
    if (!palletsPer40ft || palletsPer40ft <= 0) palletsPer40ft = 20;
  }

  const cartonCbm = (dims.length * dims.width * dims.height) / 1000000;
  const itemCbm = isRoll && rollDims.rollCbm > 0 ? rollDims.rollCbm : cartonCbm;

  let cartonsPer20ft = 0;
  let cartonsPer40ft = 0;
  let bundlesPer20ft = 0;
  let bundlesPer40ft = 0;
  let qtyPer40ft = 0;
  let qtyPer20ft = 0;

  if (loadingType === "roll_floor" || (isRoll && !isPalletConfig)) {
    // 3. Roll Floor Loaded case:
    // packing is ALWAYS 1 pc per roll
    packing = 1;
    cartonsPer20ft = 0;
    cartonsPer40ft = 0;
    bundlesPer20ft = 0;
    bundlesPer40ft = 0;

    // qty per 20ft = 27 / ((roll length * roll diameter * roll diameter) / 1000000)
    // qty per 40ft = 67 / ((roll length * roll diameter * roll diameter) / 1000000)
    if (rollDims.rollCbm > 0) {
      qtyPer20ft = Math.round(27 / rollDims.rollCbm);
      qtyPer40ft = Math.round(67 / rollDims.rollCbm);
    } else {
      qtyPer20ft = parseFloat(item.qtyPer20ft) || 0;
      qtyPer40ft = parseFloat(item.qtyPer40ft) || 0;
    }
  } else if (loadingType === "roll_pallet" || (isRoll && isPalletConfig)) {
    // 6. Roll Pallet Loading:
    // packing is ALWAYS 1 pc per roll
    // pallets per 20ft is 10, pallets per 40ft is 20
    // qty per 20ft = cartons/bundles per pallet * pallets per 20ft
    // qty per 40ft = cartons/bundles per pallet * pallets per 40ft
    packing = 1;
    cartonsPer20ft = Math.round(cartonsPerPallet * palletsPer20ft);
    cartonsPer40ft = Math.round(cartonsPerPallet * palletsPer40ft);
    bundlesPer20ft = cartonsPer20ft;
    bundlesPer40ft = cartonsPer40ft;
    qtyPer20ft = cartonsPer20ft;
    qtyPer40ft = cartonsPer40ft;
  } else if (isPalletConfig && cartonsPerPallet > 0) {
    // 4 & 5. Carton Pallet Loading & Bundle Pallet Loading:
    // Pallet per 20ft default is 10, pallet per 40ft default is 20
    // Cartons/bundles per pallet is filled and mandatory
    // packing is picked from Finance costing request
    // qty per 20ft = pcs per carton * pallet 20ft * cartons/bundles per pallet
    // qty per 40ft = pcs per carton * pallet 40ft * cartons/bundles per pallet
    cartonsPer20ft = Math.round(palletsPer20ft * cartonsPerPallet);
    cartonsPer40ft = Math.round(palletsPer40ft * cartonsPerPallet);
    bundlesPer20ft = cartonsPer20ft;
    bundlesPer40ft = cartonsPer40ft;
    qtyPer20ft = Math.round(packing * cartonsPer20ft);
    qtyPer40ft = Math.round(packing * cartonsPer40ft);
  } else {
    // 1 & 2. Carton Floor Loaded & Bundle Floor Loaded:
    // cartons/bundles per 20ft = 27 / ((L * W * H) / 1000000)
    // qty per 20ft = cartons/bundles per 20ft * packing pcs
    // cartons/bundles per 40ft = 67 / ((L * W * H) / 1000000)
    // qty per 40ft = cartons/bundles per 40ft * packing pcs
    // packing is picked from Finance costing request
    if (cartonCbm > 0) {
      cartonsPer20ft = Math.round(27 / cartonCbm);
      cartonsPer40ft = Math.round(67 / cartonCbm);
      bundlesPer20ft = cartonsPer20ft;
      bundlesPer40ft = cartonsPer40ft;
      qtyPer20ft = Math.round(cartonsPer20ft * packing);
      qtyPer40ft = Math.round(cartonsPer40ft * packing);
    } else {
      cartonsPer20ft = Math.round(parseFloat(item.cartonsPer20ft || item.bundlesPer20ft) || 0);
      cartonsPer40ft = Math.round(parseFloat(item.cartonsPer40ft || item.bundlesPer40ft) || 0);
      bundlesPer20ft = cartonsPer20ft;
      bundlesPer40ft = cartonsPer40ft;
      qtyPer20ft = parseFloat(item.qtyPer20ft) || Math.round(cartonsPer20ft * packing);
      qtyPer40ft = parseFloat(item.qtyPer40ft) || Math.round(cartonsPer40ft * packing);
    }
  }

  // Financial calculations
  const { exportExpense, exchangeRate, margin, cifRate, vat } = params;
  const effectiveMargin = getEffectiveMargin(item, margin);

  // FOB 40ft: (((Export Expense / Qty40 + UnitCost) / ExchangeRate)) / (1 - Margin)
  let rawFob40 = (qtyPer40ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer40ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;
  const fobPrice40ft = isFinite(rawFob40) && !isNaN(rawFob40) ? rawFob40 : 0;

  // FOB 20ft: (((Export Expense / Qty20 + UnitCost) / ExchangeRate)) / (1 - Margin)
  let rawFob20 = (qtyPer20ft > 0 && exchangeRate > 0 && (1 - effectiveMargin) > 0)
    ? (((exportExpense / qtyPer20ft + unitCost) / exchangeRate) / (1 - effectiveMargin))
    : 0;
  const fobPrice20ft = isFinite(rawFob20) && !isNaN(rawFob20) ? rawFob20 : 0;

  // CIF 40ft: FOB_40ft + (CIF Rate / Qty40)
  let rawCif40 = (qtyPer40ft > 0)
    ? (fobPrice40ft + (cifRate / qtyPer40ft))
    : 0;
  const cifPrice40ft = isFinite(rawCif40) && !isNaN(rawCif40) ? rawCif40 : 0;

  // CIF 20ft: FOB_20ft + (CIF Rate / Qty20)
  let rawCif20 = (qtyPer20ft > 0)
    ? (fobPrice20ft + (cifRate / qtyPer20ft))
    : 0;
  const cifPrice20ft = isFinite(rawCif20) && !isNaN(rawCif20) ? rawCif20 : 0;

  // Ex Works Price: (UnitCost / Margin) * (1 + VAT)
  let rawExw = (effectiveMargin > 0)
    ? ((unitCost / effectiveMargin) * (1 + vat))
    : 0;
  const exWorksPrice = isFinite(rawExw) && !isNaN(rawExw) ? rawExw : 0;

  // Customer Order Volume & Auto Calculations
  const orderVolume = parseFloat(item.orderVolume) || 0;
  const orderCartons = (packing > 0 && orderVolume > 0) ? Math.round(orderVolume / packing) : 0;
  const qtyPerPallet = (cartonsPerPallet > 0 && packing > 0) ? (cartonsPerPallet * packing) : 0;
  const rawPallets = (qtyPerPallet > 0 && orderVolume > 0) ? Number((orderVolume / qtyPerPallet).toFixed(2)) : 0;
  const orderPallets = isFinite(rawPallets) && !isNaN(rawPallets) ? rawPallets : 0;
  const rawTotalCbm = (itemCbm > 0 && orderCartons > 0) ? Number((itemCbm * orderCartons).toFixed(3)) : 0;
  const orderTotalCbm = isFinite(rawTotalCbm) && !isNaN(rawTotalCbm) ? rawTotalCbm : 0;

  return {
    ...item,
    dims,
    rollDims,
    packing: isFinite(packing) ? packing : 1,
    unitCost: isFinite(unitCost) ? unitCost : 0,
    margin: item.margin !== undefined ? item.margin : "",
    effectiveMargin: isFinite(effectiveMargin) ? effectiveMargin : 0.40,
    palletsPer40ft: isFinite(palletsPer40ft) ? palletsPer40ft : 0,
    palletsPer20ft: isFinite(palletsPer20ft) ? palletsPer20ft : 0,
    cartonsPerPallet: isFinite(cartonsPerPallet) ? cartonsPerPallet : 0,
    cartonCbm: isFinite(cartonCbm) ? cartonCbm : 0,
    rollCbm: isFinite(rollDims.rollCbm) ? rollDims.rollCbm : 0,
    itemCbm: isFinite(itemCbm) ? itemCbm : 0,
    loadingType,
    isRoll,
    hasRollDiameter: isRoll,
    bundlesPer20ft: isFinite(bundlesPer20ft) ? Math.round(bundlesPer20ft) : 0,
    bundlesPer40ft: isFinite(bundlesPer40ft) ? Math.round(bundlesPer40ft) : 0,
    cartonsPer20ft: isFinite(cartonsPer20ft) ? Math.round(cartonsPer20ft) : 0,
    cartonsPer40ft: isFinite(cartonsPer40ft) ? Math.round(cartonsPer40ft) : 0,
    qtyPer40ft: isFinite(qtyPer40ft) ? Math.round(qtyPer40ft) : 0,
    qtyPer20ft: isFinite(qtyPer20ft) ? Math.round(qtyPer20ft) : 0,
    fobPrice40ft: Number(fobPrice40ft.toFixed(2)),
    fobPrice20ft: Number(fobPrice20ft.toFixed(2)),
    cifPrice40ft: Number(cifPrice40ft.toFixed(2)),
    cifPrice20ft: Number(cifPrice20ft.toFixed(2)),
    exWorksPrice: Number(exWorksPrice.toFixed(2)),
    orderVolume: isFinite(orderVolume) ? orderVolume : 0,
    orderCartons: isFinite(orderCartons) ? orderCartons : 0,
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
        label: `$${(fob || 0).toFixed(2)}`,
        value: Number((fob || 0).toFixed(2)),
        subText: `FOB ${is20ft ? "20ft" : "40ft"}`
      };
    case "CIF":
      return {
        label: `$${(cif || 0).toFixed(2)}`,
        value: Number((cif || 0).toFixed(2)),
        subText: `CIF ${is20ft ? "20ft" : "40ft"}`
      };
    case "EX_WORKS":
    case "EX works":
      return {
        label: `LKR ${(exw || 0).toFixed(2)}`,
        value: Number((exw || 0).toFixed(2)),
        subText: "EX Works"
      };
    case "FOB_SEPARATE_CIF":
    case "FOB with separate CIF":
      {
        const freightPerUnit = qty > 0 ? (cifRate / qty) : 0;
        return {
          label: `$${(fob || 0).toFixed(2)}`,
          value: Number((fob || 0).toFixed(2)),
          freightPerUnit: Number(freightPerUnit.toFixed(2)),
          exWorksPrice: Number((exw || 0).toFixed(2)),
          subText: `FOB + CIF ($${freightPerUnit.toFixed(2)} freight/unit)`
        };
      }
    default:
      return {
        label: `$${(fob || 0).toFixed(2)}`,
        value: Number((fob || 0).toFixed(2)),
        subText: priceTerm
      };
  }
}

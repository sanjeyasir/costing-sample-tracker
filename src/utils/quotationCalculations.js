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
export const DEFAULT_SAVED_PRODUCTS = [
  {
    id: "preset-disc-30",
    category: "horticulture",
    name: "30 CM Round Weed Disc",
    description: "FHN0954",
    specifications: "30 CM | ROUND WEED DISC | WITH SAME LABEL AND PACKING REQUIREMENTS AS PREVIOUS ORDER",
    gsm: 800,
    latexRatio: "80:20",
    cartonSize: "57X51X58CM",
    packing: 128,
    palletSize: "1100 x 1100 mm",
    cartonsPerPallet: 16,
    imageUrl: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=300&auto=format&fit=crop&q=60"
  },
  {
    id: "preset-disc-40",
    category: "horticulture",
    name: "40 CM Round Weed Disc",
    description: "FHN0955",
    specifications: "40 CM | ROUND WEED DISC | 1000 GSM | LATEX TREATED",
    gsm: 1000,
    latexRatio: "80:20",
    cartonSize: "60X60X50CM",
    packing: 100,
    palletSize: "1100 x 1100 mm",
    cartonsPerPallet: 12,
    imageUrl: "https://images.unsplash.com/photo-1617173944883-6ffbd35d584d?w=300&auto=format&fit=crop&q=60"
  },
  {
    id: "preset-bed-pad-std",
    category: "bedding",
    name: "Coir Bedding Pad 190x90",
    description: "Standard Rubberized Coir Bedding Sheet 190x90x5cm",
    length: 190,
    width: 90,
    height: 5,
    organic: "Non-Organic",
    ncRcRatio: "70:30",
    density: "80 kg/m3",
    qtyPerBundle: 5,
    palletSize: "1900 x 900 mm",
    bundlesPerPallet: 8,
    imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=300&auto=format&fit=crop&q=60"
  },
  {
    id: "preset-bed-pad-org",
    category: "bedding",
    name: "Organic Coir Bedding Sheet",
    description: "100% Organic Certified Coir Sheet 200x100x10cm",
    length: 200,
    width: 100,
    height: 10,
    organic: "Organic",
    ncRcRatio: "100:0",
    density: "100 kg/m3",
    qtyPerBundle: 4,
    palletSize: "2000 x 1000 mm",
    bundlesPerPallet: 6,
    imageUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=300&auto=format&fit=crop&q=60"
  },
  {
    id: "preset-coir-roll",
    category: "horticulture",
    name: "Coir Geo Textile Roll",
    description: "Coir Mesh Blanket Roll 2m x 50m",
    specifications: "700 GSM | 100% Natural Coir Mesh for Erosion Control",
    gsm: 700,
    latexRatio: "N/A",
    rollDiameter: "45 cm",
    cartonSize: "",
    packing: 1,
    imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb22509?w=300&auto=format&fit=crop&q=60"
  }
];

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
 * Calculate Bedding Item quantities and prices
 */
export function calculateBeddingItem(item, params = DEFAULT_FINANCIAL_PARAMS) {
  const length = parseFloat(item.length || item.l) || 0;
  const width = parseFloat(item.width || item.w) || 0;
  const height = parseFloat(item.height || item.h) || 0;
  const qtyPerBundle = parseFloat(item.qtyPerBundle || item.qty_bundle) || 1;
  const unitCost = parseFloat(item.unitCost || item.unit_cost) || 0;
  
  const palletsPer40ft = parseFloat(item.palletsPer40ft || item.pallets_40ft) || 0;
  const palletsPer20ft = parseFloat(item.palletsPer20ft || item.pallets_20ft) || 0;
  const bundlesPerPallet = parseFloat(item.bundlesPerPallet || item.bundles_per_pallet) || 0;
  const palletSize = item.palletSize || item.pallet_size || "";

  // Volume in CBM of 1 piece: (L * W * H) / 1,000,000
  const pieceCbm = (length * width * height) / 1000000;
  
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
    bundlesPer40ft = palletsPer40ft * bundlesPerPallet;
    bundlesPer20ft = palletsPer20ft * bundlesPerPallet;
    qtyPer40ft = palletsPer40ft * bundlesPerPallet * qtyPerBundle;
    qtyPer20ft = palletsPer20ft * bundlesPerPallet * qtyPerBundle;
  } else {
    // Floor loading formula:
    // 20ft (27 CBM) => 27 / (vol) / qtyPerBundle
    // 40ft (67 CBM) => 67 / (vol) / qtyPerBundle
    if (pieceCbm > 0 && qtyPerBundle > 0) {
      bundlesPer20ft = 27 / pieceCbm / qtyPerBundle;
      bundlesPer40ft = 67 / pieceCbm / qtyPerBundle;
      qtyPer40ft = bundlesPer40ft * qtyPerBundle;
      qtyPer20ft = bundlesPer20ft * qtyPerBundle;
    } else {
      bundlesPer20ft = parseFloat(item.bundlesPer20ft) || 0;
      bundlesPer40ft = parseFloat(item.bundlesPer40ft) || 0;
      qtyPer40ft = parseFloat(item.qtyPer40ft) || (bundlesPer40ft * qtyPerBundle);
      qtyPer20ft = parseFloat(item.qtyPer20ft) || (bundlesPer20ft * qtyPerBundle);
    }
  }

  // Financial calculations
  const { exportExpense, exchangeRate, margin, cifRate, vat } = params;

  // FOB 40ft: (((Export Expense / Qty40 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice40ft = (qtyPer40ft > 0 && exchangeRate > 0 && (1 - margin) > 0)
    ? (((exportExpense / qtyPer40ft + unitCost) / exchangeRate) / (1 - margin))
    : 0;

  // FOB 20ft: (((Export Expense / Qty20 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice20ft = (qtyPer20ft > 0 && exchangeRate > 0 && (1 - margin) > 0)
    ? (((exportExpense / qtyPer20ft + unitCost) / exchangeRate) / (1 - margin))
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
  const exWorksPrice = (margin > 0)
    ? ((unitCost / margin) * (1 + vat))
    : 0;

  return {
    ...item,
    length,
    width,
    height,
    qtyPerBundle,
    unitCost,
    palletsPer40ft,
    palletsPer20ft,
    bundlesPerPallet,
    pieceCbm,
    bundlesPer20ft: Math.round(bundlesPer20ft * 100) / 100,
    bundlesPer40ft: Math.round(bundlesPer40ft * 100) / 100,
    qtyPer40ft: Math.round(qtyPer40ft),
    qtyPer20ft: Math.round(qtyPer20ft),
    fobPrice40ft,
    fobPrice20ft,
    cifPrice40ft,
    cifPrice20ft,
    exWorksPrice
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
  const loadingType = item.loadingType || (cartonsPerPallet > 0 ? "pallet" : (item.rollDiameter ? "roll" : "carton_floor"));

  const cartonCbm = (dims.length * dims.width * dims.height) / 1000000;

  let cartonsPer20ft = 0;
  let cartonsPer40ft = 0;
  let qtyPer40ft = 0;
  let qtyPer20ft = 0;

  if (loadingType === "pallet" && cartonsPerPallet > 0 && (palletsPer40ft > 0 || palletsPer20ft > 0)) {
    // Pallet loading situation: Auto cal = (L x I x F) and (M x I x F)
    cartonsPer40ft = palletsPer40ft * cartonsPerPallet;
    cartonsPer20ft = palletsPer20ft * cartonsPerPallet;
    qtyPer40ft = palletsPer40ft * cartonsPerPallet * packing;
    qtyPer20ft = palletsPer20ft * cartonsPerPallet * packing;
  } else if (loadingType === "bundle_floor") {
    // No cartons, bundle pack floor loaded: Auto cal (O x F) and (N x F)
    cartonsPer20ft = parseFloat(item.cartonsPer20ft || item.bundlesPer20ft) || 0;
    cartonsPer40ft = parseFloat(item.cartonsPer40ft || item.bundlesPer40ft) || 0;
    qtyPer40ft = cartonsPer40ft * packing;
    qtyPer20ft = cartonsPer20ft * packing;
  } else if (loadingType === "roll") {
    // Roll form loading: Manual entry for quantities
    qtyPer40ft = parseFloat(item.qtyPer40ft) || 0;
    qtyPer20ft = parseFloat(item.qtyPer20ft) || 0;
    cartonsPer20ft = 0;
    cartonsPer40ft = 0;
  } else {
    // Standard Carton floor loaded situation:
    // 20ft: 27 / Carton_CBM
    // 40ft: 67 / Carton_CBM - 7
    if (cartonCbm > 0) {
      cartonsPer20ft = 27 / cartonCbm;
      cartonsPer40ft = Math.max(0, (67 / cartonCbm) - 7);
      qtyPer40ft = cartonsPer40ft * packing;
      qtyPer20ft = cartonsPer20ft * packing;
    } else {
      cartonsPer20ft = parseFloat(item.cartonsPer20ft) || 0;
      cartonsPer40ft = parseFloat(item.cartonsPer40ft) || 0;
      qtyPer40ft = parseFloat(item.qtyPer40ft) || (cartonsPer40ft * packing);
      qtyPer20ft = parseFloat(item.qtyPer20ft) || (cartonsPer20ft * packing);
    }
  }

  // Financial calculations
  const { exportExpense, exchangeRate, margin, cifRate, vat } = params;

  // FOB 40ft: (((Export Expense / Qty40 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice40ft = (qtyPer40ft > 0 && exchangeRate > 0 && (1 - margin) > 0)
    ? (((exportExpense / qtyPer40ft + unitCost) / exchangeRate) / (1 - margin))
    : 0;

  // FOB 20ft: (((Export Expense / Qty20 + UnitCost) / ExchangeRate)) / (1 - Margin)
  const fobPrice20ft = (qtyPer20ft > 0 && exchangeRate > 0 && (1 - margin) > 0)
    ? (((exportExpense / qtyPer20ft + unitCost) / exchangeRate) / (1 - margin))
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
  const exWorksPrice = (margin > 0)
    ? ((unitCost / margin) * (1 + vat))
    : 0;

  return {
    ...item,
    dims,
    packing,
    unitCost,
    palletsPer40ft,
    palletsPer20ft,
    cartonsPerPallet,
    cartonCbm,
    loadingType,
    cartonsPer20ft: Math.round(cartonsPer20ft * 100) / 100,
    cartonsPer40ft: Math.round(cartonsPer40ft * 100) / 100,
    qtyPer40ft: Math.round(qtyPer40ft),
    qtyPer20ft: Math.round(qtyPer20ft),
    fobPrice40ft,
    fobPrice20ft,
    cifPrice40ft,
    cifPrice20ft,
    exWorksPrice
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

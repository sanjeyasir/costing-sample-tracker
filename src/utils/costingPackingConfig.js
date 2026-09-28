/**
 * Packing Configuration constants, validation, and auto-zero rules for Costing Requests
 */

export const HORTI_PACKING_OPTIONS = [
  "Carton Floor Loaded",
  "Carton Pallet Loading",
  "Bundle Floor Loaded",
  "Bundle Pallet Loading",
  "Roll Floor Loaded",
  "Roll Pallet Loading"
];

export const BEDDING_PACKING_OPTIONS = [
  "Bundle Floor Loaded",
  "Bundle Pallet Loading"
];

export const PACKING_CONFIG_TYPES = {
  CARTON_FLOOR: "Carton Floor Loaded",
  CARTON_PALLET: "Carton Pallet Loading",
  BUNDLE_FLOOR: "Bundle Floor Loaded",
  BUNDLE_PALLET: "Bundle Pallet Loading",
  ROLL_FLOOR: "Roll Floor Loaded",
  ROLL_PALLET: "Roll Pallet Loading"
};

/**
 * Returns allowed packing configuration options for a category
 */
export function getPackingOptionsForCategory(categoryIdOrName) {
  const str = String(categoryIdOrName || "").toLowerCase();
  if (str.includes("bedding")) {
    return BEDDING_PACKING_OPTIONS;
  }
  return HORTI_PACKING_OPTIONS;
}

/**
 * Default packing configuration for a given category
 */
export function getDefaultPackingOption(categoryIdOrName) {
  const str = String(categoryIdOrName || "").toLowerCase();
  if (str.includes("bedding")) {
    return PACKING_CONFIG_TYPES.BUNDLE_FLOOR;
  }
  return PACKING_CONFIG_TYPES.CARTON_FLOOR;
}

/**
 * Normalize packing configuration string
 */
export function normalizePackingConfig(config) {
  if (!config) return "";
  const str = String(config).trim().toLowerCase().replace(/[\-_]/g, " ");
  if (str.includes("roll") && (str.includes("pallet") || str.includes("plt"))) {
    return PACKING_CONFIG_TYPES.ROLL_PALLET;
  }
  if (str.includes("roll")) {
    return PACKING_CONFIG_TYPES.ROLL_FLOOR;
  }
  if (str.includes("bundle") && (str.includes("pallet") || str.includes("plt"))) {
    return PACKING_CONFIG_TYPES.BUNDLE_PALLET;
  }
  if (str.includes("bundle")) {
    return PACKING_CONFIG_TYPES.BUNDLE_FLOOR;
  }
  if (str.includes("carton") && (str.includes("pallet") || str.includes("plt"))) {
    return PACKING_CONFIG_TYPES.CARTON_PALLET;
  }
  if (str.includes("carton")) {
    return PACKING_CONFIG_TYPES.CARTON_FLOOR;
  }
  return config;
}

/**
 * Get required Finance fields and auto-zero fields based on packing configuration
 */
export function getFinanceFieldRules(packingConfig) {
  const norm = normalizePackingConfig(packingConfig);

  switch (norm) {
    case PACKING_CONFIG_TYPES.CARTON_FLOOR:
      return {
        configName: PACKING_CONFIG_TYPES.CARTON_FLOOR,
        required: ["packing", "cartonSize", "unitCost"],
        applicable: ["packing", "cartonSize", "unitCost"],
        nonApplicable: ["palletSize", "cartonsPerPallet", "rollDiameter", "rollLength"],
        labels: {
          packing: "Packing (Pieces per Carton)",
          cartonSize: "Carton Size (CM)",
          unitCost: "Unit Cost"
        }
      };

    case PACKING_CONFIG_TYPES.CARTON_PALLET:
      return {
        configName: PACKING_CONFIG_TYPES.CARTON_PALLET,
        required: ["packing", "cartonSize", "palletSize", "cartonsPerPallet", "unitCost"],
        applicable: ["packing", "cartonSize", "palletSize", "cartonsPerPallet", "unitCost"],
        nonApplicable: ["rollDiameter", "rollLength"],
        labels: {
          packing: "Packing (Pieces per Carton)",
          cartonSize: "Carton Size (CM)",
          palletSize: "Pallet Size (CM)",
          cartonsPerPallet: "Cartons per Pallet",
          unitCost: "Unit Cost"
        }
      };

    case PACKING_CONFIG_TYPES.BUNDLE_FLOOR:
      return {
        configName: PACKING_CONFIG_TYPES.BUNDLE_FLOOR,
        required: ["packing", "cartonSize", "unitCost"],
        applicable: ["packing", "cartonSize", "unitCost"],
        nonApplicable: ["palletSize", "cartonsPerPallet", "rollDiameter", "rollLength"],
        labels: {
          packing: "Packing (Pieces per Bundle)",
          cartonSize: "Bundle Size (CM)",
          unitCost: "Unit Cost"
        }
      };

    case PACKING_CONFIG_TYPES.BUNDLE_PALLET:
      return {
        configName: PACKING_CONFIG_TYPES.BUNDLE_PALLET,
        required: ["packing", "cartonSize", "palletSize", "cartonsPerPallet", "unitCost"],
        applicable: ["packing", "cartonSize", "palletSize", "cartonsPerPallet", "unitCost"],
        nonApplicable: ["rollDiameter", "rollLength"],
        labels: {
          packing: "Packing (Pieces per Bundle)",
          cartonSize: "Bundle Size (CM)",
          palletSize: "Pallet Size (CM)",
          cartonsPerPallet: "Bundles per Pallet",
          unitCost: "Unit Cost"
        }
      };

    case PACKING_CONFIG_TYPES.ROLL_FLOOR:
      return {
        configName: PACKING_CONFIG_TYPES.ROLL_FLOOR,
        required: ["packing", "rollDiameter", "rollLength", "unitCost"],
        applicable: ["packing", "rollDiameter", "rollLength", "unitCost"],
        nonApplicable: ["cartonSize", "palletSize", "cartonsPerPallet"],
        labels: {
          packing: "Packing (Pieces per Roll)",
          rollDiameter: "Roll Diameter (CM)",
          rollLength: "Roll Length (CM / M)",
          unitCost: "Unit Cost"
        }
      };

    case PACKING_CONFIG_TYPES.ROLL_PALLET:
      return {
        configName: PACKING_CONFIG_TYPES.ROLL_PALLET,
        required: ["packing", "rollDiameter", "rollLength", "palletSize", "unitCost"],
        applicable: ["packing", "rollDiameter", "rollLength", "palletSize", "unitCost"],
        nonApplicable: ["cartonSize", "cartonsPerPallet"],
        labels: {
          packing: "Packing (Pieces per Roll)",
          rollDiameter: "Roll Diameter (CM)",
          rollLength: "Roll Length (CM / M)",
          palletSize: "Pallet Size (CM)",
          unitCost: "Unit Cost"
        }
      };

    default:
      // Fallback if not specified or unrecognized
      return {
        configName: packingConfig || "Standard",
        required: ["packing", "unitCost"],
        applicable: ["packing", "cartonSize", "palletSize", "cartonsPerPallet", "rollDiameter", "rollLength", "unitCost"],
        nonApplicable: [],
        labels: { packing: "Packing (Pieces per Carton/Bundle/Roll)", unitCost: "Unit Cost" }
      };
  }
}

/**
 * Apply auto-zero to non-applicable fields in a costing item
 */
export function applyAutoZeroToCosting(costingItem, packingConfig) {
  const rules = getFinanceFieldRules(packingConfig);
  const updated = { ...(costingItem || {}) };

  rules.nonApplicable.forEach(fieldKey => {
    if (fieldKey === "cartonsPerPallet" || fieldKey === "unitCost") {
      updated[fieldKey] = 0;
    } else {
      updated[fieldKey] = "0";
    }
  });

  return updated;
}

/**
 * Validate that a dimension string is formatted as 3D LxWxH numerical dimensions (e.g. 57X51X58, 60x60x50, 57*51*58 CM, etc.)
 */
export function isValidDimensionString(val) {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  if (!str || str === "0" || str === "-") return true;

  // Remove common units like cm, mm, m (case insensitive)
  const clean = str.replace(/cm|mm|m/gi, "").trim();
  
  // 3D LxWxH format: 57X51X58, 57 x 51 x 58, 57*51*58, 57-51-58, 57/51/58, 57 51 58
  const match3D = clean.match(/^(\d+(\.\d+)?)\s*[*xX×\s,/\-:]\s*(\d+(\.\d+)?)\s*[*xX×\s,/\-:]\s*(\d+(\.\d+)?)$/);
  if (match3D) {
    const l = parseFloat(match3D[1]);
    const w = parseFloat(match3D[3]);
    const h = parseFloat(match3D[5]);
    return l > 0 && w > 0 && h > 0;
  }

  return false;
}

/**
 * Check if a string contains an L x W x H dimension sequence (e.g. "30x30x5", "57X51X58 CM", "100*50*20", etc.)
 */
export function containsLxWxHSequence(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (!s || s === "-") return false;

  // Match 3 numerical dimensions separated by x, X, *, ×, -, /, :, or "by" (with optional spaces)
  const regex = /(\d+(?:\.\d+)?)\s*(?:[xX*×\-/:]|\bby\b)\s*(\d+(?:\.\d+)?)\s*(?:[xX*×\-/:]|\bby\b)\s*(\d+(?:\.\d+)?)/i;
  const match = s.match(regex);
  if (match) {
    const l = parseFloat(match[1]);
    const w = parseFloat(match[2]);
    const h = parseFloat(match[3]);
    return l > 0 && w > 0 && h > 0;
  }
  return false;
}

/**
 * Validate that an item has all mandatory Finance fields filled
 * Returns { valid: boolean, error?: string }
 */
export function validateFinanceCostingItem(itemCosting, packingConfig, itemIndex = 0) {
  const normConfig = normalizePackingConfig(packingConfig);
  const rules = getFinanceFieldRules(normConfig);

  for (const fieldKey of rules.required) {
    const val = itemCosting ? itemCosting[fieldKey] : undefined;
    const fieldLabel = rules.labels[fieldKey] || fieldKey;

    if (val === undefined || val === null || val === "" || String(val).trim() === "" || String(val).trim() === "-") {
      return {
        valid: false,
        error: `Item #${itemIndex + 1} (${rules.configName}): Mandatory field "${fieldLabel}" must be filled before submission.`
      };
    }

    if (fieldKey === "packing") {
      const numVal = Number(val);
      if (isNaN(numVal) || numVal <= 0) {
        return {
          valid: false,
          error: `Item #${itemIndex + 1} (${rules.configName}): "Packing (Pieces per carton/bundle/roll)" must be a numeric value greater than 0.`
        };
      }
    }

    if (fieldKey === "unitCost") {
      const numVal = Number(val);
      if (isNaN(numVal) || numVal <= 0) {
        return {
          valid: false,
          error: `Item #${itemIndex + 1} (${rules.configName}): "Unit Cost" must be a positive numeric value.`
        };
      }
    }

    if (fieldKey === "cartonsPerPallet") {
      const numVal = Number(val);
      if (isNaN(numVal) || numVal <= 0) {
        return {
          valid: false,
          error: `Item #${itemIndex + 1} (${rules.configName}): "${fieldLabel}" must be a numeric value greater than 0.`
        };
      }
    }

    if (fieldKey === "cartonSize" || fieldKey === "palletSize" || fieldKey === "rollDiameter" || fieldKey === "rollLength") {
      if (String(val).trim() === "0") {
        return {
          valid: false,
          error: `Item #${itemIndex + 1} (${rules.configName}): "${fieldLabel}" is mandatory for this configuration and cannot be 0.`
        };
      }
      if (fieldKey === "cartonSize" && !isValidDimensionString(val)) {
        return {
          valid: false,
          error: `Item #${itemIndex + 1} (${rules.configName}): "${fieldLabel}" must contain complete L x W x H numerical dimensions (e.g. 57X51X58 CM).`
        };
      }
    }
  }

  return { valid: true };
}

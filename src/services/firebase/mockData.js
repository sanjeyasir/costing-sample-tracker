// Mock Data Seeds for Offline LocalStorage Fallback

export const DEFAULT_USERS = [
  {
    uid: "mock-mkt-1",
    email: "marketing@costing.com",
    displayName: "Sanjey Marketing",
    role: "marketing",
    costingRole: "costing_marketing",
    sampleRole: "sample_marketing",
    status: "active",
    requirePasswordChange: false,
    password: "marketing",
    phoneNumber: "+94767063788",
    whatsappEnabled: true,
    createdAt: new Date(2026, 7, 1).toISOString(),
  },
  {
    uid: "mock-fin-1",
    email: "finance@costing.com",
    displayName: "Finance Officer",
    role: "finance",
    costingRole: "costing_finance",
    sampleRole: "sample_sampling",
    status: "active",
    requirePasswordChange: false,
    password: "finance",
    phoneNumber: "+94767063788",
    whatsappEnabled: true,
    createdAt: new Date(2026, 7, 1).toISOString(),
  },
  {
    uid: "mock-adm-1",
    email: "admin@gmail.com",
    displayName: "Super Admin",
    role: "admin",
    costingRole: "admin",
    sampleRole: "admin",
    status: "active",
    requirePasswordChange: false,
    password: "admin@123",
    phoneNumber: "+94767063788",
    whatsappEnabled: true,
    createdAt: new Date(2026, 7, 1).toISOString(),
  }
];

export const DEFAULT_CATEGORIES = [
  {
    id: "bedding",
    name: "Bedding",
    createdAt: new Date(2026, 7, 1).toISOString(),
    fields: [
      { key: "description", label: "Description", type: "text", required: true, owner: "marketing" },
      { key: "length", label: "Length (CM)", type: "number", required: true, owner: "marketing" },
      { key: "width", label: "Width (CM)", type: "number", required: true, owner: "marketing" },
      { key: "height", label: "Height (CM)", type: "number", required: true, owner: "marketing" },
      { key: "organic", label: "Organic / Non-Organic", type: "select", options: ["Organic", "Non-Organic"], required: true, owner: "marketing" },
      { key: "ncRcRatio", label: "NC/RC Ratio", type: "text", required: true, owner: "marketing" },
      { key: "density", label: "Density", type: "text", required: true, owner: "marketing" },
      { key: "qtyPerBundle", label: "Quantity per Bundle (Optional)", type: "number", required: false, owner: "marketing" },
      // Finance fields
      { key: "unitCost", label: "Unit Cost", type: "number", required: true, owner: "finance" },
      { key: "qtyPerBundleFinance", label: "Quantity per Bundle (Finance)", type: "number", required: true, owner: "finance" }
    ]
  },
  {
    id: "horticulture",
    name: "Horticulture",
    createdAt: new Date(2026, 7, 1).toISOString(),
    fields: [
      { key: "description", label: "Product Description", type: "text", required: true, owner: "marketing" },
      { key: "specifications", label: "Product Specifications", type: "textarea", required: true, owner: "marketing" },
      { key: "gsm", label: "GSM", type: "number", required: true, owner: "marketing" },
      { key: "latexRatio", label: "Latex Ratio", type: "text", required: true, owner: "marketing" },
      // Finance fields
      { key: "packing", label: "Packing - Pieces per Carton or Bundle", type: "text", required: true, owner: "finance" },
      { key: "cartonSize", label: "Carton Size (CM)", type: "text", required: true, owner: "finance" },
      { key: "palletSize", label: "Pallet Size (Optional)", type: "text", required: false, owner: "finance" },
      { key: "cartonsPerPallet", label: "Cartons per Pallet (Optional)", type: "number", required: false, owner: "finance" },
      { key: "rollDiameter", label: "Roll Diameter (If Applicable)", type: "text", required: false, owner: "finance" },
      { key: "unitCost", label: "Unit Cost", type: "number", required: true, owner: "finance" }
    ]
  }
];

// Helper to construct timestamps relative to current time
const getPastDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const DEFAULT_REQUESTS = [];

export const DEFAULT_NOTIFICATIONS = [];

export const DEFAULT_ROLES = [
  // Costing roles
  { id: "costing_marketing", name: "Marketing Team", module: "costing", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },
  { id: "costing_finance", name: "Finance Team", module: "costing", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },
  { id: "costing_viewer", name: "Costing Viewer", module: "costing", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },

  // Sample roles
  { id: "sample_marketing", name: "Marketing Team", module: "sample", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },
  { id: "sample_sampling", name: "Sampling Team", module: "sample", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },
  { id: "sample_viewer", name: "Sample Viewer", module: "sample", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },

  // Admin
  { id: "admin", name: "System Administrator", module: "global", permissions: ["costing", "sample"], createdAt: new Date(2026, 7, 1).toISOString() }
];

// Initialize localStorage if not set
export const DEFAULT_SAMPLE_REQUESTS = [];

export function initializeLocalStorageState() {
  if (!localStorage.getItem("mock_data_purged_v3")) {
    localStorage.removeItem("users");
    localStorage.removeItem("costRequests");
    localStorage.removeItem("sampleRequests");
    localStorage.removeItem("notifications");
    localStorage.removeItem("systemSettings_costRequestCounter");
    localStorage.setItem("mock_data_purged_v3", "true");
  }

  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify(DEFAULT_USERS));
  }
  if (!localStorage.getItem("userRoles")) {
    localStorage.setItem("userRoles", JSON.stringify(DEFAULT_ROLES));
  }
  if (!localStorage.getItem("productCategories")) {
    localStorage.setItem("productCategories", JSON.stringify(DEFAULT_CATEGORIES));
  }
  if (!localStorage.getItem("costRequests")) {
    localStorage.setItem("costRequests", JSON.stringify(DEFAULT_REQUESTS));
  }
  if (!localStorage.getItem("sampleRequests")) {
    localStorage.setItem("sampleRequests", JSON.stringify(DEFAULT_SAMPLE_REQUESTS));
  }
  if (!localStorage.getItem("notifications")) {
    localStorage.setItem("notifications", JSON.stringify(DEFAULT_NOTIFICATIONS));
  }
  if (!localStorage.getItem("systemSettings_costRequestCounter")) {
    localStorage.setItem("systemSettings_costRequestCounter", JSON.stringify({ current: 1004 }));
  }
}

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

export const DEFAULT_REQUESTS = [
  {
    id: "req-1001",
    costRequestNo: 1001,
    customerName: "Alpha Corp",
    productUnit: "bedding",
    marketingOfficer: {
      uid: "mock-mkt-1",
      name: "Sanjey Marketing",
      email: "marketing@costing.com"
    },
    financeOfficer: null,
    requestDate: getPastDate(1), // 1 day ago
    status: "Submitted",
    completionDate: null,
    overdueAt: getPastDate(-1), // overdue in 1 day from now
    specs: {
      description: "Organic Latex Mattress Core",
      length: 200,
      width: 180,
      height: 15,
      organic: "Organic",
      ncRcRatio: "80/20",
      density: "Medium (75 kg/m3)",
      qtyPerBundle: 1
    },
    costing: {}
  },
  {
    id: "req-1002",
    costRequestNo: 1002,
    customerName: "Green Gardens Ltd",
    productUnit: "horticulture",
    marketingOfficer: {
      uid: "mock-mkt-1",
      name: "Sanjey Marketing",
      email: "marketing@costing.com"
    },
    financeOfficer: {
      uid: "mock-fin-1",
      name: "Finance Officer",
      email: "finance@costing.com"
    },
    requestDate: getPastDate(1.5), // 1.5 days ago
    status: "Received by Finance",
    completionDate: null,
    overdueAt: getPastDate(-0.5), // overdue in 12h
    specs: {
      description: "Coir Weed Mats",
      specifications: "Biodegradable organic mulch matting",
      gsm: 450,
      latexRatio: "15%"
    },
    costing: {}
  },
  {
    id: "req-1003",
    costRequestNo: 1003,
    customerName: "Sleepwell Ltd",
    productUnit: "bedding",
    marketingOfficer: {
      uid: "mock-mkt-1",
      name: "Sanjey Marketing",
      email: "marketing@costing.com"
    },
    financeOfficer: {
      uid: "mock-fin-1",
      name: "Finance Officer",
      email: "finance@costing.com"
    },
    requestDate: getPastDate(4), // 4 days ago
    status: "Costing Completed",
    completionDate: getPastDate(1), // completed 1 day ago
    overdueAt: getPastDate(2),
    specs: {
      description: "Standard PU Foam Topper",
      length: 190,
      width: 90,
      height: 5,
      organic: "Non-Organic",
      ncRcRatio: "100/0",
      density: "Soft (30 kg/m3)",
      qtyPerBundle: 5
    },
    costing: {
      unitCost: 18.50,
      qtyPerBundleFinance: 5
    }
  },
  {
    id: "req-1004",
    costRequestNo: 1004,
    customerName: "Global Horti Group",
    productUnit: "horticulture",
    marketingOfficer: {
      uid: "mock-mkt-1",
      name: "Sanjey Marketing",
      email: "marketing@costing.com"
    },
    financeOfficer: null,
    requestDate: getPastDate(3), // 3 days ago (limit was 2 days, so it is overdue)
    status: "Overdue",
    completionDate: null,
    overdueAt: getPastDate(1), // went overdue 1 day ago
    specs: {
      description: "Erosion Control Logs",
      specifications: "High density coir log for embankment protection",
      gsm: 1200,
      latexRatio: "N/A"
    },
    costing: {}
  }
];

export const DEFAULT_NOTIFICATIONS = [
  {
    id: "not-1",
    userId: null,
    role: "finance",
    costRequestId: "req-1001",
    costRequestNo: 1001,
    message: "New costing request #1001 is awaiting Finance.",
    read: false,
    readBy: [],
    createdAt: getPastDate(1)
  },
  {
    id: "not-2",
    userId: "mock-mkt-1",
    role: null,
    costRequestId: "req-1003",
    costRequestNo: 1003,
    message: "Costing request #1003 has been completed.",
    read: false,
    readBy: [],
    createdAt: getPastDate(1)
  },
  {
    id: "not-3",
    userId: null,
    role: "finance",
    costRequestId: "req-1004",
    costRequestNo: 1004,
    message: "Costing request #1004 is overdue.",
    read: false,
    readBy: [],
    createdAt: getPastDate(1)
  }
];

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
export const DEFAULT_SAMPLE_REQUESTS = [
  {
    id: "sreq-101",
    sampleRequestNo: "2627-001",
    productUnit: "Horticulture",
    requestedBy: "Sanjey Marketing",
    requestDate: "2026-08-15",
    requiredDate: "2026-08-20",
    customerName: "Alumex Ltd",
    requestType: "Normal",
    product: "RC Sheet",
    description: "Length 16\", Width 16\", Height 1\"",
    quantity: 10,
    sampleType: "New Development",
    specialNotes: "Standard packing required.",
    attachments: [],
    status: "In Progress",
    actionRequired: "Sample Development",
    dueDate: "2026-08-20",
    plannedDeliveryDate: "2026-08-20",
    createdAt: "2026-08-15T10:00:00.000Z",
    history: [
      { date: "2026-08-15T10:00:00.000Z", label: "Request Created", user: "Sanjey" },
      { date: "2026-08-15T10:00:05.000Z", label: "Request Number Generated: 2627-001", user: "System" },
      { date: "2026-08-15T10:05:00.000Z", label: "Request Accepted. Planned Delivery: 2026-08-20", user: "Sample Team" }
    ]
  },
  {
    id: "sreq-102",
    sampleRequestNo: "2627-002",
    productUnit: "Bedding",
    requestedBy: "Sanjey Marketing",
    requestDate: "2026-08-17",
    requiredDate: "2026-08-22",
    customerName: "Comfort Mat",
    requestType: "Urgent",
    product: "Premium Core",
    description: "Density 75, Length 190cm, Width 90cm",
    quantity: 2,
    sampleType: "Pre Production",
    specialNotes: "Top urgency.",
    attachments: [],
    status: "Submitted",
    actionRequired: "Sample Development",
    dueDate: "2026-08-22",
    createdAt: "2026-08-17T11:00:00.000Z",
    history: [
      { date: "2026-08-17T11:00:00.000Z", label: "Request Created", user: "Sanjey" },
      { date: "2026-08-17T11:00:02.000Z", label: "Request Number Generated: 2627-002", user: "System" }
    ]
  }
];

export function initializeLocalStorageState() {
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

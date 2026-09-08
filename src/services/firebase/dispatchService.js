import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { db, isMockMode } from "./config";
import { getFinancialYearStr } from "./sampleService";
import { DEFAULT_DISPATCH_DATA } from "../../utils/dispatchCalculations";

const COLLECTION_NAME = "dispatchTrackers";
const TEMPLATE_DOC_ID = "dispatch_default_template";

/**
 * Generates unique formatted sequential dispatch number (e.g., DSP-2627-0001)
 */
export async function generateDispatchNo() {
  const fyStr = getFinancialYearStr(new Date());
  const prefix = `DSP-${fyStr}-`;

  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    const matching = list.filter(item => item.dispatchNo && item.dispatchNo.startsWith(prefix));
    const nextSeq = matching.length + 1;
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const existing = snapshot.docs
      .map(d => d.data()?.dispatchNo)
      .filter(no => no && no.startsWith(prefix));
    
    let maxSeq = 0;
    existing.forEach(no => {
      const parts = no.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  } catch (err) {
    console.warn("Could not query sequential dispatch number, falling back:", err);
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Fetch all dispatch records with optional client-side filtering
 */
export async function getDispatchEntries(filters = {}) {
  if (isMockMode) {
    let list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    
    // Default initial mock data if empty
    if (list.length === 0) {
      const initialEntry = {
        id: "dsp-demo-1",
        ...DEFAULT_DISPATCH_DATA,
        dispatchNo: "DSP-2627-0001",
        status: "Ready for Dispatch",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "Manura Mohotti",
        createdByEmail: "Manura.Mohotti@hayleysfibre.com"
      };
      list = [initialEntry];
      localStorage.setItem(COLLECTION_NAME, JSON.stringify(list));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(d => 
        (d.dispatchNo || "").toLowerCase().includes(q) ||
        (d.receiver?.name || "").toLowerCase().includes(q) ||
        (d.receiver?.country || "").toLowerCase().includes(q) ||
        (d.waybillNo || "").toLowerCase().includes(q)
      );
    }
    if (filters.status) {
      list = list.filter(d => d.status === filters.status);
    }
    if (filters.country) {
      list = list.filter(d => (d.receiver?.country || "").toLowerCase() === filters.country.toLowerCase());
    }

    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }

  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Apply filters
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(d => 
        (d.dispatchNo || "").toLowerCase().includes(q) ||
        (d.receiver?.name || "").toLowerCase().includes(q) ||
        (d.receiver?.country || "").toLowerCase().includes(q) ||
        (d.waybillNo || "").toLowerCase().includes(q)
      );
    }
    if (filters.status) {
      list = list.filter(d => d.status === filters.status);
    }
    if (filters.country) {
      list = list.filter(d => (d.receiver?.country || "").toLowerCase() === filters.country.toLowerCase());
    }

    return list;
  } catch (err) {
    console.error("Error fetching dispatch entries:", err);
    throw err;
  }
}

/**
 * Fetch a single dispatch record by ID
 */
export async function getDispatchEntryById(id) {
  if (!id) return null;

  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    return list.find(d => d.id === id) || null;
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error(`Error fetching dispatch entry ${id}:`, err);
    throw err;
  }
}

/**
 * Create a new unique dispatch entry in Firestore
 */
export async function createDispatchEntry(entryData, currentUser = null) {
  const dispatchNo = entryData.dispatchNo || (await generateDispatchNo());
  const now = new Date().toISOString();

  const payload = {
    ...DEFAULT_DISPATCH_DATA,
    ...entryData,
    dispatchNo,
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser?.displayName || currentUser?.name || entryData.sender?.name || "System User",
    createdByEmail: currentUser?.email || entryData.sender?.email || "",
    createdByUid: currentUser?.uid || ""
  };

  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    const id = "dsp-" + Date.now();
    const newRecord = { id, ...payload };
    list.unshift(newRecord);
    localStorage.setItem(COLLECTION_NAME, JSON.stringify(list));
    return newRecord;
  }

  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const newRecord = { id: docRef.id, ...payload };
    await setDoc(docRef, payload);
    return newRecord;
  } catch (err) {
    console.error("Error creating dispatch entry:", err);
    throw err;
  }
}

/**
 * Update an existing dispatch entry
 */
export async function updateDispatchEntry(id, updatedData, currentUser = null) {
  if (!id) throw new Error("Missing entry ID for update.");

  const now = new Date().toISOString();
  const payload = {
    ...updatedData,
    updatedAt: now,
    updatedBy: currentUser?.displayName || currentUser?.name || "System User",
    updatedByEmail: currentUser?.email || ""
  };

  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error("Dispatch entry not found.");
    list[idx] = { ...list[idx], ...payload };
    localStorage.setItem(COLLECTION_NAME, JSON.stringify(list));
    return list[idx];
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, payload);
    return { id, ...payload };
  } catch (err) {
    console.error(`Error updating dispatch entry ${id}:`, err);
    throw err;
  }
}

/**
 * Delete a dispatch entry
 */
export async function deleteDispatchEntry(id) {
  if (!id) throw new Error("Missing entry ID for delete.");

  if (isMockMode) {
    let list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    list = list.filter(d => d.id !== id);
    localStorage.setItem(COLLECTION_NAME, JSON.stringify(list));
    return true;
  }

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Error deleting dispatch entry ${id}:`, err);
    throw err;
  }
}

/**
 * Save custom standard dispatch template configuration
 */
export async function saveTemplateConfig(templateData, currentUser = null) {
  const payload = {
    ...templateData,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.email || "Admin"
  };

  if (isMockMode) {
    localStorage.setItem("dispatch_template_config", JSON.stringify(payload));
    return payload;
  }

  try {
    const docRef = doc(db, "systemSettings", TEMPLATE_DOC_ID);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.error("Error saving dispatch template config:", err);
    throw err;
  }
}

/**
 * Get custom standard dispatch template configuration
 */
export async function getTemplateConfig() {
  if (isMockMode) {
    const saved = localStorage.getItem("dispatch_template_config");
    return saved ? JSON.parse(saved) : DEFAULT_DISPATCH_DATA;
  }

  try {
    const docRef = doc(db, "systemSettings", TEMPLATE_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return DEFAULT_DISPATCH_DATA;
  } catch (err) {
    console.warn("Could not load template config from Firestore, using default:", err);
    return DEFAULT_DISPATCH_DATA;
  }
}

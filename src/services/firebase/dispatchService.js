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
 * Fetch a dispatch record linked to a specific sample request
 */
export async function getDispatchBySampleRequestId(sampleRequestId) {
  if (!sampleRequestId) return null;

  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem(COLLECTION_NAME) || "[]");
    return list.find(d => d.sampleRequestId === sampleRequestId || d.id === sampleRequestId) || null;
  }

  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    const found = snapshot.docs.find(d => d.data()?.sampleRequestId === sampleRequestId || d.id === sampleRequestId);
    if (found) {
      return { id: found.id, ...found.data() };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching dispatch for sample request ${sampleRequestId}:`, err);
    return null;
  }
}

/**
 * Sync dispatch metadata back to sample request
 */
async function syncDispatchToSampleRequest(sampleRequestId, dispatchId, dispatchNo, dispatchStatus) {
  if (!sampleRequestId) return;
  try {
    if (isMockMode) {
      const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
      const idx = requests.findIndex(r => r.id === sampleRequestId);
      if (idx !== -1) {
        requests[idx].dispatchId = dispatchId;
        requests[idx].dispatchNo = dispatchNo;
        requests[idx].dispatchStatus = dispatchStatus;
        localStorage.setItem("sampleRequests", JSON.stringify(requests));
        window.dispatchEvent(new Event("storage"));
      }
    } else {
      const docRef = doc(db, "sampleRequests", sampleRequestId);
      await updateDoc(docRef, {
        dispatchId,
        dispatchNo,
        dispatchStatus
      });
    }
  } catch (err) {
    console.warn("Could not sync dispatch to sample request:", err);
  }
}

/**
 * Build default dispatch data populated directly from a Sample Request
 */
export function buildDispatchFromSampleRequest(sampleRequest, senderProfile = null, templateConfig = null) {
  if (!sampleRequest) return DEFAULT_DISPATCH_DATA;

  const baseTemplate = templateConfig || DEFAULT_DISPATCH_DATA;
  const sender = senderProfile || baseTemplate.sender;

  const sampleItems = sampleRequest.items && sampleRequest.items.length > 0 
    ? sampleRequest.items 
    : [{
        product: sampleRequest.product || "",
        quantity: sampleRequest.quantity || 1,
        description: sampleRequest.description || "",
        sampleType: sampleRequest.sampleType || "New Development",
        specialNotes: sampleRequest.specialNotes || ""
      }];

  const dispatchItems = sampleItems.map((item, idx) => ({
    id: `item-${Date.now()}-${idx + 1}`,
    description: item.description 
      ? (item.product ? `${item.product} - ${item.description}` : item.description)
      : (item.product || `Sample Item ${idx + 1}`),
    commonName: item.product || "Coir Product",
    botanicalName: "Cocos nucifera",
    qty: Number(item.quantity) || 1,
    unit: "pcs",
    weightKg: 1,
    unitPrice: 0.1,
    boxNo: `Box ${Math.floor(idx / 3) + 1}`
  }));

  return {
    ...baseTemplate,
    sampleRequestId: sampleRequest.id,
    sampleRequestNo: sampleRequest.sampleRequestNo,
    shippingDate: new Date().toISOString().split("T")[0],
    reasonForExport: `Samples for customer evaluation as per Sample Request #${sampleRequest.sampleRequestNo || ""}. Free of charge.`,
    sender: {
      ...baseTemplate.sender,
      ...sender,
      address: sender?.address || sender?.companyAddress || baseTemplate.sender?.address || "",
      companyAddress: sender?.companyAddress || sender?.address || baseTemplate.sender?.companyAddress || "",
      signatureText: sender?.signatureText || sender?.name || baseTemplate.sender?.signatureText || "Authorized Signatory",
      signatureBase64: sender?.signatureBase64 || sender?.signatureUrl || baseTemplate.sender?.signatureBase64 || "",
      signatureUrl: sender?.signatureUrl || sender?.signatureBase64 || baseTemplate.sender?.signatureUrl || ""
    },
    receiver: {
      name: sampleRequest.customerName || "",
      address: sampleRequest.deliveryAddress || sampleRequest.customerAddress || "Address:\nAs per customer requisition",
      contact: sampleRequest.customerContact || "",
      email: sampleRequest.customerEmail || "",
      country: sampleRequest.destinationCountry || sampleRequest.country || "International",
      currency: "USD",
      portOfEntry: ""
    },
    items: dispatchItems
  };
}

/**
 * Create or update dispatch record for a sample request
 */
export async function createOrUpdateDispatchForSampleRequest(sampleRequestId, dispatchData, currentUser = null) {
  let existing = await getDispatchBySampleRequestId(sampleRequestId);
  let savedRecord;

  if (existing) {
    savedRecord = await updateDispatchEntry(existing.id, {
      ...dispatchData,
      sampleRequestId,
      sampleRequestNo: dispatchData.sampleRequestNo || existing.sampleRequestNo
    }, currentUser);
  } else {
    savedRecord = await createDispatchEntry({
      ...dispatchData,
      sampleRequestId
    }, currentUser);
  }

  await syncDispatchToSampleRequest(sampleRequestId, savedRecord.id, savedRecord.dispatchNo, savedRecord.status);
  return savedRecord;
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


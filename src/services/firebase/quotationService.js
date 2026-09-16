import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { db, isMockMode } from "./config";
import { DEFAULT_FINANCIAL_PARAMS, DEFAULT_SAVED_PRODUCTS } from "../../utils/quotationCalculations";

/**
 * Fetch or initialize a quotation for a completed costing request
 */
export async function getQuotationByRequestId(requestId) {
  if (isMockMode) {
    const quotations = JSON.parse(localStorage.getItem("costQuotations") || "{}");
    return quotations[requestId] || null;
  } else {
    const docRef = doc(db, "quotations", requestId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...data,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null
      };
    }
    return null;
  }
}

/**
 * Save / Update a quotation and track any parameter changes in audit log
 */
export async function saveQuotation(requestId, quotationData, currentUser) {
  const nowStr = new Date().toISOString();
  const payload = {
    ...quotationData,
    requestId,
    updatedAt: isMockMode ? nowStr : Timestamp.now(),
    updatedBy: {
      uid: currentUser?.uid || "mock-user",
      name: currentUser?.displayName || currentUser?.email?.split("@")[0] || "User",
      email: currentUser?.email || "user@example.com"
    }
  };

  if (isMockMode) {
    const quotations = JSON.parse(localStorage.getItem("costQuotations") || "{}");
    quotations[requestId] = {
      ...payload,
      id: requestId,
      createdAt: quotations[requestId]?.createdAt || nowStr
    };
    localStorage.setItem("costQuotations", JSON.stringify(quotations));
    return quotations[requestId];
  } else {
    const docRef = doc(db, "quotations", requestId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      payload.createdAt = Timestamp.now();
    }
    await setDoc(docRef, payload, { merge: true });
    return getQuotationByRequestId(requestId);
  }
}

/**
 * Record a financial parameter change in the audit log
 */
export async function logParameterChange(logEntry) {
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    ...logEntry,
    timestamp: isMockMode ? new Date().toISOString() : Timestamp.now()
  };

  if (isMockMode) {
    const logs = JSON.parse(localStorage.getItem("paramAuditLogs") || "[]");
    logs.unshift(newLog);
    localStorage.setItem("paramAuditLogs", JSON.stringify(logs));
    return newLog;
  } else {
    const docRef = doc(collection(db, "quotationLogs"));
    await setDoc(docRef, newLog);
    return { id: docRef.id, ...newLog };
  }
}

/**
 * Fetch all financial parameter change logs for a request or globally
 */
export async function getParameterLogs(requestId = null) {
  if (isMockMode) {
    const logs = JSON.parse(localStorage.getItem("paramAuditLogs") || "[]");
    if (requestId) {
      return logs.filter(l => l.requestId === requestId || !l.requestId);
    }
    return logs;
  } else {
    try {
      const q = query(collection(db, "quotationLogs"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || null
        };
      });
      if (requestId) {
        return list.filter(l => l.requestId === requestId || !l.requestId);
      }
      return list;
    } catch (e) {
      console.warn("Failed to fetch firestore logs, fallback to empty array:", e);
      return [];
    }
  }
}

/**
 * Fetch Saved Product Presets (Merged with built-in library)
 */
export async function getSavedProducts(category = null) {
  let customPresets = [];
  if (isMockMode) {
    customPresets = JSON.parse(localStorage.getItem("savedProductPresets") || "[]");
  } else {
    try {
      const snap = await getDocs(collection(db, "savedProductPresets"));
      customPresets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Failed to fetch product presets:", e);
    }
  }

  const all = [...DEFAULT_SAVED_PRODUCTS, ...customPresets];
  if (category) {
    return all.filter(p => p.category?.toLowerCase() === category.toLowerCase());
  }
  return all;
}

/**
 * Save a new product preset to the library
 */
export async function saveProductPreset(product) {
  const newProduct = {
    ...product,
    id: product.id || `preset-${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem("savedProductPresets") || "[]");
    list.unshift(newProduct);
    localStorage.setItem("savedProductPresets", JSON.stringify(list));
    return newProduct;
  } else {
    const docRef = doc(collection(db, "savedProductPresets"));
    await setDoc(docRef, { ...newProduct, createdAt: Timestamp.now() });
    return { id: docRef.id, ...newProduct };
  }
}

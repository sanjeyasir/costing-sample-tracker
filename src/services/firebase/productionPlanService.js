import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  query, 
  orderBy, 
  Timestamp 
} from "firebase/firestore";
import { db, isMockMode } from "./config";
import { 
  productionForecastBaseline, 
  prospectPipelineBaseline, 
  calculateRowMetrics 
} from "../../utils/productionPlanData";

const FORECAST_COLLECTION = "productionForecasts";
const PROSPECT_COLLECTION = "prospectPipelines";

const STORAGE_KEY_FORECASTS = "production_forecast_data_v1";
const STORAGE_KEY_PROSPECTS = "production_prospect_data_v1";

/**
 * Initialize storage with baseline data if empty
 */
function getLocalForecasts() {
  const raw = localStorage.getItem(STORAGE_KEY_FORECASTS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY_FORECASTS, JSON.stringify(productionForecastBaseline));
    return [...productionForecastBaseline];
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error parsing local forecasts:", e);
    return [...productionForecastBaseline];
  }
}

function setLocalForecasts(list) {
  localStorage.setItem(STORAGE_KEY_FORECASTS, JSON.stringify(list));
}

function getLocalProspects() {
  const raw = localStorage.getItem(STORAGE_KEY_PROSPECTS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY_PROSPECTS, JSON.stringify(prospectPipelineBaseline));
    return [...prospectPipelineBaseline];
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error parsing local prospects:", e);
    return [...prospectPipelineBaseline];
  }
}

function setLocalProspects(list) {
  localStorage.setItem(STORAGE_KEY_PROSPECTS, JSON.stringify(list));
}

/**
 * Fetch all Production Forecasts with filtering options
 */
export async function getProductionForecasts(filters = {}) {
  let list = [];

  if (isMockMode) {
    list = getLocalForecasts();
  } else {
    try {
      const q = query(collection(db, FORECAST_COLLECTION));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // If Firestore collection is empty, load baseline into cache and return
        list = getLocalForecasts();
      } else {
        list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sync local cache
        setLocalForecasts(list);
      }
    } catch (err) {
      console.warn("Firestore query failed for forecasts, falling back to local storage:", err);
      list = getLocalForecasts();
    }
  }

  // Ensure all rows have freshly calculated metrics & proper structure
  let processed = list.map(r => calculateRowMetrics(r));

  // Apply filters
  if (filters.months && Array.isArray(filters.months) && filters.months.length > 0) {
    processed = processed.filter(r => 
      filters.months.includes(r.monthKey) || 
      filters.months.includes(r.month) ||
      filters.months.includes(r.monthName)
    );
  } else if (filters.monthKey) {
    processed = processed.filter(r => r.monthKey === filters.monthKey || r.month === filters.monthKey);
  }

  if (filters.salesOfficer && filters.salesOfficer !== "all") {
    processed = processed.filter(r => r.salesOfficer === filters.salesOfficer);
  }

  if (filters.department && filters.department !== "all") {
    processed = processed.filter(r => r.department === filters.department);
  }

  if (filters.status && filters.status !== "all") {
    processed = processed.filter(r => r.status === filters.status);
  }

  if (filters.searchText && filters.searchText.trim() !== "") {
    const q = filters.searchText.toLowerCase().trim();
    processed = processed.filter(r => 
      (r.buyer && r.buyer.toLowerCase().includes(q)) ||
      (r.salesOfficer && r.salesOfficer.toLowerCase().includes(q)) ||
      (r.department && r.department.toLowerCase().includes(q)) ||
      (r.month && r.month.toLowerCase().includes(q)) ||
      (r.monthName && r.monthName.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  }

  return processed;
}

/**
 * Save single forecast entry (create or update)
 */
export async function saveProductionForecast(entry) {
  const calculated = calculateRowMetrics(entry);
  const id = calculated.id || `fc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const itemToSave = {
    ...calculated,
    id,
    updatedAt: new Date().toISOString()
  };

  // Update local cache
  const localList = getLocalForecasts();
  const existingIdx = localList.findIndex(item => item.id === id);
  if (existingIdx >= 0) {
    localList[existingIdx] = itemToSave;
  } else {
    localList.unshift(itemToSave);
  }
  setLocalForecasts(localList);

  if (!isMockMode) {
    try {
      await setDoc(doc(db, FORECAST_COLLECTION, id), itemToSave, { merge: true });
    } catch (err) {
      console.warn("Could not save to Firestore, local state updated:", err);
    }
  }

  return itemToSave;
}

/**
 * Bulk save / batch update multiple forecast entries (ideal for Handsontable spreadsheet)
 */
export async function batchSaveProductionForecasts(entries = []) {
  if (!entries || entries.length === 0) return [];

  const localList = getLocalForecasts();
  const updatedRecords = [];

  entries.forEach(entry => {
    const calculated = calculateRowMetrics(entry);
    const id = calculated.id || `fc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const fullItem = {
      ...calculated,
      id,
      updatedAt: new Date().toISOString()
    };

    updatedRecords.push(fullItem);
    const existingIdx = localList.findIndex(item => item.id === id);
    if (existingIdx >= 0) {
      localList[existingIdx] = fullItem;
    } else {
      localList.push(fullItem);
    }
  });

  setLocalForecasts(localList);

  if (!isMockMode) {
    try {
      // Chunk batches by 450 (Firestore limit is 500)
      const chunkSize = 400;
      for (let i = 0; i < updatedRecords.length; i += chunkSize) {
        const chunk = updatedRecords.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(db, FORECAST_COLLECTION, item.id);
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn("Firestore batch commit warning, local data saved:", err);
    }
  }

  return updatedRecords;
}

/**
 * Delete a forecast entry
 */
export async function deleteProductionForecast(id) {
  const localList = getLocalForecasts();
  const filtered = localList.filter(item => item.id !== id);
  setLocalForecasts(filtered);

  if (!isMockMode) {
    try {
      await deleteDoc(doc(db, FORECAST_COLLECTION, id));
    } catch (err) {
      console.warn("Could not delete from Firestore:", err);
    }
  }

  return true;
}

/**
 * Reset all forecasts back to the baseline extracted from ProductionPlan.xlsx
 */
export async function resetToExcelBaseline() {
  localStorage.setItem(STORAGE_KEY_FORECASTS, JSON.stringify(productionForecastBaseline));
  localStorage.setItem(STORAGE_KEY_PROSPECTS, JSON.stringify(prospectPipelineBaseline));

  if (!isMockMode) {
    try {
      // Batch write baseline
      const chunkSize = 400;
      for (let i = 0; i < productionForecastBaseline.length; i += chunkSize) {
        const chunk = productionForecastBaseline.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(db, FORECAST_COLLECTION, item.id);
          batch.set(docRef, item);
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn("Firestore baseline reset warning:", err);
    }
  }

  return true;
}

/**
 * Fetch Prospect Pipeline records (Sheet 1)
 */
export async function getProspectPipelines(filters = {}) {
  let list = [];

  if (isMockMode) {
    list = getLocalProspects();
  } else {
    try {
      const q = query(collection(db, PROSPECT_COLLECTION));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        list = getLocalProspects();
      } else {
        list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLocalProspects(list);
      }
    } catch (err) {
      console.warn("Firestore prospect fetch failed, using local storage:", err);
      list = getLocalProspects();
    }
  }

  let result = [...list];

  if (filters.salesOfficer && filters.salesOfficer !== "all") {
    result = result.filter(r => r.salesOfficer === filters.salesOfficer);
  }

  if (filters.priority && filters.priority !== "all") {
    result = result.filter(r => r.priority === filters.priority);
  }

  if (filters.timeline && filters.timeline !== "all") {
    result = result.filter(r => r.expectedClosingTimeline === filters.timeline);
  }

  if (filters.searchText && filters.searchText.trim() !== "") {
    const q = filters.searchText.toLowerCase().trim();
    result = result.filter(r => 
      (r.companyName && r.companyName.toLowerCase().includes(q)) ||
      (r.country && r.country.toLowerCase().includes(q)) ||
      (r.status && r.status.toLowerCase().includes(q)) ||
      (r.salesOfficer && r.salesOfficer.toLowerCase().includes(q))
    );
  }

  return result;
}

/**
 * Save / Update a prospect
 */
export async function saveProspect(entry) {
  const id = entry.id || `pr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const itemToSave = {
    ...entry,
    id,
    updatedAt: new Date().toISOString()
  };

  const list = getLocalProspects();
  const idx = list.findIndex(i => i.id === id);
  if (idx >= 0) {
    list[idx] = itemToSave;
  } else {
    list.unshift(itemToSave);
  }
  setLocalProspects(list);

  if (!isMockMode) {
    try {
      await setDoc(doc(db, PROSPECT_COLLECTION, id), itemToSave, { merge: true });
    } catch (err) {
      console.warn("Firestore prospect save warning:", err);
    }
  }

  return itemToSave;
}

/**
 * Convert a prospect into a Forecast entry in a specific month
 */
export async function convertProspectToForecast(prospect, targetMonthObj) {
  const forecastEntry = {
    year: targetMonthObj.year || 2026,
    month: targetMonthObj.code || targetMonthObj.month || "SEP",
    monthKey: targetMonthObj.monthKey || "2026-09",
    monthName: targetMonthObj.name || targetMonthObj.monthName || "September 2026",
    salesOfficer: prospect.salesOfficer || "MM",
    department: prospect.salesOfficer === "PD" ? "Bedding" : "Horticulture",
    buyer: prospect.companyName,
    budgetTeu: prospect.estTeus || 0,
    budgetTurnover: (prospect.estTurnover || 0) * 1000000, // Est Turnover is in millions in sheet
    budgetContribution: (prospect.estTurnover || 0) * 1000000 * 0.4,
    budgetMargin: 0.4,
    actualTeu: 0,
    actualTurnover: 0,
    actualContribution: 0,
    actualMargin: 0,
    notes: `Converted from prospect pipeline. Priority: ${prospect.priority}. ${prospect.status || ""}`
  };

  return await saveProductionForecast(forecastEntry);
}

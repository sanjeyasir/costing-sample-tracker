import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  runTransaction,
  Timestamp
} from "firebase/firestore";
import { db, isMockMode } from "./config";
import { initializeLocalStorageState } from "./mockData";
import { createNotification, sendEmailNotification } from "./notificationService";

if (isMockMode) {
  initializeLocalStorageState();
}

function getFinancialYearStr(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  let startYear, endYear;
  if (month >= 3) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }
  return startYear.toString().slice(-2) + endYear.toString().slice(-2);
}

/**
 * Fetch all product categories
 */
export async function getProductCategories() {
  if (isMockMode) {
    return JSON.parse(localStorage.getItem("productCategories") || "[]");
  } else {
    const q = query(collection(db, "productCategories"), orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

/**
 * Create a new product category (Admin only)
 */
export async function createProductCategory(category) {
  const id = category.name.toLowerCase().replace(/\s+/g, "-");

  if (isMockMode) {
    const categories = JSON.parse(localStorage.getItem("productCategories") || "[]");
    const exists = categories.some(c => c.id === id);
    if (exists) {
      throw new Error("Category with this name already exists.");
    }
    const newCat = {
      id,
      name: category.name.trim(),
      fields: category.fields || [],
      createdAt: new Date().toISOString()
    };
    categories.push(newCat);
    localStorage.setItem("productCategories", JSON.stringify(categories));
    return newCat;
  } else {
    const docRef = doc(db, "productCategories", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      throw new Error("Category with this name already exists.");
    }
    const newCat = {
      name: category.name.trim(),
      fields: category.fields || [],
      createdAt: Timestamp.now()
    };
    await setDoc(docRef, newCat);
    return { id, ...newCat };
  }
}

/**
 * Delete a product category (Admin only)
 */
export async function deleteProductCategory(categoryId) {
  if (isMockMode) {
    let categories = JSON.parse(localStorage.getItem("productCategories") || "[]");
    categories = categories.filter(c => c.id !== categoryId);
    localStorage.setItem("productCategories", JSON.stringify(categories));
  } else {
    const docRef = doc(db, "productCategories", categoryId);
    await deleteDoc(docRef);
  }
}

/**
 * Update a product category (Admin only)
 */
export async function updateProductCategory(categoryId, updatedData) {
  if (isMockMode) {
    const categories = JSON.parse(localStorage.getItem("productCategories") || "[]");
    const idx = categories.findIndex(c => c.id === categoryId);
    if (idx !== -1) {
      categories[idx] = {
        ...categories[idx],
        name: updatedData.name.trim(),
        fields: updatedData.fields || []
      };
      localStorage.setItem("productCategories", JSON.stringify(categories));
      return categories[idx];
    }
    throw new Error("Category not found.");
  } else {
    const docRef = doc(db, "productCategories", categoryId);
    const updatePayload = {
      name: updatedData.name.trim(),
      fields: updatedData.fields || []
    };
    await updateDoc(docRef, updatePayload);
    return { id: categoryId, ...updatePayload };
  }
}

/**
 * Create a costing request
 */
export async function createCostingRequest(requestData, currentUser) {
  const { customerName, productUnit, specs } = requestData;
  const fyStr = getFinancialYearStr(new Date());

  if (isMockMode) {
    // Simulate atomic transaction in localStorage
    const counterKey = `costRequestCounter_${fyStr}`;
    const counterObj = JSON.parse(localStorage.getItem(counterKey) || '{"current":0}');
    const nextCounter = (counterObj.current || 0) + 1;
    
    // Increment counter
    localStorage.setItem(counterKey, JSON.stringify({ current: nextCounter }));
    
    const nowStr = new Date().toISOString();
    const overdueStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    
    const categories = JSON.parse(localStorage.getItem("productCategories") || "[]");
    const activeCategory = categories.find(c => c.id === productUnit);
    const categoryFields = activeCategory ? (activeCategory.fields || []) : [];
    const categoryFieldsJson = JSON.stringify(categoryFields);

    const seqNum = String(nextCounter).padStart(4, "0");
    const unitCode = productUnit && productUnit.toString().toLowerCase().startsWith("hort") ? "H" : "B";
    const costRequestNo = `${fyStr}-C-${unitCode}-${seqNum}`;

    const newRequest = {
      id: `req-${Date.now()}`,
      costRequestNo,
      customerName,
      productUnit,
      categoryFieldsJson,
      marketingOfficer: {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email.split("@")[0],
        email: currentUser.email
      },
      financeOfficer: null,
      requestDate: nowStr,
      status: "Submitted",
      completionDate: null,
      specs,
      costing: {},
      overdueAt: overdueStr
    };

    // Save request
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    requests.push(newRequest);
    localStorage.setItem("costRequests", JSON.stringify(requests));

    // Save notification
    await createNotification({
      userId: null,
      role: "finance",
      costRequestId: newRequest.id,
      costRequestNo: costRequestNo,
      message: `New costing request #${costRequestNo} is awaiting Finance.`
    });

    return {
      success: true,
      data: {
        id: newRequest.id,
        costRequestNo: costRequestNo
      }
    };
  } else {
    const fyStr = getFinancialYearStr(new Date());
    const counterDocId = `costRequestCounter_${fyStr}`;
    const counterRef = doc(db, "systemSettings", counterDocId);
    const requestRef = doc(collection(db, "costRequests"));
    const notificationRef = doc(collection(db, "notifications"));

    try {
      const result = await runTransaction(db, async (transaction) => {
        // 1. Execute all reads first
        const counterDoc = await transaction.get(counterRef);
        const categoryRef = doc(db, "productCategories", productUnit);
        const categoryDoc = await transaction.get(categoryRef);

        // 2. Perform calculations
        let currentCounter = 0; // Starting counter default
        if (counterDoc.exists()) {
          currentCounter = counterDoc.data().current || 0;
        }

        const nextCounter = currentCounter + 1;
        const categoryFields = categoryDoc.exists() ? (categoryDoc.data().fields || []) : [];
        const categoryFieldsJson = JSON.stringify(categoryFields);

        // 3. Execute all writes
        transaction.set(counterRef, { current: nextCounter }, { merge: true });

        const now = Timestamp.now();
        const overdueAt = Timestamp.fromMillis(
          now.toMillis() + 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds
        );

        const seqNum = String(nextCounter).padStart(4, "0");
        const unitCode = productUnit && productUnit.toString().toLowerCase().startsWith("hort") ? "H" : "B";
        const costRequestNo = `${fyStr}-C-${unitCode}-${seqNum}`;

        const newRequest = {
          costRequestNo,
          customerName,
          productUnit,
          categoryFieldsJson,
          marketingOfficer: {
            uid: currentUser.uid,
            name: currentUser.displayName || currentUser.email.split("@")[0],
            email: currentUser.email
          },
          financeOfficer: null,
          requestDate: now,
          status: "Submitted",
          completionDate: null,
          specs,
          costing: {},
          overdueAt
        };

        transaction.set(requestRef, newRequest);

        const notification = {
          userId: null,
          role: "finance",
          costRequestId: requestRef.id,
          costRequestNo: costRequestNo,
          message: `New costing request #${costRequestNo} is awaiting Finance.`,
          read: false,
          readBy: [],
          createdAt: now
        };
        transaction.set(notificationRef, notification);

        return {
          id: requestRef.id,
          costRequestNo: costRequestNo
        };
      });

      // Dispatch email notification after successful transaction
      sendEmailNotification({
        userId: null,
        role: "finance",
        costRequestId: result.id,
        costRequestNo: result.costRequestNo,
        message: `New costing request #${result.costRequestNo} is awaiting Finance.`
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error("Client-side Transaction failed: ", error);
      throw new Error(`Failed to create costing request: ${error.message}`);
    }
  }
}

/**
 * Fetch a single request by ID
 */
export async function getCostingRequestById(id) {
  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const req = requests.find(r => r.id === id);
    if (!req) throw new Error("Cost Request not found.");
    return req;
  } else {
    const docRef = doc(db, "costRequests", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Cost Request not found.");
    
    const data = docSnap.data();
    // Convert Firestore timestamps to ISO Strings for UI compatibility
    return {
      id: docSnap.id,
      ...data,
      requestDate: data.requestDate?.toDate().toISOString() || null,
      completionDate: data.completionDate?.toDate().toISOString() || null,
      overdueAt: data.overdueAt?.toDate().toISOString() || null
    };
  }
}

/**
 * Fetch all costing requests with filter parameters
 */
export async function getCostingRequests(filters = {}) {
  const { 
    search, 
    status, 
    productUnit, 
    marketingOfficerUid, 
    financeOfficerUid,
    dateFrom, 
    dateTo 
  } = filters;

  if (isMockMode) {
    let requests = JSON.parse(localStorage.getItem("costRequests") || "[]");

    // Perform check for overdue updates locally
    const now = new Date();
    let updated = false;
    requests = requests.map(r => {
      if (
        ["Submitted", "Received by Finance", "Costing in Progress"].includes(r.status) &&
        r.overdueAt &&
        new Date(r.overdueAt) < now
      ) {
        r.status = "Overdue";
        updated = true;

        // Add overdue notification locally
        const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        // Avoid duplicate notification
        const hasNotified = notifications.some(n => n.costRequestId === r.id && n.message.includes("overdue"));
        if (!hasNotified) {
          notifications.push({
            id: `not-${Date.now()}-${r.id}`,
            userId: null,
            role: "finance",
            costRequestId: r.id,
            costRequestNo: r.costRequestNo,
            message: `Costing request #${r.costRequestNo} is overdue.`,
            read: false,
            readBy: [],
            createdAt: now.toISOString()
          });
          localStorage.setItem("notifications", JSON.stringify(notifications));
        }
      }
      return r;
    });

    if (updated) {
      localStorage.setItem("costRequests", JSON.stringify(requests));
    }

    // Filters implementation
    if (search) {
      const q = search.toLowerCase();
      requests = requests.filter(r => 
        r.customerName.toLowerCase().includes(q) ||
        r.costRequestNo.toString().includes(q) ||
        r.marketingOfficer.name.toLowerCase().includes(q) ||
        (r.financeOfficer && r.financeOfficer.name.toLowerCase().includes(q))
      );
    }
    if (status) {
      requests = requests.filter(r => r.status === status);
    }
    if (productUnit) {
      requests = requests.filter(r => r.productUnit === productUnit);
    }
    if (marketingOfficerUid) {
      requests = requests.filter(r => r.marketingOfficer.uid === marketingOfficerUid);
    }
    if (financeOfficerUid) {
      requests = requests.filter(r => r.financeOfficer?.uid === financeOfficerUid);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      requests = requests.filter(r => new Date(r.requestDate) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      // Include the end date fully
      to.setHours(23, 59, 59, 999);
      requests = requests.filter(r => new Date(r.requestDate) <= to);
    }

    // Sort by requestNo desc
    requests.sort((a, b) => String(b.costRequestNo).localeCompare(String(a.costRequestNo), undefined, { numeric: true, sensitivity: 'base' }));

    return requests;
  } else {
    // Real Firestore querying
    // Note: Simple query build-up. Complex filter queries will fall back to local filtering to avoid missing indexes issues during review
    let q = query(collection(db, "costRequests"));
    
    const snapshot = await getDocs(q);
    let requests = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        requestDate: data.requestDate?.toDate().toISOString() || null,
        completionDate: data.completionDate?.toDate().toISOString() || null,
        overdueAt: data.overdueAt?.toDate().toISOString() || null
      };
    });

    // Client-side filtering to guarantee zero Firebase Firestore Index errors on deploy
    if (search) {
      const qLower = search.toLowerCase();
      requests = requests.filter(r => 
        r.customerName.toLowerCase().includes(qLower) ||
        r.costRequestNo.toString().includes(qLower) ||
        r.marketingOfficer.name.toLowerCase().includes(qLower) ||
        (r.financeOfficer && r.financeOfficer.name.toLowerCase().includes(qLower))
      );
    }
    if (status) {
      requests = requests.filter(r => r.status === status);
    }
    if (productUnit) {
      requests = requests.filter(r => r.productUnit === productUnit);
    }
    if (marketingOfficerUid) {
      requests = requests.filter(r => r.marketingOfficer.uid === marketingOfficerUid);
    }
    if (financeOfficerUid) {
      requests = requests.filter(r => r.financeOfficer?.uid === financeOfficerUid);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      requests = requests.filter(r => new Date(r.requestDate) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      requests = requests.filter(r => new Date(r.requestDate) <= to);
    }

    requests.sort((a, b) => String(b.costRequestNo).localeCompare(String(a.costRequestNo), undefined, { numeric: true, sensitivity: 'base' }));
    return requests;
  }
}

/**
 * Transitions the costing request to "Received by Finance" and assigns the Finance Officer
 */
export async function receiveCostingRequest(requestId, financeUser) {
  const updateData = {
    status: "Received by Finance",
    financeOfficer: {
      uid: financeUser.uid,
      name: financeUser.displayName || financeUser.email.split("@")[0],
      email: financeUser.email
    }
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");
    requests[index] = { ...requests[index], ...updateData };
    localStorage.setItem("costRequests", JSON.stringify(requests));
    return requests[index];
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, updateData);
    return getCostingRequestById(requestId);
  }
}

/**
 * Transitions the costing request status to "Costing in Progress"
 */
export async function startCostingRequest(requestId) {
  const updateData = {
    status: "Costing in Progress"
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");
    requests[index] = { ...requests[index], ...updateData };
    localStorage.setItem("costRequests", JSON.stringify(requests));
    return requests[index];
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, updateData);
    return getCostingRequestById(requestId);
  }
}

/**
 * Saves costing data drafts (keeps status as Costing in Progress or Received by Finance)
 */
export async function saveCostingDataDraft(requestId, costingData) {
  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");
    requests[index].costing = { ...requests[index].costing, ...costingData };
    localStorage.setItem("costRequests", JSON.stringify(requests));
    return requests[index];
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, { costing: costingData });
    return getCostingRequestById(requestId);
  }
}

/**
 * Completes costing request, updates costing data, sets status to "Costing Completed" & notifies Marketing
 */
export async function completeCostingRequest(requestId, costingData) {
  const now = new Date();
  
  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");

    const req = requests[index];
    req.costing = costingData;
    req.status = "Costing Completed"; // Transition status
    req.completionDate = now.toISOString();

    requests[index] = req;
    localStorage.setItem("costRequests", JSON.stringify(requests));



    // Create notification for Marketing Officer
    await createNotification({
      userId: req.marketingOfficer.uid,
      role: null,
      costRequestId: req.id,
      costRequestNo: req.costRequestNo,
      message: `Costing request #${req.costRequestNo} has been completed.`
    });

    return req;
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, {
      costing: costingData,
      status: "Costing Completed",
      completionDate: Timestamp.fromDate(now)
    });

    const completedReq = await getCostingRequestById(requestId);

    // Create notification document in Firestore
    await createNotification({
      userId: completedReq.marketingOfficer.uid,
      role: null,
      costRequestId: requestId,
      costRequestNo: completedReq.costRequestNo,
      message: `Costing request #${completedReq.costRequestNo} has been completed.`
    });

    return completedReq;
  }
}

/**
 * Sent to Marketing transition (optional status step)
 */
export async function sendToMarketing(requestId) {
  const updateData = {
    status: "Sent to Marketing"
  };
  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");
    requests[index] = { ...requests[index], ...updateData };
    localStorage.setItem("costRequests", JSON.stringify(requests));
    return requests[index];
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, updateData);
    return getCostingRequestById(requestId);
  }
}

/**
 * Re-opens a completed request (Admin only)
 */
export async function reopenCostingRequest(requestId) {
  const updateData = {
    status: "Costing in Progress",
    completionDate: null
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");
    requests[index] = { ...requests[index], ...updateData };
    localStorage.setItem("costRequests", JSON.stringify(requests));
    return requests[index];
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, {
      status: "Costing in Progress",
      completionDate: null
    });
    return getCostingRequestById(requestId);
  }
}

/**
 * Updates Marketing-owned specifications (Marketing / Admin only)
 */
export async function updateRequestSpecs(requestId, specsData) {
  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("costRequests") || "[]");
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error("Request not found");
    requests[index].specs = specsData;
    localStorage.setItem("costRequests", JSON.stringify(requests));
    return requests[index];
  } else {
    const docRef = doc(db, "costRequests", requestId);
    await updateDoc(docRef, { specs: specsData });
    return getCostingRequestById(requestId);
  }
}

/**
 * Update system counter setting (Admin only)
 */
export async function updateSystemCounter(newCounterValue) {
  if (isMockMode) {
    localStorage.setItem("systemSettings_costRequestCounter", JSON.stringify({ current: newCounterValue }));
  } else {
    const docRef = doc(db, "systemSettings", "costRequestCounter");
    await setDoc(docRef, { current: newCounterValue }, { merge: true });
  }
}

/**
 * Get current system counter setting (Admin only)
 */
export async function getSystemCounter() {
  if (isMockMode) {
    const counterObj = JSON.parse(localStorage.getItem("systemSettings_costRequestCounter") || '{"current":1000}');
    return counterObj.current;
  } else {
    const docRef = doc(db, "systemSettings", "costRequestCounter");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().current || 1000;
    }
    return 1000;
  }
}

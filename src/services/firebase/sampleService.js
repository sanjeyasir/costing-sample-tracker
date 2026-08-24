import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc,
  query, 
  orderBy, 
  runTransaction,
  Timestamp
} from "firebase/firestore";
import { db, isMockMode } from "./config";


/**
 * Returns the financial year string based on April 1st start.
 * Example: August 2026 -> "2627"
 */
export function getFinancialYearStr(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 3 = April
  let startYear, endYear;
  
  if (month >= 3) { // April to Dec
    startYear = year;
    endYear = year + 1;
  } else { // Jan to March
    startYear = year - 1;
    endYear = year;
  }
  
  const sY = startYear.toString().slice(-2);
  const eY = endYear.toString().slice(-2);
  return `${sY}${eY}`;
}

/**
 * Fetch all sample requests (optionally filtered)
 */
export async function getSampleRequests(filters = {}) {
  // Overdue status check helper
  const nowStr = new Date().toISOString().split("T")[0];
  const checkAndUpdateOverdue = (req) => {
    if (req.status === "In Progress" && req.plannedDeliveryDate) {
      const plannedDate = req.plannedDeliveryDate.split("T")[0];
      if (nowStr > plannedDate) {
        return {
          ...req,
          status: "Overdue",
          actionRequired: "Sample Development"
        };
      }
    }
    return req;
  };

  if (isMockMode) {
    let requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    
    // Auto-update overdue in return list
    requests = requests.map(checkAndUpdateOverdue);
    
    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      requests = requests.filter(r => 
        (r.sampleRequestNo || "").toLowerCase().includes(searchLower) ||
        (r.customerName || "").toLowerCase().includes(searchLower) ||
        (r.requestedBy || "").toLowerCase().includes(searchLower) ||
        (r.product || "").toLowerCase().includes(searchLower)
      );
    }
    if (filters.productUnit) {
      requests = requests.filter(r => r.productUnit === filters.productUnit);
    }
    if (filters.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    if (filters.requestType) {
      requests = requests.filter(r => r.requestType === filters.requestType);
    }
    if (filters.sampleType) {
      requests = requests.filter(r => r.sampleType === filters.sampleType);
    }
    if (filters.requestedBy) {
      requests = requests.filter(r => r.requestedBy === filters.requestedBy);
    }
    
    // Sort by requestDate desc
    requests.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
    return requests;
  } else {
    try {
      const q = query(collection(db, "sampleRequests"), orderBy("requestDate", "desc"));
      const snapshot = await getDocs(q);
      let requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Auto-update overdue
      requests = requests.map(checkAndUpdateOverdue);
      
      // Apply filters client-side to ensure complex text search works instantly
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        requests = requests.filter(r => 
          (r.sampleRequestNo || "").toLowerCase().includes(searchLower) ||
          (r.customerName || "").toLowerCase().includes(searchLower) ||
          (r.requestedBy || "").toLowerCase().includes(searchLower) ||
          (r.product || "").toLowerCase().includes(searchLower)
        );
      }
      if (filters.productUnit) {
        requests = requests.filter(r => r.productUnit === filters.productUnit);
      }
      if (filters.status) {
        requests = requests.filter(r => r.status === filters.status);
      }
      if (filters.requestType) {
        requests = requests.filter(r => r.requestType === filters.requestType);
      }
      if (filters.sampleType) {
        requests = requests.filter(r => r.sampleType === filters.sampleType);
      }
      if (filters.requestedBy) {
        requests = requests.filter(r => r.requestedBy === filters.requestedBy);
      }
      
      return requests;
    } catch (err) {
      console.error("Error getting sample requests:", err);
      return [];
    }
  }
}

/**
 * Fetch a single sample request by ID
 */
export async function getSampleRequestById(id) {
  const nowStr = new Date().toISOString().split("T")[0];
  const checkAndUpdateOverdue = (req) => {
    if (req.status === "In Progress" && req.plannedDeliveryDate) {
      const plannedDate = req.plannedDeliveryDate.split("T")[0];
      if (nowStr > plannedDate) {
        return {
          ...req,
          status: "Overdue",
          actionRequired: "Sample Development"
        };
      }
    }
    return req;
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    const req = requests.find(r => r.id === id);
    if (!req) throw new Error("Sample Request not found.");
    return checkAndUpdateOverdue(req);
  } else {
    const docRef = doc(db, "sampleRequests", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Sample Request not found.");
    return checkAndUpdateOverdue({ id: docSnap.id, ...docSnap.data() });
  }
}

/**
 * marketing Creates Sample Request
 */
export async function createSampleRequest(requestData, currentUser) {
  const fyStr = getFinancialYearStr(new Date());
  
  if (isMockMode) {
    // Atomic generate request number in LocalStorage
    const counterKey = `sampleRequestCounter_${fyStr}`;
    const counterObj = JSON.parse(localStorage.getItem(counterKey) || '{"current":0}');
    const nextCounter = (counterObj.current || 0) + 1;
    localStorage.setItem(counterKey, JSON.stringify({ current: nextCounter }));
    
    const seqNum = String(nextCounter).padStart(4, "0");
    const unitCode = requestData.productUnit === "Horticulture" ? "H" : "B";
    const sampleRequestNo = `${fyStr}-S-${unitCode}-${seqNum}`;

    const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    
    const nowISO = new Date().toISOString();
    const newRequest = {
      id: `req-${Date.now()}`,
      sampleRequestNo,
      productUnit: requestData.productUnit, // Horticulture or Bedding
      requestedBy: requestData.requestedBy || currentUser?.displayName || currentUser?.email?.split("@")?.[0] || "Marketing Officer",
      requestDate: requestData.requestDate || nowISO.split("T")[0],
      requiredDate: requestData.requiredDate,
      customerName: requestData.customerName,
      requestType: requestData.requestType, // Top Urgent, Urgent, Normal
      product: requestData.product,
      description: requestData.description,
      quantity: Number(requestData.quantity || 1),
      sampleType: requestData.sampleType, // New Development, Pre Production
      specialNotes: requestData.specialNotes || "",
      attachments: requestData.attachments || [],
      items: requestData.items || [],
      status: "Submitted",
      actionRequired: "Sample Development",
      dueDate: requestData.requiredDate,
      createdAt: nowISO,
      createdByUid: currentUser?.uid || null,
      createdByEmail: currentUser?.email || null,
      history: [
        { date: nowISO, label: "Request Created", user: currentUser?.displayName || "Marketing" },
        { date: nowISO, label: `Request Number Generated: ${sampleRequestNo}`, user: "System" },
        { date: nowISO, label: "Request Submitted to Sample Development", user: currentUser?.displayName || "Marketing" }
      ]
    };

    requests.push(newRequest);
    localStorage.setItem("sampleRequests", JSON.stringify(requests));
    window.dispatchEvent(new Event("storage"));
    
    // Add in-app notification
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
      id: `not-${Date.now()}`,
      userId: null,
      role: "sample",
      sampleRequestId: newRequest.id,
      sampleRequestNo,
      message: `New sample request #${sampleRequestNo} is awaiting development.`,
      read: false,
      readBy: [],
      createdAt: nowISO
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));


    
    return newRequest;
  } else {
    // Generate Request Number securely using runTransaction
    const counterDocId = `sampleRequestCounter_${fyStr}`;
    const counterRef = doc(db, "systemSettings", counterDocId);
    const requestsRef = collection(db, "sampleRequests");
    const newDocRef = doc(requestsRef);
    const notificationRef = doc(collection(db, "notifications"));

    const nowISO = new Date().toISOString();

    const result = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentCounter = 0;
      if (counterSnap.exists()) {
        currentCounter = counterSnap.data().current || 0;
      }
      const nextCounter = currentCounter + 1;
      transaction.set(counterRef, { current: nextCounter }, { merge: true });
      
      const seqNum = String(nextCounter).padStart(4, "0");
      const unitCode = requestData.productUnit === "Horticulture" ? "H" : "B";
      const sampleRequestNo = `${fyStr}-S-${unitCode}-${seqNum}`;

      const newRequest = {
        sampleRequestNo,
        productUnit: requestData.productUnit,
        requestedBy: requestData.requestedBy || currentUser?.displayName || "Marketing Officer",
        requestDate: requestData.requestDate || nowISO.split("T")[0],
        requiredDate: requestData.requiredDate,
        customerName: requestData.customerName,
        requestType: requestData.requestType,
        product: requestData.product,
        description: requestData.description,
        quantity: Number(requestData.quantity || 1),
        sampleType: requestData.sampleType,
        specialNotes: requestData.specialNotes || "",
        attachments: requestData.attachments || [],
        items: requestData.items || [],
        status: "Submitted",
        actionRequired: "Sample Development",
        dueDate: requestData.requiredDate,
        createdAt: nowISO,
        createdByUid: currentUser?.uid || null,
        createdByEmail: currentUser?.email || null,
        history: [
          { date: nowISO, label: "Request Created", user: currentUser?.displayName || "Marketing" },
          { date: nowISO, label: `Request Number Generated: ${sampleRequestNo}`, user: "System" },
          { date: nowISO, label: "Request Submitted to Sample Development", user: currentUser?.displayName || "Marketing" }
        ]
      };

      transaction.set(newDocRef, newRequest);
      
      const notification = {
        userId: null,
        role: "sample",
        sampleRequestId: newDocRef.id,
        sampleRequestNo,
        message: `New sample request #${sampleRequestNo} is awaiting development.`,
        read: false,
        readBy: [],
        createdAt: Timestamp.now()
      };
      transaction.set(notificationRef, notification);

      return { id: newDocRef.id, ...newRequest };
    });



    return result;
  }
}

/**
 * Sample Development accepts a request
 */
export async function acceptSampleRequest(id, plannedDeliveryDate, remarks, processedBy) {
  const nowISO = new Date().toISOString();
  const updatePayload = {
    status: "In Progress",
    actionRequired: "Sample Development",
    plannedDeliveryDate,
    dateReceived: nowISO.split("T")[0],
    acceptanceDateTime: nowISO,
    remarks: remarks || "",
    processedBy: processedBy || "Sample Team",
    dueDate: plannedDeliveryDate
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) throw new Error("Request not found.");
    
    const updated = {
      ...requests[idx],
      ...updatePayload,
      history: [
        ...(requests[idx].history || []),
        { date: nowISO, label: `Request Accepted. Planned Delivery: ${plannedDeliveryDate}`, user: processedBy }
      ]
    };
    requests[idx] = updated;
    localStorage.setItem("sampleRequests", JSON.stringify(requests));
    window.dispatchEvent(new Event("storage"));

    // Add in-app notification
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
      id: `not-${Date.now()}`,
      userId: updated.createdByUid || null,
      role: updated.createdByUid ? null : "sample_marketing",
      sampleRequestId: updated.id,
      sampleRequestNo: updated.sampleRequestNo,
      message: `Sample request #${updated.sampleRequestNo} has been accepted. Planned delivery: ${plannedDeliveryDate}`,
      read: false,
      readBy: [],
      createdAt: nowISO
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));
    

    
    return updated;
  } else {
    const docRef = doc(db, "sampleRequests", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Request not found.");
    const currentData = docSnap.data();
    
    const history = [
      ...(currentData.history || []),
      { date: nowISO, label: `Request Accepted. Planned Delivery: ${plannedDeliveryDate}`, user: processedBy }
    ];

    await updateDoc(docRef, {
      ...updatePayload,
      history
    });

    const updatedRequest = { id, ...currentData, ...updatePayload, history };

    // Add in-app notification
    await addDoc(collection(db, "notifications"), {
      userId: currentData.createdByUid || null,
      role: currentData.createdByUid ? null : "sample_marketing",
      sampleRequestId: id,
      sampleRequestNo: currentData.sampleRequestNo,
      message: `Sample request #${currentData.sampleRequestNo} has been accepted. Planned delivery: ${plannedDeliveryDate}`,
      read: false,
      readBy: [],
      createdAt: Timestamp.now()
    });



    return updatedRequest;
  }
}

/**
 * Sample Development requests more info
 */
export async function requestMoreInfo(id, remarks, processedBy = "Sample Team") {
  const nowISO = new Date().toISOString();
  const updatePayload = {
    status: "Request for Resubmission",
    actionRequired: "Marketing",
    remarks: remarks, // mandatory remarks
    processedBy
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) throw new Error("Request not found.");
    
    const updated = {
      ...requests[idx],
      ...updatePayload,
      history: [
        ...(requests[idx].history || []),
        { date: nowISO, label: `More Information Requested: "${remarks}"`, user: processedBy }
      ]
    };
    requests[idx] = updated;
    localStorage.setItem("sampleRequests", JSON.stringify(requests));
    window.dispatchEvent(new Event("storage"));

    // Add in-app notification
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
      id: `not-${Date.now()}`,
      userId: updated.createdByUid || null,
      role: updated.createdByUid ? null : "sample_marketing",
      sampleRequestId: updated.id,
      sampleRequestNo: updated.sampleRequestNo,
      message: `More information requested for sample request #${updated.sampleRequestNo}: "${remarks}"`,
      read: false,
      readBy: [],
      createdAt: nowISO
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));
    

    
    return updated;
  } else {
    const docRef = doc(db, "sampleRequests", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Request not found.");
    const currentData = docSnap.data();

    const history = [
      ...(currentData.history || []),
      { date: nowISO, label: `More Information Requested: "${remarks}"`, user: processedBy }
    ];

    await updateDoc(docRef, {
      ...updatePayload,
      history
    });

    const updatedRequest = { id, ...currentData, ...updatePayload, history };

    // Add in-app notification
    await addDoc(collection(db, "notifications"), {
      userId: currentData.createdByUid || null,
      role: currentData.createdByUid ? null : "sample_marketing",
      sampleRequestId: id,
      sampleRequestNo: currentData.sampleRequestNo,
      message: `More information requested for sample request #${currentData.sampleRequestNo}: "${remarks}"`,
      read: false,
      readBy: [],
      createdAt: Timestamp.now()
    });



    return updatedRequest;
  }
}

/**
 * Marketing resubmits request with changes/attachments
 */
export async function resubmitSampleRequest(id, updatedData, user) {
  const nowISO = new Date().toISOString();
  const updatePayload = {
    ...updatedData,
    status: "Submitted",
    actionRequired: "Sample Development",
    resubmittedAt: nowISO
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) throw new Error("Request not found.");

    const updated = {
      ...requests[idx],
      ...updatePayload,
      history: [
        ...(requests[idx].history || []),
        { date: nowISO, label: "Request Updated and Resubmitted", user: user?.displayName || "Marketing" }
      ]
    };
    requests[idx] = updated;
    localStorage.setItem("sampleRequests", JSON.stringify(requests));
    window.dispatchEvent(new Event("storage"));

    // Add in-app notification targeting sample team
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
      id: `not-${Date.now()}`,
      userId: null,
      role: "sample",
      sampleRequestId: updated.id,
      sampleRequestNo: updated.sampleRequestNo,
      message: `Sample request #${updated.sampleRequestNo} has been resubmitted with updates.`,
      read: false,
      readBy: [],
      createdAt: nowISO
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));

    return updated;
  } else {
    const docRef = doc(db, "sampleRequests", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Request not found.");
    const currentData = docSnap.data();

    const history = [
      ...(currentData.history || []),
      { date: nowISO, label: "Request Updated and Resubmitted", user: user?.displayName || "Marketing" }
    ];

    await updateDoc(docRef, {
      ...updatePayload,
      history
    });

    const updatedRequest = { id, ...currentData, ...updatePayload, history };

    // Add in-app notification targeting sample team
    await addDoc(collection(db, "notifications"), {
      userId: null,
      role: "sample",
      sampleRequestId: id,
      sampleRequestNo: currentData.sampleRequestNo,
      message: `Sample request #${currentData.sampleRequestNo} has been resubmitted with updates.`,
      read: false,
      readBy: [],
      createdAt: Timestamp.now()
    });

    return updatedRequest;
  }
}

/**
 * Sample Development completes the sample
 */
export async function completeSampleRequest(id, completionData, completedBy) {
  const nowISO = new Date().toISOString();
  const updatePayload = {
    status: "Completed",
    actionRequired: "None",
    actualCompletionDate: completionData.actualCompletionDate,
    completionDateTime: nowISO,
    completionRemarks: completionData.completionRemarks || "",
    completedBy: completedBy || "Sample Team",
    // Merge new files/photographs with previous attachments
    attachments: completionData.attachments || []
  };

  if (isMockMode) {
    const requests = JSON.parse(localStorage.getItem("sampleRequests") || "[]");
    const idx = requests.findIndex(r => r.id === id);
    if (idx === -1) throw new Error("Request not found.");

    const mergedAttachments = [
      ...(requests[idx].attachments || []),
      ...(completionData.attachments || [])
    ];

    const updated = {
      ...requests[idx],
      ...updatePayload,
      attachments: mergedAttachments,
      history: [
        ...(requests[idx].history || []),
        { date: nowISO, label: `Sample Marked as Completed: "${completionData.completionRemarks}"`, user: completedBy }
      ]
    };
    requests[idx] = updated;
    localStorage.setItem("sampleRequests", JSON.stringify(requests));
    window.dispatchEvent(new Event("storage"));

    // Add in-app notification targeting marketing creator
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    notifications.push({
      id: `not-${Date.now()}`,
      userId: updated.createdByUid || null,
      role: updated.createdByUid ? null : "sample_marketing",
      sampleRequestId: updated.id,
      sampleRequestNo: updated.sampleRequestNo,
      message: `Sample request #${updated.sampleRequestNo} has been completed successfully!`,
      read: false,
      readBy: [],
      createdAt: nowISO
    });
    localStorage.setItem("notifications", JSON.stringify(notifications));
    

    
    return updated;
  } else {
    const docRef = doc(db, "sampleRequests", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Request not found.");
    const currentData = docSnap.data();

    const mergedAttachments = [
      ...(currentData.attachments || []),
      ...(completionData.attachments || [])
    ];

    const history = [
      ...(currentData.history || []),
      { date: nowISO, label: `Sample Marked as Completed: "${completionData.completionRemarks}"`, user: completedBy }
    ];

    await updateDoc(docRef, {
      ...updatePayload,
      attachments: mergedAttachments,
      history
    });

    const updatedRequest = { id, ...currentData, ...updatePayload, attachments: mergedAttachments, history };

    // Add in-app notification targeting marketing creator
    await addDoc(collection(db, "notifications"), {
      userId: currentData.createdByUid || null,
      role: currentData.createdByUid ? null : "sample_marketing",
      sampleRequestId: id,
      sampleRequestNo: currentData.sampleRequestNo,
      message: `Sample request #${currentData.sampleRequestNo} has been completed successfully!`,
      read: false,
      readBy: [],
      createdAt: Timestamp.now()
    });



    return updatedRequest;
  }
}

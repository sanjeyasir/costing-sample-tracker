const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

admin.initializeApp();
const db = getFirestore();

/**
 * Cloud Function to securely and atomically create a new costing request
 * with a sequential Cost Request Number.
 * 
 * Callable from client.
 */
exports.createCostRequest = functions.https.onCall(async (data, context) => {
  // 1. Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required to create a costing request."
    );
  }

  const { uid, token } = context.auth;
  const email = token.email || "";
  const name = token.name || email.split("@")[0] || "Marketing Officer";

  // Validate inputs
  const { customerName, productUnit, specs } = data;
  if (!customerName || !productUnit || !specs) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Customer name, product category, and product specifications are required."
    );
  }

  const counterRef = db.collection("systemSettings").doc("costRequestCounter");
  const requestRef = db.collection("costRequests").doc();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Get the current counter value
      const counterDoc = await transaction.get(counterRef);
      let currentCounter = 1000; // Starting counter default

      if (counterDoc.exists) {
        currentCounter = counterDoc.data().current || 1000;
      }

      // Increment counter
      const nextCounter = currentCounter + 1;

      // Update counter in db
      transaction.set(counterRef, { current: nextCounter }, { merge: true });

      const now = Timestamp.now();
      const overdueAt = Timestamp.fromMillis(
        now.toMillis() + 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds
      );

      // Fetch category fields
      const categoryRef = db.collection("productCategories").doc(productUnit);
      const categoryDoc = await transaction.get(categoryRef);
      const categoryFields = categoryDoc.exists ? (categoryDoc.data().fields || []) : [];
      const categoryFieldsJson = JSON.stringify(categoryFields);

      const newRequest = {
        costRequestNo: nextCounter,
        customerName,
        productUnit,
        categoryFieldsJson,
        marketingOfficer: {
          uid,
          name,
          email,
        },
        financeOfficer: null,
        requestDate: now,
        status: "Submitted",
        completionDate: null,
        specs,
        costing: {},
        overdueAt,
      };

      // Create the costing request
      transaction.set(requestRef, newRequest);

      // Create in-app notification for all Finance users
      const notificationRef = db.collection("notifications").doc();
      const notification = {
        userId: null, // Broadcast to role
        role: "finance",
        costRequestId: requestRef.id,
        costRequestNo: nextCounter,
        message: `New costing request #${nextCounter} is awaiting Finance.`,
        read: false,
        readBy: [],
        createdAt: now,
      };
      transaction.set(notificationRef, notification);

      return {
        id: requestRef.id,
        costRequestNo: nextCounter,
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Transaction failed: ", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to generate unique cost request number: ${error.message}`
    );
  }
});

/**
 * Scheduled Cloud Function running every hour to check for outstanding costing requests
 * that have exceeded the 2-day limit, marking them as Overdue and notifying Finance.
 */
exports.checkOverdueRequests = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async (context) => {
    const now = Timestamp.now();
    
    // Query outstanding requests that are past their overdue threshold
    const snapshot = await db.collection("costRequests")
      .where("status", "in", ["Submitted", "Received by Finance", "Costing in Progress"])
      .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const overdueAt = data.overdueAt;

      // Check if past overdue threshold
      if (overdueAt && overdueAt.toMillis() < now.toMillis()) {
        const docRef = db.collection("costRequests").doc(doc.id);
        
        // Update status to Overdue
        batch.update(docRef, { status: "Overdue" });

        // Add overdue notification for Finance
        const notificationRef = db.collection("notifications").doc();
        batch.set(notificationRef, {
          userId: null,
          role: "finance",
          costRequestId: doc.id,
          costRequestNo: data.costRequestNo,
          message: `Costing request #${data.costRequestNo} is overdue.`,
          read: false,
          readBy: [],
          createdAt: now,
        });

        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Successfully marked ${count} requests as Overdue.`);
    } else {
      console.log("No overdue requests found.");
    }

    return null;
  });

/**
 * Cloud Function to securely create a new user account with role specifications
 * and seed the Firestore database profile. (Admin only)
 */
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  // 1. Ensure caller is authenticated and has Admin role
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }

  // Fetch caller role
  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();
  
  const callerRole = callerDoc.data().role;
  const isCallerAdmin = Array.isArray(callerRole) ? callerRole.includes("admin") : callerRole === "admin";
  if (!callerDoc.exists || !isCallerAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Administrators can register new users."
    );
  }

  const { email, password, displayName, role } = data;
  if (!email || !password || !displayName || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "All fields (email, password, name, role) are required."
    );
  }

  try {
    // 2. Create authentication account in Firebase Auth
    const userRecord = await getAuth().createUser({
      email,
      password,
      displayName,
    });

    // 3. Create document in users collection
    await db.collection("users").doc(userRecord.uid).set({
      email,
      displayName,
      role,
      status: "active",
      requirePasswordChange: true,
      createdAt: Timestamp.now()
    });

    return {
      success: true,
      uid: userRecord.uid
    };
  } catch (error) {
    console.error("Failed to create user: ", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to create user profile: ${error.message}`
    );
  }
});

/**
 * Cloud Function to securely approve a password reset request.
 * Resets user's password to welcome123 and flags requirePasswordChange: true. (Admin only)
 */
exports.adminApprovePasswordReset = functions.https.onCall(async (data, context) => {
  // 1. Ensure caller is authenticated and has Admin role
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();
  
  const callerRole = callerDoc.data().role;
  const isCallerAdmin = Array.isArray(callerRole) ? callerRole.includes("admin") : callerRole === "admin";
  if (!callerDoc.exists || !isCallerAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Administrators can approve password resets."
    );
  }

  const { requestId } = data;
  if (!requestId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Request ID is required."
    );
  }

  try {
    const docRef = db.collection("password_resets").doc(requestId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Reset request not found."
      );
    }
    const resetData = docSnap.data();

    // Find the user by email in firestore
    const usersSnap = await db.collection("users")
      .where("email", "==", resetData.email)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        "No registered user account found with this email."
      );
    }
    const userDoc = usersSnap.docs[0];
    const userUid = userDoc.id;

    // Reset password in Firebase Auth to welcome123
    const tempPassword = "welcome123";
    await getAuth().updateUser(userUid, {
      password: tempPassword
    });

    // Update requirePasswordChange flag in user document
    await db.collection("users").doc(userUid).update({
      requirePasswordChange: true
    });

    // Mark the reset request doc as APPROVED
    await docRef.update({
      status: "APPROVED",
      approvedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to reset password: ", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to reset password: ${error.message}`
    );
  }
});

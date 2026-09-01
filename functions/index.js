const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

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

  const { email, password, displayName, role, phoneNumber, whatsappEnabled } = data;
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
      phoneNumber: phoneNumber || "",
      whatsappEnabled: !!whatsappEnabled,
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

  const { requestId, tempPassword } = data;
  if (!requestId || !tempPassword) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Request ID and Temporary Password are required."
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

    // Find the user by email case-insensitively in Firestore
    const targetEmailLower = (resetData.email || "").toLowerCase();
    const usersSnap = await db.collection("users").get();
    const userDoc = usersSnap.docs.find(d => {
      const uEmail = d.data().email;
      return uEmail && uEmail.toLowerCase() === targetEmailLower;
    });

    if (!userDoc) {
      throw new functions.https.HttpsError(
        "not-found",
        "No registered user account found with this email."
      );
    }
    const userUid = userDoc.id;
    const userEmail = userDoc.data().email;

    // Reset password in Firebase Auth to the temporary password
    await getAuth().updateUser(userUid, {
      password: tempPassword
    });

    // Send the email with the temporary password
    const mailTransporter = getTransporter();
    await mailTransporter.sendMail({
      from: '"Hayfibre Operations" <chasphayleys@gmail.com>',
      to: userEmail,
      subject: "Password Reset Request Approved",
      html: `
        <p>Hello,</p>
        <p>Your password reset request has been approved.</p>
        <p>Your password has been reset to a temporary password: <strong>${tempPassword}</strong></p>
        <p>Please log in using this temporary password. You will be prompted to reset it to a password of your choice on your first login.</p>
        <br/>
        <p style="font-size: 11px; color: #666666;">
          This is an automated notification from the Costing & Sample Tracking System. Please do not reply directly to this email.
        </p>
      `
    });

    // Update requirePasswordChange flag in user document
    await db.collection("users").doc(userUid).update({
      requirePasswordChange: true
    });

    // Delete the reset request doc
    await docRef.delete();

    return { success: true };
  } catch (error) {
    console.error("Failed to reset password: ", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to reset password: ${error.message}`
    );
  }
});

/**
 * Cloud Function to securely delete a password reset request. (Admin only)
 */
exports.adminDeletePasswordReset = functions.https.onCall(async (data, context) => {
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
      "Only Administrators can delete password resets."
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

    // Delete the reset request doc
    await docRef.delete();

    return { success: true };
  } catch (error) {
    console.error("Failed to delete password reset request: ", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to delete password reset request: ${error.message}`
    );
  }
});

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "chasphayleys@gmail.com",
      pass: "fjcd qmuy epfk pwhb"
    }
  });
  return transporter;
};

/**
 * Cloud Function to securely send email notifications using Gmail SMTP.
 * Callable from client.
 */
exports.sendEmailViaSMTP = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required to send emails."
    );
  }

  const { to, subject, html } = data;
  if (!to || !subject || !html) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Recipient (to), subject, and HTML body are required."
    );
  }

  let targetEmail = to;
  if (to.toLowerCase() === "admin@gmail.com") {
    targetEmail = "Sanjey.Asirvatham@hayleysfibre.com";
  }

  try {
    const mailTransporter = getTransporter();
    const info = await mailTransporter.sendMail({
      from: '"Hayfibre Operations" <chasphayleys@gmail.com>',
      to: targetEmail,
      subject,
      html,
    });

    // Save sent email record in Firestore emails collection
    await db.collection("emails").add({
      to,
      message: {
        subject,
        html
      },
      template: "system_notification",
      createdAt: new Date().toISOString(),
      status: "sent",
      messageId: info.messageId || null
    });

    return { success: true, data: { id: info.messageId } };
  } catch (error) {
    console.error("Failed to send email via Gmail SMTP: ", error);
    throw new functions.https.HttpsError(
      "internal",
      `Gmail SMTP email delivery failed: ${error.message}`
    );
  }
});

/**
 * Cloud Function to securely handle WhatsApp notifications.
 * Callable from client.
 */
exports.sendWhatsAppViaAPI = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required to send WhatsApp notifications."
    );
  }

  const { to, message } = data;
  if (!to || !message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Recipient (to) and message are required."
    );
  }

  try {
    // 1. Fetch systemSettings/whatsappConfig
    const configSnap = await db.collection("systemSettings").doc("whatsappConfig").get();
    let config = { 
      provider: "disabled",
      globalOverride: true,
      overrideNumber: "+94767063788"
    };
    if (configSnap.exists) {
      config = { ...config, ...configSnap.data() };
    }

    const provider = config.provider || "disabled";
    let status = "simulated";
    let responseData = "WhatsApp delivery simulation mode.";

    // Save WhatsApp log to Firestore
    await db.collection("whatsappLogs").add({
      to,
      message,
      provider,
      status,
      createdAt: new Date().toISOString(),
      response: responseData
    });

    return { success: true, status, response: responseData };
  } catch (error) {
    console.error("sendWhatsAppViaAPI failure: ", error);
    
    // Log failed transaction
    await db.collection("whatsappLogs").add({
      to,
      message,
      provider: "error",
      status: "failed",
      createdAt: new Date().toISOString(),
      response: error.message
    });

    throw new functions.https.HttpsError(
      "internal",
      `WhatsApp API dispatch failed: ${error.message}`
    );
  }
});

/**
 * Cloud Function to seed / migrate default Product Categories & System Settings to Firestore.
 */
exports.seedProductCategories = functions.https.onRequest(async (req, res) => {
  const DEFAULT_CATEGORIES = [
    {
      id: "bedding",
      name: "Bedding",
      createdAt: Timestamp.now(),
      fields: [
        { key: "description", label: "Description", type: "text", required: true, owner: "marketing" },
        { key: "length", label: "Length (CM)", type: "number", required: true, owner: "marketing" },
        { key: "width", label: "Width (CM)", type: "number", required: true, owner: "marketing" },
        { key: "height", label: "Height (CM)", type: "number", required: true, owner: "marketing" },
        { key: "organic", label: "Organic / Non-Organic", type: "select", options: ["Organic", "Non-Organic"], required: true, owner: "marketing" },
        { key: "ncRcRatio", label: "NC/RC Ratio", type: "text", required: true, owner: "marketing" },
        { key: "density", label: "Density", type: "text", required: true, owner: "marketing" },
        { key: "qtyPerBundle", label: "Quantity per Bundle (Optional)", type: "number", required: false, owner: "marketing" },
        { key: "unitCost", label: "Unit Cost", type: "number", required: true, owner: "finance" },
        { key: "qtyPerBundleFinance", label: "Quantity per Bundle (Finance)", type: "number", required: true, owner: "finance" }
      ]
    },
    {
      id: "horticulture",
      name: "Horticulture",
      createdAt: Timestamp.now(),
      fields: [
        { key: "description", label: "Product Description", type: "text", required: true, owner: "marketing" },
        { key: "specifications", label: "Product Specifications", type: "textarea", required: true, owner: "marketing" },
        { key: "gsm", label: "GSM", type: "number", required: true, owner: "marketing" },
        { key: "latexRatio", label: "Latex Ratio", type: "text", required: true, owner: "marketing" },
        { key: "packing", label: "Packing - Pieces per Carton or Bundle", type: "text", required: true, owner: "finance" },
        { key: "cartonSize", label: "Carton Size (CM)", type: "text", required: true, owner: "finance" },
        { key: "palletSize", label: "Pallet Size (Optional)", type: "text", required: false, owner: "finance" },
        { key: "cartonsPerPallet", label: "Cartons per Pallet (Optional)", type: "number", required: false, owner: "finance" },
        { key: "rollDiameter", label: "Roll Diameter (If Applicable)", type: "text", required: false, owner: "finance" },
        { key: "unitCost", label: "Unit Cost", type: "number", required: true, owner: "finance" }
      ]
    }
  ];

  try {
    const results = [];
    for (const cat of DEFAULT_CATEGORIES) {
      const { id, ...data } = cat;
      await db.collection("productCategories").doc(id).set(data, { merge: true });
      results.push(cat.name);
    }

    // Seed default systemSettings if not exists
    const counterDoc = await db.collection("systemSettings").doc("costRequestCounter").get();
    if (!counterDoc.exists) {
      await db.collection("systemSettings").doc("costRequestCounter").set({ current: 1000 });
    }

    res.status(200).json({
      success: true,
      message: "Product categories and system settings successfully seeded/migrated.",
      migratedCategories: results
    });
  } catch (err) {
    console.error("Migration error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

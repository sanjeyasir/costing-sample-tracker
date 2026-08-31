import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  onSnapshot,
  arrayUnion,
  writeBatch,
  addDoc,
  Timestamp
} from "firebase/firestore";
import { db, functions, isMockMode, auth } from "./config";
import { initializeLocalStorageState } from "./mockData";
import { httpsCallable } from "firebase/functions";
import { getUsers } from "./userService";

if (isMockMode) {
  initializeLocalStorageState();
}

/**
 * Subscribes to notification updates for the current user and their role.
 * Includes user-specific alerts and role broadcast alerts (e.g. Finance alerts).
 */
export function subscribeNotifications(currentUser, onNotificationsChanged) {
  if (!currentUser) {
    onNotificationsChanged([]);
    return () => {};
  }

  const { uid, roles = [] } = currentUser;

  if (isMockMode) {
    const checkNotifications = () => {
      const allNotifications = JSON.parse(localStorage.getItem("notifications") || "[]");
      
      // Filter notifications targeting this specific user OR matching their roles
      const filtered = allNotifications.filter(n => {
        // Direct target notification
        if (n.userId === uid) return true;
        
        // Admin receives all
        if (roles.includes("admin")) {
          const isReadByUser = n.readBy && n.readBy.includes(uid);
          return !isReadByUser;
        }

        // Role broadcast notifications
        if (n.role) {
          const hasFinanceAccess = n.role === "finance" && roles.includes("costing_finance");
          const hasSampleAccess = (n.role === "sample" || n.role === "sample_sampling") && roles.includes("sample_sampling");
          
          if (hasFinanceAccess || hasSampleAccess) {
            const isReadByUser = n.readBy && n.readBy.includes(uid);
            return !isReadByUser;
          }
        }
        return false;
      });

      // Sort newest first
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      onNotificationsChanged(filtered);
    };

    checkNotifications();

    const listener = (e) => {
      if (e.key === "notifications") {
        checkNotifications();
      }
    };
    window.addEventListener("storage", listener);

    return () => {
      window.removeEventListener("storage", listener);
    };
  } else {
    // Real Firestore real-time listener (fetch all notifications, filter client-side securely)
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const allNotifications = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || null
        };
      });

      // Filter on client based on roles array
      const filtered = allNotifications.filter(n => {
        if (n.userId === uid) {
          return !n.read;
        }
        if (roles.includes("admin")) {
          return !(n.readBy && n.readBy.includes(uid));
        }
        if (n.role) {
          const hasFinanceAccess = n.role === "finance" && roles.includes("costing_finance");
          const hasSampleAccess = (n.role === "sample" || n.role === "sample_sampling") && roles.includes("sample_sampling");
          if (hasFinanceAccess || hasSampleAccess) {
            return !(n.readBy && n.readBy.includes(uid));
          }
        }
        return false;
      });

      // Sort client-side to keep order when query is not ordered by index
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      onNotificationsChanged(filtered);
    }, (error) => {
      console.error("Error subscribing to notifications:", error);
    });
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId, currentUser) {
  const { uid } = currentUser;
  const now = new Date();
  const completedAtVal = now.toISOString();

  if (isMockMode) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    const index = notifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      const n = notifications[index];
      if (n.role) {
        if (!n.readBy) n.readBy = [];
        if (!n.readBy.includes(uid)) {
          n.readBy.push(uid);
        }
        if (!n.completions) n.completions = {};
        n.completions[uid] = completedAtVal;
        n.completedAt = completedAtVal;
        n.status = "completed";
      } else {
        n.read = true;
        n.status = "completed";
        n.completedAt = completedAtVal;
      }
      notifications[index] = n;
      localStorage.setItem("notifications", JSON.stringify(notifications));
      // Dispatch storage event to trigger subscriber check in active window
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "notifications", notificationId);
    
    // Check if notification is target-user or role-broadcasted
    // To make it simple, we do:
    const notifications = await getDocs(query(collection(db, "notifications")));
    const docSnap = notifications.docs.find(d => d.id === notificationId);
    if (docSnap) {
      const data = docSnap.data();
      const dbCompletedAt = Timestamp.fromDate(now);
      if (data.role) {
        await updateDoc(docRef, {
          readBy: arrayUnion(uid),
          [`completions.${uid}`]: dbCompletedAt,
          completedAt: dbCompletedAt,
          status: "completed"
        });
      } else {
        await updateDoc(docRef, { 
          read: true,
          completedAt: dbCompletedAt,
          status: "completed"
        });
      }
    }
  }
}

/**
 * Mark all active notifications as read
 */
export async function markAllNotificationsAsRead(currentUser, activeNotifications) {
  const { uid } = currentUser;
  const now = new Date();
  const completedAtVal = now.toISOString();

  if (isMockMode) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    
    activeNotifications.forEach(activeN => {
      const index = notifications.findIndex(n => n.id === activeN.id);
      if (index !== -1) {
        const n = notifications[index];
        if (n.userId === uid) {
          n.read = true;
          n.completedAt = completedAtVal;
          n.status = "completed";
        } else if (n.role) {
          if (!n.readBy) n.readBy = [];
          if (!n.readBy.includes(uid)) {
            n.readBy.push(uid);
          }
          if (!n.completions) n.completions = {};
          n.completions[uid] = completedAtVal;
          n.completedAt = completedAtVal;
          n.status = "completed";
        }
        notifications[index] = n;
      }
    });

    localStorage.setItem("notifications", JSON.stringify(notifications));
    window.dispatchEvent(new Event("storage"));
  } else {
    const batch = writeBatch(db);
    const dbCompletedAt = Timestamp.fromDate(now);
    activeNotifications.forEach(n => {
      const docRef = doc(db, "notifications", n.id);
      if (n.userId === uid) {
        batch.update(docRef, { 
          read: true,
          completedAt: dbCompletedAt,
          status: "completed"
        });
      } else if (n.role) {
        batch.update(docRef, {
          readBy: arrayUnion(uid),
          [`completions.${uid}`]: dbCompletedAt,
          completedAt: dbCompletedAt,
          status: "completed"
        });
      }
    });
    await batch.commit();
  }
}

/**
 * Sends an email notification to relevant users based on the notification data
 */
export async function sendEmailNotification(notificationData) {
  try {
    const users = await getUsers();
    console.log("Resolved users from Firestore for notifications:", users);
    const emails = [];

    // 1. Resolve recipients based on userId or role
    if (notificationData.userId) {
      const u = users.find(user => user.uid === notificationData.userId);
      if (u && u.email) {
        emails.push(u.email);
      }
    }

    if (notificationData.role) {
      const targetRole = notificationData.role.toLowerCase();
      users.forEach(u => {
        const userRoles = Array.isArray(u.role) ? u.role : [u.role];
        const costingRoles = Array.isArray(u.costingRoles) ? u.costingRoles : [u.costingRole];
        const sampleRoles = Array.isArray(u.sampleRoles) ? u.sampleRoles : [u.sampleRole];
        const allUserRoles = [...userRoles, ...costingRoles, ...sampleRoles, u.costingRole, u.sampleRole]
          .filter(Boolean)
          .map(r => r.toLowerCase());

        let isMatched = false;
        if (targetRole === "finance") {
          isMatched = allUserRoles.includes("costing_finance") || 
                      allUserRoles.includes("finance") || 
                      allUserRoles.includes("costing-finance-team");
        } else if (targetRole === "sample" || targetRole === "sample_sampling") {
          isMatched = allUserRoles.includes("sample_sampling") || 
                      allUserRoles.includes("sample") || 
                      allUserRoles.includes("sample-samplingteam");
        } else if (targetRole === "sample_marketing" || targetRole === "marketing") {
          isMatched = allUserRoles.includes("sample_marketing") || 
                      allUserRoles.includes("costing_marketing") || 
                      allUserRoles.includes("marketing") || 
                      allUserRoles.includes("costing-marketing-team") || 
                      allUserRoles.includes("sample-marketing-team");
        } else {
          isMatched = allUserRoles.includes(targetRole) || 
                      allUserRoles.some(r => r.replace(/[^a-z]/g, "") === targetRole.replace(/[^a-z]/g, ""));
        }

        if (isMatched && u.email && !emails.includes(u.email)) {
          emails.push(u.email);
        }
      });
    }

    // Add the current logged-in requester email for new costing/sample request creations
    const isNewRequestNotification = 
      notificationData.message && 
      (notificationData.message.toLowerCase().includes("new costing request") || 
       notificationData.message.toLowerCase().includes("new sample request"));

    if (isNewRequestNotification) {
      const requesterEmail = auth?.currentUser?.email;
      if (requesterEmail && !emails.includes(requesterEmail)) {
        emails.push(requesterEmail);
      }
    }

    if (emails.length === 0) {
      console.log("No recipient emails resolved for notification:", notificationData);
      return;
    }

    // 2. Map and redirect admin@gmail.com to Sanjey.Asirvatham@hayleysfibre.com
    const finalEmails = emails.map(email => {
      if (email.toLowerCase() === "admin@gmail.com") {
        return "Sanjey.Asirvatham@hayleysfibre.com";
      }
      return email;
    });

    // 3. Prepare email content
    const isCost = !!notificationData.costRequestId;
    const reqNo = notificationData.costRequestNo || notificationData.sampleRequestNo || "N/A";
    const subject = `Request - ${reqNo}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333333; max-width: 600px; margin: 0 auto; padding: 10px;">
        <p>Hello,</p>
        <p>A new system update has been logged in the Costing & Sample Tracking System:</p>
        
        <blockquote style="margin: 15px 0; padding: 10px 15px; border-left: 4px solid #10b981; background-color: #f8fafc; font-size: 14px;">
          <strong>Request Type:</strong> ${isCost ? 'Costing Request' : 'Sample Request'}<br/>
          <strong>Reference No:</strong> ${reqNo}<br/>
          <strong>Details:</strong> ${notificationData.message}
        </blockquote>

        <p>Please log in to the tracking portal to review the request details.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
        <p style="font-size: 11px; color: #666666;">
          This is an automated notification from the Hayleys Fibre Costing & Sample Tracking System.<br/>
          Please do not reply directly to this email.
        </p>
      </div>
    `;

    // 4. Send email to each recipient
    for (const recipient of finalEmails) {
      if (isMockMode) {
        console.log(`[Mock Mode Email] Mock notification dispatched to ${recipient}: ${notificationData.message}`);
        // Log email to mock localStorage collection
        await logEmailRecord(recipient, subject, htmlBody, `mock-msg-${Date.now()}`, "sent");
      } else {
        // Real Firestore mode
        try {
          const sendEmailFunc = httpsCallable(functions, "sendEmailViaSMTP");
          await sendEmailFunc({
            to: recipient,
            subject: subject,
            html: htmlBody
          });
          console.log(`[Firestore Mode Email] Securely sent email via Cloud Function to ${recipient}`);
        } catch (fnErr) {
          console.error(`[Firestore Mode Email] Cloud Function failed to send email to ${recipient}:`, fnErr);
        }
      }
    }
  } catch (err) {
    console.error("sendEmailNotification experienced an error:", err);
  }
}

/**
 * Helper to log sent email records (matching cloud-erp structure)
 */
async function logEmailRecord(recipient, subject, html, messageId, status) {
  if (isMockMode) {
    const mockEmails = JSON.parse(localStorage.getItem("emails") || "[]");
    mockEmails.push({
      id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      to: recipient,
      message: { subject, html },
      template: "system_notification",
      createdAt: new Date().toISOString(),
      status: status,
      messageId: messageId || `mock-msg-${Date.now()}`
    });
    localStorage.setItem("emails", JSON.stringify(mockEmails));
    window.dispatchEvent(new Event("storage"));
  } else {
    try {
      const { collection, addDoc } = await import("firebase/firestore");
      await addDoc(collection(db, "emails"), {
        to: recipient,
        message: { subject, html },
        template: "system_notification",
        createdAt: new Date().toISOString(),
        status: status,
        messageId: messageId || null
      });
    } catch (err) {
      console.error("Failed to write email record to Firestore 'emails' collection:", err);
    }
  }
}

/**
 * Creates a new notification (user-specific or role broadcast)
 */
export async function createNotification(notificationData) {
  const now = new Date();
  const payload = {
    userId: notificationData.userId || null,
    role: notificationData.role || null,
    costRequestId: notificationData.costRequestId || null,
    sampleRequestId: notificationData.sampleRequestId || null,
    costRequestNo: notificationData.costRequestNo || null,
    sampleRequestNo: notificationData.sampleRequestNo || null,
    message: notificationData.message,
    read: false,
    readBy: [],
    status: "pending",
    createdAt: isMockMode ? now.toISOString() : Timestamp.fromDate(now)
  };

  if (isMockMode) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    payload.id = `not-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    notifications.push(payload);
    localStorage.setItem("notifications", JSON.stringify(notifications));
    window.dispatchEvent(new Event("storage"));
  } else {
    const ref = collection(db, "notifications");
    await addDoc(ref, payload);
  }

  // Trigger email dispatch in background
  sendEmailNotification(payload);
}


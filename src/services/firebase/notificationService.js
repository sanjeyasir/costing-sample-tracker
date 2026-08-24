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
  writeBatch
} from "firebase/firestore";
import { db, isMockMode } from "./config";
import { initializeLocalStorageState } from "./mockData";

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
      const allNotifications = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }));

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

  if (isMockMode) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    const index = notifications.findIndex(n => n.id === notificationId);
    
    if (index !== -1) {
      const n = notifications[index];
      if (n.userId === uid) {
        n.read = true;
      } else if (n.role) {
        if (!n.readBy) n.readBy = [];
        if (!n.readBy.includes(uid)) {
          n.readBy.push(uid);
        }
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
      if (data.userId === uid) {
        await updateDoc(docRef, { read: true });
      } else if (data.role) {
        await updateDoc(docRef, {
          readBy: arrayUnion(uid)
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

  if (isMockMode) {
    const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    
    activeNotifications.forEach(activeN => {
      const index = notifications.findIndex(n => n.id === activeN.id);
      if (index !== -1) {
        const n = notifications[index];
        if (n.userId === uid) {
          n.read = true;
        } else if (n.role) {
          if (!n.readBy) n.readBy = [];
          if (!n.readBy.includes(uid)) {
            n.readBy.push(uid);
          }
        }
        notifications[index] = n;
      }
    });

    localStorage.setItem("notifications", JSON.stringify(notifications));
    window.dispatchEvent(new Event("storage"));
  } else {
    const batch = writeBatch(db);
    activeNotifications.forEach(n => {
      const docRef = doc(db, "notifications", n.id);
      if (n.userId === uid) {
        batch.update(docRef, { read: true });
      } else if (n.role) {
        batch.update(docRef, {
          readBy: arrayUnion(uid)
        });
      }
    });
    await batch.commit();
  }
}

import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  updatePassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs, addDoc, writeBatch } from "firebase/firestore";
import { auth, db, functions, isMockMode } from "./config";
import { httpsCallable } from "firebase/functions";
import { initializeLocalStorageState } from "./mockData";

// Make sure localStorage mock values exist
if (isMockMode) {
  initializeLocalStorageState();
}

/**
 * Log in a user with email and password
 */
export const DEFAULT_ROLES = [
  { id: "super_admin", name: "Super Admin", permissions: ["*:*"] },
  { id: "tenant_admin", name: "Tenant Admin", permissions: ["*:*"] },
  { id: "marketing", name: "Marketing / Sales", permissions: ["requests:view", "requests:create", "requests:update"] },
  { id: "finance", name: "Finance Team", permissions: ["requests:view", "requests:update", "requests:finance"] }
];

export async function seedGlobalRoles() {
  try {
    const rolesCol = collection(db, "roles");
    const snapshot = await getDocs(rolesCol);
    
    if (snapshot.empty) {
      const batch = writeBatch(db);
      DEFAULT_ROLES.forEach((r) => {
        batch.set(doc(db, "roles", r.id), {
          name: r.name,
          permissions: r.permissions
        });
      });
      await batch.commit();
      console.log("Global roles seeded successfully.");
    }
  } catch (error) {
    console.error("Error seeding global roles:", error);
  }
}

export async function login(email, password) {
  if (isMockMode) {
    // 1. Fetch users from local storage
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    // Find matching user
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error("auth/user-not-found: User not found.");
    }
    if (user.status === "inactive") {
      throw new Error("auth/user-disabled: This user has been deactivated by an Administrator.");
    }
    // Simulate check
    if (user.password && user.password !== password) {
      throw new Error("auth/wrong-password: The password you entered is incorrect.");
    }
    // Save token session
    localStorage.setItem("mock_session_uid", user.uid);
    return {
      user: { uid: user.uid, email: user.email },
      profile: { id: user.uid, ...user },
      tenant: { id: "mock_tenant", companyName: "Main Plant Operations", status: "ACTIVE" },
      role: { id: user.role, name: user.role, permissions: ["*:*"] }
    };
  } else {
    // Real Firebase login
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (
        (err.code === "auth/user-not-found" || 
         err.code === "auth/invalid-credential" || 
         err.code === "auth/invalid-email") &&
        email.toLowerCase() === "admin@gmail.com" &&
        password === "admin123"
      ) {
        // Auto-register super admin auth account
        userCredential = await createUserWithEmailAndPassword(auth, "admin@gmail.com", "admin123");
      } else {
        throw err;
      }
    }
    const user = userCredential.user;
    
    // Fetch user doc
    const userDocRef = doc(db, "users", user.uid);
    let userDoc = await getDoc(userDocRef);
    let userData;
    let tenantData = null;
    let roleData = null;
    
    if (!userDoc.exists()) {
      if (email.toLowerCase() === "admin@gmail.com") {
        const tenantId = "admin_tenant_gmail";
        
        await seedGlobalRoles();
        
        await setDoc(doc(db, "tenants", tenantId), {
          companyName: "Main Plant Operations",
          subscriptionPlan: "ENTERPRISE",
          status: "ACTIVE",
          createdAt: Timestamp.now()
        });
        
        userData = {
          tenantId,
          displayName: "Super Admin",
          email: "admin@gmail.com",
          roleId: "tenant_admin",
          role: "admin",
          status: "active",
          requirePasswordChange: false,
          createdAt: Timestamp.now()
        };
        await setDoc(userDocRef, userData);
        userData.id = user.uid;
      } else {
        throw new Error("User record does not exist in database.");
      }
    } else {
      userData = { id: userDoc.id, ...userDoc.data() };
    }
    
    if (userData.status === "inactive") {
      await firebaseSignOut(auth);
      throw new Error("This user has been deactivated by an Administrator.");
    }
    
    // Fetch tenant and role
    if (userData.tenantId) {
      const tenantDoc = await getDoc(doc(db, "tenants", userData.tenantId));
      if (tenantDoc.exists()) {
        tenantData = { id: tenantDoc.id, ...tenantDoc.data() };
      }
    }
    
    const rawRole = userData.roleId || userData.role;
    const roleId = Array.isArray(rawRole) ? rawRole[0] : rawRole;
    if (roleId && typeof roleId === "string") {
      const roleDoc = await getDoc(doc(db, "roles", roleId));
      if (roleDoc.exists()) {
        roleData = { id: roleDoc.id, ...roleDoc.data() };
      }
    }
    
    return {
      user,
      profile: userData,
      tenant: tenantData,
      role: roleData
    };
  }
}

/**
 * Log out the current user
 */
export async function logout() {
  if (isMockMode) {
    localStorage.removeItem("mock_session_uid");
    window.dispatchEvent(new Event("storage"));
  } else {
    await firebaseSignOut(auth);
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error("auth/user-not-found: Email not registered.");
    }
    const resets = JSON.parse(localStorage.getItem("password_resets") || "[]");
    resets.push({
      id: `reset-req-${Date.now()}`,
      email: email.toLowerCase(),
      userId: user.uid,
      name: user.displayName || "User",
      status: "PENDING",
      requestedAt: new Date().toISOString()
    });
    localStorage.setItem("password_resets", JSON.stringify(resets));
    window.dispatchEvent(new Event("storage"));
    return true;
  } else {
    const emailLower = email.toLowerCase();
    await addDoc(collection(db, "password_resets"), {
      email: emailLower,
      status: "PENDING",
      requestedAt: Timestamp.now()
    });
    return true;
  }
}

/**
 * Subscribe to authentication state changes
 */
export function subscribeAuthState(onStateChanged) {
  if (isMockMode) {
    const checkSession = () => {
      const activeUid = localStorage.getItem("mock_session_uid");
      if (activeUid) {
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const found = users.find(u => u.uid === activeUid);
        if (found && found.status === "active") {
          const profile = { id: found.uid, ...found };
          const tenant = {
            id: "mock_tenant",
            companyName: "Main Plant Operations",
            subscriptionPlan: "ENTERPRISE",
            status: "ACTIVE"
          };
          const role = {
            id: found.role,
            name: found.role === "admin" ? "Super Admin" : found.role === "finance" ? "Finance Team" : "Marketing / Sales",
            permissions: ["*:*"]
          };
          onStateChanged({ uid: found.uid, email: found.email }, profile, tenant, role);
          return;
        }
      }
      onStateChanged(null, null, null, null);
    };

    checkSession();

    const listener = (e) => {
      if (e.key === "mock_session_uid" || e.key === "users") {
        checkSession();
      }
    };
    window.addEventListener("storage", listener);

    return () => {
      window.removeEventListener("storage", listener);
    };
  } else {
    // Real Firebase listener
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          let userDoc = await getDoc(userDocRef);
          
          let userData = null;
          let tenantData = null;
          let roleData = null;
          
          if (userDoc.exists()) {
            userData = { id: userDoc.id, ...userDoc.data() };
            
            // Fetch Tenant
            if (userData.tenantId) {
              const tenantDoc = await getDoc(doc(db, "tenants", userData.tenantId));
              if (tenantDoc.exists()) {
                tenantData = { id: tenantDoc.id, ...tenantDoc.data() };
              }
            }
            
            // Fetch Role
            const rawRole = userData.roleId || userData.role;
            const roleId = Array.isArray(rawRole) ? rawRole[0] : rawRole;
            if (roleId && typeof roleId === "string") {
              const roleDoc = await getDoc(doc(db, "roles", roleId));
              if (roleDoc.exists()) {
                roleData = { id: roleDoc.id, ...roleDoc.data() };
              }
            }
          } else if (user.email && user.email.toLowerCase() === "admin@gmail.com") {
            const tenantId = "admin_tenant_gmail";
            
            await seedGlobalRoles();
            
            await setDoc(doc(db, "tenants", tenantId), {
              companyName: "Main Plant Operations",
              subscriptionPlan: "ENTERPRISE",
              status: "ACTIVE",
              createdAt: Timestamp.now()
            });
            
            userData = {
              tenantId,
              displayName: "Super Admin",
              email: "admin@gmail.com",
              roleId: "tenant_admin",
              role: "admin",
              status: "active",
              requirePasswordChange: false,
              createdAt: Timestamp.now()
            };
            await setDoc(userDocRef, userData);
            userData.id = user.uid;
            
            const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
            if (tenantDoc.exists()) {
              tenantData = { id: tenantDoc.id, ...tenantDoc.data() };
            }
            
            const roleDoc = await getDoc(doc(db, "roles", "tenant_admin"));
            if (roleDoc.exists()) {
              roleData = { id: roleDoc.id, ...roleDoc.data() };
            }
          } else {
            onStateChanged(null, null, null, null);
            return;
          }
          
          if (userData && userData.status === "active") {
            onStateChanged(user, userData, tenantData, roleData);
            return;
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
      }
      onStateChanged(null, null, null, null);
    });
  }
}

/**
 * Updates password of the currently logged-in user
 */
export async function updateUserPassword(newPassword) {
  if (isMockMode) {
    const uid = localStorage.getItem("mock_session_uid");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index === -1) throw new Error("No active mock session.");
    
    users[index].requirePasswordChange = false;
    users[index].password = newPassword; // Save the updated password locally
    localStorage.setItem("users", JSON.stringify(users));
    window.dispatchEvent(new Event("storage"));
  } else {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated session found.");
    
    // 1. Update password in Auth SDK
    await updatePassword(user, newPassword);
    
    // 2. Update requirePasswordChange flag in Firestore doc
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { requirePasswordChange: false });
  }
}

/**
 * Fetch all pending password reset requests
 */
export async function getPendingPasswordResets() {
  if (isMockMode) {
    const resets = JSON.parse(localStorage.getItem("password_resets") || "[]");
    return resets.filter(r => r.status === "PENDING");
  } else {
    const q = query(
      collection(db, "password_resets"),
      where("status", "==", "PENDING")
    );
    const snapshot = await getDocs(q);
    
    const results = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      let displayName = "Unknown User";
      
      // Look up user document by email
      try {
        const uQ = query(collection(db, "users"), where("email", "==", data.email));
        const uSnap = await getDocs(uQ);
        if (!uSnap.empty) {
          displayName = uSnap.docs[0].data().displayName || "User";
        }
      } catch (err) {
        console.error("Error fetching display name for reset request:", err);
      }
      
      results.push({
        id: docSnap.id,
        ...data,
        name: displayName,
        requestedAt: data.requestedAt ? data.requestedAt.toDate().toISOString() : null
      });
    }
    return results;
  }
}

/**
 * Approve a password reset request and trigger the reset email
 */
export async function approvePasswordReset(requestId, tempPassword) {
  if (isMockMode) {
    const resets = JSON.parse(localStorage.getItem("password_resets") || "[]");
    const index = resets.findIndex(r => r.id === requestId);
    if (index === -1) {
      throw new Error("Reset request not found.");
    }
    const resetData = resets[index];

    // Find and update mock user's credentials
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex(u => u.email.toLowerCase() === resetData.email.toLowerCase());
    if (userIndex !== -1) {
      users[userIndex].password = tempPassword || "welcome123";
      users[userIndex].requirePasswordChange = true;
      localStorage.setItem("users", JSON.stringify(users));
    }

    // Delete the reset request from resets list
    resets.splice(index, 1);
    localStorage.setItem("password_resets", JSON.stringify(resets));
    window.dispatchEvent(new Event("storage"));
    return true;
  } else {
    // Call the secure Firebase cloud function to update Auth credentials and database flags
    const adminApprovePasswordResetFunc = httpsCallable(functions, "adminApprovePasswordReset");
    await adminApprovePasswordResetFunc({ requestId, tempPassword });
    return true;
  }
}

/**
 * Delete a password reset request without resetting the password (Admin only)
 */
export async function deletePasswordReset(requestId) {
  if (isMockMode) {
    const resets = JSON.parse(localStorage.getItem("password_resets") || "[]");
    const index = resets.findIndex(r => r.id === requestId);
    if (index !== -1) {
      resets.splice(index, 1);
      localStorage.setItem("password_resets", JSON.stringify(resets));
      window.dispatchEvent(new Event("storage"));
    }
    return true;
  } else {
    const adminDeletePasswordResetFunc = httpsCallable(functions, "adminDeletePasswordReset");
    await adminDeletePasswordResetFunc({ requestId });
    return true;
  }
}

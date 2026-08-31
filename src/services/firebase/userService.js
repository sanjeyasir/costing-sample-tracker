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
import { db, functions, isMockMode } from "./config";
import { initializeLocalStorageState } from "./mockData";
import { httpsCallable } from "firebase/functions";

if (isMockMode) {
  initializeLocalStorageState();
}

/**
 * Fetch all registered user accounts
 */
export async function getUsers() {
  if (isMockMode) {
    return JSON.parse(localStorage.getItem("users") || "[]");
  } else {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  }
}

/**
 * Update user role (Admin only)
 */
export async function updateUserRole(uid, role) {
  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index].role = role;
      localStorage.setItem("users", JSON.stringify(users));
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { role });
  }
}

/**
 * Update user module specific roles (Admin only)
 */
export async function updateUserModuleRoles(uid, costingRoles, sampleRoles) {
  const costingRolesArray = Array.isArray(costingRoles) ? costingRoles : (costingRoles ? [costingRoles] : []);
  const sampleRolesArray = Array.isArray(sampleRoles) ? sampleRoles : (sampleRoles ? [sampleRoles] : []);
  const roleArray = [...costingRolesArray, ...sampleRolesArray].filter(r => r && r !== "none");

  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index].costingRoles = costingRolesArray;
      users[index].sampleRoles = sampleRolesArray;
      users[index].costingRole = costingRolesArray[0] || "none";
      users[index].sampleRole = sampleRolesArray[0] || "none";
      users[index].role = roleArray;
      localStorage.setItem("users", JSON.stringify(users));
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { 
      costingRoles: costingRolesArray, 
      sampleRoles: sampleRolesArray,
      costingRole: costingRolesArray[0] || "none", 
      sampleRole: sampleRolesArray[0] || "none",
      role: roleArray
    });
  }
}

/**
 * Update user status - active/inactive (Admin only)
 */
export async function updateUserStatus(uid, status) {
  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index].status = status;
      localStorage.setItem("users", JSON.stringify(users));
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { status });
  }
}

/**
 * Creates a new user account (Admin only)
 */
export async function createUser(userData) {
  const { email, password, displayName, costingRoles, sampleRoles, phoneNumber, whatsappEnabled } = userData;
  const costingRolesArray = Array.isArray(costingRoles) ? costingRoles : (costingRoles ? [costingRoles] : []);
  const sampleRolesArray = Array.isArray(sampleRoles) ? sampleRoles : (sampleRoles ? [sampleRoles] : []);
  const roleArray = [...costingRolesArray, ...sampleRolesArray].filter(r => r && r !== "none");

  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    
    // Check if email already registered
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("auth/email-already-in-use: This email address is already registered.");
    }
    
    const newUid = `mock-usr-${Date.now()}`;
    const newUser = {
      uid: newUid,
      email,
      displayName,
      phoneNumber: phoneNumber || "",
      whatsappEnabled: !!whatsappEnabled,
      costingRoles: costingRolesArray,
      sampleRoles: sampleRolesArray,
      costingRole: costingRolesArray[0] || "none",
      sampleRole: sampleRolesArray[0] || "none",
      role: roleArray,
      status: "active",
      requirePasswordChange: true,
      password, // Save temporary password for first login validation
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));
    window.dispatchEvent(new Event("storage"));
    
    return { success: true, uid: newUid };
  } else {
    const adminCreateUserFunc = httpsCallable(functions, "adminCreateUser");
    const result = await adminCreateUserFunc({ 
      email, 
      password, 
      displayName, 
      phoneNumber: phoneNumber || "",
      whatsappEnabled: !!whatsappEnabled,
      costingRoles: costingRolesArray, 
      sampleRoles: sampleRolesArray, 
      costingRole: costingRolesArray[0] || "none", 
      sampleRole: sampleRolesArray[0] || "none", 
      role: roleArray 
    });
    return result.data;
  }
}

/**
 * Update user profile details (Admin only)
 */
export async function updateUserProfile(uid, profileData) {
  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index] = { ...users[index], ...profileData };
      localStorage.setItem("users", JSON.stringify(users));
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, profileData);
  }
}

/**
 * Fetch all registered user roles (with defaults fallback)
 */
export async function getUserRoles() {
  const defaultRoles = [
    // Costing roles
    { id: "costing_marketing", name: "Marketing Team", module: "costing", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "costing_finance", name: "Finance Team", module: "costing", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "costing_viewer", name: "Costing Viewer", module: "costing", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },

    // Sample roles
    { id: "sample_marketing", name: "Marketing Team", module: "sample", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "sample_sampling", name: "Sampling Team", module: "sample", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "sample_viewer", name: "Sample Viewer", module: "sample", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },

    // Admin
    { id: "admin", name: "System Administrator", module: "global", permissions: ["costing", "sample"], createdAt: new Date(2026, 7, 1).toISOString() }
  ];

  if (isMockMode) {
    let roles = JSON.parse(localStorage.getItem("userRoles"));
    if (!roles || roles.length === 0 || !roles.some(r => r.id.startsWith("costing_"))) {
      roles = defaultRoles;
      localStorage.setItem("userRoles", JSON.stringify(roles));
    }
    return roles;
  } else {
    try {
      const q = query(collection(db, "userRoles"), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (roles.length === 0) {
        // Seed default roles if empty in firestore
        for (const role of defaultRoles) {
          const docRef = doc(db, "userRoles", role.id);
          await setDoc(docRef, { name: role.name, module: role.module, permissions: role.permissions, createdAt: Timestamp.now() });
        }
        localStorage.setItem("userRoles", JSON.stringify(defaultRoles));
        return defaultRoles;
      }
      localStorage.setItem("userRoles", JSON.stringify(roles));
      return roles;
    } catch (err) {
      console.error("Error fetching user roles, falling back:", err);
      return defaultRoles;
    }
  }
}

/**
 * Create a new user role (Admin only)
 */
export async function createUserRole(role) {
  const id = role.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  if (!id) {
    throw new Error("Invalid role name. Must contain alphanumeric characters.");
  }

  if (isMockMode) {
    const roles = await getUserRoles();
    if (roles.some(r => r.id === id)) {
      throw new Error("Role already exists.");
    }
    const newRole = {
      id,
      name: role.name.trim(),
      module: role.module || "global",
      roleType: role.roleType || "creator",
      permissions: role.permissions || [],
      createdAt: new Date().toISOString()
    };
    roles.push(newRole);
    localStorage.setItem("userRoles", JSON.stringify(roles));
    window.dispatchEvent(new Event("storage"));
    return newRole;
  } else {
    const docRef = doc(db, "userRoles", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      throw new Error("Role already exists.");
    }
    const newRole = {
      name: role.name.trim(),
      module: role.module || "global",
      roleType: role.roleType || "creator",
      permissions: role.permissions || [],
      createdAt: Timestamp.now()
    };
    await setDoc(docRef, newRole);
    return { id, ...newRole };
  }
}

/**
 * Delete a user role (Admin only)
 */
export async function deleteUserRole(roleId) {
  // Protect admin role from deletion
  if (roleId === "admin") {
    throw new Error("System Administrator role cannot be deleted.");
  }

  if (isMockMode) {
    let roles = await getUserRoles();
    roles = roles.filter(r => r.id !== roleId);
    localStorage.setItem("userRoles", JSON.stringify(roles));
    window.dispatchEvent(new Event("storage"));
  } else {
    const docRef = doc(db, "userRoles", roleId);
    await deleteDoc(docRef);
  }
}

/**
 * Update user role details (Admin only)
 */
export async function updateUserRoleDetails(roleId, updatedData) {
  if (isMockMode) {
    const roles = await getUserRoles();
    const index = roles.findIndex(r => r.id === roleId);
    if (index !== -1) {
      roles[index].name = updatedData.name.trim();
      roles[index].permissions = updatedData.permissions || [];
      localStorage.setItem("userRoles", JSON.stringify(roles));
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "userRoles", roleId);
    await updateDoc(docRef, {
      name: updatedData.name.trim(),
      permissions: updatedData.permissions || []
    });
  }
}

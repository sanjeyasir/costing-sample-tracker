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
  let userList = [];
  if (isMockMode) {
    userList = JSON.parse(localStorage.getItem("users") || "[]");
  } else {
    const snapshot = await getDocs(collection(db, "users"));
    userList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  }

  // Ensure every user has productionRoles appropriately set
  return userList.map(u => {
    let prodRoles = u.productionRoles || (u.productionRole && u.productionRole !== "none" ? [u.productionRole] : []);
    if (!prodRoles || prodRoles.length === 0) {
      if (u.email === "admin@gmail.com" || u.role === "admin" || (u.costingRoles && u.costingRoles.includes("admin"))) {
        prodRoles = ["production_all"];
      } else if (u.email?.includes("factory") || u.role === "factory") {
        prodRoles = ["production_factory"];
      } else if (
        (u.costingRoles && u.costingRoles.includes("costing_marketing")) ||
        (u.sampleRoles && u.sampleRoles.includes("sample_marketing")) ||
        u.role === "marketing"
      ) {
        prodRoles = ["production_marketing"];
      } else {
        prodRoles = ["production_viewer"];
      }
    }
    return {
      ...u,
      productionRoles: prodRoles,
      productionRole: prodRoles[0] || "production_viewer"
    };
  });
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
export async function updateUserModuleRoles(uid, costingRoles, sampleRoles, productionRoles = []) {
  const costingRolesArray = Array.isArray(costingRoles) ? costingRoles : (costingRoles ? [costingRoles] : []);
  const sampleRolesArray = Array.isArray(sampleRoles) ? sampleRoles : (sampleRoles ? [sampleRoles] : []);
  const productionRolesArray = Array.isArray(productionRoles) ? productionRoles : (productionRoles ? [productionRoles] : []);
  const roleArray = [...costingRolesArray, ...sampleRolesArray, ...productionRolesArray].filter(r => r && r !== "none");

  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index].costingRoles = costingRolesArray;
      users[index].sampleRoles = sampleRolesArray;
      users[index].productionRoles = productionRolesArray;
      users[index].costingRole = costingRolesArray[0] || "none";
      users[index].sampleRole = sampleRolesArray[0] || "none";
      users[index].productionRole = productionRolesArray[0] || "none";
      users[index].role = roleArray;
      localStorage.setItem("users", JSON.stringify(users));
      window.dispatchEvent(new Event("storage"));
    }
  } else {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, { 
      costingRoles: costingRolesArray, 
      sampleRoles: sampleRolesArray,
      productionRoles: productionRolesArray,
      costingRole: costingRolesArray[0] || "none", 
      sampleRole: sampleRolesArray[0] || "none",
      productionRole: productionRolesArray[0] || "none",
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
  const { email, password, displayName, costingRoles, sampleRoles, productionRoles, phoneNumber, whatsappEnabled } = userData;
  const costingRolesArray = Array.isArray(costingRoles) ? costingRoles : (costingRoles ? [costingRoles] : []);
  const sampleRolesArray = Array.isArray(sampleRoles) ? sampleRoles : (sampleRoles ? [sampleRoles] : []);
  const productionRolesArray = Array.isArray(productionRoles) ? productionRoles : (productionRoles ? [productionRoles] : []);
  const roleArray = [...costingRolesArray, ...sampleRolesArray, ...productionRolesArray].filter(r => r && r !== "none");

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
      productionRoles: productionRolesArray,
      costingRole: costingRolesArray[0] || "none",
      sampleRole: sampleRolesArray[0] || "none",
      productionRole: productionRolesArray[0] || "none",
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
      productionRoles: productionRolesArray,
      costingRole: costingRolesArray[0] || "none", 
      sampleRole: sampleRolesArray[0] || "none", 
      productionRole: productionRolesArray[0] || "none",
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
    { id: "costing_marketing", name: "Marketing Team", module: "costing", roleType: "creator", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "costing_finance", name: "Finance Team", module: "costing", roleType: "analyst", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "costing_viewer", name: "Costing Viewer", module: "costing", roleType: "viewer", permissions: ["costing"], createdAt: new Date(2026, 7, 1).toISOString() },

    // Sample roles
    { id: "sample_marketing", name: "Marketing Team", module: "sample", roleType: "creator", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "sample_sampling", name: "Sampling Team", module: "sample", roleType: "developer", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "sample_viewer", name: "Sample Viewer", module: "sample", roleType: "viewer", permissions: ["sample"], createdAt: new Date(2026, 7, 1).toISOString() },

    // Production Forecast roles (4 Distinct Views)
    { id: "production_all", name: "👑 Full Management (All Fields Editable)", module: "production", roleType: "administrator", permissions: ["production"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "production_marketing", name: "📈 Marketing Team (Actuals Only)", module: "production", roleType: "creator", permissions: ["production"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "production_factory", name: "🏭 Factory Team (Factory Perf & Confirmed)", module: "production", roleType: "developer", permissions: ["production"], createdAt: new Date(2026, 7, 1).toISOString() },
    { id: "production_viewer", name: "👁️ Read-Only View (Auditor / Executive)", module: "production", roleType: "viewer", permissions: ["production"], createdAt: new Date(2026, 7, 1).toISOString() },

    // Admin
    { id: "admin", name: "System Administrator", module: "global", roleType: "administrator", permissions: ["costing", "sample", "production"], createdAt: new Date(2026, 7, 1).toISOString() }
  ];

  if (isMockMode) {
    let roles = JSON.parse(localStorage.getItem("userRoles") || "[]");
    const roleIds = new Set(roles.map(r => r.id));
    let hasMissing = false;
    defaultRoles.forEach(dr => {
      if (!roleIds.has(dr.id)) {
        roles.push(dr);
        hasMissing = true;
      }
    });
    if (hasMissing || roles.length === 0) {
      localStorage.setItem("userRoles", JSON.stringify(roles));
    }
    return roles;
  } else {
    try {
      const q = query(collection(db, "userRoles"), orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const roleIds = new Set(roles.map(r => r.id));

      // Auto-seed any missing default roles (such as production_all, production_marketing, production_factory, production_viewer)
      for (const role of defaultRoles) {
        if (!roleIds.has(role.id)) {
          const docRef = doc(db, "userRoles", role.id);
          await setDoc(docRef, { 
            name: role.name, 
            module: role.module, 
            roleType: role.roleType, 
            permissions: role.permissions, 
            createdAt: Timestamp.now() 
          });
          roles.push(role);
        }
      }

      localStorage.setItem("userRoles", JSON.stringify(roles));
      return roles;
    } catch (err) {
      console.error("Error fetching user roles, falling back to defaults:", err);
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

/**
 * Update Sales Officer Profile for a user
 */
export async function updateUserSalesOfficerProfile(uid, profileData) {
  if (!uid) throw new Error("Missing user ID");

  if (isMockMode) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const index = users.findIndex(u => u.uid === uid);
    if (index !== -1) {
      users[index].salesOfficerProfile = {
        ...(users[index].salesOfficerProfile || {}),
        ...profileData,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem("users", JSON.stringify(users));
      window.dispatchEvent(new Event("storage"));
      return users[index].salesOfficerProfile;
    }
    throw new Error("User not found in mock storage.");
  } else {
    const docRef = doc(db, "users", uid);
    const payload = {
      salesOfficerProfile: {
        ...profileData,
        updatedAt: Timestamp.now()
      }
    };
    await updateDoc(docRef, payload);
    return profileData;
  }
}

/**
 * Get list of available Sales Officers across users and defaults
 */
export async function getSalesOfficers() {
  const users = await getUsers();
  const officers = [];

  // Default system marketing officer if no customized officers exist
  const defaultOfficer = {
    id: "default-manura",
    userId: null,
    name: "Manura Mohotti",
    designation: "Manager Marketing",
    companyName: "Toyo Cushion Lanka Pvt Ltd",
    address: "Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka",
    contact: "+9474 216 8231",
    email: "Manura.Mohotti@hayleysfibre.com",
    country: "Sri Lanka",
    originCity: "COLOMBO, SRI LANKA",
    signatureText: "Manura Mohotti",
    signatureBase64: "",
    signatureUrl: ""
  };

  users.forEach(u => {
    if (u.salesOfficerProfile && u.salesOfficerProfile.name) {
      officers.push({
        id: u.uid,
        userId: u.uid,
        ...u.salesOfficerProfile
      });
    } else if (
      (u.costingRoles && u.costingRoles.includes("costing_marketing")) ||
      (u.sampleRoles && u.sampleRoles.includes("sample_marketing")) ||
      u.role === "marketing" ||
      u.displayName
    ) {
      // Create a sensible officer record from user profile
      officers.push({
        id: u.uid,
        userId: u.uid,
        name: u.displayName || u.email?.split("@")?.[0] || "Marketing Officer",
        designation: "Marketing Officer",
        companyName: "Toyo Cushion Lanka Pvt Ltd",
        address: "Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka",
        contact: u.phoneNumber || "+9474 216 8231",
        email: u.email || "",
        country: "Sri Lanka",
        originCity: "COLOMBO, SRI LANKA",
        signatureText: u.displayName || "Authorized Signatory",
        signatureBase64: "",
        signatureUrl: ""
      });
    }
  });

  // Ensure default officer is present if empty
  if (officers.length === 0) {
    officers.push(defaultOfficer);
  }

  return officers;
}


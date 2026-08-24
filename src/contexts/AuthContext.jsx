import React, { createContext, useContext, useEffect, useState } from "react";
import * as authService from "../services/firebase/authService";
import * as userService from "../services/firebase/userService";
import { isMockMode } from "../services/firebase/config";
import { Spin } from "antd";
import { useAuthStore } from "../store/authStore";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { user, profile, tenant, role, loading, setAuth, clearAuth } = useAuthStore();
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.subscribeAuthState(async (usr, prof, ten, rl) => {
      if (usr) {
        try {
          await userService.getUserRoles();
        } catch (err) {
          console.error("Failed to sync user roles on auth change:", err);
        }
        setAuth(usr, prof, ten, rl);
        setRolesLoaded(true);
      } else {
        clearAuth();
        setRolesLoaded(true);
      }
    });

    return () => unsubscribe();
  }, [setAuth, clearAuth]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    try {
      await userService.getUserRoles();
    } catch (err) {
      console.error("Failed to fetch roles after login:", err);
    }
    setAuth(res.user, res.profile, res.tenant, res.role);
    return res.profile;
  };

  const logout = async () => {
    try {
      await authService.logout();
      clearAuth();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const resetPassword = async (email) => {
    return await authService.resetPassword(email);
  };

  // Map to legacy currentUser structure for costing page compatibility
  const storedRoles = JSON.parse(localStorage.getItem("userRoles") || "[]");
  
  let rawCostingRoles = profile?.costingRoles || (profile?.costingRole ? [profile.costingRole] : []);
  let rawSampleRoles = profile?.sampleRoles || (profile?.sampleRole ? [profile.sampleRole] : []);

  if (profile?.email === "admin@gmail.com") {
    rawCostingRoles = ["admin"];
    rawSampleRoles = ["admin"];
  }

  // Resolve costing roles
  const costingRoles = rawCostingRoles.map(rId => {
    if (rId === "admin" || rId === "none" || rId === "costing_marketing" || rId === "costing_finance" || rId === "costing_viewer") {
      return rId;
    }
    const customRole = storedRoles.find(r => r.id === rId);
    if (customRole && customRole.module === "costing") {
      if (customRole.roleType === "creator") return "costing_marketing";
      if (customRole.roleType === "analyst") return "costing_finance";
      if (customRole.roleType === "viewer") return "costing_viewer";
    }
    return rId;
  }).filter(r => r && r !== "none");

  // Resolve sample roles
  const sampleRoles = rawSampleRoles.map(rId => {
    if (rId === "admin" || rId === "none" || rId === "sample_marketing" || rId === "sample_sampling" || rId === "sample_viewer") {
      return rId;
    }
    const customRole = storedRoles.find(r => r.id === rId);
    if (customRole && customRole.module === "sample") {
      if (customRole.roleType === "creator") return "sample_marketing";
      if (customRole.roleType === "developer") return "sample_sampling";
      if (customRole.roleType === "viewer") return "sample_viewer";
    }
    return rId;
  }).filter(r => r && r !== "none");

  const userRoles = [...costingRoles, ...sampleRoles];
  if (profile?.email === "admin@gmail.com" && !userRoles.includes("admin")) {
    userRoles.push("admin");
  }

  const currentUser = profile ? {
    uid: user?.uid,
    email: user?.email || profile?.email || "",
    displayName: profile.displayName || profile.name || "User",
    costingRoles,
    sampleRoles,
    costingRole: costingRoles[0] || "none",
    sampleRole: sampleRoles[0] || "none",
    role: costingRoles[0] !== "none" ? costingRoles[0] : (sampleRoles[0] || "none"),
    roles: userRoles,
    status: profile.status,
    requirePasswordChange: profile.requirePasswordChange || profile.isFirstLogin || false
  } : null;

  const value = {
    currentUser,
    loading,
    login,
    logout,
    resetPassword,
    tenant,
    role,
    costingRole: costingRoles[0] || "none",
    sampleRole: sampleRoles[0] || "none",
    isMockMode
  };

  return (
    <AuthContext.Provider value={value}>
      {loading || !rolesLoaded ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#080c14" }}>
          <Spin size="large" tip="Loading session..." style={{ color: "#6366f1" }} />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

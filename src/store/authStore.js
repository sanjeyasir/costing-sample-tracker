import { create } from "zustand";

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  tenant: null,
  role: null,
  costingRole: null,
  sampleRole: null,
  loading: true,

  setAuth: (user, profile, tenant, role) => {
    const costingRole = profile?.costingRole || (profile?.email === "admin@gmail.com" ? "admin" : "none");
    const sampleRole = profile?.sampleRole || (profile?.email === "admin@gmail.com" ? "admin" : "none");
    set({ user, profile, tenant, role, costingRole, sampleRole, loading: false });
  },
    
  setLoading: (loading) => set({ loading }),
  
  clearAuth: () => 
    set({ user: null, profile: null, tenant: null, role: null, costingRole: null, sampleRole: null, loading: false }),

  hasPermission: (module, action) => {
    const { profile, costingRole, sampleRole } = get();
    if (!profile) return false;
    
    // admin@gmail.com has absolute access
    if (profile.email === "admin@gmail.com" || costingRole === "admin" || sampleRole === "admin") return true;
    
    const userModuleRole = module === "costing" ? costingRole : (module === "sample" ? sampleRole : "");
    if (!userModuleRole || userModuleRole === "none") return false;
    
    const permissions = profile.permissions || [];
    const permissionKey = `${module}:${action}`;
    const allKey = `${module}:*`;
    
    return permissions.includes(permissionKey) || permissions.includes(allKey) || permissions.includes("*:*") || userModuleRole !== "none";
  }
}));

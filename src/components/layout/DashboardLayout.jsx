import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { toggleMockMode } from "../../services/firebase/config";
import { Layout, Menu, Button, Avatar, Badge, Dropdown, Space, Tooltip, Tag, Alert, Drawer, Grid, Typography, Card } from "antd";
import {
  MenuOutlined,
  DashboardOutlined,
  UnorderedListOutlined,
  PlusCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  TagsOutlined,
  SettingOutlined,
  BellOutlined,
  LogoutOutlined,
  CloudOutlined,
  CloudSyncOutlined,
  HomeOutlined,
  FileTextOutlined,
  BarChartOutlined,
  BranchesOutlined
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

export default function DashboardLayout({ children }) {
  const { currentUser, logout, isMockMode, tenant, role } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const activeNotifications = notifications.filter(n => !n.read && !(n.readBy && n.readBy.includes(currentUser?.uid)));
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  
  const isMobile = !screens.md;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    
    const id = notif.costRequestId || notif.sampleRequestId || notif.requestId;
    if (!id) {
      navigate("/dashboard");
      return;
    }

    const isSample = 
      id.toString().startsWith("sreq-") || 
      (notif.message && notif.message.toLowerCase().includes("sample")) ||
      notif.sampleRequestId;

    if (isSample) {
      navigate(`/requests/${id}`);
    } else {
      navigate(`/costing-requests/${id}`);
    }
  };

  const costingRoles = currentUser?.costingRoles || [];
  const sampleRoles = currentUser?.sampleRoles || [];
  const userRoles = currentUser?.roles || [];
  const isAdmin = userRoles.includes("admin") || costingRoles.includes("admin") || sampleRoles.includes("admin");

  const hasCostingAccess = isAdmin || (costingRoles.length > 0 && !costingRoles.includes("none"));
  const hasSampleAccess = isAdmin || (sampleRoles.length > 0 && !sampleRoles.includes("none"));

  const menuItems = [];

  // 1. Dashboard (Always visible)
  menuItems.push({ label: "Dashboard", key: "/dashboard", icon: <DashboardOutlined /> });

  // 1b. Notifications Center (Always visible)
  menuItems.push({ label: "Notifications", key: "/notifications", icon: <BellOutlined /> });

  // 2. Costing Section (visible if has costing access)
  if (hasCostingAccess) {
    const costingChildren = [
      { label: "Costing Requests", key: "/costing-requests" }
    ];
    if (isAdmin || costingRoles.includes("costing_marketing")) {
      costingChildren.push({ label: "Create Costing", key: "/costing-requests/create" });
    }
    if (isAdmin) {
      costingChildren.push({ label: "Product Categories", key: "/admin/categories" });
    }
    menuItems.push({
      label: "Costing Management",
      key: "costing-group",
      icon: <FileTextOutlined />,
      children: costingChildren
    });
  }

  // 3. Sample Section (visible if has sample access)
  if (hasSampleAccess) {
    menuItems.push({
      label: "Sample Requisitions",
      key: "sample-requests-group",
      icon: <UnorderedListOutlined />,
      children: [
        { label: "All Requests", key: "/requests" },
        { label: "New Requests", key: "/requests?status=Submitted" },
        { label: "Awaiting Marketing", key: "/requests?status=Request%20for%20Resubmission" },
        { label: "In Progress", key: "/requests?status=In%20Progress" },
        { label: "Due Today", key: "/requests?due=today" },
        { label: "Overdue", key: "/requests?status=Overdue" },
        { label: "Completed", key: "/requests?status=Completed" }
      ]
    });
    menuItems.push({ label: "Sample Reports", key: "/reports", icon: <BarChartOutlined /> });
  }

  // 4. Administration Section (visible to admin)
  if (isAdmin) {
    menuItems.push({
      type: "group",
      label: "Administration",
      children: [
        { label: "User Management", key: "/admin/users", icon: <TeamOutlined /> },
        { label: "System Settings", key: "/admin/settings", icon: <SettingOutlined /> }
      ]
    });
  }

  const filteredMenuItems = menuItems;

  const getRoleLabel = (role) => {
    switch (role) {
      case "admin": return "Administrator";
      case "costing_marketing": return "Marketing Team";
      case "costing_finance": return "Finance Team";
      case "costing_viewer": return "Costing Viewer";
      case "sample_marketing": return "Marketing Team";
      case "sample_sampling": return "Sampling Team";
      case "sample_viewer": return "Sample Viewer";
      case "none": return "No Access";
      default: return role || "User";
    }
  };

  const getRoleColor = (role) => {
    if (role === "admin") return "red";
    if (role?.startsWith("costing_")) return "purple";
    if (role?.startsWith("sample_")) return "blue";
    return "default";
  };



  async function markAllAllRead() {
    await markAllAsRead();
  }

  // Handle menu selection and route navigation
  const handleMenuClick = (info) => {
    navigate(info.key);
    if (isMobile) setMobileOpen(false);
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith("/requests/create")) return "/requests/create";
    if (path.startsWith("/requests/")) return "/requests";
    return path;
  };

  const sidebarContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", color: "#0f172a" }}>
      {/* Brand Header */}
      <div style={{ padding: collapsed ? "16px 0" : "24px 20px", display: "flex", justifyContent: collapsed ? "center" : "flex-start", alignItems: "center", gap: 12 }}>
        <Avatar style={{ backgroundColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }} icon={<BranchesOutlined />} />
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem", lineHeight: 1.1 }}>
              Hayfibre Ops
            </div>
            <div style={{ color: "#64748b", fontSize: "0.7rem", letterSpacing: "0.05em", marginTop: 2 }}>
              MARKETING HUB
            </div>
          </div>
        )}
      </div>
      
      <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: 0 }} />
      
      {/* Menu Options */}
      <div style={{ flexGrow: 1, overflowY: "auto", padding: "12px 8px" }}>
        <Menu
          mode="inline"
          theme="light"
          inlineCollapsed={collapsed}
          selectedKeys={[getSelectedKey()]}
          onClick={handleMenuClick}
          items={filteredMenuItems}
          style={{ background: "transparent", border: "none" }}
        />
      </div>

      <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: 0 }} />

      {/* User Footer Profile */}
      <div style={{ padding: collapsed ? "12px" : "20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!collapsed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700 }}>
              {currentUser?.displayName 
                ? currentUser.displayName[0].toUpperCase() 
                : (currentUser?.email ? currentUser.email[0].toUpperCase() : "U")}
            </Avatar>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>
                {currentUser?.displayName || currentUser?.email?.split("@")?.[0] || "User"}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                {currentUser?.email}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Avatar style={{ backgroundColor: "#10b981", fontWeight: 700 }}>
              {currentUser?.displayName 
                ? currentUser.displayName[0].toUpperCase() 
                : (currentUser?.email ? currentUser.email[0].toUpperCase() : "U")}
            </Avatar>
          </div>
        )}
        <Button 
          type="default" 
          danger 
          icon={<LogoutOutlined />} 
          onClick={logout} 
          style={{ background: "rgba(239, 68, 68, 0.04)", borderColor: "rgba(239, 68, 68, 0.15)", width: "100%", padding: collapsed ? 0 : "4px 15px" }}
        >
          {!collapsed && "Sign Out"}
        </Button>
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Desktop Sider */}
      {!isMobile && (
        <Sider
          width={260}
          collapsedWidth={80}
          collapsible
          collapsed={collapsed}
          trigger={null}
          style={{
            position: "fixed",
            height: "100vh",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            background: "#ffffff",
            borderRight: "1px solid #e2e8f0"
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        styles={{ body: { padding: 0, background: "#ffffff" } }}
        width={260}
      >
        {sidebarContent}
      </Drawer>

      <Layout style={{ 
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 260), 
        marginRight: isMobile ? 0 : 320,
        minHeight: "100vh", 
        display: "flex", 
        flexDirection: "column",
        transition: "all 0.2s"
      }}>
        {/* Top Header */}
        <Header
          style={{
            padding: "0 24px",
            background: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #e2e8f0",
            position: "fixed",
            top: 0,
            right: isMobile ? 0 : 320,
            left: isMobile ? 0 : (collapsed ? 80 : 260),
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            transition: "all 0.2s"
          }}
        >
          <Space size="middle">
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileOpen(!mobileOpen)}
                style={{ fontSize: "16px", width: 40, height: 40, color: "#0f172a" }}
              />
            ) : (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: "16px", width: 40, height: 40, color: "#0f172a" }}
              />
            )}
            <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "#10b981", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8 }}>
              <BranchesOutlined style={{ fontSize: 18 }} />
              Hayfibre Marketing Operations
            </span>

            {/* Tenant Display */}
            {tenant && (
              <Tag icon={<HomeOutlined />} color="success" style={{ margin: 0, display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6 }}>
                {tenant.companyName}
              </Tag>
            )}
          </Space>

          <Space size="middle">
            {/* Mock Mode Status Toggle */}
            <Tooltip title={isMockMode ? "Click to use Firebase (requires credentials)" : "Click to use Offline Mock Mode"}>
              <Tag
                icon={isMockMode ? <CloudSyncOutlined /> : <CloudOutlined />}
                color={isMockMode ? "warning" : "success"}
                onClick={() => toggleMockMode(!isMockMode)}
                style={{ cursor: "pointer", fontWeight: 700, padding: "4px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}
              >
                {isMockMode ? "Mock Mode" : "Firebase Connected"}
              </Tag>
            </Tooltip>

            {/* Role Badges */}
            {isAdmin && (
              <Tag color="red" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em", padding: "1px 8px", margin: 0 }}>
                ADMIN
              </Tag>
            )}
            {!isAdmin && costingRoles.length > 0 && (
              <Tag color="purple" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em", padding: "1px 8px", margin: 0 }}>
                Costing: {costingRoles.map(r => getRoleLabel(r)).join(", ")}
              </Tag>
            )}
            {!isAdmin && sampleRoles.length > 0 && (
              <Tag color="blue" style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.05em", padding: "1px 8px", margin: 0 }}>
                Sample: {sampleRoles.map(r => getRoleLabel(r)).join(", ")}
              </Tag>
            )}

            {/* Notifications Bell (Drawer Toggle - Mobile Only) */}
            {isMobile && (
              <Badge count={notifications.filter(n => !n.read && !(n.readBy && n.readBy.includes(currentUser?.uid))).length} overflowCount={9} style={{ backgroundColor: "#ef4444" }}>
                <Button 
                  shape="circle" 
                  icon={<BellOutlined />} 
                  onClick={() => setNotificationsOpen(true)}
                  style={{ border: "1px solid #cbd5e1", background: "transparent", color: "#0f172a" }}
                />
              </Badge>
            )}
          </Space>
        </Header>

        {/* Content area */}
        <Content
          style={{
            margin: "88px 24px 24px 24px",
            flexGrow: 1,
            display: "flex",
            flexDirection: "column"
          }}
        >
          {isMockMode && (
            <Alert
              message="Running in Local Mock Mode. Active collections persist only in your browser storage. You can log in using marketing@costing.com, finance@costing.com, or admin@costing.com with any password."
              type="warning"
              showIcon
              style={{ marginBottom: 24, borderRadius: 10 }}
            />
          )}
          
          <div style={{ flexGrow: 1 }}>
            {children}
          </div>
        </Content>
      </Layout>

      {/* Permanent Right Notifications Panel (visible on desktop) */}
      {!isMobile && (
        <div style={{
          width: 320,
          background: "#ffffff",
          borderLeft: "1px solid #e2e8f0",
          height: "100vh",
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                Notifications ({activeNotifications.length})
              </span>
              {activeNotifications.length > 0 && (
                <Button type="link" size="small" onClick={markAllAsRead} style={{ padding: 0, fontSize: "0.75rem" }}>
                  Mark all read
                </Button>
              )}
            </div>
            <div style={{ flexGrow: 1, overflowY: "auto" }}>
              {activeNotifications.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <BellOutlined style={{ fontSize: 32, color: "#cbd5e1", marginBottom: 12 }} />
                  <div><Text type="secondary" style={{ fontSize: "0.85rem" }}>No new notifications.</Text></div>
                </div>
              ) : (
                activeNotifications.map((notif) => {
                  const isRead = notif.read || (notif.readBy && notif.readBy.includes(currentUser?.uid));
                  return (
                    <div
                      key={notif.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #f1f5f9",
                        background: isRead ? "#f8fafc" : "#ffffff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                        transition: "all 0.2s"
                      }}
                    >
                      <div 
                        onClick={() => handleNotificationClick(notif)}
                        style={{ cursor: "pointer", flexGrow: 1 }}
                      >
                        <div style={{ 
                          fontWeight: isRead ? 500 : 700, 
                          fontSize: "0.82rem", 
                          color: isRead ? "#64748b" : "#0f172a", 
                          lineHeight: 1.35,
                          textDecoration: isRead ? "line-through" : "none" 
                        }}>
                          {notif.message}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      {!isRead && (
                        <Tooltip title="Mark as Completed/Read">
                          <Button
                            type="text"
                            shape="circle"
                            size="small"
                            icon={<CheckCircleOutlined style={{ color: "#10b981", fontSize: 16 }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notif.id);
                            }}
                            style={{ marginTop: -2 }}
                          />
                        </Tooltip>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side Notifications Drawer Panel */}
      <Drawer
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
              Notifications ({activeNotifications.length})
            </span>
            {activeNotifications.length > 0 && (
              <Button type="link" size="small" onClick={markAllAsRead} style={{ padding: 0 }}>
                Mark all read
              </Button>
            )}
          </div>
        }
        placement="right"
        onClose={() => setNotificationsOpen(false)}
        open={notificationsOpen}
        width={isMobile ? "100%" : 380}
        styles={{ body: { padding: 0 } }}
      >
        {activeNotifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <BellOutlined style={{ fontSize: 48, color: "#cbd5e1", marginBottom: 16 }} />
            <div><Text type="secondary" style={{ fontSize: "0.95rem" }}>No new notifications.</Text></div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flexGrow: 1, overflowY: "auto" }}>
              {activeNotifications.map((notif) => {
                const isRead = notif.read || (notif.readBy && notif.readBy.includes(currentUser?.uid));
                return (
                  <div
                    key={notif.id}
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #f1f5f9",
                      background: isRead ? "#f8fafc" : "#ffffff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      transition: "all 0.2s"
                    }}
                  >
                    <div 
                      onClick={() => {
                        handleNotificationClick(notif);
                        setNotificationsOpen(false);
                      }}
                      style={{ cursor: "pointer", flexGrow: 1 }}
                    >
                      <div style={{ 
                        fontWeight: isRead ? 500 : 700, 
                        fontSize: "0.9rem", 
                        color: isRead ? "#64748b" : "#0f172a", 
                        lineHeight: 1.4,
                        textDecoration: isRead ? "line-through" : "none" 
                      }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 6 }}>
                        {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    
                    {!isRead && (
                      <Tooltip title="Mark as Completed/Read">
                        <Button
                          type="text"
                          shape="circle"
                          icon={<CheckCircleOutlined style={{ color: "#10b981", fontSize: 18 }} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.id);
                          }}
                          style={{ marginTop: -4 }}
                        />
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  );
}

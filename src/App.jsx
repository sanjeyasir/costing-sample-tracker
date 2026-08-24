import React from "react";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#6366f1", // Indigo primary
          colorSuccess: "#10b981", // Emerald green
          colorWarning: "#f59e0b", // Amber yellow
          colorError: "#ef4444",   // Red error
          colorInfo: "#3b82f6",    // Blue info
          colorBgBase: "#f8fafc",  // Light base background
          colorBgContainer: "#ffffff", // White container background
          borderRadius: 12,
          fontFamily: '"Outfit", "Inter", "Roboto", sans-serif',
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import * as notificationService from "../services/firebase/notificationService";
import { notification } from "antd";

const NotificationContext = createContext(null);

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [api, contextHolder] = notification.useNotification();
  
  // Track previous notifications to detect newly arrived ones
  const prevNotificationsRef = useRef([]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      prevNotificationsRef.current = [];
      return;
    }

    const unsubscribe = notificationService.subscribeNotifications(
      currentUser,
      (newNotifications) => {
        // Compare lists to identify new items that weren't in previous snapshot
        const prevIds = prevNotificationsRef.current.map(n => n.id);
        const newlyAdded = newNotifications.filter(n => !prevIds.includes(n.id));

        if (newlyAdded.length > 0) {
          // Display the newest incoming notification
          const newest = newlyAdded[0];
          api.open({
            message: newest.message.includes("overdue") ? "System Alert" : "Notification",
            description: newest.message,
            placement: "bottomRight",
            duration: 6,
            type: newest.message.includes("overdue") ? "error" : "info"
          });
        }

        setNotifications(newNotifications);
        prevNotificationsRef.current = newNotifications;
      }
    );

    return () => unsubscribe();
  }, [currentUser, api]);

  const markAsRead = async (id) => {
    if (!currentUser) return;
    await notificationService.markNotificationAsRead(id, currentUser);
  };

  const markAllAsRead = async () => {
    if (!currentUser || notifications.length === 0) return;
    await notificationService.markAllNotificationsAsRead(currentUser, notifications);
  };

  const [waNotify, setWaNotify] = useState(null);
  const [waVisible, setWaVisible] = useState(false);

  useEffect(() => {
    const handleWhatsAppNotification = (e) => {
      const data = e.detail;
      setWaNotify(data);
      setWaVisible(true);
      
      const timer = setTimeout(() => {
        setWaVisible(false);
        setTimeout(() => setWaNotify(null), 400);
      }, 6000);

      return () => clearTimeout(timer);
    };

    window.addEventListener("whatsapp_notification_sent", handleWhatsAppNotification);
    return () => window.removeEventListener("whatsapp_notification_sent", handleWhatsAppNotification);
  }, []);

  const value = {
    notifications,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {contextHolder}
      {children}

      {/* Simulated WhatsApp Toast Notification */}
      {waNotify && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            width: 360,
            zIndex: 9999,
            background: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)",
            padding: 16,
            transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            transform: waVisible ? "translateX(0) translateY(0)" : "translateX(400px) translateY(0)",
            opacity: waVisible ? 1 : 0,
            fontFamily: '"Outfit", "Inter", sans-serif',
            overflow: "hidden"
          }}
        >
          {/* Premium green header strip */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #10b981, #059669)" }} />
          
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div 
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: "50%", 
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)",
                flexShrink: 0
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                width="20" 
                height="20" 
                fill="#ffffff"
              >
                <path d="M12.012 2C6.48 2 2 6.48 2 12.012c0 1.764.468 3.48 1.344 5L2 22l5.124-1.344c1.476.804 3.144 1.236 4.884 1.236 5.532 0 10.012-4.48 10.012-10.012C22.02 6.48 17.544 2 12.012 2zm0 16.512c-1.572 0-3.12-.42-4.476-1.212l-.324-.192-3.324.876.888-3.24-.216-.348c-.876-1.392-1.332-3.012-1.332-4.68 0-4.692 3.816-8.508 8.508-8.508 4.692 0 8.508 3.816 8.508 8.508s-3.816 8.508-8.508 8.508zm4.656-6.36c-.252-.132-1.5-.744-1.728-.828-.228-.084-.396-.132-.564.132-.168.252-.648.828-.792.996-.144.168-.288.192-.54.06-1.092-.552-1.8-1.02-2.52-2.256-.192-.324.192-.3.552-1.02.06-.12.03-.228-.012-.312s-.396-.996-.54-1.356c-.144-.348-.288-.3-.396-.3-.108-.012-.228-.012-.348-.012s-.312.048-.48.228c-.168.18-.648.636-.648 1.548s.66 1.8 1.728 2.256c.144.06 2.376 3.624 5.76 5.088.804.348 1.428.552 1.92.708.816.252 1.548.216 2.136.132.66-.096 1.5-.612 1.716-1.2.216-.588.216-1.092.156-1.2-.06-.108-.228-.168-.48-.3z"/>
              </svg>
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.85rem" }}>
                  WhatsApp Alert Dispatched
                </span>
                <span 
                  style={{ 
                    fontSize: "0.65rem", 
                    color: waNotify.status === "sent" ? "#10b981" : (waNotify.status === "simulated" ? "#6366f1" : "#ef4444"), 
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}
                >
                  {waNotify.status}
                </span>
              </div>
              <div style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 500, marginBottom: 8 }}>
                Recipient: <strong style={{ color: "#334155" }}>{waNotify.to}</strong>
              </div>
              
              <div 
                style={{ 
                  background: "rgba(16, 185, 129, 0.04)", 
                  border: "1px solid rgba(16, 185, 129, 0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: "0.8rem",
                  color: "#475569",
                  lineHeight: "1.45",
                  whiteSpace: "pre-wrap",
                  maxHeight: 120,
                  overflowY: "auto",
                  wordBreak: "break-word"
                }}
              >
                {waNotify.message}
              </div>
            </div>
            
            <button 
              onClick={() => {
                setWaVisible(false);
                setTimeout(() => setWaNotify(null), 400);
              }}
              style={{
                border: "none",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 0,
                fontSize: "1rem",
                marginTop: -4,
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.color = "#475569"}
              onMouseLeave={(e) => e.target.style.color = "#94a3b8"}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

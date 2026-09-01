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

  const value = {
    notifications,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {contextHolder}
      {children}
    </NotificationContext.Provider>
  );
};

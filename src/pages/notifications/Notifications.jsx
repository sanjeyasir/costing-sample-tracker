import React, { useState, useEffect } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, Typography, Button, Tabs, Tag, Tooltip, Space, List, Alert, Spin, Row, Col, Badge } from "antd";
import { BellOutlined, CheckCircleOutlined, ClockCircleOutlined, CheckCircleFilled } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

export default function Notifications() {
  const { currentUser } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const [allList, setAllList] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotificationHistory = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const uid = currentUser.uid;
      const roles = currentUser.roles || [];
      const costingRoles = currentUser.costingRoles || [];
      const sampleRoles = currentUser.sampleRoles || [];
      
      const hasFinanceAccess = costingRoles.includes("costing_finance") || roles.includes("admin");
      const hasSampleAccess = sampleRoles.includes("sample_sampling") || roles.includes("admin");

      if (localStorage.getItem("mockMode") === "true" || !uid) {
        // Mock Mode fetch
        const allNotifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        const userNotifs = allNotifications.filter(n => {
          if (n.userId === uid) return true;
          if (roles.includes("admin")) return true;
          if (n.role) {
            const isFin = n.role === "finance" && hasFinanceAccess;
            const isSamp = (n.role === "sample" || n.role === "sample_sampling") && hasSampleAccess;
            return isFin || isSamp;
          }
          return false;
        });
        
        userNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllList(userNotifs);
      } else {
        // Firestore fetch
        const { db } = await import("../../services/firebase/config");
        const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
        
        const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const allNotifications = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate().toISOString() || new Date().toISOString()
        }));

        const userNotifs = allNotifications.filter(n => {
          if (n.userId === uid) return true;
          if (roles.includes("admin")) return true;
          if (n.role) {
            const isFin = n.role === "finance" && hasFinanceAccess;
            const isSamp = (n.role === "sample" || n.role === "sample_sampling") && hasSampleAccess;
            return isFin || isSamp;
          }
          return false;
        });

        setAllList(userNotifs);
      }
    } catch (err) {
      console.error("Error loading notification history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotificationHistory();
  }, [currentUser, notifications]);

  const handleNotificationClick = (notif) => {
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

  // Split history list into pending and completed
  const pendingList = allList.filter(
    n => !n.read && !(n.readBy && n.readBy.includes(currentUser?.uid))
  );

  const completedList = allList.filter(
    n => n.read || (n.readBy && n.readBy.includes(currentUser?.uid))
  );

  return (
    <div style={{ paddingBottom: 48 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <BellOutlined style={{ fontSize: 24, color: "#10b981" }} />
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              Notification Center
            </Title>
          </Space>
        </Col>
        <Col>
          {pendingList.length > 0 && (
            <Button type="primary" onClick={markAllAsRead} style={{ borderRadius: 8 }}>
              Mark All Completed
            </Button>
          )}
        </Col>
      </Row>

      <Card style={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {loading && allList.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}><Spin size="large" /></div>
        ) : (
          <Tabs defaultActiveKey="pending" size="large" type="line">
            <Tabs.TabPane 
              tab={
                <span>
                  Pending Action{" "}
                  <Badge count={pendingList.length} style={{ backgroundColor: "#ef4444", marginLeft: 4 }} />
                </span>
              } 
              key="pending"
            >
              <List
                itemLayout="horizontal"
                dataSource={pendingList}
                locale={{ emptyText: "You have completed all pending action items!" }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Tooltip title="Mark Completed">
                        <Button
                          type="text"
                          shape="circle"
                          icon={<CheckCircleOutlined style={{ color: "#10b981", fontSize: 20 }} />}
                          onClick={() => markAsRead(item.id)}
                        />
                      </Tooltip>
                    ]}
                    style={{
                      padding: "16px 24px",
                      background: "#ffffff",
                      borderBottom: "1px solid #f1f5f9",
                      borderRadius: 8,
                      marginBottom: 8,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <a 
                          onClick={() => handleNotificationClick(item)}
                          style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}
                        >
                          {item.message}
                        </a>
                      }
                      description={
                        <Space size="middle" style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: "0.75rem" }}>
                            <ClockCircleOutlined /> {new Date(item.createdAt).toLocaleString()}
                          </Text>
                          {item.role && <Tag color="blue">{item.role.toUpperCase()}</Tag>}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Tabs.TabPane>
            
            <Tabs.TabPane 
              tab={
                <span>
                  Completed History{" "}
                  <Tag style={{ marginLeft: 4 }}>{completedList.length}</Tag>
                </span>
              } 
              key="completed"
            >
              <List
                itemLayout="horizontal"
                dataSource={completedList}
                locale={{ emptyText: "No completed notifications history." }}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: "16px 24px",
                      background: "#f8fafc",
                      borderBottom: "1px solid #f1f5f9",
                      borderRadius: 8,
                      marginBottom: 8,
                      opacity: 0.8
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <span 
                          onClick={() => handleNotificationClick(item)}
                          style={{ 
                            fontWeight: 500, 
                            fontSize: "0.95rem", 
                            color: "#64748b", 
                            textDecoration: "line-through",
                            cursor: "pointer"
                          }}
                        >
                          {item.message}
                        </span>
                      }
                      description={
                        <Space size="middle" style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: "0.75rem" }}>
                            <ClockCircleOutlined /> Completed: {new Date(item.createdAt).toLocaleString()}
                          </Text>
                          <Tag icon={<CheckCircleFilled />} color="success">COMPLETED</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Tabs.TabPane>
          </Tabs>
        )}
      </Card>
    </div>
  );
}

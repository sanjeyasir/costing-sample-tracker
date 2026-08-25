import React, { useState, useEffect } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { Card, Typography, Button, Tabs, Tag, Tooltip, Space, List, Alert, Spin, Row, Col, Badge, Statistic } from "antd";
import { BellOutlined, CheckCircleOutlined, ClockCircleOutlined, CheckCircleFilled, BarChartOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

export default function Notifications() {
  const { currentUser } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const [allList, setAllList] = useState([]);
  const [costRequests, setCostRequests] = useState([]);
  const [sampleRequests, setSampleRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    
    let unsubNotifs = () => {};
    let unsubCost = () => {};
    let unsubSample = () => {};

    const setupSubscriptions = async () => {
      try {
        const uid = currentUser.uid;
        const roles = currentUser.roles || [];
        const costingRoles = currentUser.costingRoles || [];
        const sampleRoles = currentUser.sampleRoles || [];
        
        const hasFinanceAccess = costingRoles.includes("costing_finance") || roles.includes("admin");
        const hasSampleAccess = sampleRoles.includes("sample_sampling") || roles.includes("admin");
        const isMarketingOrAdmin = costingRoles.includes("costing_marketing") || sampleRoles.includes("sample_marketing") || roles.includes("admin");

        const { db } = await import("../../services/firebase/config");
        const { collection, onSnapshot, query, orderBy } = await import("firebase/firestore");
        
        unsubCost = onSnapshot(collection(db, "costRequests"), (snapshot) => {
          setCostRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        unsubSample = onSnapshot(collection(db, "sampleRequests"), (snapshot) => {
          setSampleRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
        unsubNotifs = onSnapshot(q, (snapshot) => {
          const allNotifications = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
              completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || null
            };
          });

          const filteredList = allNotifications.filter(n => {
            if (isMarketingOrAdmin) return true;
            if (n.userId === uid) return true;
            if (n.role) {
              const isFin = n.role === "finance" && hasFinanceAccess;
              const isSamp = (n.role === "sample" || n.role === "sample_sampling") && hasSampleAccess;
              return isFin || isSamp;
            }
            return false;
          });
          setAllList(filteredList);
          setLoading(false);
        });
      } catch (err) {
        console.error("Error setting up notifications subscriptions:", err);
        setLoading(false);
      }
    };

    setupSubscriptions();

    return () => {
      unsubNotifs();
      unsubCost();
      unsubSample();
    };
  }, [currentUser]);

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

  const costingRoles = currentUser?.costingRoles || [];
  const sampleRoles = currentUser?.sampleRoles || [];
  const roles = currentUser?.roles || [];
  const hasFinanceAccess = costingRoles.includes("costing_finance") || roles.includes("admin");
  const hasSampleAccess = sampleRoles.includes("sample_sampling") || roles.includes("admin");

  const isInboxTarget = (n) => {
    // Direct target notification
    if (n.userId === currentUser?.uid) return true;
    
    // Admin gets all as target if admin
    if (roles.includes("admin")) return true;

    // Role broadcast notifications
    if (n.role) {
      const isFin = n.role === "finance" && hasFinanceAccess;
      const isSamp = (n.role === "sample" || n.role === "sample_sampling") && hasSampleAccess;
      return isFin || isSamp;
    }
    return false;
  };

  const isMarketingOrAdmin = costingRoles.includes("costing_marketing") || sampleRoles.includes("sample_marketing") || roles.includes("admin");

  // Split history list into pending and completed with specific sorting
  const pendingList = allList
    .filter(n => isInboxTarget(n) && !n.read && !(n.readBy && n.readBy.includes(currentUser?.uid)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const completedList = allList
    .filter(n => isInboxTarget(n) && (n.read || (n.readBy && n.readBy.includes(currentUser?.uid))))
    .sort((a, b) => {
      const timeA = a.completedAt || a.createdAt;
      const timeB = b.completedAt || b.createdAt;
      return new Date(timeB) - new Date(timeA);
    });

  // Helper: calculate milliseconds between created and completed (defensive against Timestamps, Strings, and Dates)
  const calculateResponseTime = (createdAt, completedAt) => {
    if (!createdAt || !completedAt) return null;
    
    const toDateObject = (val) => {
      if (val instanceof Date) return val;
      if (val && typeof val.toDate === "function") return val.toDate();
      if (val && val.seconds !== undefined) return new Date(val.seconds * 1000);
      return new Date(val);
    };

    const start = toDateObject(createdAt);
    const end = toDateObject(completedAt);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    const diff = end - start;
    return diff > 0 ? diff : 0;
  };

  // Helper: get standard date key YYYY-MM-DD from any date type (Timestamp, Date, String)
  const getLocalDateKey = (dateVal) => {
    if (!dateVal) return null;
    
    const toDateObject = (val) => {
      if (val instanceof Date) return val;
      if (val && typeof val.toDate === "function") return val.toDate();
      if (val && val.seconds !== undefined) return new Date(val.seconds * 1000);
      return new Date(val);
    };

    const parsed = toDateObject(dateVal);
    if (isNaN(parsed.getTime())) return null;
    
    return parsed.toISOString().split("T")[0];
  };

  // Helper: format duration in human readable format
  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return "N/A";
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (days > 0) return `${days}d ${hrs % 24}h`;
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m`;
    return `${secs}s`;
  };



  // Compute personal analytics for the logged-in user only
  const myNotifications = allList.filter(n => isInboxTarget(n));
  const myCompletedNotifications = myNotifications.filter(n => {
    if (n.role) {
      return n.readBy && n.readBy.includes(currentUser?.uid);
    }
    return n.read;
  });
  const myTotalSent = myNotifications.length;
  const myTotalCompleted = myCompletedNotifications.length;

  let totalMyResponseTimeMs = 0;
  let myCompletedWithTimesCount = 0;
  myCompletedNotifications.forEach(n => {
    const userCompletedAt = n.role ? (n.completions?.[currentUser?.uid] || n.completedAt) : n.completedAt;
    const duration = calculateResponseTime(n.createdAt, userCompletedAt);
    if (duration !== null) {
      totalMyResponseTimeMs += duration;
      myCompletedWithTimesCount++;
    }
  });
  const myAvgResponseTimeMs = myCompletedWithTimesCount > 0 ? Math.floor(totalMyResponseTimeMs / myCompletedWithTimesCount) : null;

  // Group by date for the last 7 days for the chart
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  };

  const last7Days = getLast7Days();
  const formatDateLabel = (date) => {
    return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  };
  const formatDateKey = (date) => {
    return date.toISOString().split("T")[0];
  };

  const chartData = last7Days.map(date => {
    const key = formatDateKey(date);
    const label = formatDateLabel(date);
    
    const createdCount = myNotifications.filter(n => {
      const dateKey = getLocalDateKey(n.createdAt);
      return dateKey === key;
    }).length;
    
    const completedCount = myNotifications.filter(n => {
      const userCompletedAt = n.role ? (n.completions?.[currentUser?.uid] || n.completedAt) : n.completedAt;
      const dateKey = getLocalDateKey(userCompletedAt);
      return dateKey === key;
    }).length;
    
    return {
      label,
      created: createdCount,
      completed: completedCount
    };
  });

  const maxChartVal = Math.max(...chartData.map(d => Math.max(d.created, d.completed)), 5);
  const yMax = Math.ceil(maxChartVal / 5) * 5;
  const yTicks = [yMax, Math.round(yMax * 0.75), Math.round(yMax * 0.5), Math.round(yMax * 0.25), 0];



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
                      <Tooltip title="Acknowledge">
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
                            <ClockCircleOutlined /> Completed: {item.completedAt ? new Date(item.completedAt).toLocaleString() : new Date(item.createdAt).toLocaleString()}
                          </Text>
                          <Tag icon={<CheckCircleFilled />} color="success">ACKNOWLEDGED</Tag>
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
                  <BarChartOutlined style={{ marginRight: 4 }} />
                  Trends & Response Times
                </span>
              } 
              key="trends"
            >
              <div style={{ padding: "16px 8px" }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={8}>
                    <Card style={{ borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Statistic 
                        title="Notifications Created" 
                        value={myTotalSent} 
                        valueStyle={{ fontWeight: 800, color: "#0f172a" }}
                        prefix={<BellOutlined style={{ color: "#3b82f6", marginRight: 8 }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card style={{ borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Statistic 
                        title="Notifications Completed" 
                        value={myTotalCompleted} 
                        valueStyle={{ fontWeight: 800, color: "#10b981" }}
                        prefix={<CheckCircleFilled style={{ color: "#10b981", marginRight: 8 }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card style={{ borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Statistic 
                        title="Average Response Time" 
                        value={formatDuration(myAvgResponseTimeMs)} 
                        valueStyle={{ fontWeight: 800, color: "#f59e0b" }}
                        prefix={<ClockCircleOutlined style={{ color: "#f59e0b", marginRight: 8 }} />}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* SVG Daily Activity Chart */}
                <Card 
                  title={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <span style={{ fontWeight: 800, color: "#0f172a" }}>
                        <BarChartOutlined style={{ marginRight: 8, color: "#10b981" }} />
                        Daily Activity (Last 7 Days)
                      </span>
                      <Space size="large" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#3b82f6", display: "inline-block" }} />
                          Created
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#10b981", display: "inline-block" }} />
                          Completed
                        </span>
                      </Space>
                    </div>
                  }
                  style={{ borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 24 }}
                >
                  <div style={{ position: "relative", width: "100%", height: 260 }}>
                    <svg viewBox="0 0 600 250" width="100%" height="100%" style={{ overflow: "visible" }}>
                      {/* Grid lines */}
                      {yTicks.map((tick, index) => {
                        const y = 20 + (190 * index) / 4;
                        return (
                          <g key={index}>
                            <line 
                              x1="40" 
                              y1={y} 
                              x2="580" 
                              y2={y} 
                              stroke="#e2e8f0" 
                              strokeWidth="1" 
                              strokeDasharray={index === 4 ? "0" : "4 4"} 
                            />
                            <text 
                              x="30" 
                              y={y + 4} 
                              textAnchor="end" 
                              style={{ fontSize: "11px", fill: "#64748b", fontWeight: 500 }}
                            >
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      {/* Bars & Interactive Groups */}
                      {chartData.map((d, i) => {
                        const groupWidth = 540 / 7;
                        const xGroup = 40 + groupWidth * i;
                        const groupCenter = xGroup + groupWidth / 2;
                        
                        const barWidth = 14;
                        const barGap = 4;
                        
                        const createdHeight = (d.created / yMax) * 190;
                        const completedHeight = (d.completed / yMax) * 190;
                        
                        const createdY = 210 - createdHeight;
                        const completedY = 210 - completedHeight;

                        return (
                          <g 
                            key={i}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ cursor: "pointer" }}
                          >
                            {/* Hover Background Highlight */}
                            {hoveredIndex === i && (
                              <rect
                                x={xGroup + 4}
                                y="15"
                                width={groupWidth - 8}
                                height="200"
                                fill="#f1f5f9"
                                opacity="0.6"
                                rx="6"
                              />
                            )}

                            {/* Created Bar */}
                            <rect
                              x={groupCenter - barWidth - barGap / 2}
                              y={createdY}
                              width={barWidth}
                              height={createdHeight}
                              fill="#3b82f6"
                              rx="3"
                              style={{ transition: "all 0.3s ease" }}
                            />

                            {/* Completed Bar */}
                            <rect
                              x={groupCenter + barGap / 2}
                              y={completedY}
                              width={barWidth}
                              height={completedHeight}
                              fill="#10b981"
                              rx="3"
                              style={{ transition: "all 0.3s ease" }}
                            />

                            {/* Hover numbers above bars */}
                            {hoveredIndex === i && (
                              <g>
                                  {d.created > 0 && (
                                    <text
                                      x={groupCenter - barWidth/2 - barGap/2}
                                      y={createdY - 6}
                                      textAnchor="middle"
                                      style={{ fontSize: "11px", fontWeight: "bold", fill: "#3b82f6" }}
                                    >
                                      {d.created}
                                    </text>
                                  )}
                                  {d.completed > 0 && (
                                    <text
                                      x={groupCenter + barWidth/2 + barGap/2}
                                      y={completedY - 6}
                                      textAnchor="middle"
                                      style={{ fontSize: "11px", fontWeight: "bold", fill: "#10b981" }}
                                    >
                                      {d.completed}
                                    </text>
                                  )}
                              </g>
                            )}

                            {/* X Axis Label */}
                            <text
                              x={groupCenter}
                              y="235"
                              textAnchor="middle"
                              style={{ 
                                fontSize: "12px", 
                                fill: hoveredIndex === i ? "#0f172a" : "#64748b",
                                fontWeight: hoveredIndex === i ? 700 : 500 
                              }}
                            >
                              {d.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </Card>


              </div>
            </Tabs.TabPane>
          </Tabs>
        )}
      </Card>
    </div>
  );
}

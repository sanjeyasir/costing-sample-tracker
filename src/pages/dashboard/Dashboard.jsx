import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as sampleService from "../../services/firebase/sampleService";
import * as costingService from "../../services/firebase/costingService";
import { downloadSamplePDF } from "../../utils/pdfGenerator";
import { Row, Col, Card, Typography, Table, Tag, Button, Alert, List, Space, Spin, Tooltip, Tabs } from "antd";
import {
  UnorderedListOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  PlusCircleOutlined,
  FilePdfOutlined,
  QuestionCircleOutlined,
  CalendarOutlined,
  AlertOutlined,
  DollarOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [sampleRequests, setSampleRequests] = useState([]);
  const [costingRequests, setCostingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Determine Access permissions
  const costingRoles = currentUser?.costingRoles || [];
  const sampleRoles = currentUser?.sampleRoles || [];
  const isAdmin = currentUser?.roles?.includes("admin") || costingRoles.includes("admin") || sampleRoles.includes("admin");
  const hasCostingAccess = isAdmin || (costingRoles.length > 0 && !costingRoles.includes("none"));
  const hasSampleAccess = isAdmin || (sampleRoles.length > 0 && !sampleRoles.includes("none"));

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const promises = [];
        
        if (hasSampleAccess) {
          promises.push(sampleService.getSampleRequests().then(data => setSampleRequests(data)));
        }
        if (hasCostingAccess) {
          promises.push(costingService.getCostingRequests().then(data => setCostingRequests(data)));
        }

        await Promise.all(promises);
      } catch (err) {
        console.error("Error loading dashboard modules:", err);
        setError("Failed to fetch dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [hasSampleAccess, hasCostingAccess]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" tip="Synchronizing system dashboards..." />
      </div>
    );
  }

  // ==========================================
  // SAMPLE REQUESTS METRICS & WORKFLOW QUEUES
  // ==========================================
  const renderSampleDashboard = () => {
    const totalCount = sampleRequests.length;
    const newRequestsCount = sampleRequests.filter(r => r.status === "Submitted").length;
    const awaitingMarketingCount = sampleRequests.filter(r => r.status === "Request for Resubmission").length;
    const inProgressCount = sampleRequests.filter(r => r.status === "In Progress").length;
    const completedCount = sampleRequests.filter(r => r.status === "Completed").length;
    const overdueCount = sampleRequests.filter(r => r.status === "Overdue").length;

    const todayStr = dayjs().format("YYYY-MM-DD");
    const endOfWeekStr = dayjs().endOf("week").format("YYYY-MM-DD");

    const dueTodayCount = sampleRequests.filter(r => 
      r.status !== "Completed" && r.plannedDeliveryDate === todayStr
    ).length;

    const dueThisWeekCount = sampleRequests.filter(r => 
      r.status !== "Completed" && 
      r.plannedDeliveryDate && 
      r.plannedDeliveryDate >= todayStr && 
      r.plannedDeliveryDate <= endOfWeekStr
    ).length;

    const kpis = [
      { title: "Total Requests", value: totalCount, color: "#6366f1", icon: <UnorderedListOutlined />, query: "" },
      { title: "New Requests", value: newRequestsCount, color: "#3b82f6", icon: <ClockCircleOutlined />, query: "status=Submitted" },
      { title: "Awaiting Marketing", value: awaitingMarketingCount, color: "#f59e0b", icon: <QuestionCircleOutlined />, query: "status=Request%20for%20Resubmission" },
      { title: "In Progress", value: inProgressCount, color: "#818cf8", icon: <UnorderedListOutlined />, query: "status=In%20Progress" },
      { title: "Due Today", value: dueTodayCount, color: "#10b981", icon: <CalendarOutlined />, query: "due=today" },
      { title: "Due This Week", value: dueThisWeekCount, color: "#06b6d4", icon: <CalendarOutlined />, query: "" },
      { title: "Overdue", value: overdueCount, color: "#ef4444", icon: <WarningOutlined />, query: "status=Overdue" },
      { title: "Completed", value: completedCount, color: "#10b981", icon: <CheckCircleOutlined />, query: "status=Completed" }
    ];

    const getSampleDevActionQueue = () => {
      const list = sampleRequests.filter(r => ["Submitted", "In Progress", "Overdue"].includes(r.status));
      const getPriority = (req) => {
        if (req.status === "Overdue") return 5;
        if (req.requestType === "Top Urgent") return 4;
        if (req.requestType === "Urgent") return 3;
        if (req.plannedDeliveryDate === todayStr) return 2;
        return 1;
      };
      return [...list].sort((a, b) => getPriority(b) - getPriority(a)).slice(0, 5);
    };

    const getMarketingActionQueue = () => {
      return sampleRequests
        .filter(r => r.status === "Request for Resubmission")
        .sort((a, b) => new Date(b.requestDate || b.createdAt || 0) - new Date(a.requestDate || a.createdAt || 0))
        .slice(0, 5);
    };

    const getUpcomingDeliveries = () => {
      return sampleRequests.filter(r => 
        r.status === "In Progress" && r.plannedDeliveryDate && r.plannedDeliveryDate >= todayStr
      ).sort((a, b) => a.plannedDeliveryDate.localeCompare(b.plannedDeliveryDate)).slice(0, 5);
    };

    return (
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#475569" }}>
              Sample Development Lifecycle Metrics
            </Title>
          </Col>
          <Col>
            {(isAdmin || sampleRoles.includes("sample_marketing")) && (
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={() => navigate("/requests/create")}
                style={{ borderRadius: 8, background: "#10b981", borderColor: "#10b981" }}
              >
                Create Sample Request
              </Button>
            )}
          </Col>
        </Row>

        {/* KPI Cards Grid */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {kpis.map((card, i) => (
            <Col xs={12} sm={8} md={6} lg={3} key={i}>
              <Card
                hoverable
                onClick={() => card.query && navigate(`/requests?${card.query}`)}
                style={{ borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center" }}
                styles={{ body: { padding: "16px 8px" } }}
              >
                <div style={{ color: card.color, fontSize: 18, marginBottom: 4 }}>{card.icon}</div>
                <Text strong style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>{card.title}</Text>
                <Title level={4} style={{ margin: "4px 0 0 0", color: "#0f172a", fontWeight: 800 }}>{card.value}</Title>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[20, 20]}>
          <Col xs={24} lg={14}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Card title="Awaiting Development Queue" bordered={true} style={{ borderRadius: 12 }}>
                <Table
                  dataSource={getSampleDevActionQueue()}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: "max-content" }}
                  columns={[
                    { title: "No.", dataIndex: "sampleRequestNo", key: "sampleRequestNo", render: (t) => <strong style={{ color: "#6366f1" }}>{t}</strong> },
                    { title: "Customer", dataIndex: "customerName", key: "customerName" },
                    { title: "Urgency", dataIndex: "requestType", render: (t) => <Tag color={t === "Top Urgent" ? "red" : "orange"}>{t}</Tag> },
                    { title: "Action", align: "right", render: (_, r) => (
                      <Space>
                        {(isAdmin || sampleRoles.includes("sample_sampling")) ? (
                          <Button type="primary" size="small" onClick={() => navigate(`/requests/${r.id}`)}>Process</Button>
                        ) : (
                          <Button size="small" onClick={() => navigate(`/requests/${r.id}`)}>View</Button>
                        )}
                        <Button type="text" danger icon={<FilePdfOutlined />} onClick={() => downloadSamplePDF(r)} />
                      </Space>
                    )}
                  ]}
                  locale={{ emptyText: "No active actions pending for Sample Development." }}
                />
              </Card>

              <Card title="Awaiting Resubmission (Marketing)" bordered={true} style={{ borderRadius: 12 }}>
                <Table
                  dataSource={getMarketingActionQueue()}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: "max-content" }}
                  columns={[
                    { title: "No.", dataIndex: "sampleRequestNo", key: "sampleRequestNo", render: (t) => <strong style={{ color: "#6366f1" }}>{t}</strong> },
                    { title: "Customer", dataIndex: "customerName", key: "customerName" },
                    { title: "Reason", dataIndex: "remarks", ellipsis: true },
                    { title: "Action", align: "right", render: (_, r) => <Button size="small" onClick={() => navigate(`/requests/${r.id}`)}>{(isAdmin || sampleRoles.includes("sample_marketing")) ? "Edit" : "View"}</Button> }
                  ]}
                  locale={{ emptyText: "No resubmissions pending." }}
                />
              </Card>
            </Space>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Upcoming Planned Deliveries" bordered={true} style={{ borderRadius: 12 }}>
              <List
                dataSource={getUpcomingDeliveries()}
                size="small"
                renderItem={(item) => (
                  <List.Item actions={[<Button type="link" onClick={() => navigate(`/requests/${item.id}`)}>View</Button>]}>
                    <List.Item.Meta
                      title={<strong>#{item.sampleRequestNo} - {item.customerName}</strong>}
                      description={`Planned Delivery Date: ${item.plannedDeliveryDate}`}
                    />
                  </List.Item>
                )}
                locale={{ emptyText: "No upcoming deliveries planned." }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // ==========================================
  // COSTING REQUESTS METRICS & WORKFLOW QUEUES
  // ==========================================
  const renderCostingDashboard = () => {
    const totalCostings = costingRequests.length;
    const submittedCount = costingRequests.filter(r => r.status === "Submitted").length;
    const inProgressCount = costingRequests.filter(r => r.status === "Costing in Progress").length;
    const completedCount = costingRequests.filter(r => r.status === "Costing Completed").length;
    const overdueCount = costingRequests.filter(r => r.status === "Overdue").length;

    const kpis = [
      { title: "Total Costings", value: totalCostings, color: "#6366f1", icon: <DollarOutlined /> },
      { title: "Pending Receipt", value: submittedCount, color: "#3b82f6", icon: <ClockCircleOutlined /> },
      { title: "In Progress", value: inProgressCount, color: "#f59e0b", icon: <UnorderedListOutlined /> },
      { title: "Completed", value: completedCount, color: "#10b981", icon: <CheckCircleOutlined /> },
      { title: "Overdue Costings", value: overdueCount, color: "#ef4444", icon: <WarningOutlined /> }
    ];

    const getCostingQueue = () => {
      return costingRequests
        .filter(r => ["Submitted", "Costing in Progress", "Overdue"].includes(r.status))
        .sort((a, b) => new Date(b.requestDate || b.createdAt || 0) - new Date(a.requestDate || a.createdAt || 0))
        .slice(0, 5);
    };

    const getRecentCompletedCostings = () => {
      return costingRequests
        .filter(r => r.status === "Costing Completed")
        .sort((a, b) => new Date(b.completionDate || b.requestDate || 0) - new Date(a.completionDate || a.requestDate || 0))
        .slice(0, 5);
    };

    return (
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#475569" }}>
              Product Costing Lifecycle Metrics
            </Title>
          </Col>
          <Col>
            {(isAdmin || costingRoles.includes("costing_marketing")) && (
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={() => navigate("/costing-requests/create")}
                style={{ borderRadius: 8, background: "#6366f1", borderColor: "#6366f1" }}
              >
                Create Costing Request
              </Button>
            )}
          </Col>
        </Row>

        {/* KPI Cards Grid */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {kpis.map((card, i) => (
            <Col xs={12} sm={8} md={6} lg={4} key={i}>
              <Card
                hoverable
                onClick={() => navigate(`/costing-requests`)}
                style={{ borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center" }}
                styles={{ body: { padding: "16px 8px" } }}
              >
                <div style={{ color: card.color, fontSize: 18, marginBottom: 4 }}>{card.icon}</div>
                <Text strong style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>{card.title}</Text>
                <Title level={4} style={{ margin: "4px 0 0 0", color: "#0f172a", fontWeight: 800 }}>{card.value}</Title>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[20, 20]}>
          <Col xs={24} lg={12}>
            <Card title="Costing Action Work Queue" bordered={true} style={{ borderRadius: 12 }}>
              <Table
                dataSource={getCostingQueue()}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
                columns={[
                  { title: "No.", dataIndex: "costRequestNo", key: "costRequestNo", render: (t) => <strong style={{ color: "#6366f1" }}>#{t}</strong> },
                  { title: "Customer", dataIndex: "customerName", key: "customerName" },
                  { title: "Category", dataIndex: "productUnit", key: "productUnit", render: (u) => <Tag color={u === "horticulture" ? "cyan" : "geekblue"}>{u.toUpperCase()}</Tag> },
                  { title: "Product Description", key: "description", render: (_, record) => record.specs?.description || record.specs?.productName || "" },
                  { title: "Status", dataIndex: "status", render: (s) => <Tag color={s === "Overdue" ? "error" : "processing"}>{s.toUpperCase()}</Tag> },
                  { title: "Action", align: "right", render: (_, r) => (
                    <Button type="primary" size="small" onClick={() => navigate(`/costing-requests/${r.id}`)}>
                      {(isAdmin || costingRoles.includes("costing_finance")) ? "Process" : "View"}
                    </Button>
                  )}
                ]}
                locale={{ emptyText: "No costing actions pending." }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Recently Completed Costings" bordered={true} style={{ borderRadius: 12 }}>
              <Table
                dataSource={getRecentCompletedCostings()}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
                columns={[
                  { title: "No.", dataIndex: "costRequestNo", key: "costRequestNo", render: (t) => <strong>#{t}</strong> },
                  { title: "Customer", dataIndex: "customerName", key: "customerName" },
                  { title: "Product Description", key: "description", render: (_, record) => record.specs?.description || record.specs?.productName || "" },
                  { title: "Action", align: "right", render: (_, r) => (
                    <Button type="link" onClick={() => navigate(`/costing-requests/${r.id}`)}>Details</Button>
                  )}
                ]}
                locale={{ emptyText: "No completed costings yet." }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
          Welcome back, {currentUser?.displayName || currentUser?.email?.split("@")?.[0]} 👋
        </Title>
        <Text type="secondary" style={{ fontSize: "0.95rem" }}>
          Access your operations summary and action logs below.
        </Text>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}

      {/* Render Dual Tabs if Admin / Multi-module, else render single direct dashboard */}
      {hasSampleAccess && hasCostingAccess ? (
        <Tabs defaultActiveKey="sample" size="large" type="card" style={{ marginTop: 12 }}>
          <Tabs.TabPane tab="Sample Requisitions Dashboard" key="sample">
            <div style={{ paddingTop: 16 }}>{renderSampleDashboard()}</div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="Product Costings Dashboard" key="costing">
            <div style={{ paddingTop: 16 }}>{renderCostingDashboard()}</div>
          </Tabs.TabPane>
        </Tabs>
      ) : hasSampleAccess ? (
        <div style={{ marginTop: 12 }}>{renderSampleDashboard()}</div>
      ) : hasCostingAccess ? (
        <div style={{ marginTop: 12 }}>{renderCostingDashboard()}</div>
      ) : (
        <Alert
          message="No Module Access"
          description="Your user account role permissions do not authorize access to costing or sample requisition screens. Please contact an Administrator."
          type="warning"
          showIcon
          style={{ marginTop: 24, borderRadius: 8 }}
        />
      )}
    </div>
  );
}

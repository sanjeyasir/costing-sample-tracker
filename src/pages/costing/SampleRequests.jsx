import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as sampleService from "../../services/firebase/sampleService";
import { downloadSamplePDF } from "../../utils/pdfGenerator";
import { 
  getDispatchBySampleRequestId,
  buildDispatchFromSampleRequest 
} from "../../services/firebase/dispatchService";
import {
  generateSampleInvoicePDF,
  generatePhytoApplicationPDF,
  generatePackingListPDF,
  generateCompleteDispatchBundlePDF,
  downloadPdfFile
} from "../../utils/dispatchPdfGenerator";
import * as XLSX from "xlsx";
import { Table, Input, Select, Button, Tag, Space, Tooltip, DatePicker, Row, Col, Card, Alert, Typography, Tabs, Dropdown, message, Empty } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  UserOutlined,
  CloudDownloadOutlined,
  SendOutlined
} from "@ant-design/icons";

const { Option } = Select;
const { Title, Text } = Typography;

export default function SampleRequests() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  // View state: "all", "my", or "completed"
  const view = searchParams.get("view") || "all";

  // Filter States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [productUnit, setProductUnit] = useState("");
  const [requestType, setRequestType] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  
  // Custom SLA/Due Filters
  const [dueParam, setDueParam] = useState(searchParams.get("due") || "");

  // Pagination States
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync parameters from search URL (e.g. from Dashboard click redirects)
  useEffect(() => {
    setStatus(searchParams.get("status") || "");
    setDueParam(searchParams.get("due") || "");
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await sampleService.getSampleRequests();
        setRequests(data || []);
      } catch (err) {
        console.error("Error loading sample requests:", err);
        setError("Failed to fetch sample requests.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setProductUnit("");
    setRequestType("");
    setSampleType("");
    setSelectedCustomer("");
    const newParams = new URLSearchParams();
    if (view !== "all") newParams.set("view", view);
    setSearchParams(newParams);
    setCurrentPage(1);
  };

  const handleTabChange = (key) => {
    const newParams = new URLSearchParams(searchParams);
    if (key === "all") {
      newParams.delete("view");
    } else {
      newParams.set("view", key);
    }
    setSearchParams(newParams);
    setCurrentPage(1);
  };

  const isMyRequest = (r) => {
    if (!currentUser) return false;
    return (
      r.createdByUid === currentUser.uid ||
      r.createdByEmail === currentUser.email ||
      (currentUser.displayName && r.requestedBy === currentUser.displayName) ||
      (currentUser.email && r.requestedBy === currentUser.email)
    );
  };

  // Compute metrics for active (incomplete) vs completed
  const incompleteRequests = requests.filter(r => r.status !== "Completed");
  const completedRequests = requests.filter(r => r.status === "Completed");
  const myIncompleteRequests = incompleteRequests.filter(isMyRequest);

  // Extract unique customers of completed requests only
  const uniqueCompletedCustomers = Array.from(
    new Set(completedRequests.map(r => r.customerName?.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const activeCount = incompleteRequests.length;
  const myActiveCount = myIncompleteRequests.length;
  const completedCount = completedRequests.length;

  // Filter displayed requests according to active tab
  let displayedRequests = [];

  if (view === "completed") {
    // In completed view: only present requests for the selected customer
    if (selectedCustomer) {
      displayedRequests = completedRequests.filter(r => r.customerName?.trim() === selectedCustomer);
      
      if (search.trim()) {
        const q = search.toLowerCase();
        displayedRequests = displayedRequests.filter(r => 
          (r.sampleRequestNo || "").toLowerCase().includes(q) ||
          (r.product || "").toLowerCase().includes(q) ||
          (r.requestedBy || "").toLowerCase().includes(q)
        );
      }
      if (productUnit) {
        displayedRequests = displayedRequests.filter(r => r.productUnit === productUnit);
      }
      if (sampleType) {
        displayedRequests = displayedRequests.filter(r => r.sampleType === sampleType);
      }
    } else {
      displayedRequests = []; // Zero data loaded until a customer is chosen
    }
  } else {
    // In "all" or "my" view: present only incomplete/active requests
    let baseList = view === "my" ? myIncompleteRequests : incompleteRequests;

    if (dueParam === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      baseList = baseList.filter(r => r.plannedDeliveryDate === todayStr);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      baseList = baseList.filter(r => 
        (r.sampleRequestNo || "").toLowerCase().includes(q) ||
        (r.customerName || "").toLowerCase().includes(q) ||
        (r.product || "").toLowerCase().includes(q) ||
        (r.requestedBy || "").toLowerCase().includes(q)
      );
    }
    if (status) {
      baseList = baseList.filter(r => r.status === status);
    }
    if (productUnit) {
      baseList = baseList.filter(r => r.productUnit === productUnit);
    }
    if (requestType) {
      baseList = baseList.filter(r => r.requestType === requestType);
    }
    if (sampleType) {
      baseList = baseList.filter(r => r.sampleType === sampleType);
    }

    displayedRequests = baseList;
  }

  const tabItems = [
    {
      key: "all",
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <UnorderedListOutlined />
          <span>Active Requisitions</span>
          <Tag color="processing" style={{ borderRadius: 10, fontWeight: 700, marginInlineStart: 2 }}>
            {activeCount}
          </Tag>
        </span>
      )
    },
    {
      key: "my",
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <UserOutlined />
          <span>My Active Requests</span>
          <Tag color="blue" style={{ borderRadius: 10, fontWeight: 700, marginInlineStart: 2 }}>
            {myActiveCount}
          </Tag>
        </span>
      )
    },
    {
      key: "completed",
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <CheckCircleOutlined style={{ color: "#10b981" }} />
          <span>Completed Archive</span>
          <Tag color="success" style={{ borderRadius: 10, fontWeight: 700, marginInlineStart: 2 }}>
            {completedCount}
          </Tag>
        </span>
      )
    }
  ];

  const getStatusColor = (statusVal) => {
    switch (statusVal) {
      case "Submitted": return "blue";
      case "Request for Resubmission": return "orange";
      case "In Progress": return "purple";
      case "Completed": return "success";
      case "Overdue": return "error";
      default: return "default";
    }
  };

  const handleQuickDownloadPdf = async (record, docType) => {
    try {
      setDownloadingId(`${record.id}-${docType}`);
      const filenameBase = `${record.sampleRequestNo || "Sample"}_Export`;

      if (docType === "qp02b") {
        await downloadSamplePDF(record);
        message.success("QP-02-B Sample Requisition PDF downloaded!");
        return;
      }

      // Load or build dispatch data for this sample request
      let dispatch = await getDispatchBySampleRequestId(record.id);
      if (!dispatch) {
        dispatch = buildDispatchFromSampleRequest(record, currentUser?.salesOfficerProfile);
      }

      if (docType === "invoice") {
        await downloadPdfFile(generateSampleInvoicePDF(dispatch), `${filenameBase}_Commercial_Invoice.pdf`);
        message.success("Commercial / Sample Invoice PDF downloaded!");
      } else if (docType === "phyto") {
        await downloadPdfFile(generatePhytoApplicationPDF(dispatch), `${filenameBase}_Phyto_Application.pdf`);
        message.success("Phyto Application PDF downloaded!");
      } else if (docType === "packing") {
        await downloadPdfFile(generatePackingListPDF(dispatch), `${filenameBase}_Packing_List.pdf`);
        message.success("Packing List PDF downloaded!");
      } else if (docType === "bundle") {
        await downloadPdfFile(generateCompleteDispatchBundlePDF(dispatch), `${filenameBase}_Complete_Bundle.pdf`);
        message.success("Complete 3-in-1 Export Documentation Bundle downloaded!");
      }
    } catch (err) {
      console.error("PDF download failed:", err);
      message.error("PDF generation failed: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Excel Bulk Export
  const handleExcelExport = () => {
    if (displayedRequests.length === 0) return;
    const exportRows = displayedRequests.map(r => ({
      "Request Number": r.sampleRequestNo,
      "Customer Name": r.customerName,
      "Product Unit": r.productUnit,
      "Requested By": r.requestedBy,
      "Request Date": r.requestDate ? new Date(r.requestDate).toLocaleDateString() : "",
      "Required Date": r.requiredDate,
      "Planned Delivery Date": r.plannedDeliveryDate || "Not Set",
      "Actual Completion Date": r.actualCompletionDate || "Pending",
      "Request Type": r.requestType,
      "Product": r.product,
      "Quantity": r.quantity,
      "Sample Type": r.sampleType,
      "Status": r.status,
      "Action Required": r.actionRequired,
      "Special Note": r.specialNotes
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Requests");
    const viewPrefix = view === "my" ? "My_Sample_Requests" : "All_Sample_Requests";
    XLSX.writeFile(workbook, `${viewPrefix}_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // CSV Bulk Export
  const handleCSVExport = () => {
    if (displayedRequests.length === 0) return;
    const headers = [
      "Request Number", "Customer Name", "Product Unit", "Requested By", "Request Date",
      "Required Date", "Planned Delivery Date", "Actual Completion Date", "Request Type",
      "Product", "Quantity", "Sample Type", "Status", "Action Required"
    ];
    
    let csvContent = headers.join(",") + "\n";
    
    displayedRequests.forEach(r => {
      const row = [
        r.sampleRequestNo,
        `"${(r.customerName || "").replace(/"/g, '""')}"`,
        r.productUnit || "",
        r.requestedBy || "",
        r.requestDate || "",
        r.requiredDate || "",
        r.plannedDeliveryDate || "",
        r.actualCompletionDate || "",
        r.requestType || "",
        `"${(r.product || "").replace(/"/g, '""')}"`,
        r.quantity || 1,
        r.sampleType || "",
        r.status || "",
        r.actionRequired || ""
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const viewPrefix = view === "my" ? "My_Sample_Requests" : "All_Sample_Requests";
    link.setAttribute("download", `${viewPrefix}_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      title: "Request No",
      dataIndex: "sampleRequestNo",
      key: "sampleRequestNo",
      render: (text, record) => (
        <div>
          <span 
            style={{ fontWeight: 800, color: "#4f46e5", cursor: "pointer" }}
            onClick={() => navigate(`/requests/${record.id}`)}
          >
            {text}
          </span>
          {record.dispatchNo && (
            <div style={{ fontSize: "11px", color: "#059669", fontWeight: 600, marginTop: 2 }}>
              📦 {record.dispatchNo}
            </div>
          )}
        </div>
      ),
      sorter: (a, b) => (a.sampleRequestNo || "").localeCompare(b.sampleRequestNo || "", undefined, { numeric: true, sensitivity: "base" })
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      render: (text) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{text}</span>,
      sorter: (a, b) => (a.customerName || "").localeCompare(b.customerName || "")
    },
    {
      title: "Category",
      dataIndex: "productUnit",
      key: "productUnit",
      render: (unit) => <Tag color={unit === "Horticulture" ? "cyan" : "geekblue"} style={{ fontWeight: 700 }}>{unit}</Tag>
    },
    {
      title: "Requested By",
      dataIndex: "requestedBy",
      key: "requestedBy"
    },
    {
      title: "Request Date",
      dataIndex: "requestDate",
      key: "requestDate",
      defaultSortOrder: "descend",
      sorter: (a, b) => new Date(a.requestDate || a.createdAt || 0) - new Date(b.requestDate || b.createdAt || 0),
      render: (date) => date ? new Date(date).toLocaleDateString() : ""
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (statusVal) => <Tag color={getStatusColor(statusVal)} style={{ fontWeight: 700 }}>{statusVal.toUpperCase()}</Tag>
    },
    {
      title: "Export Docs & Actions",
      key: "actions",
      align: "right",
      render: (_, record) => {
        const isDownloading = downloadingId?.startsWith(record.id);

        const docItems = [
          {
            key: "bundle",
            label: "Complete Export Bundle (3-in-1 PDF)",
            icon: <FilePdfOutlined style={{ color: "#4f46e5" }} />,
            onClick: () => handleQuickDownloadPdf(record, "bundle")
          },
          {
            type: "divider"
          },
          {
            key: "qp02b",
            label: "1. QP-02-B Requisition Sheet",
            icon: <FilePdfOutlined style={{ color: "#6366f1" }} />,
            onClick: () => handleQuickDownloadPdf(record, "qp02b")
          },
          {
            key: "invoice",
            label: "2. Commercial / Sample Invoice",
            icon: <FilePdfOutlined style={{ color: "#ef4444" }} />,
            onClick: () => handleQuickDownloadPdf(record, "invoice")
          },
          {
            key: "phyto",
            label: "3. Phyto Application PDF",
            icon: <FilePdfOutlined style={{ color: "#10b981" }} />,
            onClick: () => handleQuickDownloadPdf(record, "phyto")
          },
          {
            key: "packing",
            label: "4. Export Packing List PDF",
            icon: <FilePdfOutlined style={{ color: "#f59e0b" }} />,
            onClick: () => handleQuickDownloadPdf(record, "packing")
          }
        ];

        return (
          <Space size="small">
            <Tooltip title="View Details & Integrated Dispatch Hub">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/requests/${record.id}`)}
                style={{ background: "#ffffff", borderColor: "#cbd5e1" }}
              >
                View
              </Button>
            </Tooltip>

            <Dropdown menu={{ items: docItems }} placement="bottomRight" trigger={["click"]}>
              <Button
                size="small"
                type="primary"
                ghost
                icon={<CloudDownloadOutlined />}
                loading={isDownloading}
                style={{ borderRadius: 6, fontWeight: 600 }}
              >
                Export Docs
              </Button>
            </Dropdown>
          </Space>
        );
      }
    }
  ];


  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a" }}>
            Sample Requisitions
          </Title>
          <Text type="secondary" style={{ fontSize: "0.95rem", fontWeight: 500 }}>
            Monitor and track physical sample requisitions and workflows.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExcelExport}
              disabled={displayedRequests.length === 0}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Export Excel
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleCSVExport}
              disabled={displayedRequests.length === 0}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Export CSV
            </Button>
            {(currentUser?.sampleRoles?.includes("sample_marketing") || currentUser?.roles?.includes("admin") || currentUser?.sampleRoles?.includes("admin")) && (
              <Button
                type="primary"
                onClick={() => navigate("/requests/create")}
                size="large"
                style={{ 
                  borderRadius: 8, 
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none",
                  fontWeight: 700 
                }}
              >
                Create Request
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* View Switcher Tabs */}
      <Tabs
        activeKey={view}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
        style={{ marginBottom: 16 }}
      />

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />
      )}

      {/* Filters Card */}
      <Card 
        bordered={true} 
        style={{ marginBottom: 24, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
        styles={{ body: { padding: 24 } }}
      >
        {view === "completed" ? (
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} sm={12} md={8}>
              <div style={{ marginBottom: 8, color: "#0f172a", fontWeight: 700 }}>
                🏢 Select Customer <span style={{ color: "#ef4444" }}>*</span>
              </div>
              <Select
                showSearch
                placeholder="Choose Customer to View Completed Records..."
                value={selectedCustomer || undefined}
                onChange={(val) => {
                  setSelectedCustomer(val || "");
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
                options={uniqueCompletedCustomers.map(c => ({
                  label: `🏢 ${c}`,
                  value: c
                }))}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Search Customer's Requests</div>
              <Input
                prefix={<SearchOutlined />}
                placeholder="No., Product, Officer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ borderRadius: 8 }}
                disabled={!selectedCustomer}
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Product Unit</div>
              <Select
                placeholder="All Category Units"
                value={productUnit}
                onChange={(val) => {
                  setProductUnit(val);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
                disabled={!selectedCustomer}
              >
                <Option value="">All Units</Option>
                <Option value="Horticulture">Horticulture</Option>
                <Option value="Bedding">Bedding</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Sample Type</div>
              <Select
                placeholder="All Types"
                value={sampleType}
                onChange={(val) => {
                  setSampleType(val);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
                disabled={!selectedCustomer}
              >
                <Option value="">All Types</Option>
                <Option value="New Development">New Development</Option>
                <Option value="Pre Production">Pre Production</Option>
              </Select>
            </Col>
            <Col xs={24} md={2}>
              <Tooltip title="Clear Filters">
                <Button
                  icon={<FilterOutlined />}
                  onClick={handleClearFilters}
                  size="large"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
                />
              </Tooltip>
            </Col>
          </Row>
        ) : (
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} sm={12} md={5}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Search</div>
              <Input
                prefix={<SearchOutlined />}
                placeholder="No., Customer, Product..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Product Unit</div>
              <Select
                placeholder="All Category Units"
                value={productUnit}
                onChange={(val) => {
                  setProductUnit(val);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
              >
                <Option value="">All Units</Option>
                <Option value="Horticulture">Horticulture</Option>
                <Option value="Bedding">Bedding</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Active Status</div>
              <Select
                placeholder="All Active Statuses"
                value={status}
                onChange={(val) => {
                  setStatus(val);
                  const newParams = new URLSearchParams(searchParams);
                  if (val) {
                    newParams.set("status", val);
                  } else {
                    newParams.delete("status");
                  }
                  setSearchParams(newParams);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
              >
                <Option value="">All Active Statuses</Option>
                <Option value="Submitted">Submitted (New)</Option>
                <Option value="Request for Resubmission">Awaiting Resubmission</Option>
                <Option value="In Progress">In Progress</Option>
                <Option value="Overdue">Overdue</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Urgency</div>
              <Select
                placeholder="All Urgencies"
                value={requestType}
                onChange={(val) => {
                  setRequestType(val);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
              >
                <Option value="">All Types</Option>
                <Option value="Top Urgent">Top Urgent</Option>
                <Option value="Urgent">Urgent</Option>
                <Option value="Normal">Normal</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Sample Type</div>
              <Select
                placeholder="All Sample Types"
                value={sampleType}
                onChange={(val) => {
                  setSampleType(val);
                  setCurrentPage(1);
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
              >
                <Option value="">All Types</Option>
                <Option value="New Development">New Development</Option>
                <Option value="Pre Production">Pre Production</Option>
              </Select>
            </Col>
            <Col xs={24} md={1}>
              <Tooltip title="Clear Filters">
                <Button
                  icon={<FilterOutlined />}
                  onClick={handleClearFilters}
                  size="large"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
                />
              </Tooltip>
            </Col>
          </Row>
        )}
      </Card>

      {/* Table */}
      <Table
        dataSource={displayedRequests}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          pageSizeOptions: ["5", "10", "25"],
          showSizeChanger: true,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          },
          style: { marginTop: 16 }
        }}
        locale={{
          emptyText: view === "completed" && !selectedCustomer ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: "16px 0" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>
                    Select a Customer to View Completed Requisitions
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    Choose a customer from the dropdown above to load and display their completed sample records.
                  </div>
                </div>
              }
            />
          ) : (
            <Empty description="No sample requisitions found matching current criteria." />
          )
        }}
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          overflow: "hidden"
        }}
      />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as sampleService from "../../services/firebase/sampleService";
import { downloadSamplePDF } from "../../utils/pdfGenerator";
import * as XLSX from "xlsx";
import { Table, Input, Select, Button, Tag, Space, Tooltip, DatePicker, Row, Col, Card, Alert, Typography } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined
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

  // Filter States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [productUnit, setProductUnit] = useState("");
  const [requestType, setRequestType] = useState("");
  const [sampleType, setSampleType] = useState("");
  
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
        const filters = {
          search,
          status,
          productUnit,
          requestType,
          sampleType
        };

        let data = await sampleService.getSampleRequests(filters);
        
        // Filter by due date if requested
        if (dueParam === "today") {
          const todayStr = new Date().toISOString().split("T")[0];
          data = data.filter(r => r.plannedDeliveryDate === todayStr && r.status !== "Completed");
        }

        setRequests(data);
      } catch (err) {
        console.error("Error loading sample requests:", err);
        setError("Failed to fetch sample requests.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [search, status, productUnit, requestType, sampleType, dueParam]);

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setProductUnit("");
    setRequestType("");
    setSampleType("");
    setSearchParams({});
    setCurrentPage(1);
  };

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

  // Excel Bulk Export
  const handleExcelExport = () => {
    if (requests.length === 0) return;
    const exportRows = requests.map(r => ({
      "Request Number": r.sampleRequestNo,
      "Customer Name": r.customerName,
      "Product Unit": r.productUnit,
      "Requested By": r.requestedBy,
      "Request Date": r.requestDate,
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
    XLSX.writeFile(workbook, `Sample_Requests_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // CSV Bulk Export
  const handleCSVExport = () => {
    if (requests.length === 0) return;
    const headers = [
      "Request Number", "Customer Name", "Product Unit", "Requested By", "Request Date",
      "Required Date", "Planned Delivery Date", "Actual Completion Date", "Request Type",
      "Product", "Quantity", "Sample Type", "Status", "Action Required"
    ];
    
    let csvContent = headers.join(",") + "\n";
    
    requests.forEach(r => {
      const row = [
        r.sampleRequestNo,
        `"${r.customerName.replace(/"/g, '""')}"`,
        r.productUnit,
        r.requestedBy,
        r.requestDate,
        r.requiredDate,
        r.plannedDeliveryDate || "",
        r.actualCompletionDate || "",
        r.requestType,
        `"${r.product.replace(/"/g, '""')}"`,
        r.quantity,
        r.sampleType,
        r.status,
        r.actionRequired
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sample_Requests_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      title: "Request No",
      dataIndex: "sampleRequestNo",
      key: "sampleRequestNo",
      render: (text) => <span style={{ fontWeight: 800, color: "#6366f1" }}>{text}</span>,
      sorter: (a, b) => a.sampleRequestNo.localeCompare(b.sampleRequestNo)
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      render: (text) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{text}</span>,
      sorter: (a, b) => a.customerName.localeCompare(b.customerName)
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
      sorter: (a, b) => new Date(a.requestDate) - new Date(b.requestDate)
    },
    {
      title: "Required Date",
      dataIndex: "requiredDate",
      key: "requiredDate"
    },
    {
      title: "Planned Delivery",
      dataIndex: "plannedDeliveryDate",
      key: "plannedDeliveryDate",
      render: (date) => date || <span style={{ color: "#94a3b8" }}>Not set</span>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (statusVal) => <Tag color={getStatusColor(statusVal)} style={{ fontWeight: 700 }}>{statusVal.toUpperCase()}</Tag>
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              shape="circle"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/requests/${record.id}`)}
              style={{ background: "#ffffff", borderColor: "#cbd5e1" }}
            />
          </Tooltip>
          
          <Tooltip title="Download QP-02-B PDF">
            <Button
              shape="circle"
              type="primary"
              danger
              icon={<FilePdfOutlined />}
              onClick={() => downloadSamplePDF(record)}
              style={{ background: "#fef2f2", borderColor: "#ef4444", color: "#ef4444" }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 32 }}>
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
              disabled={requests.length === 0}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Export Excel
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleCSVExport}
              disabled={requests.length === 0}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Export CSV
            </Button>
            {(currentUser.sampleRoles?.includes("sample_marketing") || currentUser.roles?.includes("admin") || currentUser.sampleRoles?.includes("admin")) && (
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

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />
      )}

      {/* Filters Card */}
      <Card 
        bordered={true} 
        style={{ marginBottom: 24, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
        styles={{ body: { padding: 24 } }}
      >
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
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Status</div>
            <Select
              placeholder="All Statuses"
              value={status}
              onChange={(val) => {
                setStatus(val);
                setSearchParams(val ? { status: val } : {});
                setCurrentPage(1);
              }}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
              allowClear
            >
              <Option value="">All Statuses</Option>
              <Option value="Submitted">Submitted (New)</Option>
              <Option value="Request for Resubmission">Awaiting Resubmission</Option>
              <Option value="In Progress">In Progress</Option>
              <Option value="Overdue">Overdue</Option>
              <Option value="Completed">Completed</Option>
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
      </Card>

      {/* Table */}
      <Table
        dataSource={requests}
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

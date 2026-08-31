import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as costingService from "../../services/firebase/costingService";
import * as XLSX from "xlsx";
import { Table, Input, Select, Button, Tag, Space, Tooltip, DatePicker, Row, Col, Card, Alert, Typography } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Option } = Select;
const { Title, Text } = Typography;

export default function CostRequests() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [productUnit, setProductUnit] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  // Pagination States
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync status filter from search parameters (e.g. from Dashboard click redirects)
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setStatus(statusParam);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch categories for filter dropdown
        const cats = await costingService.getProductCategories();
        setCategories(cats);

        // Fetch requests based on role and active filters
        const filters = {
          search,
          status,
          productUnit,
          dateFrom: dateFrom ? dateFrom.format("YYYY-MM-DD") : "",
          dateTo: dateTo ? dateTo.format("YYYY-MM-DD") : ""
        };

        if (currentUser.costingRoles?.includes("costing_marketing")) {
          filters.marketingOfficerUid = currentUser.uid;
        }

        const data = await costingService.getCostingRequests(filters);
        setRequests(data);
      } catch (err) {
        console.error("Error loading costing requests:", err);
        setError("Failed to fetch costing requests.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser, search, status, productUnit, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setProductUnit("");
    setDateFrom(null);
    setDateTo(null);
    setSearchParams({});
    setCurrentPage(1);
  };

  const getStatusColor = (statusVal) => {
    switch (statusVal) {
      case "Submitted": return "processing";
      case "Received by Finance": return "warning";
      case "Costing in Progress": return "purple";
      case "Costing Completed":
      case "Sent to Marketing": return "success";
      case "Overdue": return "error";
      default: return "default";
    }
  };

  // Bulk Excel Export Implementation
  const handleBulkExport = () => {
    if (requests.length === 0) return;

    const excelRows = requests.map(r => {
      let descriptionStr = r.specs.description || r.specs.productDescription || "";
      
      let beddingSpecs = "";
      if (r.productUnit === "bedding") {
        beddingSpecs = `Length: ${r.specs.length}cm, Width: ${r.specs.width}cm, Height: ${r.specs.height}cm, Organic: ${r.specs.organic}, NC/RC: ${r.specs.ncRcRatio}, Density: ${r.specs.density}`;
      }

      let hortiSpecs = "";
      if (r.productUnit === "horticulture") {
        hortiSpecs = `GSM: ${r.specs.gsm}, Latex Ratio: ${r.specs.latexRatio}, Specs: ${r.specs.specifications || ""}`;
      }

      let unitCostStr = r.costing?.unitCost ? `$${r.costing.unitCost.toFixed(2)}` : "N/A";
      let packagingStr = "";
      let loadabilityStr = "";

      if (r.productUnit === "bedding") {
        packagingStr = r.costing?.qtyPerBundleFinance ? `Qty/Bundle: ${r.costing.qtyPerBundleFinance}` : `Qty/Bundle: ${r.specs.qtyPerBundle || "N/A"}`;
      } else if (r.productUnit === "horticulture") {
        packagingStr = r.costing?.packing ? `Packing: ${r.costing.packing}` : "N/A";
        loadabilityStr = `Carton: ${r.costing?.cartonSize || ""}, Pallet Size: ${r.costing?.palletSize || ""}, Cartons/Pallet: ${r.costing?.cartonsPerPallet || ""}, Roll Diam: ${r.costing?.rollDiameter || ""}`;
      }

      return {
        "Cost Request No": r.costRequestNo,
        "Customer Name": r.customerName,
        "Request Date": r.requestDate ? new Date(r.requestDate).toLocaleDateString() : "",
        "Product Category": r.productUnit.charAt(0).toUpperCase() + r.productUnit.slice(1),
        "Marketing Officer": r.marketingOfficer.name,
        "Finance Officer": r.financeOfficer?.name || "Unassigned",
        "Product Description": descriptionStr,
        "Bedding Specifications": beddingSpecs,
        "Horticulture Specifications": hortiSpecs,
        "Unit Cost": unitCostStr,
        "Packing Details": packagingStr,
        "Loadability details": loadabilityStr,
        "Status": r.status,
        "Completion Date": r.completionDate ? new Date(r.completionDate).toLocaleDateString() : "Pending"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Costings");

    const maxLens = {};
    excelRows.forEach(row => {
      Object.keys(row).forEach(key => {
        const valStr = row[key]?.toString() || "";
        maxLens[key] = Math.max(maxLens[key] || key.length, valStr.length);
      });
    });
    worksheet["!cols"] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] + 3 }));

    XLSX.writeFile(workbook, `Cost_Requests_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const columns = [
    {
      title: "Request No",
      dataIndex: "costRequestNo",
      key: "costRequestNo",
      render: (text) => <span style={{ fontWeight: 800, color: "#6366f1" }}>#{text}</span>
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      render: (text) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{text}</span>
    },
    {
      title: "Request Date",
      dataIndex: "requestDate",
      key: "requestDate",
      render: (date) => date ? new Date(date).toLocaleDateString() : ""
    },
    {
      title: "Marketing Officer",
      dataIndex: ["marketingOfficer", "name"],
      key: "marketingOfficer"
    },
    {
      title: "Category",
      dataIndex: "productUnit",
      key: "productUnit",
      render: (unit) => <Tag style={{ textTransform: "uppercase", fontWeight: 700 }}>{unit}</Tag>
    },
    {
      title: "Finance Officer",
      dataIndex: ["financeOfficer", "name"],
      key: "financeOfficer",
      render: (name) => name || <span style={{ color: "#94a3b8" }}>Unassigned</span>
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (statusVal) => <Tag color={getStatusColor(statusVal)} style={{ fontWeight: 700 }}>{statusVal}</Tag>
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
              onClick={() => navigate(`/costing-requests/${record.id}`)}
              style={{ background: "#ffffff", borderColor: "#cbd5e1" }}
            />
          </Tooltip>
          
          {(currentUser.costingRoles?.includes("costing_finance") || currentUser.roles?.includes("admin") || currentUser.costingRoles?.includes("admin")) && record.status === "Submitted" && (
            <Tooltip title="Receive Request">
              <Button
                shape="circle"
                type="primary"
                danger
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/costing-requests/${record.id}`)}
                style={{ background: "rgba(245, 158, 11, 0.1)", borderColor: "#f59e0b", color: "#f59e0b" }}
              />
            </Tooltip>
          )}

          {(currentUser.costingRoles?.includes("costing_finance") || currentUser.roles?.includes("admin") || currentUser.costingRoles?.includes("admin")) && record.status === "Received by Finance" && (
            <Tooltip title="Start Costing">
              <Button
                shape="circle"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/costing-requests/${record.id}`)}
                style={{ background: "rgba(99, 102, 241, 0.1)", borderColor: "#6366f1", color: "#6366f1" }}
              />
            </Tooltip>
          )}

          {(currentUser.costingRoles?.includes("costing_finance") || currentUser.roles?.includes("admin") || currentUser.costingRoles?.includes("admin")) && (record.status === "Costing in Progress" || record.status === "Overdue") && (
            <Tooltip title="Complete Costing">
              <Button
                shape="circle"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => navigate(`/costing-requests/${record.id}`)}
                style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981", color: "#10b981" }}
              />
            </Tooltip>
          )}
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
            Costing Requests
          </Title>
          <Text type="secondary" style={{ fontSize: "0.95rem", fontWeight: 500 }}>
            Search, filter, and track sample costing request cycles.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleBulkExport}
              disabled={requests.length === 0}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Export to Excel
            </Button>
            {(currentUser.costingRoles?.includes("costing_marketing") || currentUser.roles?.includes("admin") || currentUser.costingRoles?.includes("admin")) && (
              <Button
                type="primary"
                onClick={() => navigate("/costing-requests/create")}
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
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Search</div>
            <Input
              prefix={<SearchOutlined />}
              placeholder="No., Customer, Officers..."
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
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Category</div>
            <Select
              placeholder="All Categories"
              value={productUnit}
              onChange={(val) => {
                setProductUnit(val);
                setCurrentPage(1);
              }}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
              allowClear
            >
              <Option value="">All Categories</Option>
              {categories.map((c) => (
                <Option key={c.id} value={c.id}>{c.name}</Option>
              ))}
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
              <Option value="Received by Finance">Received by Finance</Option>
              <Option value="Costing in Progress">Costing in Progress</Option>
              <Option value="Costing Completed">Costing Completed</Option>
              <Option value="Overdue">Overdue</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>From Date</div>
            <DatePicker
              value={dateFrom}
              onChange={(date) => {
                setDateFrom(date);
                setCurrentPage(1);
              }}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>To Date</div>
            <DatePicker
              value={dateTo}
              onChange={(date) => {
                setDateTo(date);
                setCurrentPage(1);
              }}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
            />
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

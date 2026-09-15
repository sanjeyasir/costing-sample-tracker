import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Table, 
  Card, 
  Button, 
  Input, 
  Select, 
  Tag, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic, 
  Dropdown, 
  Modal, 
  message, 
  Tooltip, 
  Popconfirm, 
  Badge, 
  Empty, 
  Tabs 
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  FilePdfOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  CloudDownloadOutlined,
  SettingOutlined,
  UploadOutlined,
  CarOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  InboxOutlined,
  GlobalOutlined,
  UnorderedListOutlined,
  FilterOutlined
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { 
  getDispatchEntries, 
  deleteDispatchEntry 
} from "../../services/firebase/dispatchService";
import { calculateDispatchTotals } from "../../utils/dispatchCalculations";
import {
  generateSampleInvoicePDF,
  generatePhytoApplicationPDF,
  generatePackingListPDF,
  generateCompleteDispatchBundlePDF,
  downloadPdfFile
} from "../../utils/dispatchPdfGenerator";

const { Title, Text } = Typography;
const { Option } = Select;

export default function DispatchList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    try {
      setLoading(true);
      const data = await getDispatchEntries();
      setEntries(data || []);
    } catch (err) {
      console.error("Failed to load dispatches:", err);
      message.error("Failed to load dispatch entries.");
    } finally {
      setLoading(false);
    }
  };

  const isCompletedDispatch = (status) => status === "Delivered" || status === "Completed";

  const activeEntries = entries.filter(e => !isCompletedDispatch(e.status));
  const completedEntries = entries.filter(e => isCompletedDispatch(e.status));

  // Extract unique customers of completed / delivered dispatches only
  const uniqueCompletedCustomers = Array.from(
    new Set(completedEntries.map(e => (e.receiver?.name || e.customerName)?.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Filter effect according to active tab
  let filteredEntries = [];

  if (activeTab === "completed") {
    if (selectedCustomer) {
      filteredEntries = completedEntries.filter(e => 
        (e.receiver?.name?.trim() === selectedCustomer || e.customerName?.trim() === selectedCustomer)
      );
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        filteredEntries = filteredEntries.filter(d => 
          (d.dispatchNo || "").toLowerCase().includes(q) ||
          (d.receiver?.country || "").toLowerCase().includes(q) ||
          (d.waybillNo || "").toLowerCase().includes(q)
        );
      }
    } else {
      filteredEntries = []; // Zero data loaded until a customer is chosen
    }
  } else {
    // In active tab: show incomplete dispatches
    let list = [...activeEntries];

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(d => 
        (d.dispatchNo || "").toLowerCase().includes(q) ||
        (d.receiver?.name || "").toLowerCase().includes(q) ||
        (d.receiver?.country || "").toLowerCase().includes(q) ||
        (d.waybillNo || "").toLowerCase().includes(q) ||
        (d.sender?.name || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter(d => d.status === statusFilter);
    }

    filteredEntries = list;
  }

  const handleDelete = async (id, dispatchNo) => {
    try {
      await deleteDispatchEntry(id);
      message.success(`Dispatch ${dispatchNo || id} deleted successfully.`);
      loadDispatches();
    } catch (err) {
      console.error("Delete failed:", err);
      message.error("Failed to delete dispatch entry.");
    }
  };

  const handleDownloadPdf = async (record, type) => {
    try {
      setDownloadingId(`${record.id}-${type}`);
      const filenameBase = `${record.dispatchNo || "Dispatch"}_${record.shippingDate || "Doc"}`;

      if (type === "invoice") {
        await downloadPdfFile(generateSampleInvoicePDF(record), `${filenameBase}_Sample_Invoice.pdf`);
        message.success("Sample Invoice PDF downloaded!");
      } else if (type === "phyto") {
        await downloadPdfFile(generatePhytoApplicationPDF(record), `${filenameBase}_Phyto_Application.pdf`);
        message.success("Phyto Application PDF downloaded!");
      } else if (type === "packing") {
        await downloadPdfFile(generatePackingListPDF(record), `${filenameBase}_Packing_List.pdf`);
        message.success("Packing List PDF downloaded!");
      } else if (type === "bundle") {
        await downloadPdfFile(generateCompleteDispatchBundlePDF(record), `${filenameBase}_Complete_Bundle.pdf`);
        message.success("Complete Dispatch Bundle PDF downloaded!");
      }
    } catch (err) {
      console.error("PDF download failed:", err);
      message.error("Could not generate PDF: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Metrics computation
  const totalCount = entries.length;
  const readyCount = entries.filter(e => e.status === "Ready for Dispatch").length;
  const inTransitCount = entries.filter(e => e.status === "In Transit" || e.status === "Shipped").length;
  const uniqueCountries = new Set(entries.map(e => e.receiver?.country).filter(Boolean)).size;

  const getStatusTag = (status) => {
    switch (status) {
      case "Ready for Dispatch":
        return <Tag color="green" icon={<CheckCircleOutlined />}>Ready for Dispatch</Tag>;
      case "In Transit":
      case "Shipped":
        return <Tag color="blue" icon={<SendOutlined />}>In Transit</Tag>;
      case "Delivered":
        return <Tag color="cyan" icon={<CheckCircleOutlined />}>Delivered</Tag>;
      case "Cancelled":
        return <Tag color="red">Cancelled</Tag>;
      case "Draft":
      default:
        return <Tag color="default" icon={<ClockCircleOutlined />}>Draft</Tag>;
    }
  };

  const columns = [
    {
      title: "Dispatch No",
      dataIndex: "dispatchNo",
      key: "dispatchNo",
      render: (text, record) => (
        <div>
          <Text strong style={{ color: "#4f46e5", cursor: "pointer" }} onClick={() => navigate(`/dispatch-tracker/${record.id}`)}>
            {text || "Draft"}
          </Text>
          {record.sampleRequestNo && (
            <div style={{ marginTop: 2 }}>
              <Tag 
                color="blue" 
                style={{ cursor: "pointer", fontSize: 11 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/requests/${record.sampleRequestId || record.id}`);
                }}
              >
                📋 Req #{record.sampleRequestNo}
              </Tag>
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>
            Date: {record.shippingDate || "N/A"}
          </div>
        </div>
      ),
    },
    {
      title: "Consignee & Destination",
      key: "consignee",
      render: (_, record) => (
        <div>
          <Text strong>{record.receiver?.name || "Unnamed Consignee"}</Text>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <GlobalOutlined style={{ fontSize: 11, color: "#3b82f6" }} />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.receiver?.country || "N/A"}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Waybill / AWB",
      dataIndex: "waybillNo",
      key: "waybillNo",
      render: (text) => text ? <Tag color="geekblue">{text}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Items & QTY",
      key: "items",
      render: (_, record) => {
        const totals = calculateDispatchTotals(record);
        return (
          <div>
            <Text>{record.items?.length || 0} items</Text>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Total QTY: <Text strong>{totals.totalQty}</Text> pcs
            </div>
          </div>
        );
      },
    },
    {
      title: "Consignment Weight",
      key: "weight",
      render: (_, record) => {
        const totals = calculateDispatchTotals(record);
        return (
          <div>
            <Text>{totals.totalNetWeight} kg (Net)</Text>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Gross: <Text strong>{totals.totalGrossWeight}</Text> kg
            </div>
          </div>
        );
      },
    },
    {
      title: "Invoice Value",
      key: "invoiceValue",
      render: (_, record) => {
        const totals = calculateDispatchTotals(record);
        const currency = record.receiver?.currency || "USD";
        return (
          <div>
            <Text strong style={{ color: "#059669" }}>
              {currency} {totals.totalInvoiceValue.toFixed(2)}
            </Text>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Cargo: {currency} {totals.cargoValue.toFixed(2)}
            </div>
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "Export Docs & PDFs",
      key: "documents",
      align: "center",
      render: (_, record) => {
        const isDownloading = downloadingId?.startsWith(record.id);

        const menuItems = [
          {
            key: "bundle",
            label: "Complete Documentation Bundle (3-in-1 PDF)",
            icon: <FilePdfOutlined style={{ color: "#4f46e5" }} />,
            onClick: () => handleDownloadPdf(record, "bundle")
          },
          {
            type: "divider"
          },
          {
            key: "invoice",
            label: "1. Sample Invoice PDF",
            icon: <FilePdfOutlined style={{ color: "#ef4444" }} />,
            onClick: () => handleDownloadPdf(record, "invoice")
          },
          {
            key: "phyto",
            label: "2. Phyto Application PDF",
            icon: <FilePdfOutlined style={{ color: "#10b981" }} />,
            onClick: () => handleDownloadPdf(record, "phyto")
          },
          {
            key: "packing",
            label: "3. Export Packing List PDF",
            icon: <FilePdfOutlined style={{ color: "#f59e0b" }} />,
            onClick: () => handleDownloadPdf(record, "packing")
          }
        ];

        return (
          <Space>
            <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={["click"]}>
              <Button 
                size="small" 
                type="primary" 
                ghost 
                icon={<CloudDownloadOutlined />}
                loading={isDownloading}
              >
                Docs
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, record) => (
        <Space orientation="horizontal" size="small">
          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/dispatch-tracker/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit Dispatch">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/dispatch-tracker/${record.id}/edit`)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this dispatch entry?"
            description="Are you sure you want to permanently delete this record?"
            onConfirm={() => handleDelete(record.id, record.dispatchNo)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header Banner */}
      <div 
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
          borderRadius: 16,
          padding: "24px 32px",
          marginBottom: 24,
          color: "#ffffff",
          boxShadow: "0 10px 25px -5px rgba(49, 46, 129, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26, background: "rgba(255,255,255,0.15)", padding: "6px 12px", borderRadius: 10 }}>📦</span>
            <div>
              <Title level={3} style={{ color: "#ffffff", margin: 0 }}>Dispatch Tracker</Title>
              <Text style={{ color: "#c7d2fe", fontSize: 13 }}>
                Commercial Invoices, Phyto Applications & Export Packing Lists
              </Text>
            </div>
          </div>
        </div>

        <Space wrap>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 600 }}
            onClick={() => navigate("/dispatch-tracker/create")}
          >
            New Dispatch Entry
          </Button>
        </Space>
      </div>

      {/* Metrics Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 500 }}>Total Dispatches</span>}
              value={totalCount}
              prefix={<InboxOutlined style={{ color: "#4f46e5" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 500 }}>Ready for Dispatch</span>}
              value={readyCount}
              valueStyle={{ color: "#10b981" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 500 }}>In Transit / Shipped</span>}
              value={inTransitCount}
              valueStyle={{ color: "#3b82f6" }}
              prefix={<SendOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 500 }}>Destinations</span>}
              value={uniqueCountries}
              prefix={<GlobalOutlined style={{ color: "#f59e0b" }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* View Switcher Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSearchText("");
          setStatusFilter("all");
          setSelectedCustomer("");
        }}
        size="large"
        style={{ marginBottom: 16 }}
        items={[
          {
            key: "active",
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <UnorderedListOutlined />
                <span>Active Dispatches</span>
                <Tag color="processing" style={{ borderRadius: 10, fontWeight: 700, marginInlineStart: 2 }}>
                  {activeEntries.length}
                </Tag>
              </span>
            )
          },
          {
            key: "completed",
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <CheckCircleOutlined style={{ color: "#10b981" }} />
                <span>Delivered & Completed Archive</span>
                <Tag color="success" style={{ borderRadius: 10, fontWeight: 700, marginInlineStart: 2 }}>
                  {completedEntries.length}
                </Tag>
              </span>
            )
          }
        ]}
      />

      {/* Search & Filter Bar */}
      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {activeTab === "completed" ? (
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} sm={12} md={10}>
              <div style={{ marginBottom: 8, color: "#0f172a", fontWeight: 700 }}>
                🏢 Select Customer / Receiver <span style={{ color: "#ef4444" }}>*</span>
              </div>
              <Select
                showSearch
                placeholder="Choose Customer to View Delivered Dispatches..."
                value={selectedCustomer || undefined}
                onChange={(val) => setSelectedCustomer(val || "")}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
                allowClear
                options={uniqueCompletedCustomers.map(c => ({
                  label: `🏢 ${c}`,
                  value: c
                }))}
              />
            </Col>

            <Col xs={24} sm={12} md={10}>
              <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Search within Customer</div>
              <Input
                placeholder="Search Dispatch No, Country, AWB..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="large"
                style={{ borderRadius: 8 }}
                disabled={!selectedCustomer}
              />
            </Col>

            <Col xs={24} md={4}>
              <Button 
                icon={<FilterOutlined />} 
                onClick={() => {
                  setSelectedCustomer("");
                  setSearchText("");
                }}
                size="large"
                style={{ width: "100%", borderRadius: 8 }}
              >
                Clear
              </Button>
            </Col>
          </Row>
        ) : (
          <Row gutter={[16, 16]} justify="space-between" align="middle">
            <Col xs={24} md={12} lg={8}>
              <Input
                placeholder="Search by Dispatch No, Consignee, Country, or AWB..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="middle"
              />
            </Col>

            <Col xs={24} md={12} lg={8}>
              <Space wrap style={{ width: "100%", justifyContent: "flex-end" }}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 180 }}
                >
                  <Option value="all">All Active Statuses</Option>
                  <Option value="Draft">Draft</Option>
                  <Option value="Ready for Dispatch">Ready for Dispatch</Option>
                  <Option value="In Transit">In Transit</Option>
                  <Option value="Cancelled">Cancelled</Option>
                </Select>
                
                <Button icon={<SyncOutlined />} onClick={loadDispatches}>
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
        )}
      </Card>

      {/* Main Table */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <Table
          columns={columns}
          dataSource={filteredEntries}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} entries`,
          }}
          locale={{
            emptyText: activeTab === "completed" && !selectedCustomer ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ padding: "16px 0" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>
                      Select a Customer to View Delivered Dispatches
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                      Choose a customer from the dropdown above to load and display their delivered export dispatches.
                    </div>
                  </div>
                }
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No dispatch entries found matching current filters."
              >
                {activeTab === "active" && (
                  <Button type="primary" onClick={() => navigate("/dispatch-tracker/create")}>
                    Create First Dispatch
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </Card>
    </div>
  );
}

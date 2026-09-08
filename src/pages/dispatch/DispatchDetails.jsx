import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Tag,
  Row,
  Col,
  Space,
  Typography,
  Descriptions,
  Table,
  Divider,
  message,
  Spin,
  Dropdown,
  Popconfirm
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  SendOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  InboxOutlined,
  ShareAltOutlined
} from "@ant-design/icons";
import { getDispatchEntryById, deleteDispatchEntry, updateDispatchEntry } from "../../services/firebase/dispatchService";
import { calculateDispatchTotals } from "../../utils/dispatchCalculations";
import {
  generateSampleInvoicePDF,
  generatePhytoApplicationPDF,
  generatePackingListPDF,
  generateCompleteDispatchBundlePDF,
  downloadPdfFile
} from "../../utils/dispatchPdfGenerator";

const { Title, Text, Paragraph } = Typography;

export default function DispatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    loadEntry();
  }, [id]);

  const loadEntry = async () => {
    try {
      setLoading(true);
      const data = await getDispatchEntryById(id);
      if (!data) {
        message.error("Dispatch record not found.");
        navigate("/dispatch-tracker");
        return;
      }
      setEntry(data);
    } catch (err) {
      console.error("Failed to load details:", err);
      message.error("Error loading dispatch record.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateDispatchEntry(id, { ...entry, status: newStatus });
      setEntry(prev => ({ ...prev, status: newStatus }));
      message.success(`Status updated to: ${newStatus}`);
    } catch (err) {
      message.error("Failed to update status.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDispatchEntry(id);
      message.success("Dispatch entry deleted.");
      navigate("/dispatch-tracker");
    } catch (err) {
      message.error("Delete failed.");
    }
  };

  const handleDownloadPdf = async (type) => {
    try {
      setDownloading(true);
      const filenameBase = `${entry.dispatchNo || "Dispatch"}_${entry.shippingDate || "Doc"}`;

      if (type === "invoice") {
        await downloadPdfFile(generateSampleInvoicePDF(entry), `${filenameBase}_Sample_Invoice.pdf`);
        message.success("Sample Invoice PDF downloaded!");
      } else if (type === "phyto") {
        await downloadPdfFile(generatePhytoApplicationPDF(entry), `${filenameBase}_Phyto_Application.pdf`);
        message.success("Phyto Application PDF downloaded!");
      } else if (type === "packing") {
        await downloadPdfFile(generatePackingListPDF(entry), `${filenameBase}_Packing_List.pdf`);
        message.success("Packing List PDF downloaded!");
      } else if (type === "bundle") {
        await downloadPdfFile(generateCompleteDispatchBundlePDF(entry), `${filenameBase}_Complete_Bundle.pdf`);
        message.success("Complete Documentation Bundle PDF downloaded!");
      }
    } catch (err) {
      console.error("PDF download failed:", err);
      message.error("PDF error: " + err.message);
    } finally {
      setDownloading(false);
    }
  };


  if (loading || !entry) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Spin size="large" tip="Loading Dispatch Details..." />
      </div>
    );
  }

  const totals = calculateDispatchTotals(entry);
  const currency = entry.receiver?.currency || "USD";

  const itemColumns = [
    {
      title: "#",
      key: "idx",
      width: 50,
      render: (_, __, i) => i + 1,
    },
    {
      title: "Item / Description",
      dataIndex: "description",
      key: "description",
      render: (text, item) => (
        <div>
          <Text strong>{text}</Text>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            Botanical: <em>{item.botanicalName || "Cocos nucifera"}</em>
          </div>
        </div>
      ),
    },
    {
      title: "QTY",
      dataIndex: "qty",
      key: "qty",
      align: "right",
      render: (qty) => `${qty} pcs`,
    },
    {
      title: "Weight (Kg)",
      dataIndex: "weightKg",
      key: "weightKg",
      align: "right",
      render: (w) => `${Number(w).toFixed(1)} kg`,
    },
    {
      title: `Unit Price (${currency})`,
      dataIndex: "unitPrice",
      key: "unitPrice",
      align: "right",
      render: (p) => Number(p).toFixed(2),
    },
    {
      title: "Box No",
      dataIndex: "boxNo",
      key: "boxNo",
    },
    {
      title: `Line Total (${currency})`,
      key: "lineTotal",
      align: "right",
      render: (_, item) => {
        const total = (Number(item.qty || 0) * Number(item.unitPrice || 0)).toFixed(2);
        return <Text strong style={{ color: "#059669" }}>{currency} {total}</Text>;
      },
    },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Top Action Bar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 24px",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dispatch-tracker")}>
            Back
          </Button>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Dispatch: {entry.dispatchNo || id}
            </Title>
            <Space size="small">
              <Tag color={entry.status === "Ready for Dispatch" ? "green" : entry.status === "In Transit" ? "blue" : "default"}>
                {entry.status || "Draft"}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Created: {new Date(entry.createdAt || Date.now()).toLocaleDateString()}
              </Text>
            </Space>
          </div>
        </Space>

        <Space wrap>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/dispatch-tracker/${id}/edit`)}
          >
            Edit Record
          </Button>


          <Dropdown
            menu={{
              items: [
                {
                  key: "bundle",
                  label: "Complete Documentation Bundle (3-in-1 PDF)",
                  icon: <FilePdfOutlined style={{ color: "#4f46e5" }} />,
                  onClick: () => handleDownloadPdf("bundle")
                },
                { type: "divider" },
                {
                  key: "invoice",
                  label: "1. Sample Invoice PDF",
                  icon: <FilePdfOutlined style={{ color: "#ef4444" }} />,
                  onClick: () => handleDownloadPdf("invoice")
                },
                {
                  key: "phyto",
                  label: "2. Phyto Application PDF",
                  icon: <FilePdfOutlined style={{ color: "#10b981" }} />,
                  onClick: () => handleDownloadPdf("phyto")
                },
                {
                  key: "packing",
                  label: "3. Export Packing List PDF",
                  icon: <FilePdfOutlined style={{ color: "#f59e0b" }} />,
                  onClick: () => handleDownloadPdf("packing")
                }
              ]
            }}
          >
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              style={{ background: "#4f46e5", borderColor: "#4f46e5" }}
              loading={downloading}
            >
              Download PDFs
            </Button>
          </Dropdown>

          <Popconfirm
            title="Delete this dispatch?"
            description="Are you sure you want to permanently delete this dispatch?"
            onConfirm={handleDelete}
            okText="Yes, Delete"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        {/* Left Column: Consignee, Sender & Logistics Overview */}
        <Col xs={24} lg={16}>
          {/* Main Info Card */}
          <Card 
            title={<span style={{ fontWeight: 600 }}>Consignment & Logistics Details</span>}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12}>
                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Shipper / Exporter</Text>
                  <div style={{ marginTop: 6 }}>
                    <Text strong style={{ fontSize: 14 }}>{entry.sender?.name || "N/A"}</Text>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{entry.sender?.designation}</div>
                    <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-line" }}>{entry.sender?.address}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Tel: {entry.sender?.contact || "N/A"} | Email: {entry.sender?.email || "N/A"}
                    </div>
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Ship To / Consignee</Text>
                  <div style={{ marginTop: 6 }}>
                    <Text strong style={{ fontSize: 14 }}>{entry.receiver?.name || "N/A"}</Text>
                    <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>{entry.receiver?.country}</div>
                    <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-line" }}>{entry.receiver?.address}</div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Tel: {entry.receiver?.contact || "N/A"} | Email: {entry.receiver?.email || "N/A"}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: "20px 0 16px" }} />

            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
              <Descriptions.Item label="Shipping Date">
                <Text strong>{entry.shippingDate || "N/A"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Waybill / AWB No">
                {entry.waybillNo ? <Tag color="geekblue">{entry.waybillNo}</Tag> : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="VAT Number">
                {entry.vatNo || "N/A"}
              </Descriptions.Item>

              <Descriptions.Item label="Reason for Export">
                {entry.reasonForExport || "Samples, as per customer request."}
              </Descriptions.Item>
              <Descriptions.Item label="Total Box Count">
                <Tag color="purple">{totals.noOfBoxes} Box(es)</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Currency">
                <Tag color="cyan">{currency}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Sample Items Table */}
          <Card 
            title={<span style={{ fontWeight: 600 }}>Commodities & Sample Items ({entry.items?.length || 0})</span>}
            bordered={false}
            style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Table
              columns={itemColumns}
              dataSource={entry.items || []}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>

        {/* Right Column: Calculations & Quick Export */}
        <Col xs={24} lg={8}>
          {/* Totals Breakdown Card */}
          <Card 
            title={<span style={{ fontWeight: 600 }}>Financial & Weight Breakdown</span>}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Text type="secondary">Total Quantity:</Text>
              <Text strong style={{ color: "#4f46e5" }}>{totals.totalQty} pcs</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Text type="secondary">Total Net Weight:</Text>
              <Text strong>{totals.totalNetWeight} kg</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Text type="secondary">Total Gross Weight:</Text>
              <Text strong>{totals.totalGrossWeight} kg</Text>
            </div>
            <Divider style={{ margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Text type="secondary">Cargo Value:</Text>
              <Text strong>{currency} {totals.cargoValue.toFixed(2)}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Text type="secondary">Courier Charges:</Text>
              <Text strong>{currency} {totals.courierCharges.toFixed(2)}</Text>
            </div>
            <div 
              style={{
                background: "#ecfdf5",
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid #a7f3d0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <Text strong style={{ color: "#065f46" }}>TOTAL INVOICE VALUE</Text>
              <Text strong style={{ fontSize: 18, color: "#047857" }}>
                {currency} {totals.totalInvoiceValue.toFixed(2)}
              </Text>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card 
            title={<span style={{ fontWeight: 600 }}>Quick Exports & Documents</span>}
            bordered={false}
            style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Space orientation="vertical" style={{ width: "100%" }} size="middle">
              <Button
                block
                icon={<FilePdfOutlined style={{ color: "#ef4444" }} />}
                onClick={() => handleDownloadPdf("invoice")}
              >
                Sample Invoice PDF
              </Button>
              <Button
                block
                icon={<FilePdfOutlined style={{ color: "#10b981" }} />}
                onClick={() => handleDownloadPdf("phyto")}
              >
                Phyto Application PDF
              </Button>
              <Button
                block
                icon={<FilePdfOutlined style={{ color: "#f59e0b" }} />}
                onClick={() => handleDownloadPdf("packing")}
              >
                Export Packing List PDF
              </Button>
              <Button
                block
                type="primary"
                ghost
                icon={<FilePdfOutlined />}
                onClick={() => handleDownloadPdf("bundle")}
              >
                Complete Bundle (3-in-1 PDF)
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

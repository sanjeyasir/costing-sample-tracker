import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Input,
  InputNumber,
  Button,
  Select,
  Row,
  Col,
  Table,
  Space,
  Typography,
  Tabs,
  Tag,
  Divider,
  message,
  Upload,
  Tooltip,
  Spin
} from "antd";
import {
  SaveOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  CopyOutlined,
  EyeOutlined,
  EditOutlined,
  FileImageOutlined
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import logoUrl from "../../assets/hayleys-fibre-log.jpg";
import emblemUrl from "../../assets/sri-lanka-emblem.png";
import { 
  DEFAULT_DISPATCH_DATA, 
  calculateDispatchTotals
} from "../../utils/dispatchCalculations";
import {
  generateSampleInvoicePDF,
  generatePhytoApplicationPDF,
  generatePackingListPDF,
  generateCompleteDispatchBundlePDF,
  downloadPdfFile
} from "../../utils/dispatchPdfGenerator";
import {
  getDispatchEntryById,
  createDispatchEntry,
  updateDispatchEntry,
  getTemplateConfig
} from "../../services/firebase/dispatchService";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function DispatchEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState("form");
  const [previewDocTab, setPreviewDocTab] = useState("invoice");

  // Main Form Data State
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(DEFAULT_DISPATCH_DATA)));

  // Load existing dispatch or template defaults on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        if (isEditMode) {
          const entry = await getDispatchEntryById(id);
          if (!entry) {
            message.error("Dispatch record not found.");
            navigate("/dispatch-tracker");
            return;
          }
          setFormData(entry);
        } else {
          const template = await getTemplateConfig();
          if (template) {
            setFormData(prev => ({
              ...prev,
              ...template,
              shippingDate: new Date().toISOString().split("T")[0],
              dispatchNo: "" // Auto-generated on save
            }));
          }
        }
      } catch (err) {
        console.error("Init failed:", err);
        message.error("Failed to load dispatch details.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, isEditMode, navigate]);

  // Derived calculations
  const totals = calculateDispatchTotals(formData);
  const currency = formData.receiver?.currency || "USD";

  // Form Change Handlers
  const handleRootChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [field]: value
      }
    }));
  };

  // Signature Upload
  const handleSignatureUpload = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("Please upload an image file (PNG/JPG).");
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setFormData(prev => ({
        ...prev,
        sender: {
          ...(prev.sender || {}),
          signatureBase64: base64,
          signatureUrl: base64
        }
      }));
      message.success("Signature updated for this dispatch!");
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleRemoveSignature = () => {
    setFormData(prev => ({
      ...prev,
      sender: {
        ...(prev.sender || {}),
        signatureBase64: "",
        signatureUrl: ""
      }
    }));
    message.info("Signature removed.");
  };

  // Item List Handlers
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleAddItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      description: "",
      commonName: "",
      botanicalName: "Cocos nucifera",
      qty: 1,
      unit: "pcs",
      weightKg: 1,
      unitPrice: 0.1,
      boxNo: `Box ${Math.max(1, (formData.items?.length || 0) + 1)}`
    };
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const handleDeleteItem = (index) => {
    setFormData(prev => {
      const items = (prev.items || []).filter((_, i) => i !== index);
      return { ...prev, items };
    });
  };

  const handleDuplicateItem = (index) => {
    setFormData(prev => {
      const target = prev.items[index];
      const copy = { ...target, id: `item-${Date.now()}` };
      const items = [...prev.items];
      items.splice(index + 1, 0, copy);
      return { ...prev, items };
    });
  };


  // Save to Firestore
  const handleSave = async (statusOverride = null) => {
    try {
      setSaving(true);
      const status = statusOverride || formData.status || "Draft";
      const payload = {
        ...formData,
        status
      };

      if (isEditMode) {
        await updateDispatchEntry(id, payload, currentUser);
        message.success("Dispatch record updated successfully!");
        navigate("/dispatch-tracker");
      } else {
        const created = await createDispatchEntry(payload, currentUser);
        message.success(`Dispatch record created with No: ${created.dispatchNo}`);
        navigate("/dispatch-tracker");
      }
    } catch (err) {
      console.error("Save failed:", err);
      message.error("Failed to save dispatch entry: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // PDF Downloads
  const handleDownloadPdf = async (type) => {
    try {
      setDownloading(true);
      const filenameBase = `${formData.dispatchNo || "Dispatch"}_${formData.shippingDate || "Doc"}`;

      if (type === "invoice") {
        await downloadPdfFile(generateSampleInvoicePDF(formData), `${filenameBase}_Sample_Invoice.pdf`);
        message.success("Sample Invoice PDF downloaded!");
      } else if (type === "phyto") {
        await downloadPdfFile(generatePhytoApplicationPDF(formData), `${filenameBase}_Phyto_Application.pdf`);
        message.success("Phyto Application PDF downloaded!");
      } else if (type === "packing") {
        await downloadPdfFile(generatePackingListPDF(formData), `${filenameBase}_Packing_List.pdf`);
        message.success("Packing List PDF downloaded!");
      } else if (type === "bundle") {
        await downloadPdfFile(generateCompleteDispatchBundlePDF(formData), `${filenameBase}_Complete_Bundle.pdf`);
        message.success("Complete Documentation Bundle PDF downloaded!");
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      message.error("PDF Generation error: " + err.message);
    } finally {
      setDownloading(false);
    }
  };


  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Spin size="large" tip="Loading Dispatch Tracker..." />
      </div>
    );
  }

  // Items Table Columns for Form Tab
  const itemColumns = [
    {
      title: "#",
      key: "index",
      width: 45,
      render: (_, __, index) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: "Item / Description",
      key: "description",
      render: (_, item, index) => (
        <Input
          placeholder="e.g. Needeled sheet 290 × 500 mm x10 mm"
          value={item.description}
          onChange={(e) => handleItemChange(index, "description", e.target.value)}
        />
      ),
    },
    {
      title: "Botanical Name",
      key: "botanicalName",
      width: 170,
      render: (_, item, index) => (
        <Select
          style={{ width: "100%" }}
          value={item.botanicalName || "Cocos nucifera"}
          onChange={(val) => handleItemChange(index, "botanicalName", val)}
        >
          <Option value="Cocos nucifera">Cocos nucifera (Coir)</Option>
          <Option value="Coir Pith Block">Coir Pith Block</Option>
          <Option value="Rubberized Coir">Rubberized Coir</Option>
          <Option value="Geotextile Mesh">Geotextile Mesh</Option>
          <Option value="Other Plant Material">Other Plant Material</Option>
        </Select>
      ),
    },
    {
      title: "QTY",
      key: "qty",
      width: 95,
      render: (_, item, index) => (
        <InputNumber
          min={1}
          style={{ width: "100%" }}
          value={item.qty}
          onChange={(val) => handleItemChange(index, "qty", val)}
        />
      ),
    },
    {
      title: "Weight (Kg)",
      key: "weightKg",
      width: 105,
      render: (_, item, index) => (
        <InputNumber
          min={0}
          step={0.5}
          style={{ width: "100%" }}
          value={item.weightKg}
          onChange={(val) => handleItemChange(index, "weightKg", val)}
        />
      ),
    },
    {
      title: `Unit Price (${currency})`,
      key: "unitPrice",
      width: 125,
      render: (_, item, index) => (
        <InputNumber
          min={0}
          step={0.05}
          style={{ width: "100%" }}
          value={item.unitPrice}
          onChange={(val) => handleItemChange(index, "unitPrice", val)}
        />
      ),
    },
    {
      title: "Box No",
      key: "boxNo",
      width: 110,
      render: (_, item, index) => (
        <Input
          placeholder="Box 1"
          value={item.boxNo}
          onChange={(e) => handleItemChange(index, "boxNo", e.target.value)}
        />
      ),
    },
    {
      title: `Total (${currency})`,
      key: "lineTotal",
      width: 100,
      render: (_, item) => {
        const total = (Number(item.qty || 0) * Number(item.unitPrice || 0)).toFixed(2);
        return <Text strong>{currency} {total}</Text>;
      },
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_, __, index) => (
        <Space size="small">
          <Tooltip title="Duplicate Row">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicateItem(index)}
            />
          </Tooltip>
          <Tooltip title="Delete Row">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteItem(index)}
              disabled={(formData.items || []).length <= 1}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Top Navigation & Action Bar */}
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
            Back to List
          </Button>
          <div>
            <Title level={4} style={{ margin: 0, color: "#000000" }}>
              {isEditMode ? `Edit Dispatch: ${formData.dispatchNo || id}` : "Create New Dispatch Entry"}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isEditMode ? "Update details, recalculate invoices, and generate export documents" : "Fill data entry fields to automatically populate and generate invoices"}
            </Text>
          </div>
        </Space>

        <Space wrap>

          <Button
            icon={<FilePdfOutlined />}
            onClick={() => handleDownloadPdf("bundle")}
            loading={downloading}
          >
            Download All PDFs (Bundle)
          </Button>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            style={{ background: "#000000", borderColor: "#000000", fontWeight: 600 }}
            onClick={() => handleSave()}
            loading={saving}
          >
            Save Details
          </Button>
        </Space>
      </div>

      {/* Main Tabs: Form Editor vs Live Official Document Previews */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: "form",
            label: <span><EditOutlined /> Data Entry & Formulation</span>,
            children: (
              <div>
                <Row gutter={[20, 20]}>
                  {/* Left Column: Sender Profile & Signature */}
                  <Col xs={24} lg={12}>
                    <Card 
                      title={<span style={{ fontWeight: 600 }}>1. Sender / Exporter Profile</span>}
                      bordered={false}
                      style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                    >
                      <Row gutter={[12, 12]}>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Sender Name</label>
                          <Input
                            placeholder="Manura Mohotti"
                            value={formData.sender?.name}
                            onChange={(e) => handleNestedChange("sender", "name", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Designation & Title</label>
                          <Input
                            placeholder="Manura Mohotti-Manager Marketing"
                            value={formData.sender?.designation}
                            onChange={(e) => handleNestedChange("sender", "designation", e.target.value)}
                          />
                        </Col>
                        <Col span={24}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Company / Exporter Address</label>
                          <TextArea
                            rows={2}
                            placeholder="Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka"
                            value={formData.sender?.address}
                            onChange={(e) => handleNestedChange("sender", "address", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Contact Phone</label>
                          <Input
                            placeholder="+9474 216 8231"
                            value={formData.sender?.contact}
                            onChange={(e) => handleNestedChange("sender", "contact", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Email Address</label>
                          <Input
                            placeholder="Manura.Mohotti@hayleysfibre.com"
                            value={formData.sender?.email}
                            onChange={(e) => handleNestedChange("sender", "email", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Origin Country</label>
                          <Input
                            placeholder="Sri Lanka"
                            value={formData.sender?.country}
                            onChange={(e) => handleNestedChange("sender", "country", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Signature Printed Text</label>
                          <Input
                            placeholder="Manura Mohotti"
                            value={formData.sender?.signatureText}
                            onChange={(e) => handleNestedChange("sender", "signatureText", e.target.value)}
                          />
                        </Col>

                        {/* Signature PNG Box */}
                        <Col span={24}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Authorized Signature PNG</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
                            <div 
                              style={{ 
                                width: 140, 
                                height: 55, 
                                border: "1px dashed #000000", 
                                borderRadius: 6, 
                                display: "flex", 
                                justifyContent: "center", 
                                alignItems: "center", 
                                background: "#fff" 
                              }}
                            >
                              {formData.sender?.signatureBase64 || formData.sender?.signatureUrl ? (
                                <img 
                                  src={formData.sender.signatureBase64 || formData.sender.signatureUrl} 
                                  alt="Signature" 
                                  style={{ maxHeight: "90%", maxWidth: "90%", objectFit: "contain" }}
                                />
                              ) : (
                                <Text type="secondary" style={{ fontSize: 11 }}>No PNG</Text>
                              )}
                            </div>
                            <Upload beforeUpload={handleSignatureUpload} showUploadList={false} accept="image/png,image/jpeg">
                              <Button size="small" icon={<FileImageOutlined />}>Upload Signature</Button>
                            </Upload>
                            {(formData.sender?.signatureBase64 || formData.sender?.signatureUrl) && (
                              <Button size="small" danger icon={<DeleteOutlined />} onClick={handleRemoveSignature} />
                            )}
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* Right Column: Receiver / Consignee */}
                  <Col xs={24} lg={12}>
                    <Card 
                      title={<span style={{ fontWeight: 600 }}>2. Receiver / Consignee Profile</span>}
                      bordered={false}
                      style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                    >
                      <Row gutter={[12, 12]}>
                        <Col span={14}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Receiver / Company Name</label>
                          <Input
                            placeholder="Leonard Saranga"
                            value={formData.receiver?.name}
                            onChange={(e) => handleNestedChange("receiver", "name", e.target.value)}
                          />
                        </Col>
                        <Col span={10}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Currency</label>
                          <Select
                            style={{ width: "100%" }}
                            value={formData.receiver?.currency || "USD"}
                            onChange={(val) => handleNestedChange("receiver", "currency", val)}
                          >
                            <Option value="USD">USD ($)</Option>
                            <Option value="EUR">EUR (€)</Option>
                            <Option value="GBP">GBP (£)</Option>
                            <Option value="SEK">SEK (kr)</Option>
                            <Option value="LKR">LKR (Rs)</Option>
                          </Select>
                        </Col>
                        <Col span={24}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Full Delivery Address</label>
                          <TextArea
                            rows={3}
                            placeholder="Address&#10;Lgh 1001,&#10;Thomsons våg 30B,&#10;Malmö, Zip 21372&#10;Sweden"
                            value={formData.receiver?.address}
                            onChange={(e) => handleNestedChange("receiver", "address", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Contact Phone</label>
                          <Input
                            placeholder="+46 76 439 46 86"
                            value={formData.receiver?.contact}
                            onChange={(e) => handleNestedChange("receiver", "contact", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Email Address</label>
                          <Input
                            placeholder="leo@nordiceasysolutions.com"
                            value={formData.receiver?.email}
                            onChange={(e) => handleNestedChange("receiver", "email", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Destination Country</label>
                          <Input
                            placeholder="Sweden"
                            value={formData.receiver?.country}
                            onChange={(e) => handleNestedChange("receiver", "country", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Port of Entry</label>
                          <Input
                            placeholder="Malmö Airport / Port"
                            value={formData.receiver?.portOfEntry}
                            onChange={(e) => handleNestedChange("receiver", "portOfEntry", e.target.value)}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                {/* Section 3: Consignment & Reason for Export */}
                <Card 
                  title={<span style={{ fontWeight: 600 }}>3. Consignment, Reason for Export & Logistics</span>}
                  bordered={false}
                  style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Shipping Date</label>
                      <Input
                        type="date"
                        value={formData.shippingDate}
                        onChange={(e) => handleRootChange("shippingDate", e.target.value)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Waybill / AWB Number</label>
                      <Input
                        placeholder="e.g. 54329871"
                        value={formData.waybillNo}
                        onChange={(e) => handleRootChange("waybillNo", e.target.value)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Courier Charges ({currency})</label>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={0}
                        step={5}
                        value={formData.logistics?.courierCharges}
                        onChange={(val) => handleNestedChange("logistics", "courierCharges", val || 0)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>No. of Boxes</label>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={1}
                        value={formData.logistics?.noOfBoxes}
                        onChange={(val) => handleNestedChange("logistics", "noOfBoxes", val || 1)}
                      />
                    </Col>

                    <Col xs={24} sm={12}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Reason for Export (Mandatory on Invoices)</label>
                      <Input
                        value={formData.reasonForExport}
                        onChange={(e) => handleRootChange("reasonForExport", e.target.value)}
                        placeholder="Samples, as per customer request. Free of charge samples for evaluation."
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>VAT Number</label>
                      <Input
                        placeholder="e.g. 114059196-7000"
                        value={formData.vatNo}
                        onChange={(e) => handleRootChange("vatNo", e.target.value)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Dispatch Status</label>
                      <Select
                        style={{ width: "100%" }}
                        value={formData.status || "Draft"}
                        onChange={(val) => handleRootChange("status", val)}
                      >
                        <Option value="Draft">Draft</Option>
                        <Option value="Ready for Dispatch">Ready for Dispatch</Option>
                        <Option value="In Transit">In Transit</Option>
                        <Option value="Delivered">Delivered</Option>
                        <Option value="Cancelled">Cancelled</Option>
                      </Select>
                    </Col>
                  </Row>
                </Card>

                {/* Section 4: Sample Items Table */}
                <Card 
                  title={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>4. Sample Items & Quantities Grid</span>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        style={{ background: "#000000", borderColor: "#000000" }}
                        onClick={handleAddItem}
                      >
                        Add Item Row
                      </Button>
                    </div>
                  }
                  bordered={false}
                  style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                >
                  <Table
                    columns={itemColumns}
                    dataSource={formData.items || []}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 16 }}
                  />

                  {/* Summary & Live Calculation Bar */}
                  <div
                    style={{
                      background: "#fafafa",
                      borderRadius: 8,
                      padding: "16px 20px",
                      border: "1px solid #000000",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 16
                    }}
                  >
                    <Space size="large" wrap>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Total Items</Text>
                        <div><Text strong style={{ fontSize: 16 }}>{totals.computedItems.length}</Text></div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Total Pieces (QTY)</Text>
                        <div><Text strong style={{ fontSize: 16 }}>{totals.totalQty} pcs</Text></div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Total Net Weight</Text>
                        <div><Text strong style={{ fontSize: 16 }}>{totals.totalNetWeight} kg</Text></div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Total Gross Weight</Text>
                        <div><Text strong style={{ fontSize: 16 }}>{totals.totalGrossWeight} kg</Text></div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Courier Charges</Text>
                        <div><Text strong style={{ fontSize: 16 }}>{currency} {totals.courierCharges.toFixed(2)}</Text></div>
                      </div>
                    </Space>

                    <div style={{ textAlign: "right" }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>TOTAL INVOICE VALUE</Text>
                      <div>
                        <Text strong style={{ fontSize: 22 }}>
                          {currency} {totals.totalInvoiceValue.toFixed(2)}
                        </Text>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: "previews",
            label: <span><EyeOutlined /> Official Document Previews (B&W Structured)</span>,
            children: (
              <div>
                {/* 3 Official Documents Only */}
                <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <Space wrap>
                    <Button 
                      type={previewDocTab === "invoice" ? "primary" : "default"}
                      style={previewDocTab === "invoice" ? { background: "#000000", borderColor: "#000000" } : {}}
                      onClick={() => setPreviewDocTab("invoice")}
                    >
                      1. Commercial / Sample Invoice
                    </Button>
                    <Button 
                      type={previewDocTab === "phyto" ? "primary" : "default"}
                      style={previewDocTab === "phyto" ? { background: "#000000", borderColor: "#000000" } : {}}
                      onClick={() => setPreviewDocTab("phyto")}
                    >
                      2. Phyto Application (Sri Lanka Crest)
                    </Button>
                    <Button 
                      type={previewDocTab === "packing" ? "primary" : "default"}
                      style={previewDocTab === "packing" ? { background: "#000000", borderColor: "#000000" } : {}}
                      onClick={() => setPreviewDocTab("packing")}
                    >
                      3. Export Packing List (PQS/EXP/02)
                    </Button>
                  </Space>

                  <Space wrap>
                    {previewDocTab === "invoice" && (
                      <Button icon={<FilePdfOutlined />} onClick={() => handleDownloadPdf("invoice")}>
                        Download Sample Invoice PDF
                      </Button>
                    )}
                    {previewDocTab === "phyto" && (
                      <Button icon={<FilePdfOutlined />} onClick={() => handleDownloadPdf("phyto")}>
                        Download Phyto Application PDF
                      </Button>
                    )}
                    {previewDocTab === "packing" && (
                      <Button icon={<FilePdfOutlined />} onClick={() => handleDownloadPdf("packing")}>
                        Download Packing List PDF
                      </Button>
                    )}
                  </Space>
                </div>

                {/* TAB 1 PREVIEW: SAMPLE INVOICE (B&W) */}
                {previewDocTab === "invoice" && (
                  <Card 
                    bordered 
                    style={{ 
                      maxWidth: 820, 
                      margin: "0 auto", 
                      padding: "24px 32px", 
                      background: "#ffffff", 
                      borderRadius: 4,
                      border: "1.5px solid #000000",
                      fontFamily: "Arial, sans-serif",
                      color: "#000000"
                    }}
                  >
                    {/* Header with Hayleys Fibre Logo */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #000000", paddingBottom: 12, marginBottom: 12 }}>
                      <div style={{ width: 140 }}>
                        <img src={logoUrl} alt="Hayleys Fibre" style={{ width: "100%", maxHeight: 50, objectFit: "contain" }} />
                      </div>
                      <div style={{ textAlign: "center", flexGrow: 1 }}>
                        <Title level={4} style={{ margin: 0, color: "#000000", textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {formData.sender?.companyName || "TOYO CUSHION LANKA (PVT) LTD"}
                        </Title>
                        <Text style={{ fontSize: 11, color: "#000000" }}>
                          {formData.sender?.companyAddress || "No.25, Foster Lane, Colombo 10, Sri Lanka."}
                        </Text>
                        <div style={{ fontSize: 10, color: "#000000" }}>
                          Tel: {formData.sender?.contact || "+9474 216 8231"} | Email: {formData.sender?.email || "info@hayleysfibre.com"}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "center", background: "#f2f2f2", border: "1px solid #000000", padding: "4px 0", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>
                      COMMERCIAL / SAMPLE INVOICE
                    </div>

                    {/* Metadata Header Grid */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #000000" }}>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000", width: "33%" }}>
                            <strong>Invoice No:</strong> {formData.dispatchNo || "DSP-" + new Date().getFullYear()}
                          </td>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000", width: "33%" }}>
                            <strong>No. of Pieces:</strong> {totals.totalQty} pcs
                          </td>
                          <td style={{ padding: "5px", width: "34%" }}>
                            <strong>Currency:</strong> {currency}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #000000" }}>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>
                            <strong>Shipping Date:</strong> {formData.shippingDate || "N/A"}
                          </td>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>
                            <strong>Net Weight:</strong> {totals.totalNetWeight} Kg
                          </td>
                          <td style={{ padding: "5px" }}>
                            <strong>VAT Number:</strong> {formData.vatNo || "114059196-7000"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>
                            <strong>Waybill / AWB No:</strong> {formData.waybillNo || "N/A"}
                          </td>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>
                            <strong>Gross Weight:</strong> {totals.totalGrossWeight} Kg
                          </td>
                          <td style={{ padding: "5px" }}>
                            <strong>No. of Boxes:</strong> {totals.noOfBoxes} Box(es)
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Reason for Export Box (Required) */}
                    <div style={{ border: "1px solid #000000", padding: "6px 8px", fontSize: 11, marginBottom: 12, background: "#fafafa" }}>
                      <strong>REASON FOR EXPORT:</strong> {formData.reasonForExport || "Samples, as per customer request. Free of charge samples of no commercial value."}
                    </div>

                    {/* 2-Column Shipper vs Consignee Box */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <thead>
                        <tr style={{ background: "#f2f2f2", borderBottom: "1px solid #000000" }}>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", width: "50%", textAlign: "left" }}>SHIPPER / EXPORTER</th>
                          <th style={{ padding: "5px", textAlign: "left" }}>SHIP TO / CONSIGNEE</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: "8px", borderRight: "1px solid #000000", verticalAlign: "top" }}>
                            <strong>{formData.sender?.name}</strong><br />
                            <span style={{ whiteSpace: "pre-line" }}>{formData.sender?.address}</span><br />
                            <span>Tel: {formData.sender?.contact}</span><br />
                            <span>Email: {formData.sender?.email}</span>
                          </td>
                          <td style={{ padding: "8px", verticalAlign: "top" }}>
                            <strong>{formData.receiver?.name}</strong><br />
                            <span style={{ whiteSpace: "pre-line" }}>{formData.receiver?.address}</span><br />
                            <span>Country: {formData.receiver?.country}</span><br />
                            <span>Tel: {formData.receiver?.contact}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Origin SOO Notice */}
                    <div style={{ border: "1px solid #000000", padding: "5px 8px", fontSize: 9.5, fontStyle: "italic", marginBottom: 12, background: "#fafafa" }}>
                      SOO : The exporter TOYO CUSHION LANKA(PVT)LTD, 400 DEANS ROAD, COLOMBO- 10, SRI LANKA - LKREX114059196DC0155 dated 23/07/2018 of the products covered by this document declares that, except where otherwise clearly indicated, these products are of SRI LANKA preferential origin according to rules of origin of Generalized System of Preferences of European Community ("P").
                    </div>

                    {/* Item Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <thead>
                        <tr style={{ background: "#f2f2f2", borderBottom: "1px solid #000000", textAlign: "left" }}>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>#</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>Item Description</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>QTY</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>Unit Price ({currency})</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>Weight (Kg)</th>
                          <th style={{ padding: "5px", textAlign: "right" }}>Total ({currency})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {totals.computedItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{idx + 1}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{item.description}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>{item.qty}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>{Number(item.unitPrice).toFixed(2)}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>{Number(item.weightKg).toFixed(1)}</td>
                            <td style={{ padding: "5px", textAlign: "right", fontWeight: "bold" }}>{Number(item.lineTotal).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals Section */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 14, border: "1px solid #000000" }}>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #000000" }}>
                          <td style={{ padding: "5px" }}>Total Cargo Weight / Value:</td>
                          <td style={{ padding: "5px", textAlign: "right", fontWeight: "bold" }}>
                            {totals.totalNetWeight} Kg  |  {currency} {totals.cargoValue.toFixed(2)}
                          </td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #000000" }}>
                          <td style={{ padding: "5px" }}>Total Gross Weight:</td>
                          <td style={{ padding: "5px", textAlign: "right", fontWeight: "bold" }}>{totals.totalGrossWeight} Kg</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #000000" }}>
                          <td style={{ padding: "5px" }}>+ Courier Charges:</td>
                          <td style={{ padding: "5px", textAlign: "right", fontWeight: "bold" }}>{currency} {totals.courierCharges.toFixed(2)}</td>
                        </tr>
                        <tr style={{ background: "#f2f2f2", fontWeight: "bold", fontSize: 12 }}>
                          <td style={{ padding: "6px" }}>TOTAL INVOICE VALUE (Customs Purpose):</td>
                          <td style={{ padding: "6px", textAlign: "right" }}>{currency} {totals.totalInvoiceValue.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Certification & Signature Block */}
                    <div style={{ fontSize: 9.5, fontStyle: "italic", marginBottom: 16 }}>
                      We hereby certify that the information on this invoice is true and that the contents of this are as stated above. Above invoice value is for custom declaration purpose only. These are free of charge samples of no commercial value.
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        {(formData.sender?.signatureBase64 || formData.sender?.signatureUrl) && (
                          <div style={{ height: 45, marginBottom: 4 }}>
                            <img src={formData.sender.signatureBase64 || formData.sender.signatureUrl} alt="Signature" style={{ height: "100%", objectFit: "contain" }} />
                          </div>
                        )}
                        <div style={{ borderBottom: "1px solid #000000", width: 180, marginBottom: 4 }}></div>
                        <div style={{ fontWeight: "bold", fontSize: 11 }}>{formData.sender?.designation}</div>
                        <div style={{ fontSize: 10 }}>{formData.sender?.companyName}</div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 11 }}>
                        <div><strong>Date:</strong> {formData.shippingDate}</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* TAB 2 PREVIEW: PHYTO APPLICATION (B&W with Emblem) */}
                {previewDocTab === "phyto" && (
                  <Card 
                    bordered 
                    style={{ 
                      maxWidth: 820, 
                      margin: "0 auto", 
                      padding: "24px 32px", 
                      background: "#ffffff", 
                      borderRadius: 4,
                      border: "1.5px solid #000000",
                      fontFamily: "Arial, sans-serif",
                      color: "#000000"
                    }}
                  >
                    {/* Sri Lanka State Emblem */}
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <img src={emblemUrl} alt="Sri Lanka Emblem" style={{ width: 48, height: "auto", objectFit: "contain", marginBottom: 16 }} />
                      <Title level={4} style={{ margin: "0 0 4px", color: "#000000", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        DEPARTMENT OF AGRICULTURE, SRI LANKA
                      </Title>
                      <Text strong style={{ fontSize: 12, display: "block", marginBottom: 2 }}>
                        APPLICATION FOR PHYTOSANITARY CERTIFICATE
                      </Text>
                      <div style={{ fontSize: 10, color: "#333333" }}>
                        Application for Phytosanitary Certificate / For Re-Export
                      </div>
                    </div>

                    <Divider style={{ borderColor: "#000000", margin: "8px 0 12px" }} />

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <thead>
                        <tr style={{ background: "#f2f2f2", borderBottom: "1px solid #000000" }}>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", width: "50%", textAlign: "left" }}>1. Name and address of exporter:</th>
                          <th style={{ padding: "5px", textAlign: "left" }}>2. Name and address of consignee:</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: "8px", borderRight: "1px solid #000000", verticalAlign: "top" }}>
                            {formData.sender?.address}
                          </td>
                          <td style={{ padding: "8px", verticalAlign: "top", whiteSpace: "pre-line" }}>
                            {formData.receiver?.address}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #000000" }}>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000", width: "50%" }}>
                            <strong>3. Place of origin:</strong> {formData.sender?.originCity || "COLOMBO, SRI LANKA"}
                          </td>
                          <td style={{ padding: "5px", width: "50%" }}>
                            <strong>4. Airway Bill No:</strong> {formData.waybillNo || "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>
                            <strong>5. Means of conveyance:</strong> {formData.sender?.meansOfConveyance || "BY COURIER FROM COLOMBO, SRI LANKA"}
                          </td>
                          <td style={{ padding: "5px" }}>
                            <strong>6. Point of entry / Use:</strong> {formData.receiver?.country} | {formData.logistics?.intendedUse || "As samples"}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ background: "#f2f2f2", border: "1px solid #000000", borderBottom: "none", padding: "5px 8px", fontWeight: "bold", fontSize: 10.5 }}>
                      7. Distinguishing marks; No. and description of packages; Name of produce (including botanical name of plants)
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <thead>
                        <tr style={{ background: "#f2f2f2", borderBottom: "1px solid #000000", textAlign: "left" }}>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>#</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>Produce Name & Botanical Name</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>Quantity</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>Unit</th>
                          <th style={{ padding: "5px", textAlign: "right" }}>Gross Weight (Kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {totals.computedItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{idx + 1}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{item.description} <em>({item.botanicalName || "Cocos nucifera"})</em></td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>{item.qty}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>pcs</td>
                            <td style={{ padding: "5px", textAlign: "right" }}>{idx === 0 ? totals.totalGrossWeight : "-"}</td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f2f2f2", fontWeight: "bold" }}>
                          <td colSpan={2} style={{ padding: "5px", borderRight: "1px solid #000000" }}>Total Consignment Weights:</td>
                          <td colSpan={2} style={{ padding: "5px", borderRight: "1px solid #000000" }}>Net: {totals.totalNetWeight} Kgs</td>
                          <td style={{ padding: "5px", textAlign: "right" }}>Gross: {totals.totalGrossWeight} Kgs</td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ fontSize: 9.5, fontStyle: "italic", marginBottom: 14 }}>
                      Kindly inspect the products described above and issue a Certificate in accordance with Article V of the International Plant Protection Convention, 1951, as amended in 1979.
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
                      <div>
                        {(formData.sender?.signatureBase64 || formData.sender?.signatureUrl) && (
                          <div style={{ height: 45, marginBottom: 4 }}>
                            <img src={formData.sender.signatureBase64 || formData.sender.signatureUrl} alt="Signature" style={{ height: "100%", objectFit: "contain" }} />
                          </div>
                        )}
                        <div style={{ borderBottom: "1px solid #000000", width: 170, marginBottom: 4 }}></div>
                        <div style={{ fontWeight: "bold", fontSize: 11 }}>Exporter's Signature</div>
                        <div style={{ fontSize: 10 }}>{formData.sender?.designation}</div>
                      </div>
                      <div style={{ fontSize: 11 }}>
                        <div><strong>Date:</strong> {formData.shippingDate}</div>
                      </div>
                    </div>

                    {/* Official Use Only Box */}
                    <div style={{ border: "1px solid #000000", padding: "8px 12px", fontSize: 10, background: "#fafafa" }}>
                      <strong>FOR OFFICIAL USE ONLY (NATIONAL PLANT QUARANTINE SERVICE)</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
                        <div>Certificate No: ....................................................</div>
                        <div>Date of Inspection: ............................................</div>
                        <div>Inspecting Officer: ............................................</div>
                        <div>Official Seal & Signature: .................................</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* TAB 3 PREVIEW: PACKING LIST (B&W) */}
                {previewDocTab === "packing" && (
                  <Card 
                    bordered 
                    style={{ 
                      maxWidth: 820, 
                      margin: "0 auto", 
                      padding: "24px 32px", 
                      background: "#ffffff", 
                      borderRadius: 4,
                      border: "1.5px solid #000000",
                      fontFamily: "Arial, sans-serif",
                      color: "#000000"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1.5px solid #000000", paddingBottom: 10, marginBottom: 12 }}>
                      <div>
                        <Title level={4} style={{ margin: 0, color: "#000000", textTransform: "uppercase" }}>EXPORT PACKING LIST</Title>
                        <Text strong style={{ fontSize: 12 }}>{formData.sender?.companyName}</Text>
                        <div style={{ fontSize: 11 }}>{formData.sender?.companyAddress} | Tel: {formData.sender?.contact}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ border: "1px solid #000000", padding: "2px 8px", fontWeight: "bold", fontSize: 11, display: "inline-block" }}>
                          PQS/EXP/02
                        </div>
                        <div style={{ fontSize: 10, marginTop: 4 }}>PSC No: {formData.logistics?.pscNo || "(Office use)"}</div>
                      </div>
                    </div>

                    {/* Section 1: Details of Consignment */}
                    <div style={{ border: "1px solid #000000", padding: 8, fontSize: 11, marginBottom: 12 }}>
                      <div style={{ background: "#f2f2f2", margin: "-8px -8px 6px", padding: "4px 8px", fontWeight: "bold", borderBottom: "1px solid #000000" }}>
                        1. DETAILS OF THE CONSIGNMENT
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        <div>Exporting country: <strong>{formData.receiver?.country}</strong></div>
                        <div>Airway Bill No: <strong>{formData.waybillNo || "N/A"}</strong></div>
                        <div>Exporter Address: {formData.sender?.address}</div>
                        <div>Invoice No: <strong>{formData.dispatchNo || "N/A"}</strong></div>
                      </div>
                    </div>

                    {/* Section 2: Forwarding Agent */}
                    <div style={{ border: "1px solid #000000", padding: 8, fontSize: 11, marginBottom: 12 }}>
                      <div style={{ background: "#f2f2f2", margin: "-8px -8px 6px", padding: "4px 8px", fontWeight: "bold", borderBottom: "1px solid #000000" }}>
                        2. DETAILS OF WHARF CLERK / FORWARDING AGENT
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        <div>Name: {formData.logistics?.wharfClerkName || "N/A"}</div>
                        <div>ID No: {formData.logistics?.wharfClerkId || "N/A"}</div>
                        <div>Contact Tel: {formData.logistics?.wharfClerkContact || "N/A"}</div>
                        <div>CHA Reg No: {formData.logistics?.wharfClerkChaReg || "N/A"}</div>
                      </div>
                    </div>

                    {/* Section 3: Commodities Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12, border: "1px solid #000000" }}>
                      <thead>
                        <tr style={{ background: "#f2f2f2", borderBottom: "1px solid #000000", textAlign: "left" }}>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>#</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>Item Description</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>Botanical Name</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000" }}>Box No</th>
                          <th style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>Net Wt (Kg)</th>
                          <th style={{ padding: "5px", textAlign: "right" }}>Gross Wt (Kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {totals.computedItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #000000" }}>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{idx + 1}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{item.description}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}><em>{item.botanicalName || "Cocos nucifera"}</em></td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>{item.boxNo || "Box 1"}</td>
                            <td style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>{Number(item.weightKg).toFixed(1)}</td>
                            <td style={{ padding: "5px", textAlign: "right" }}>{idx === 0 ? totals.totalGrossWeight : "-"}</td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f2f2f2", fontWeight: "bold" }}>
                          <td colSpan={3} style={{ padding: "5px", borderRight: "1px solid #000000" }}>TOTALS:</td>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000" }}>Boxes: {totals.noOfBoxes}</td>
                          <td style={{ padding: "5px", borderRight: "1px solid #000000", textAlign: "right" }}>{totals.totalNetWeight} Kg</td>
                          <td style={{ padding: "5px", textAlign: "right" }}>{totals.totalGrossWeight} Kg</td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ fontSize: 9.5, fontStyle: "italic", marginTop: 14, marginBottom: 10, color: "#333333" }}>
                      (Note - If you collect any commodity from the certified fields please paste stickers on the other side of the packing list)
                    </div>

                    <div style={{ fontWeight: "bold", fontSize: 11.5, marginBottom: 24 }}>
                      Above items and quantities are ready for export.
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
                      <div>
                        {(formData.sender?.signatureBase64 || formData.sender?.signatureUrl) && (
                          <div style={{ height: 45, marginBottom: 4 }}>
                            <img src={formData.sender.signatureBase64 || formData.sender.signatureUrl} alt="Signature" style={{ height: "100%", objectFit: "contain" }} />
                          </div>
                        )}
                        <div style={{ borderBottom: "1px solid #000000", width: 170, marginBottom: 4 }}></div>
                        <div style={{ fontWeight: "bold", fontSize: 11 }}>Authorized Officer Signature</div>
                        <div style={{ fontSize: 10 }}>{formData.sender?.designation}</div>
                        <div style={{ fontSize: 10 }}>{formData.sender?.companyName}</div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 11 }}>
                        <div><strong>Date:</strong> {formData.shippingDate}</div>
                      </div>
                    </div>

                    {/* Director Customs Note */}
                    <div style={{ border: "1px solid #000000", padding: "6px 10px", fontSize: 10, background: "#fafafa" }}>
                      <strong>To: Director Customs / NPQS Inspector</strong>
                      <div>Location: {formData.logistics?.directorCustomsNote || "BIA, Katunayake, Sri Lanka"}</div>
                      <div>Certified for export customs clearance and quarantine inspection.</div>
                    </div>
                  </Card>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

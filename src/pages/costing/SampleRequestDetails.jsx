import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as sampleService from "../../services/firebase/sampleService";
import { downloadSamplePDF } from "../../utils/pdfGenerator";
import * as notificationService from "../../services/firebase/notificationService";
import {
  getDispatchBySampleRequestId,
  createOrUpdateDispatchForSampleRequest,
  buildDispatchFromSampleRequest,
  getTemplateConfig
} from "../../services/firebase/dispatchService";
import { calculateDispatchTotals } from "../../utils/dispatchCalculations";
import {
  generateSampleInvoicePDF,
  generatePhytoApplicationPDF,
  generatePackingListPDF,
  generateCompleteDispatchBundlePDF,
  downloadPdfFile
} from "../../utils/dispatchPdfGenerator";

import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Tag,
  Space,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Alert,
  Spin,
  Descriptions,
  Divider,
  Upload,
  Timeline,
  Tabs,
  Table,
  Tooltip,
  Modal,
  message
} from "antd";
import {
  LeftOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  RollbackOutlined,
  UploadOutlined,
  DeleteOutlined,
  CloudDownloadOutlined,
  PlusOutlined,
  SendOutlined,
  EyeOutlined,
  EditOutlined,
  UserOutlined,
  InboxOutlined,
  FileImageOutlined,
  GlobalOutlined,
  CheckCircleFilled
} from "@ant-design/icons";
import dayjs from "dayjs";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function SampleRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Workflow Dialog Form States
  const [plannedDeliveryDate, setPlannedDeliveryDate] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [actualCompletionDate, setActualCompletionDate] = useState(dayjs());
  const [completionRemarks, setCompletionRemarks] = useState("");

  // Resubmission Edit States
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [table2Data, setTable2Data] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);

  // Integrated Dispatch Tracker State
  const [activeTab, setActiveTab] = useState("workflow");
  const [dispatchData, setDispatchData] = useState(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const hotTable2Ref = useRef(null);

  useEffect(() => {
    loadRequestAndDispatch();
  }, [id]);

  const loadRequestAndDispatch = async () => {
    try {
      setLoading(true);
      setError("");

      const [sampleData, existingDispatch, templateConfig] = await Promise.all([
        sampleService.getSampleRequestById(id),
        getDispatchBySampleRequestId(id),
        getTemplateConfig()
      ]);

      setRequest(sampleData);

      // Initialize items list for sample requisition table
      const itemsList = sampleData.items || [{
        product: sampleData.product || "",
        quantity: sampleData.quantity || 1,
        sampleType: sampleData.sampleType || "New Development",
        description: sampleData.description || "",
        specialNotes: sampleData.specialNotes || ""
      }];
      setTable2Data(itemsList);
      setNewAttachments([]);

      // Initialize Dispatch Data: Look up existing or auto-populate from logged-in user profile
      if (existingDispatch) {
        const baseSender = templateConfig?.sender || {};
        const savedSender = existingDispatch.sender || {};
        const enrichedSender = {
          ...baseSender,
          ...savedSender,
          address: savedSender.address || savedSender.companyAddress || baseSender.address || "",
          signatureBase64: savedSender.signatureBase64 || savedSender.signatureUrl || (existingDispatch.createdByUid === currentUser?.uid ? currentUser?.salesOfficerProfile?.signatureBase64 : "") || "",
          signatureUrl: savedSender.signatureUrl || savedSender.signatureBase64 || (existingDispatch.createdByUid === currentUser?.uid ? currentUser?.salesOfficerProfile?.signatureUrl : "") || ""
        };
        setDispatchData({
          ...existingDispatch,
          sender: enrichedSender
        });
      } else {
        // Auto-build from Sample Request & active user's saved sales officer profile
        const activeSender = currentUser?.salesOfficerProfile || templateConfig?.sender;
        const initialDispatch = buildDispatchFromSampleRequest(sampleData, activeSender, templateConfig);
        setDispatchData(initialDispatch);
      }
    } catch (err) {
      console.error("Error loading request and dispatch:", err);
      setError("Failed to load sample requisition & dispatch details.");
    } finally {
      setLoading(false);
    }
  };

  // Dispatch Data change handlers
  const handleDispatchRootChange = (field, value) => {
    setDispatchData(prev => ({ ...prev, [field]: value }));
  };

  const handleDispatchNestedChange = (parent, field, value) => {
    setDispatchData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [field]: value
      }
    }));
  };

  const handleDispatchItemChange = (index, field, value) => {
    setDispatchData(prev => {
      const items = [...(prev.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const handleAddDispatchItem = () => {
    setDispatchData(prev => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: `item-${Date.now()}`,
          description: "",
          commonName: "",
          botanicalName: "Cocos nucifera",
          qty: 1,
          unit: "pcs",
          weightKg: 1,
          unitPrice: 0.1,
          boxNo: `Box ${Math.max(1, (prev.items?.length || 0) + 1)}`
        }
      ]
    }));
  };

  const handleDeleteDispatchItem = (index) => {
    setDispatchData(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index)
    }));
  };

  // Save Dispatch Formulation
  const handleSaveDispatch = async (statusOverride = null) => {
    if (!dispatchData) return;
    try {
      setDispatchSaving(true);
      const statusToSave = statusOverride || dispatchData.status || "Ready for Dispatch";
      const payload = {
        ...dispatchData,
        sampleRequestId: id,
        sampleRequestNo: request.sampleRequestNo,
        status: statusToSave
      };

      const saved = await createOrUpdateDispatchForSampleRequest(id, payload, currentUser);
      setDispatchData(saved);
      setRequest(prev => ({
        ...prev,
        dispatchId: saved.id,
        dispatchNo: saved.dispatchNo,
        dispatchStatus: saved.status
      }));
      message.success(`Dispatch documentation saved successfully (No: ${saved.dispatchNo})`);
    } catch (err) {
      console.error("Failed to save dispatch:", err);
      message.error("Failed to save dispatch documentation: " + err.message);
    } finally {
      setDispatchSaving(false);
    }
  };

  // One-Click PDF Generation & Download
  const handleDownloadPdf = async (type) => {
    try {
      setDownloadingPdf(true);
      const filenameBase = `${request?.sampleRequestNo || "Sample"}_${dispatchData?.dispatchNo || "Dispatch"}`;

      if (type === "qp02b") {
        await downloadSamplePDF(request);
        message.success("Sample Requisition (QP-02-B) PDF downloaded!");
      } else if (type === "invoice") {
        if (!dispatchData) throw new Error("Dispatch details not ready.");
        await downloadPdfFile(generateSampleInvoicePDF(dispatchData), `${filenameBase}_Commercial_Invoice.pdf`);
        message.success("Commercial / Sample Invoice PDF downloaded!");
      } else if (type === "phyto") {
        if (!dispatchData) throw new Error("Dispatch details not ready.");
        await downloadPdfFile(generatePhytoApplicationPDF(dispatchData), `${filenameBase}_Phyto_Application.pdf`);
        message.success("Phyto Application PDF downloaded!");
      } else if (type === "packing") {
        if (!dispatchData) throw new Error("Dispatch details not ready.");
        await downloadPdfFile(generatePackingListPDF(dispatchData), `${filenameBase}_Export_Packing_List.pdf`);
        message.success("Export Packing List PDF downloaded!");
      } else if (type === "bundle") {
        if (!dispatchData) throw new Error("Dispatch details not ready.");
        await downloadPdfFile(generateCompleteDispatchBundlePDF(dispatchData), `${filenameBase}_Complete_Export_Bundle.pdf`);
        message.success("Complete Export Documentation Bundle (3-in-1 PDF) downloaded!");
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      message.error("PDF Generation error: " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Workflow Handlers
  const handleCustomUpload = ({ file, onSuccess }) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = {
        uid: file.uid,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: e.target.result
      };
      setNewAttachments(prev => [...prev, fileData]);
      onSuccess("ok");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveNewAttachment = (uid) => {
    setNewAttachments(prev => prev.filter(a => a.uid !== uid));
  };

  const handleDownloadFile = (file) => {
    const link = document.createElement("a");
    link.href = file.dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAccept = async () => {
    if (!plannedDeliveryDate) {
      return setError("Please select a Planned Sample Delivery Date.");
    }
    try {
      setError("");
      setSaving(true);
      const updated = await sampleService.acceptSampleRequest(
        id,
        plannedDeliveryDate.format("YYYY-MM-DD"),
        remarks,
        currentUser?.displayName || "Sample Team"
      );
      setRequest(updated);
      setSuccessMsg("Sample request accepted successfully.");
      setRemarks("");
      setPlannedDeliveryDate(null);
    } catch (err) {
      setError(err.message || "Failed to accept sample request.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestMoreInfo = async () => {
    if (!remarks.trim()) {
      return setError("Remarks are mandatory when requesting more information.");
    }
    try {
      setError("");
      setSaving(true);
      const updated = await sampleService.requestMoreInfo(
        id,
        remarks.trim(),
        currentUser?.displayName || "Sample Team"
      );
      setRequest(updated);
      setSuccessMsg("Request sent back to Marketing for resubmission.");
      setRemarks("");
    } catch (err) {
      setError(err.message || "Failed to submit action.");
    } finally {
      setSaving(false);
    }
  };

  const handleResubmit = async () => {
    const hot2 = hotTable2Ref.current?.hotInstance;
    const currentTable2Data = hot2 ? hot2.getSourceData() : table2Data;

    const filledItems = currentTable2Data.filter(row => 
      row.product && row.product.trim() !== ""
    );

    if (filledItems.length === 0) {
      return setError("Please add at least one sample item row.");
    }

    for (let i = 0; i < filledItems.length; i++) {
      const item = filledItems[i];
      if (!item.product || item.product.trim() === "") {
        return setError(`Item #${i + 1} is missing the Product Name.`);
      }
      if (!item.description || item.description.trim() === "") {
        return setError(`Item #${i + 1} is missing the Description/Specifications.`);
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        return setError(`Item #${i + 1} must have a valid quantity greater than 0.`);
      }
    }

    try {
      setError("");
      setSaving(true);
      
      const payload = {
        product: filledItems[0].product.trim(),
        quantity: Number(filledItems[0].quantity || 1),
        sampleType: filledItems[0].sampleType,
        description: filledItems[0].description.trim(),
        specialNotes: filledItems[0].specialNotes || "",
        items: filledItems,
        attachments: [...(request.attachments || []), ...newAttachments]
      };

      const updated = await sampleService.resubmitSampleRequest(id, payload, currentUser);
      setRequest(updated);
      setIsResubmitting(false);
      setSuccessMsg("Requisition updated and resubmitted successfully.");
      loadRequestAndDispatch();
    } catch (err) {
      setError(err.message || "Failed to resubmit request.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!actualCompletionDate) {
      return setError("Actual Sample Completion Date is required.");
    }
    try {
      setError("");
      setSaving(true);

      const payload = {
        actualCompletionDate: actualCompletionDate.format("YYYY-MM-DD"),
        completionRemarks: completionRemarks.trim(),
        attachments: newAttachments
      };

      const updated = await sampleService.completeSampleRequest(id, payload, currentUser?.displayName || "Sample Team");
      setRequest(updated);
      setSuccessMsg("Sample marked as completed successfully. Dispatch documentation is ready for generation!");
      setCompletionRemarks("");
      setNewAttachments([]);
      loadRequestAndDispatch();
    } catch (err) {
      setError(err.message || "Failed to mark as completed.");
    } finally {
      setSaving(false);
    }
  };

  const handleNudgeSample = async () => {
    try {
      setError("");
      setSaving(true);
      
      await notificationService.createNotification({
        userId: null,
        role: "sample",
        sampleRequestId: request.id,
        sampleRequestNo: request.sampleRequestNo,
        message: `Marketing Officer ${currentUser.displayName || currentUser.email} is requesting an update on Sample Requisition #${request.sampleRequestNo}.`
      });
      setSuccessMsg("Nudge notification sent to Sample Team successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to send nudge notification.");
    } finally {
      setSaving(false);
    }
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

  const getDispatchStatusColor = (statusVal) => {
    switch (statusVal) {
      case "Ready for Dispatch": return "green";
      case "In Transit": return "blue";
      case "Delivered": return "cyan";
      case "Cancelled": return "red";
      case "Draft":
      default: return "default";
    }
  };

  const handleAddItemRow = () => {
    setTable2Data(prev => [...prev, {
      product: "",
      quantity: 1,
      sampleType: "New Development",
      description: "",
      specialNotes: ""
    }]);
  };

  const handleDeleteItemRow = () => {
    const hot2 = hotTable2Ref.current?.hotInstance;
    if (!hot2) return;
    const selectedRange = hot2.getSelected();
    if (!selectedRange || selectedRange.length === 0) {
      Modal.warning({ title: "No Row Selected", content: "Please select a cell in the row you wish to delete." });
      return;
    }
    const rowIndex = selectedRange[0][0];
    setTable2Data(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  if (loading || !request) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <Spin size="large" tip="Loading unified sample request & dispatch documentation..." />
      </div>
    );
  }

  // Derived totals for dispatch items
  const totals = dispatchData ? calculateDispatchTotals(dispatchData) : { totalQty: 0, totalNetWeight: 0, totalGrossWeight: 0, cargoValue: 0, courierCharges: 0, totalInvoiceValue: 0 };
  const currency = dispatchData?.receiver?.currency || "USD";

  // Table columns for Handsontable in workflow tab
  const tableColumns = [
    { data: "product", type: "text", readOnly: !isResubmitting },
    { data: "quantity", type: "numeric", readOnly: !isResubmitting },
    { data: "sampleType", type: "dropdown", source: ["New Development", "Pre Production"], readOnly: !isResubmitting, visibleRows: 10 },
    { data: "description", type: "text", readOnly: !isResubmitting },
    { data: "specialNotes", type: "text", readOnly: !isResubmitting }
  ];

  // Table columns for Dispatch items formulation
  const dispatchItemColumns = [
    {
      title: "#",
      key: "idx",
      width: 45,
      render: (_, __, index) => <Text type="secondary">{index + 1}</Text>
    },
    {
      title: "Item / Description",
      key: "description",
      render: (_, item, index) => (
        <Input
          placeholder="e.g. Coir Mat 500x250mm"
          value={item.description}
          onChange={(e) => handleDispatchItemChange(index, "description", e.target.value)}
        />
      )
    },
    {
      title: "Botanical / Material Name",
      key: "botanicalName",
      width: 170,
      render: (_, item, index) => (
        <Select
          style={{ width: "100%" }}
          value={item.botanicalName || "Cocos nucifera"}
          onChange={(val) => handleDispatchItemChange(index, "botanicalName", val)}
        >
          <Option value="Cocos nucifera">Cocos nucifera (Coir)</Option>
          <Option value="Coir Pith Block">Coir Pith Block</Option>
          <Option value="Rubberized Coir">Rubberized Coir</Option>
          <Option value="Geotextile Mesh">Geotextile Mesh</Option>
          <Option value="Other Plant Material">Other Plant Material</Option>
        </Select>
      )
    },
    {
      title: "QTY",
      key: "qty",
      width: 90,
      render: (_, item, index) => (
        <InputNumber
          min={1}
          style={{ width: "100%" }}
          value={item.qty}
          onChange={(val) => handleDispatchItemChange(index, "qty", val)}
        />
      )
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
          onChange={(val) => handleDispatchItemChange(index, "weightKg", val)}
        />
      )
    },
    {
      title: `Unit Price (${currency})`,
      key: "unitPrice",
      width: 120,
      render: (_, item, index) => (
        <InputNumber
          min={0}
          step={0.05}
          style={{ width: "100%" }}
          value={item.unitPrice}
          onChange={(val) => handleDispatchItemChange(index, "unitPrice", val)}
        />
      )
    },
    {
      title: "Box No",
      key: "boxNo",
      width: 100,
      render: (_, item, index) => (
        <Input
          placeholder="Box 1"
          value={item.boxNo}
          onChange={(e) => handleDispatchItemChange(index, "boxNo", e.target.value)}
        />
      )
    },
    {
      title: `Line Total`,
      key: "lineTotal",
      width: 110,
      render: (_, item) => {
        const lineVal = ((Number(item.qty) || 0) * (Number(item.unitPrice) || 0)).toFixed(2);
        return <Text strong>{currency} {lineVal}</Text>;
      }
    },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_, __, index) => (
        <Button
          size="small"
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteDispatchItem(index)}
          disabled={(dispatchData?.items || []).length <= 1}
        />
      )
    }
  ];

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Top Banner & Action Header */}
      <div 
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <Space size="middle" align="center">
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigate("/requests")}
            style={{ borderRadius: 8 }}
          >
            Back
          </Button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Title level={3} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
                Sample Request #{request.sampleRequestNo}
              </Title>
              <Tag color={getStatusColor(request.status)} style={{ fontWeight: 700, padding: "2px 8px" }}>
                {request.status.toUpperCase()}
              </Tag>
              {dispatchData?.dispatchNo && (
                <Tag color={getDispatchStatusColor(dispatchData.status)} style={{ fontWeight: 700, padding: "2px 8px" }}>
                  📦 {dispatchData.dispatchNo} ({dispatchData.status})
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Customer: <strong>{request.customerName}</strong> | Product Unit: <strong>{request.productUnit}</strong> | Requisition Date: {request.requestDate}
            </Text>
          </div>
        </Space>

        {/* Quick Export Documents Download Group */}
        <Space wrap>
          <Tooltip title="Download Official QP-02-B Sample Requisition Sheet">
            <Button
              icon={<FilePdfOutlined style={{ color: "#4f46e5" }} />}
              onClick={() => handleDownloadPdf("qp02b")}
              loading={downloadingPdf}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              QP-02-B PDF
            </Button>
          </Tooltip>

          <Tooltip title="Download Commercial / Sample Invoice">
            <Button
              icon={<FilePdfOutlined style={{ color: "#ef4444" }} />}
              onClick={() => handleDownloadPdf("invoice")}
              loading={downloadingPdf}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Invoice PDF
            </Button>
          </Tooltip>

          <Tooltip title="Download Complete Export Documentation Bundle (3-in-1: Invoice, Phyto & Packing List)">
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleDownloadPdf("bundle")}
              loading={downloadingPdf}
              style={{ borderRadius: 8, background: "#0f172a", borderColor: "#0f172a", fontWeight: 700 }}
            >
              Complete Export Bundle (3-in-1)
            </Button>
          </Tooltip>
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 8 }} />}
      {successMsg && <Alert message={successMsg} type="success" showIcon closable onClose={() => setSuccessMsg("")} style={{ marginBottom: 20, borderRadius: 8 }} />}

      {/* Main Integrated Tabs: Workflow vs Dispatch Tracker */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: "workflow",
            label: (
              <span style={{ fontWeight: 600, padding: "0 4px" }}>
                📋 Requisition & Development Workflow
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                {/* Left Panel: Request Details & Items */}
                <Col xs={24} lg={15}>
                  <Space direction="vertical" size="large" style={{ width: "100%" }}>
                    
                    {/* General Information Card */}
                    <Card 
                      title={<span style={{ color: "#0f172a", fontWeight: 700 }}>Requisition Summary</span>}
                      bordered={true}
                      style={{ borderLeft: "4px solid #475569", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                    >
                      <Descriptions column={{ xs: 1, sm: 2, md: 3 }} layout="vertical" bordered={false}>
                        <Descriptions.Item label={<span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Customer</span>}>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{request.customerName}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Requested By</span>}>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>{request.requestedBy}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Product Unit</span>}>
                          <Tag color={request.productUnit === "Horticulture" ? "cyan" : "geekblue"} style={{ fontWeight: 700 }}>
                            {request.productUnit}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Requisition Date</span>}>
                          <span style={{ fontWeight: 600 }}>{request.requestDate}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Required Date</span>}>
                          <span style={{ fontWeight: 600 }}>{request.requiredDate}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Urgency</span>}>
                          <Tag color={request.requestType === "Top Urgent" ? "red" : request.requestType === "Urgent" ? "orange" : "blue"} style={{ fontWeight: 700 }}>
                            {request.requestType}
                          </Tag>
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* Specifications Card (Handsontable) */}
                    <Card 
                      title={<span style={{ color: "#0f172a", fontWeight: 700 }}>Sample Requisition Items</span>}
                      extra={
                        isResubmitting && (
                          <Space>
                            <Button 
                              type="dashed" 
                              onClick={handleAddItemRow}
                              icon={<PlusOutlined />}
                              size="small"
                              style={{ borderRadius: 6 }}
                            >
                              Add Row
                            </Button>
                            <Button 
                              type="dashed" 
                              danger 
                              onClick={handleDeleteItemRow}
                              icon={<DeleteOutlined />}
                              size="small"
                              style={{ borderRadius: 6 }}
                            >
                              Delete Row
                            </Button>
                          </Space>
                        )
                      }
                      bordered={true}
                      style={{ borderLeft: "4px solid #0ea5e9", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                    >
                      <div className="hot-container">
                        <HotTable
                          ref={hotTable2Ref}
                          data={table2Data}
                          columns={tableColumns}
                          colHeaders={["Product Name *", "Quantity *", "Sample Type *", "Description / Specifications *", "Special Notes"]}
                          rowHeaders={true}
                          height="auto"
                          licenseKey="non-commercial-and-evaluation"
                          colWidths={[200, 100, 180, 250, 200]}
                          manualColumnResize={true}
                        />
                      </div>

                      {isResubmitting && (
                        <div style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                          <div style={{ marginBottom: 16 }}>
                            <span style={{ color: "#475569", fontWeight: 600, display: "block", marginBottom: 8 }}>Upload Additional Attachments</span>
                            <Upload customRequest={handleCustomUpload} showUploadList={false}>
                              <Button icon={<UploadOutlined />}>Select Attachment File</Button>
                            </Upload>
                            <div style={{ marginTop: 8 }}>
                              {newAttachments.map(f => (
                                <div key={f.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "4px 8px", borderRadius: 4, marginBottom: 4 }}>
                                  <Text ellipsis style={{ maxWidth: "80%" }}>{f.name}</Text>
                                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveNewAttachment(f.uid)} />
                                </div>
                              ))}
                            </div>
                          </div>

                          <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleResubmit}
                            loading={saving}
                            block
                            size="large"
                            style={{ background: "#6366f1", borderColor: "#6366f1", fontWeight: 700 }}
                          >
                            Resubmit Sample Requisition
                          </Button>
                        </div>
                      )}
                    </Card>

                    {/* Attachments Display */}
                    {(request.attachments || []).length > 0 && (
                      <Card 
                        title={<span style={{ color: "#0f172a", fontWeight: 700 }}>Attached Documents & Images</span>}
                        bordered={true}
                        style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                      >
                        <Row gutter={[12, 12]}>
                          {request.attachments.map((f, i) => (
                            <Col xs={24} sm={12} key={f.uid || i}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                                <Text ellipsis style={{ maxWidth: "70%", fontWeight: 600 }}>{f.name}</Text>
                                <Button size="small" type="primary" ghost icon={<CloudDownloadOutlined />} onClick={() => handleDownloadFile(f)}>
                                  Download
                                </Button>
                              </div>
                            </Col>
                          ))}
                        </Row>
                      </Card>
                    )}
                  </Space>
                </Col>

                {/* Right Panel: Workflow Actions & History */}
                <Col xs={24} lg={9}>
                  <Space direction="vertical" size="large" style={{ width: "100%" }}>
                    
                    {/* Workflow Action Panel */}
                    <Card 
                      title={<span style={{ color: "#0f172a", fontWeight: 700 }}>Workflow Action</span>}
                      bordered={true}
                      style={{ borderLeft: "4px solid #f59e0b", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                    >
                      <div style={{ marginBottom: 16 }}>
                        <span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase", display: "block" }}>
                          Current Action Required
                        </span>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem", display: "block", marginTop: 4 }}>
                          {request.actionRequired === "Marketing" 
                            ? "Marketing needs to provide more information and resubmit." 
                            : request.actionRequired === "Sample Development"
                            ? "Sample Development needs to process/complete the request."
                            : "Requisition is completed. Export documents available."
                          }
                        </span>
                      </div>

                      {request.status === "Submitted" && (
                        (currentUser.sampleRoles?.includes("sample_sampling") || currentUser.roles?.includes("admin") || currentUser.sampleRoles?.includes("admin")) ? (
                          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            <div>
                              <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Remarks / Instructions</div>
                              <Input.TextArea 
                                rows={2} 
                                value={remarks} 
                                onChange={(e) => setRemarks(e.target.value)} 
                                placeholder="Enter workflow remarks..."
                              />
                            </div>

                            <div>
                              <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Planned Delivery Date</div>
                              <DatePicker 
                                style={{ width: "100%" }} 
                                onChange={(val) => setPlannedDeliveryDate(val)} 
                                value={plannedDeliveryDate}
                              />
                            </div>

                            <Row gutter={12}>
                              <Col span={12}>
                                <Button
                                  type="primary"
                                  onClick={handleAccept}
                                  loading={saving}
                                  block
                                  style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                                >
                                  Accept
                                </Button>
                              </Col>
                              <Col span={12}>
                                <Button
                                  danger
                                  onClick={handleRequestMoreInfo}
                                  loading={saving}
                                  block
                                  style={{ fontWeight: 700 }}
                                >
                                  Need Info
                                </Button>
                              </Col>
                            </Row>
                          </Space>
                        ) : (
                          <Alert message="Awaiting Sample Developer review." type="info" showIcon />
                        )
                      )}

                      {request.status === "Request for Resubmission" && !isResubmitting && (
                        <div>
                          <Alert 
                            message={<span style={{ fontWeight: 700 }}>Resubmission Required:</span>}
                            description={request.remarks}
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                          <Button 
                            type="primary" 
                            icon={<PlayCircleOutlined />} 
                            onClick={() => setIsResubmitting(true)}
                            block
                          >
                            Edit & Resubmit Requisition
                          </Button>
                        </div>
                      )}

                      {["In Progress", "Overdue"].includes(request.status) && (
                        (currentUser.sampleRoles?.includes("sample_sampling") || currentUser.roles?.includes("admin") || currentUser.sampleRoles?.includes("admin")) ? (
                          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            <div>
                              <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Completion Date</div>
                              <DatePicker 
                                style={{ width: "100%" }} 
                                value={actualCompletionDate}
                                onChange={(date) => setActualCompletionDate(date)}
                              />
                            </div>

                            <div>
                              <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Completion Remarks</div>
                              <Input.TextArea 
                                rows={2} 
                                value={completionRemarks} 
                                onChange={(e) => setCompletionRemarks(e.target.value)} 
                                placeholder="Add completion details..."
                              />
                            </div>

                            <div>
                              <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Upload Photograph (Optional)</div>
                              <Upload customRequest={handleCustomUpload} showUploadList={false}>
                                <Button icon={<UploadOutlined />}>Upload File</Button>
                              </Upload>
                              <div style={{ marginTop: 6 }}>
                                {newAttachments.map(f => (
                                  <div key={f.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "4px 8px", borderRadius: 4, marginBottom: 4 }}>
                                    <Text ellipsis style={{ maxWidth: "80%" }}>{f.name}</Text>
                                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveNewAttachment(f.uid)} />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <Button
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              onClick={handleComplete}
                              loading={saving}
                              block
                              style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                            >
                              Mark as Completed
                            </Button>
                          </Space>
                        ) : (
                          <div>
                            <Alert message="Sample development is currently in progress." type="info" showIcon style={{ marginBottom: 12 }} />
                            <Button type="primary" ghost onClick={handleNudgeSample} loading={saving} block>
                              Nudge Sample Developer
                            </Button>
                          </div>
                        )
                      )}

                      {request.status === "Completed" && (
                        <div>
                          <Alert 
                            message="Sample Completed Successfully" 
                            description={
                              <div>
                                <div>Date: <strong>{request.actualCompletionDate}</strong></div>
                                <div>Remarks: <strong>{request.completionRemarks || "-"}</strong></div>
                              </div>
                            }
                            type="success"
                            showIcon
                          />
                        </div>
                      )}
                    </Card>

                    {/* Timeline Log */}
                    <Card 
                      title={<span style={{ color: "#0f172a", fontWeight: 700 }}>Activity History</span>}
                      bordered={true}
                      style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                    >
                      <Timeline 
                        items={(request.history || []).map((h, i) => ({
                          color: h.label.includes("Completed") ? "green" : h.label.includes("Accepted") ? "purple" : h.label.includes("Requested") ? "orange" : "blue",
                          children: (
                            <div key={i}>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{h.label}</div>
                              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                                {new Date(h.date).toLocaleString()} | by {h.user || "System"}
                              </div>
                            </div>
                          )
                        }))}
                      />
                    </Card>
                  </Space>
                </Col>
              </Row>
            )
          },
          {
            key: "dispatch",
            label: (
              <span style={{ fontWeight: 600, padding: "0 4px" }}>
                📦 Dispatch Tracker & Export Documentation (Integrated)
              </span>
            ),
            children: dispatchData ? (
              <div>
                {/* Action Bar inside Dispatch Tab */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    marginBottom: 20,
                    color: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12
                  }}
                >
                  <Space align="center" size="middle">
                    <span style={{ fontSize: 24 }}>📦</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        Dispatch Formulation: {dispatchData.dispatchNo || "Draft"}
                      </div>
                      <div style={{ fontSize: 12, color: "#c7d2fe" }}>
                        Data synchronized from Sample Request #{request.sampleRequestNo}. Complete commercial invoice, phyto application & packing list.
                      </div>
                    </div>
                  </Space>

                  <Space wrap>
                    <Button
                      icon={<FilePdfOutlined />}
                      onClick={() => handleDownloadPdf("invoice")}
                      loading={downloadingPdf}
                    >
                      Sample Invoice
                    </Button>
                    <Button
                      icon={<FilePdfOutlined />}
                      onClick={() => handleDownloadPdf("phyto")}
                      loading={downloadingPdf}
                    >
                      Phyto Application
                    </Button>
                    <Button
                      icon={<FilePdfOutlined />}
                      onClick={() => handleDownloadPdf("packing")}
                      loading={downloadingPdf}
                    >
                      Packing List
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                      onClick={() => handleSaveDispatch()}
                      loading={dispatchSaving}
                    >
                      Save Dispatch Details
                    </Button>
                  </Space>
                </div>

                {/* Dispatch Form Grids */}
                <Row gutter={[20, 20]}>
                  {/* Left: Sender / Sales Officer Details */}
                  <Col xs={24} lg={12}>
                    <Card
                      title={
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                          <span style={{ fontWeight: 700 }}>1. Sender / Sales Officer Profile</span>
                          <Tag color="purple">Auto-loaded on Login</Tag>
                        </div>
                      }
                      bordered={true}
                      style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", marginBottom: 20 }}
                    >
                      <div style={{ marginBottom: 14, padding: "8px 12px", background: "#f1f5f9", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <Text style={{ fontSize: 12, color: "#475569" }}>
                            👤 Officer Profile: <strong>{dispatchData.sender?.name || currentUser?.salesOfficerProfile?.name || currentUser?.displayName || "Logged-in User"}</strong>
                          </Text>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            Auto-populated from saved user profile / dispatch record
                          </div>
                        </div>
                        <Button 
                          type="link" 
                          size="small" 
                          onClick={() => navigate("/sales-officer-profile")}
                          style={{ fontSize: 11, padding: 0 }}
                        >
                          Edit Profile Defaults
                        </Button>
                      </div>

                      <Row gutter={[12, 12]}>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Sender Name</label>
                          <Input
                            value={dispatchData.sender?.name}
                            onChange={(e) => handleDispatchNestedChange("sender", "name", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Designation</label>
                          <Input
                            value={dispatchData.sender?.designation}
                            onChange={(e) => handleDispatchNestedChange("sender", "designation", e.target.value)}
                          />
                        </Col>
                        <Col span={24}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Company Address</label>
                          <TextArea
                            rows={2}
                            value={dispatchData.sender?.address}
                            onChange={(e) => handleDispatchNestedChange("sender", "address", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Contact Phone</label>
                          <Input
                            value={dispatchData.sender?.contact}
                            onChange={(e) => handleDispatchNestedChange("sender", "contact", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Email</label>
                          <Input
                            value={dispatchData.sender?.email}
                            onChange={(e) => handleDispatchNestedChange("sender", "email", e.target.value)}
                          />
                        </Col>

                        {/* Signature Preview */}
                        <Col span={24}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Authorized Signature</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, padding: "8px 12px", border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc" }}>
                            <div style={{ height: 45, width: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {dispatchData.sender?.signatureBase64 || dispatchData.sender?.signatureUrl ? (
                                <img
                                  src={dispatchData.sender.signatureBase64 || dispatchData.sender.signatureUrl}
                                  alt="Signature"
                                  style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                                />
                              ) : (
                                <Text type="secondary" style={{ fontSize: 11 }}>No PNG</Text>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{dispatchData.sender?.signatureText || dispatchData.sender?.name}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>To update, visit "My Sales Officer Profile"</div>
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* Right: Receiver / Consignee Profile */}
                  <Col xs={24} lg={12}>
                    <Card
                      title={<span style={{ fontWeight: 700 }}>2. Receiver / Consignee Profile</span>}
                      bordered={true}
                      style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", marginBottom: 20 }}
                    >
                      <Row gutter={[12, 12]}>
                        <Col span={14}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Receiver / Company Name</label>
                          <Input
                            value={dispatchData.receiver?.name}
                            onChange={(e) => handleDispatchNestedChange("receiver", "name", e.target.value)}
                          />
                        </Col>
                        <Col span={10}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Currency</label>
                          <Select
                            style={{ width: "100%" }}
                            value={dispatchData.receiver?.currency || "USD"}
                            onChange={(val) => handleDispatchNestedChange("receiver", "currency", val)}
                          >
                            <Option value="USD">USD ($)</Option>
                            <Option value="EUR">EUR (€)</Option>
                            <Option value="GBP">GBP (£)</Option>
                            <Option value="SEK">SEK (kr)</Option>
                            <Option value="LKR">LKR (Rs)</Option>
                          </Select>
                        </Col>
                        <Col span={24}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Full Delivery Address</label>
                          <TextArea
                            rows={3}
                            value={dispatchData.receiver?.address}
                            onChange={(e) => handleDispatchNestedChange("receiver", "address", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Destination Country</label>
                          <Input
                            value={dispatchData.receiver?.country}
                            onChange={(e) => handleDispatchNestedChange("receiver", "country", e.target.value)}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Port of Entry</label>
                          <Input
                            placeholder="e.g. Malmö Port / BIA"
                            value={dispatchData.receiver?.portOfEntry}
                            onChange={(e) => handleDispatchNestedChange("receiver", "portOfEntry", e.target.value)}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                {/* Section 3: Consignment, Logistics & Reason for Export */}
                <Card
                  title={<span style={{ fontWeight: 700 }}>3. Consignment & Logistics Details</span>}
                  bordered={true}
                  style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", marginBottom: 20 }}
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Shipping Date</label>
                      <Input
                        type="date"
                        value={dispatchData.shippingDate}
                        onChange={(e) => handleDispatchRootChange("shippingDate", e.target.value)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Waybill / AWB No.</label>
                      <Input
                        placeholder="e.g. 54329871"
                        value={dispatchData.waybillNo}
                        onChange={(e) => handleDispatchRootChange("waybillNo", e.target.value)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Courier Charges ({currency})</label>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={0}
                        step={5}
                        value={dispatchData.logistics?.courierCharges}
                        onChange={(val) => handleDispatchNestedChange("logistics", "courierCharges", val || 0)}
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>No. of Boxes</label>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={1}
                        value={dispatchData.logistics?.noOfBoxes}
                        onChange={(val) => handleDispatchNestedChange("logistics", "noOfBoxes", val || 1)}
                      />
                    </Col>
                    <Col xs={24} sm={16}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Reason for Export</label>
                      <Input
                        value={dispatchData.reasonForExport}
                        onChange={(e) => handleDispatchRootChange("reasonForExport", e.target.value)}
                      />
                    </Col>
                    <Col xs={12} sm={8}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Dispatch Status</label>
                      <Select
                        style={{ width: "100%" }}
                        value={dispatchData.status || "Ready for Dispatch"}
                        onChange={(val) => handleDispatchRootChange("status", val)}
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

                {/* Section 4: Items & Formulation Grid */}
                <Card
                  title={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <span style={{ fontWeight: 700 }}>4. Export Items & Packing List Formulation</span>
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleAddDispatchItem}>
                        Add Item
                      </Button>
                    </div>
                  }
                  bordered={true}
                  style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", marginBottom: 20 }}
                >
                  <Table
                    columns={dispatchItemColumns}
                    dataSource={dispatchData.items || []}
                    rowKey="id"
                    pagination={false}
                    size="middle"
                  />

                  {/* Totals Summary */}
                  <div style={{ marginTop: 20, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <Row gutter={[16, 8]} justify="space-between" align="middle">
                      <Col xs={12} sm={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>TOTAL QTY</Text>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{totals.totalQty} pcs</div>
                      </Col>
                      <Col xs={12} sm={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>TOTAL NET WEIGHT</Text>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{totals.totalNetWeight} kg</div>
                      </Col>
                      <Col xs={12} sm={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>TOTAL GROSS WEIGHT</Text>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{totals.totalGrossWeight} kg</div>
                      </Col>
                      <Col xs={12} sm={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>CARGO VALUE</Text>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#4f46e5" }}>{currency} {totals.cargoValue.toFixed(2)}</div>
                      </Col>
                      <Col xs={12} sm={4}>
                        <Text type="secondary" style={{ fontSize: 11 }}>TOTAL INVOICE VALUE</Text>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#10b981" }}>{currency} {totals.totalInvoiceValue.toFixed(2)}</div>
                      </Col>
                    </Row>
                  </div>
                </Card>

                {/* Bottom Save & Download Toolbar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SaveOutlined />}
                    style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700, borderRadius: 8 }}
                    onClick={() => handleSaveDispatch()}
                    loading={dispatchSaving}
                  >
                    Save Dispatch Formulation
                  </Button>
                </div>
              </div>
            ) : null
          }
        ]}
      />
    </div>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as sampleService from "../../services/firebase/sampleService";
import { downloadSamplePDF } from "../../utils/pdfGenerator";
import { Row, Col, Card, Typography, Button, Tag, Space, Input, DatePicker, Alert, Spin, Descriptions, Divider, Upload, Timeline } from "antd";
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
  PlusOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;

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

  const hotTable2Ref = useRef(null);

  useEffect(() => {
    loadRequest();
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const data = await sampleService.getSampleRequestById(id);
      setRequest(data);
      
      // Initialize edit fields and items list with backward compatibility
      const itemsList = data.items || [{
        product: data.product || "",
        quantity: data.quantity || 1,
        sampleType: data.sampleType || "New Development",
        description: data.description || "",
        specialNotes: data.specialNotes || ""
      }];
      setTable2Data(itemsList);
      setNewAttachments([]);
    } catch (err) {
      console.error("Error loading request:", err);
      setError("Failed to load sample requisition details.");
    } finally {
      setLoading(false);
    }
  };

  // Handle new attachment upload
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

  // Actions
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
      Object.values(row).some(val => val !== "" && val !== null && val !== undefined)
    );

    if (filledItems.length === 0) {
      return setError("Please add at least one sample item row.");
    }

    // Validate filled item rows
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
      loadRequest(); // Reload details and grid
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
      setSuccessMsg("Sample marked as completed successfully.");
      setCompletionRemarks("");
      setNewAttachments([]);
      loadRequest();
    } catch (err) {
      setError(err.message || "Failed to mark as completed.");
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

  // Row operations in edit mode
  const handleAddItemRow = () => {
    Modal.confirm({
      title: "Add Item Row",
      content: "Are you sure you want to add a new specification row?",
      okText: "Yes, Add",
      cancelText: "Cancel",
      onOk() {
        setTable2Data(prev => [...prev, {
          product: "",
          quantity: 1,
          sampleType: "New Development",
          description: "",
          specialNotes: ""
        }]);
      }
    });
  };

  const handleDeleteItemRow = () => {
    const hot2 = hotTable2Ref.current?.hotInstance;
    if (!hot2) return;

    const selectedRange = hot2.getSelected();
    if (!selectedRange || selectedRange.length === 0) {
      Modal.warning({
        title: "No Row Selected",
        content: "Please select a cell in the row you wish to delete."
      });
      return;
    }

    const rowIndex = selectedRange[0][0];

    Modal.confirm({
      title: "Delete Row",
      content: `Are you sure you want to delete Row #${rowIndex + 1}?`,
      okText: "Yes, Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk() {
        setTable2Data(prev => prev.filter((_, idx) => idx !== rowIndex));
      }
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading request details..." />
      </div>
    );
  }

  // Calculate Days Remaining or Overdue
  let daysRemainingText = "";
  let isOverdueStyle = false;
  if (request.status === "In Progress" && request.plannedDeliveryDate) {
    const today = dayjs().startOf("day");
    const planned = dayjs(request.plannedDeliveryDate).startOf("day");
    const diffDays = planned.diff(today, "day");
    if (diffDays >= 0) {
      daysRemainingText = `${diffDays} Day(s) Remaining`;
    } else {
      daysRemainingText = `${Math.abs(diffDays)} Day(s) Overdue`;
      isOverdueStyle = true;
    }
  } else if (request.status === "Overdue" && request.plannedDeliveryDate) {
    const today = dayjs().startOf("day");
    const planned = dayjs(request.plannedDeliveryDate).startOf("day");
    const diffDays = today.diff(planned, "day");
    daysRemainingText = `${diffDays} Day(s) Overdue`;
    isOverdueStyle = true;
  }

  // Define table columns
  const tableColumns = [
    { data: "product", type: "text", readOnly: !isResubmitting },
    { data: "quantity", type: "numeric", readOnly: !isResubmitting },
    { data: "sampleType", type: "dropdown", source: ["New Development", "Pre Production"], readOnly: !isResubmitting },
    { data: "description", type: "text", readOnly: !isResubmitting },
    { data: "specialNotes", type: "text", readOnly: !isResubmitting }
  ];

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 32, gap: 16 }}>
        <Col>
          <Space size="middle">
            <Button
              icon={<LeftOutlined />}
              onClick={() => navigate("/requests")}
              style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
            >
              Back
            </Button>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              Request #{request.sampleRequestNo}
            </Title>
            <Tag color={getStatusColor(request.status)} style={{ fontWeight: 700, padding: "2px 8px" }}>
              {request.status.toUpperCase()}
            </Tag>
          </Space>
        </Col>

        <Col>
          <Button
            type="primary"
            danger
            icon={<FilePdfOutlined />}
            onClick={() => downloadSamplePDF(request)}
            size="large"
            style={{ borderRadius: 8, fontWeight: 700 }}
          >
            Download Sample Request PDF
          </Button>
        </Col>
      </Row>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
      {successMsg && <Alert message={successMsg} type="success" showIcon closable onClose={() => setSuccessMsg("")} style={{ marginBottom: 24, borderRadius: 8 }} />}

      <Row gutter={[24, 24]}>
        {/* Left Panel: Request Details */}
        <Col xs={24} lg={15}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            
            {/* General Information Card */}
            <Card 
              title={<span style={{ color: "#0f172a" }}>Requisition Summary</span>}
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
              title={<span style={{ color: "#0f172a" }}>Sample Requisition Items (Excel View)</span>}
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
                  stretchH="all"
                  manualColumnResize={true}
                />
              </div>

              {isResubmitting && (
                <div style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
                  {/* Upload additional files during resubmission */}
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

                  <div style={{ textAlign: "right" }}>
                    <Space>
                      <Button onClick={() => {
                        setIsResubmitting(false);
                        const origItems = request.items || [{
                          product: request.product || "",
                          quantity: request.quantity || 1,
                          sampleType: request.sampleType || "New Development",
                          description: request.description || "",
                          specialNotes: request.specialNotes || ""
                        }];
                        setTable2Data(origItems);
                      }}>
                        Cancel
                      </Button>
                      <Button type="primary" onClick={handleResubmit} loading={saving}>
                        Resubmit Requisition
                      </Button>
                    </Space>
                  </div>
                </div>
              )}
            </Card>

            {/* Attachments list card */}
            <Card 
              title={<span style={{ color: "#0f172a" }}>Supporting Attachments ({request.attachments?.length || 0})</span>}
              bordered={true}
              style={{ borderLeft: "4px solid #10b981", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {request.attachments?.map((file, i) => (
                  <div 
                    key={file.uid || i}
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "10px 16px", 
                      background: "#f8fafc", 
                      borderRadius: 8,
                      border: "1px solid #e2e8f0"
                    }}
                  >
                    <Space>
                      <CloudDownloadOutlined style={{ color: "#6366f1", fontSize: 18 }} />
                      <Text style={{ fontWeight: 600, color: "#0f172a" }}>{file.name}</Text>
                      <Text type="secondary" style={{ fontSize: "0.75rem" }}>
                        ({(file.size / 1024).toFixed(1)} KB)
                      </Text>
                    </Space>
                    <Button 
                      type="primary" 
                      ghost 
                      size="small" 
                      onClick={() => handleDownloadFile(file)}
                    >
                      Download
                    </Button>
                  </div>
                ))}
                {(!request.attachments || request.attachments.length === 0) && (
                  <Text type="secondary">No attachments uploaded for this request.</Text>
                )}
              </div>
            </Card>
          </Space>
        </Col>

        {/* Right Panel: Workflow Processing & Timeline */}
        <Col xs={24} lg={9}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            
            {/* SLA / Time Remaining Card */}
            {["In Progress", "Overdue"].includes(request.status) && (
              <Card 
                bordered={true}
                style={{ 
                  background: isOverdueStyle ? "#fef2f2" : "#f5f3ff", 
                  border: isOverdueStyle ? "1px solid #fee2e2" : "1px solid #ddd6fe", 
                  borderRadius: 12 
                }}
                styles={{ body: { padding: 24, textAlign: "center" } }}
              >
                <Text style={{ color: isOverdueStyle ? "#ef4444" : "#6366f1", fontWeight: 800, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.08em" }}>
                  Delivery Timeframe
                </Text>
                <Title level={2} style={{ margin: "8px 0 0 0", color: isOverdueStyle ? "#ef4444" : "#4f46e5", fontWeight: 900 }}>
                  {daysRemainingText}
                </Title>
                <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                  Planned Delivery: <strong>{request.plannedDeliveryDate}</strong>
                </Text>
              </Card>
            )}

            {/* Workflow Action Panel */}
            <Card 
              title={<span style={{ color: "#0f172a" }}>Workflow Action</span>}
              bordered={true}
              style={{ borderLeft: "4px solid #f59e0b", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            >
              {/* CURRENT ACTION DISPLAY */}
              <div style={{ marginBottom: 20 }}>
                <span style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.05em", textTransform: "uppercase", display: "block" }}>
                  Current Action Required
                </span>
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.05rem", display: "block", marginTop: 4 }}>
                  {request.actionRequired === "Marketing" 
                    ? "Marketing needs to provide more information and resubmit." 
                    : request.actionRequired === "Sample Development"
                    ? "Sample Development needs to process/complete the request."
                    : "No action required. Requisition is completed."
                  }
                </span>
              </div>

              {/* ACTION FORMS */}
              {request.status === "Submitted" && (
                (currentUser.sampleRoles?.includes("sample_sampling") || currentUser.roles?.includes("admin") || currentUser.sampleRoles?.includes("admin")) ? (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <div>
                      <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Remarks / Instructions</div>
                      <Input.TextArea 
                        rows={3} 
                        value={remarks} 
                        onChange={(e) => setRemarks(e.target.value)} 
                        placeholder="Enter workflow remarks or information requested..."
                      />
                    </div>

                    <div>
                      <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Planned Sample Delivery Date</div>
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
                          Accept Request
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
                          Need More Info
                        </Button>
                      </Col>
                    </Row>
                  </Space>
                ) : (
                  <Alert 
                    message="Awaiting Sample Developer review and acceptance."
                    type="info"
                    showIcon
                    style={{ borderRadius: 8 }}
                  />
                )
              )}

              {request.status === "Request for Resubmission" && !isResubmitting && (
                <div>
                  <Alert 
                    message={<span style={{ fontWeight: 700 }}>Resubmission Required Reason:</span>}
                    description={request.remarks}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  {(currentUser.sampleRoles?.includes("sample_marketing") || currentUser.roles?.includes("admin") || currentUser.sampleRoles?.includes("admin")) ? (
                    <Button 
                      type="primary" 
                      icon={<PlayCircleOutlined />} 
                      onClick={() => setIsResubmitting(true)}
                      block
                    >
                      Edit & Resubmit Requisition
                    </Button>
                  ) : (
                    <Alert
                      message="Awaiting Marketing Officer updates and resubmission."
                      type="info"
                      showIcon
                      style={{ borderRadius: 8 }}
                    />
                  )}
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
                        rows={3} 
                        value={completionRemarks} 
                        onChange={(e) => setCompletionRemarks(e.target.value)} 
                        placeholder="Add completion details, specs verified, courier no, etc..."
                      />
                    </div>

                    <div>
                      <div style={{ marginBottom: 6, color: "#475569", fontWeight: 600 }}>Upload Photograph / Final Document (Optional)</div>
                      <Upload customRequest={handleCustomUpload} showUploadList={false}>
                        <Button icon={<UploadOutlined />}>Upload File</Button>
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
                  <Alert 
                    message="Sample development is currently in progress."
                    type="info"
                    showIcon
                    style={{ borderRadius: 8 }}
                  />
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

            {/* Requisition Timeline History log */}
            <Card 
              title={<span style={{ color: "#0f172a" }}>Activity History log</span>}
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
    </div>
  );
}

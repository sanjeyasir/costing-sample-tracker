import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as sampleService from "../../services/firebase/sampleService";
import { Button, Card, Row, Col, Typography, Alert, Modal, Space, Tag, Spin, Upload } from "antd";
import { LeftOutlined, PlusCircleOutlined, CheckCircleFilled, PlusOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;

export default function CreateSampleRequest() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState([]);

  // Table refs
  const hotTable1Ref = useRef(null);
  const hotTable2Ref = useRef(null);

  // Success Dialog States
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdRequestInfo, setCreatedRequestInfo] = useState(null);

  // States for general info
  const [table1Data, setTable1Data] = useState([]);

  // Table 2 data (requisition items)
  const [table2Data, setTable2Data] = useState([
    { product: "", quantity: 1, sampleType: "New Development", description: "", specialNotes: "" },
    { product: "", quantity: 1, sampleType: "New Development", description: "", specialNotes: "" },
    { product: "", quantity: 1, sampleType: "New Development", description: "", specialNotes: "" }
  ]);

  useEffect(() => {
    // Pre-populate Table 1 general details
    const defaultRequiredDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const defaultOfficer = currentUser?.displayName || currentUser?.email?.split("@")?.[0] || "";
    setTable1Data([{
      customerName: "",
      requestedBy: defaultOfficer,
      requiredDate: defaultRequiredDate,
      productUnit: "Horticulture",
      requestType: "Normal"
    }]);
  }, [currentUser]);

  // Row operations
  const handleAddRow = () => {
    Modal.confirm({
      title: "Add Item Row",
      content: "Are you sure you want to add a new requisition item row?",
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

  const handleDeleteSelectedRow = () => {
    const hot2 = hotTable2Ref.current?.hotInstance;
    if (!hot2) return;

    const selectedRange = hot2.getSelected();
    if (!selectedRange || selectedRange.length === 0) {
      Modal.warning({
        title: "No Item Selected",
        content: "Please select a cell in the row you wish to delete."
      });
      return;
    }

    const rowIndex = selectedRange[0][0];

    Modal.confirm({
      title: "Delete Item Row",
      content: `Are you sure you want to delete Row #${rowIndex + 1}?`,
      okText: "Yes, Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk() {
        setTable2Data(prev => prev.filter((_, idx) => idx !== rowIndex));
      }
    });
  };

  // Excel template downloader
  const handleDownloadTemplate = () => {
    const headers = ["Product Name", "Quantity", "Sample Type", "Description", "Special Notes"];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample_Requisition_Template");
    XLSX.writeFile(workbook, "Sample_Requisition_Template.xlsx");
  };

  // Excel parser upload
  const handleExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setError("The uploaded Excel sheet is empty.");
          return;
        }

        const headers = jsonData[0];
        const rowsData = jsonData.slice(1);

        const sampleFieldsMapping = [
          { key: "product", label: "Product Name" },
          { key: "quantity", label: "Quantity" },
          { key: "sampleType", label: "Sample Type" },
          { key: "description", label: "Description" },
          { key: "specialNotes", label: "Special Notes" }
        ];

        const parsed = rowsData.map(row => {
          const item = {};
          sampleFieldsMapping.forEach(f => {
            const colIdx = headers.findIndex(
              h => h && h.toString().trim().toLowerCase() === f.label.trim().toLowerCase()
            );
            if (colIdx !== -1) {
              let val = row[colIdx];
              if (f.key === "quantity" && val !== undefined && val !== "") {
                val = Number(val);
              }
              item[f.key] = val !== undefined ? val : "";
            } else {
              item[f.key] = f.key === "quantity" ? 1 : f.key === "sampleType" ? "New Development" : "";
            }
          });
          return item;
        });

        // Filter empty rows
        const cleanParsed = parsed.filter(item => 
          Object.values(item).some(v => v !== "" && v !== null && v !== undefined && v !== 1 && v !== "New Development")
        );

        if (cleanParsed.length === 0) {
          setError("No valid line items found in the Excel matching requisition headers.");
        } else {
          setTable2Data(cleanParsed);
          setError("");
        }
      } catch (err) {
        console.error("Failed to parse Excel file:", err);
        setError("Failed to parse uploaded Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent server auto upload
  };

  // Submit sample request
  const handleSubmitSampleRequest = async () => {
    setError("");

    const hot1 = hotTable1Ref.current?.hotInstance;
    const hot2 = hotTable2Ref.current?.hotInstance;

    const currentTable1Data = hot1 ? hot1.getSourceData()[0] : table1Data[0];
    const currentTable2Data = hot2 ? hot2.getSourceData() : table2Data;

    if (!currentTable1Data || !currentTable1Data.customerName || currentTable1Data.customerName.trim() === "") {
      setError("Please enter the Customer Name in the general details table.");
      return;
    }
    if (!currentTable1Data.requestedBy || currentTable1Data.requestedBy.trim() === "") {
      setError("Please enter the Requested By Officer name.");
      return;
    }
    if (!currentTable1Data.requiredDate || currentTable1Data.requiredDate.trim() === "") {
      setError("Please specify the Required Date.");
      return;
    }

    const filledItems = currentTable2Data.filter(row => 
      Object.values(row).some(val => val !== "" && val !== null && val !== undefined)
    );

    if (filledItems.length === 0) {
      setError("Please add at least one sample item specification row.");
      return;
    }

    // Validate filled item rows
    for (let i = 0; i < filledItems.length; i++) {
      const item = filledItems[i];
      if (!item.product || item.product.trim() === "") {
        setError(`Item #${i + 1} is missing the Product Name.`);
        return;
      }
      if (!item.description || item.description.trim() === "") {
        setError(`Item #${i + 1} is missing the Description/Specifications.`);
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        setError(`Item #${i + 1} must have a valid quantity greater than 0.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      
      // Save items and also set root level properties for backward compatibility
      const payload = {
        productUnit: currentTable1Data.productUnit,
        requestedBy: currentTable1Data.requestedBy.trim(),
        requestDate: new Date().toISOString().split("T")[0],
        requiredDate: currentTable1Data.requiredDate,
        customerName: currentTable1Data.customerName.trim(),
        requestType: currentTable1Data.requestType,
        product: filledItems[0].product.trim(),
        quantity: Number(filledItems[0].quantity || 1),
        sampleType: filledItems[0].sampleType,
        description: filledItems[0].description.trim(),
        specialNotes: filledItems[0].specialNotes || "",
        items: filledItems,
        attachments: attachments
      };

      const result = await sampleService.createSampleRequest(payload, currentUser);
      if (result) {
        setCreatedRequestInfo(result);
        setSuccessDialogOpen(true);
      }
    } catch (err) {
      console.error("Error creating sample request:", err);
      setError(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setSuccessDialogOpen(false);
    navigate(`/requests/${createdRequestInfo.id}`);
  };

  const table1Columns = [
    { data: "customerName", type: "text", placeholder: "Enter Customer Name" },
    { data: "requestedBy", type: "text", placeholder: "Officer Name" },
    { data: "requiredDate", type: "date", dateFormat: "YYYY-MM-DD", correctFormat: true },
    { data: "productUnit", type: "dropdown", source: ["Horticulture", "Bedding"] },
    { data: "requestType", type: "dropdown", source: ["Top Urgent", "Urgent", "Normal"] }
  ];

  const table2Columns = [
    { data: "product", type: "text", placeholder: "e.g. Coir Mat" },
    { data: "quantity", type: "numeric", placeholder: "Qty" },
    { data: "sampleType", type: "dropdown", source: ["New Development", "Pre Production"] },
    { data: "description", type: "text", placeholder: "Size, specifications etc." },
    { data: "specialNotes", type: "text", placeholder: "Remarks/Notes" }
  ];

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Space style={{ marginBottom: 32 }}>
        <Button 
          icon={<LeftOutlined />} 
          onClick={() => navigate("/requests")}
          style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
        >
          Back
        </Button>
        <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a" }}>
          New Sample Requisition
        </Title>
      </Space>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />
      )}

      <Row gutter={[24, 24]}>
        {/* Table 1: General Info */}
        <Col span={24}>
          <Card 
            title="1. General Information (Excel Grid)" 
            bordered={true} 
            style={{ borderLeft: "4px solid #6366f1", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            styles={{ body: { padding: 24 } }}
          >
            <div className="hot-container">
              {table1Data.length > 0 && (
                <HotTable
                  ref={hotTable1Ref}
                  data={table1Data}
                  columns={table1Columns}
                  colHeaders={["Customer Name", "Requested By Officer", "Required Date (Double Click)", "Product Unit", "Urgency"]}
                  rowHeaders={false}
                  height="auto"
                  licenseKey="non-commercial-and-evaluation"
                  stretchH="all"
                />
              )}
            </div>
            <Text type="secondary">Enter the general details like customer name and required dates above.</Text>
          </Card>
        </Col>

        {/* Table 2: Requisition Items */}
        <Col span={24}>
          <Card 
            title="2. Requisition Items (Excel Grid)" 
            extra={
              <Space wrap>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={handleDownloadTemplate}
                  style={{ borderRadius: 8 }}
                >
                  Download Template
                </Button>
                <Upload
                  accept=".xlsx,.xls"
                  showUploadList={false}
                  beforeUpload={handleExcelUpload}
                >
                  <Button icon={<UploadOutlined />} style={{ borderRadius: 8 }}>Upload filled Excel</Button>
                </Upload>
                <Button 
                  type="dashed" 
                  onClick={handleAddRow}
                  icon={<PlusOutlined />}
                  style={{ borderRadius: 8 }}
                >
                  Add Item Row
                </Button>
                <Button 
                  type="dashed" 
                  danger
                  onClick={handleDeleteSelectedRow}
                  icon={<DeleteOutlined />}
                  style={{ borderRadius: 8 }}
                >
                  Delete Selected Row
                </Button>
              </Space>
            }
            bordered={true}
            style={{ borderLeft: "4px solid #0ea5e9", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            styles={{ body: { padding: 24 } }}
          >
            <div className="hot-container">
              <HotTable
                ref={hotTable2Ref}
                data={table2Data}
                columns={table2Columns}
                colHeaders={["Product Name *", "Quantity *", "Sample Type *", "Description / Specifications *", "Special Notes"]}
                rowHeaders={true}
                height="300"
                licenseKey="non-commercial-and-evaluation"
                stretchH="all"
                manualColumnResize={true}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <Button
                type="primary"
                onClick={handleSubmitSampleRequest}
                size="large"
                disabled={submitting}
                icon={<PlusCircleOutlined />}
                style={{ 
                  height: 48,
                  borderRadius: 8,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)"
                }}
              >
                {submitting ? "Submitting Requisition..." : "Submit Sample Requisition"}
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Success Dialog Modal */}
      <Modal
        open={successDialogOpen}
        onCancel={handleCloseDialog}
        footer={[
          <Button 
            key="view" 
            type="primary" 
            size="large"
            onClick={handleCloseDialog}
            style={{ 
              borderRadius: 8, 
              fontWeight: 700, 
              paddingLeft: 32, 
              paddingRight: 32,
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              border: "none"
            }}
          >
            View Requisition Details
          </Button>
        ]}
        width={400}
        centered
        closable={false}
        styles={{ content: { borderRadius: 20, background: "#ffffff" } }}
      >
        <div style={{ textAlign: "center", padding: "12px 0 24px 0" }}>
          <CheckCircleFilled style={{ color: "#10b981", fontSize: 64, marginBottom: 16 }} />
          <Title level={3} style={{ color: "#0f172a", margin: 0, fontWeight: 800 }}>
            Requisition Submitted
          </Title>
          <Text type="secondary" style={{ display: "block", marginTop: 8, marginBottom: 24, fontSize: "0.9rem" }}>
            The sample requisition has been successfully created and registered on the server.
          </Text>
          
          <div 
            style={{ 
              padding: 24, 
              background: "rgba(99,102,241,0.03)", 
              borderRadius: 12, 
              border: "1.5px dashed rgba(99,102,241,0.2)",
              textAlign: "center"
            }}
          >
            <Text style={{ color: "#64748b", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.08em", display: "block", textTransform: "uppercase" }}>
              Sample Request No
            </Text>
            <Title level={1} style={{ margin: "8px 0", color: "#6366f1", fontWeight: 900 }}>
              {createdRequestInfo?.sampleRequestNo}
            </Title>
            <Tag color="processing" style={{ fontWeight: 800, fontSize: "0.65rem", padding: "2px 8px" }}>
              SUBMITTED TO DEVELOPERS
            </Tag>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as costingService from "../../services/firebase/costingService";
import { Button, Card, Row, Col, Typography, Alert, Modal, Space, Tag, Spin, Upload } from "antd";
import { LeftOutlined, PlusCircleOutlined, CheckCircleFilled, PlusOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;

export default function CreateRequest() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Table refs
  const hotTable1Ref = useRef(null);
  const hotTable2Ref = useRef(null);

  // States for general info
  const [customerName, setCustomerName] = useState("");
  const [productUnit, setProductUnit] = useState(""); // Category ID
  const [table1Data, setTable1Data] = useState([{ customerName: "", categoryName: "" }]);

  // Table 2 (specifications) data
  const [table2Data, setTable2Data] = useState([]);

  // Success Dialog States
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdRequestInfo, setCreatedRequestInfo] = useState(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await costingService.getProductCategories();
        setCategories(cats);
        
        if (cats.length > 0) {
          const bedding = cats.find(c => c.id === "bedding");
          const defaultCat = bedding || cats[0];
          setProductUnit(defaultCat.id);
          
          setTable1Data([{ customerName: "", categoryName: defaultCat.name }]);
          
          const defaultFields = (defaultCat.fields || []).filter(f => f.owner === "marketing");
          const emptyRows = Array.from({ length: 3 }, () => createDefaultRow(defaultFields));
          setTable2Data(emptyRows);
        }
      } catch (err) {
        console.error("Error loading categories:", err);
        setError("Failed to load product categories.");
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  const createDefaultRow = (fields) => {
    const rowObj = {};
    fields.forEach(f => {
      rowObj[f.key] = f.type === "number" ? "" : f.type === "select" ? (f.options?.[0] || "") : "";
    });
    return rowObj;
  };

  const activeCategory = (categories || []).find(c => c.id === productUnit);
  const marketingFields = activeCategory ? (activeCategory.fields || []).filter(f => f.owner === "marketing") : [];

  const handleTable1Change = (changes) => {
    if (!changes) return;
    
    const hot1 = hotTable1Ref.current?.hotInstance;
    if (!hot1) return;
    
    const currentData = hot1.getSourceData();
    const rowData = currentData[0] || {};
    
    if (rowData.customerName !== customerName) {
      setCustomerName(rowData.customerName || "");
    }
    
    const selectedCatName = rowData.categoryName;
    const matchedCat = categories.find(c => c.name === selectedCatName);
    if (matchedCat && matchedCat.id !== productUnit) {
      setProductUnit(matchedCat.id);
      
      const defaultFields = (matchedCat.fields || []).filter(f => f.owner === "marketing");
      const emptyRows = Array.from({ length: 3 }, () => createDefaultRow(defaultFields));
      setTable2Data(emptyRows);
    }
  };

  // Row operations
  const handleAddRow = () => {
    Modal.confirm({
      title: "Add Row",
      content: "Are you sure you want to add a new specification row?",
      okText: "Yes, Add",
      cancelText: "Cancel",
      onOk() {
        const newRow = createDefaultRow(marketingFields);
        setTable2Data(prev => [...prev, newRow]);
      }
    });
  };

  const handleDeleteSelectedRow = () => {
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

    // Handsontable selected range format: [[startRow, startCol, endRow, endCol], ...]
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

  // Excel template downloader
  const handleDownloadTemplate = () => {
    if (!activeCategory) return;
    const headers = marketingFields.map(f => f.label);
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    
    XLSX.writeFile(workbook, `${activeCategory.name}_Costing_Template.xlsx`);
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
        
        // Header array format
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length === 0) {
          setError("The uploaded Excel sheet is empty.");
          return;
        }

        const headers = jsonData[0];
        const rowsData = jsonData.slice(1);

        const parsedItems = rowsData.map(row => {
          const item = {};
          marketingFields.forEach(field => {
            const colIdx = headers.findIndex(
              h => h && h.toString().trim().toLowerCase() === field.label.trim().toLowerCase()
            );
            if (colIdx !== -1) {
              let val = row[colIdx];
              if (field.type === "number" && val !== undefined && val !== "") {
                val = Number(val);
              }
              item[field.key] = val !== undefined ? val : "";
            } else {
              item[field.key] = "";
            }
          });
          return item;
        });

        // Filter empty rows
        const cleanParsed = parsedItems.filter(item => 
          Object.values(item).some(v => v !== "" && v !== null && v !== undefined)
        );

        if (cleanParsed.length === 0) {
          setError("No valid line items found in the Excel matching category headers.");
        } else {
          setTable2Data(cleanParsed);
          setError("");
        }
      } catch (err) {
        console.error("Failed to parse Excel file:", err);
        setError("Failed to parse uploaded Excel file. Please ensure it is in the correct format.");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent server auto upload
  };

  // Form submission handler
  const handleSubmitCostingRequest = async () => {
    setError("");

    if (!customerName || customerName.trim() === "") {
      setError("Please enter the Customer Name in the general details table.");
      return;
    }

    const hot2 = hotTable2Ref.current?.hotInstance;
    const currentTable2Data = hot2 ? hot2.getSourceData() : table2Data;

    // Filter out completely empty rows
    const filledItems = currentTable2Data.filter(row => 
      Object.values(row).some(val => val !== "" && val !== null && val !== undefined)
    );

    if (filledItems.length === 0) {
      setError("Please add at least one line item with specifications.");
      return;
    }

    // Validate required fields
    for (let i = 0; i < filledItems.length; i++) {
      const item = filledItems[i];
      for (const field of marketingFields) {
        if (field.required) {
          const val = item[field.key];
          if (val === undefined || val === null || val === "") {
            setError(`Item #${i + 1} is missing a required specification parameter: "${field.label}"`);
            return;
          }
        }
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        customerName: customerName.trim(),
        productUnit,
        specs: {
          items: filledItems
        }
      };

      const result = await costingService.createCostingRequest(payload, currentUser);
      if (result.success) {
        setCreatedRequestInfo(result.data);
        setSuccessDialogOpen(true);
      }
    } catch (err) {
      console.error("Error creating costing request:", err);
      setError(err.message || "Failed to create costing request. Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setSuccessDialogOpen(false);
    navigate(`/costing-requests/${createdRequestInfo.id}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading categories..." />
      </div>
    );
  }

  // Setup Handsontable columns dynamically
  const table1Columns = [
    {
      data: "customerName",
      type: "text",
      placeholder: "Double click to enter Customer Name"
    },
    {
      data: "categoryName",
      type: "dropdown",
      source: categories.map(c => c.name)
    }
  ];

  const table2Columns = marketingFields.map(f => {
    const colObj = {
      data: f.key,
      title: f.required ? `${f.label} *` : f.label
    };
    if (f.type === "number") {
      colObj.type = "numeric";
    } else if (f.type === "select") {
      colObj.type = "dropdown";
      colObj.source = f.options || [];
    } else {
      colObj.type = "text";
    }
    return colObj;
  });

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Space style={{ marginBottom: 32 }}>
        <Button 
          icon={<LeftOutlined />} 
          onClick={() => navigate("/costing-requests")}
          style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
        >
          Back
        </Button>
        <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a" }}>
          Create Costing Request
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
            <div className="hot-container" style={{ maxWidth: 650 }}>
              <HotTable
                ref={hotTable1Ref}
                data={table1Data}
                columns={table1Columns}
                colHeaders={["Customer Name", "Product Category"]}
                rowHeaders={false}
                height="auto"
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleTable1Change}
                stretchH="all"
              />
            </div>
            <Text type="secondary">Double-click on cells to type or select from the dropdown options.</Text>
          </Card>
        </Col>

        {/* Table 2: Specifications List */}
        <Col span={24}>
          <Card 
            title={`2. Specifications List - ${activeCategory?.name || ""} (Excel Grid)`}
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
                  Add Row
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
              {table2Columns.length > 0 ? (
                <HotTable
                  ref={hotTable2Ref}
                  data={table2Data}
                  columns={table2Columns}
                  colHeaders={table2Columns.map(c => c.title)}
                  rowHeaders={true}
                  height="300"
                  licenseKey="non-commercial-and-evaluation"
                  stretchH="all"
                  manualColumnResize={true}
                />
              ) : (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <Text type="secondary">No fields configured for this category.</Text>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <Button
                type="primary"
                onClick={handleSubmitCostingRequest}
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
                {submitting ? "Submitting Request..." : "Submit Costing Request"}
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
            View Request Details
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
            Request Submitted
          </Title>
          <Text type="secondary" style={{ display: "block", marginTop: 8, marginBottom: 24, fontSize: "0.9rem" }}>
            The costing request has been successfully created and registered on the server.
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
              Cost Request No
            </Text>
            <Title level={1} style={{ margin: "8px 0", color: "#6366f1", fontWeight: 900 }}>
              {createdRequestInfo?.costRequestNo}
            </Title>
            <Tag color="processing" style={{ fontWeight: 800, fontSize: "0.65rem", padding: "2px 8px" }}>
              SUBMITTED TO FINANCE
            </Tag>
          </div>
        </div>
      </Modal>
    </div>
  );
}

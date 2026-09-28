import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as costingService from "../../services/firebase/costingService";
import { Button, Card, Row, Col, Typography, Alert, Modal, Space, Tag, Spin, Upload } from "antd";
import { LeftOutlined, PlusCircleOutlined, CheckCircleFilled, PlusOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

import * as costingPacking from "../../utils/costingPackingConfig";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;

const getTodayDateStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

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
  const [requestDate, setRequestDate] = useState(getTodayDateStr());
  const [table1Data, setTable1Data] = useState([{ customerName: "", categoryName: "", requestDate: getTodayDateStr() }]);

  // Table 2 (specifications) data
  const [table2Data, setTable2Data] = useState([]);

  // Success Dialog States
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdRequestInfo, setCreatedRequestInfo] = useState(null);

  const getMarketingFieldsForCat = (cat) => {
    let raw = cat ? (cat.fields || []).filter(f => f.owner === "marketing") : [];
    
    // Determine dynamic options for Packing Configuration based on category
    const packingOptions = costingPacking.getPackingOptionsForCategory(cat?.id || cat?.name);
    
    // Check if packingConfiguration already exists in category fields
    const hasPackingConfig = raw.some(f => f.key === "packingConfiguration");
    if (hasPackingConfig) {
      raw = raw.map(f => {
        if (f.key === "packingConfiguration") {
          return {
            ...f,
            label: "Packing Configuration",
            type: "select",
            options: packingOptions,
            required: true,
            owner: "marketing"
          };
        }
        return f;
      });
    } else {
      // Insert packingConfiguration right after the first field (usually description)
      const insertIdx = raw.length > 0 ? 1 : 0;
      raw.splice(insertIdx, 0, {
        key: "packingConfiguration",
        label: "Packing Configuration",
        type: "select",
        options: packingOptions,
        required: true,
        owner: "marketing"
      });
    }

    // Ensure NC/RC Ratio, Density, and Latex Ratio are select dropdowns with standard presets
    raw = raw.map(f => {
      if (f.key === "ncRcRatio") {
        return {
          ...f,
          type: "select",
          options: f.options && f.options.length > 0 ? f.options : ["80:20", "70:30", "100:0", "60:40", "50:50", "90:10"],
          required: true
        };
      }
      if (f.key === "density") {
        return {
          ...f,
          type: "select",
          options: f.options && f.options.length > 0 ? f.options : ["80 kg/m3", "65 kg/m3", "70 kg/m3", "90 kg/m3", "100 kg/m3", "120 kg/m3"],
          required: true
        };
      }
      if (f.key === "latexRatio") {
        return {
          ...f,
          type: "select",
          options: f.options && f.options.length > 0 ? f.options : ["80:20", "70:30", "100:0", "60:40", "50:50"],
          required: true
        };
      }
      if (f.key === "specifications") {
        return {
          ...f,
          label: "Product Specifications (L x W x H)",
          required: true
        };
      }
      return f;
    });

    if (!raw.some(f => f.key === "marketingRemarks" || f.key === "remarks")) {
      raw = [
        ...raw,
        { key: "marketingRemarks", label: "Marketing Remarks", type: "text", required: false, owner: "marketing" }
      ];
    }
    return raw;
  };

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await costingService.getProductCategories();
        setCategories(cats);
        
        if (cats.length > 0) {
          const bedding = cats.find(c => c.id === "bedding");
          const defaultCat = bedding || cats[0];
          setProductUnit(defaultCat.id);
          
          setTable1Data([{ customerName: "", categoryName: defaultCat.name, requestDate: getTodayDateStr() }]);
          
          const defaultFields = getMarketingFieldsForCat(defaultCat);
          const emptyRows = Array.from({ length: 1 }, () => createDefaultRow(defaultFields, defaultCat));
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

  const createDefaultRow = (fields, cat) => {
    const rowObj = {};
    const defaultPacking = costingPacking.getDefaultPackingOption(cat?.id || cat?.name);
    fields.forEach(f => {
      if (f.key === "packingConfiguration") {
        rowObj[f.key] = defaultPacking;
      } else {
        rowObj[f.key] = "";
      }
    });
    return rowObj;
  };

  const activeCategory = (categories || []).find(c => c.id === productUnit);
  const marketingFields = getMarketingFieldsForCat(activeCategory);

  const handleTable1Change = (changes) => {
    if (!changes) return;
    
    const hot1 = hotTable1Ref.current?.hotInstance;
    if (!hot1) return;
    
    const currentData = hot1.getSourceData();
    const rowData = currentData[0] || {};
    
    if (rowData.customerName !== customerName) {
      setCustomerName(rowData.customerName || "");
    }
    
    if (rowData.requestDate !== undefined && rowData.requestDate !== requestDate) {
      setRequestDate(rowData.requestDate || getTodayDateStr());
    }
    
    const selectedCatName = rowData.categoryName;
    const matchedCat = categories.find(c => c.name === selectedCatName);
    if (matchedCat && matchedCat.id !== productUnit) {
      setProductUnit(matchedCat.id);
      
      const defaultFields = getMarketingFieldsForCat(matchedCat);
      const emptyRows = Array.from({ length: 1 }, () => createDefaultRow(defaultFields, matchedCat));
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
        const newRow = createDefaultRow(marketingFields, activeCategory);
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

        const parsedItems = rowsData.map((row, rIdx) => {
          const item = {};
          marketingFields.forEach(field => {
            const colIdx = headers.findIndex(
              h => h && h.toString().trim().toLowerCase() === field.label.trim().toLowerCase()
            );
            if (colIdx !== -1) {
              let val = row[colIdx];
              // Validation: required fields must not be empty
              if (field.required && (val === undefined || val === null || val.toString().trim() === "")) {
                throw new Error(`Row #${rIdx + 2}: "${field.label}" is required and cannot be empty.`);
              }

              if (val !== undefined && val !== null && val !== "") {
                if (field.type === "number") {
                  if (isNaN(Number(val))) {
                    throw new Error(`Row #${rIdx + 2}: "${field.label}" must be a numeric value.`);
                  }
                  val = Number(val);
                }
                item[field.key] = val;
              } else {
                item[field.key] = "";
              }
            } else {
              if (field.required) {
                throw new Error(`Column "${field.label}" is missing from the Excel sheet.`);
              }
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
        setError(err.message || "Failed to parse uploaded Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent server auto upload
  };

  // Form submission handler
  const handleSubmitCostingRequest = async () => {
    setError("");

    const hot1 = hotTable1Ref.current?.hotInstance;
    const t1Data = hot1 ? hot1.getSourceData()[0] : table1Data[0];
    const finalCustomerName = (t1Data?.customerName || customerName || "").trim();
    const finalRequestDate = t1Data?.requestDate || requestDate || getTodayDateStr();

    const hot2 = hotTable2Ref.current?.hotInstance;
    const currentTable2Data = hot2 ? hot2.getSourceData() : table2Data;

    const validationErrors = [];

    if (!finalCustomerName) {
      validationErrors.push("Customer Name is required in the General Information table (Table 1).");
    }

    // Filter out rows where the user actually entered data (not just default preset dropdown values)
    const filledItems = (currentTable2Data || []).filter(row => {
      if (!row) return false;
      return (
        (row.description && String(row.description).trim() !== "") ||
        (row.specifications && String(row.specifications).trim() !== "") ||
        (row.length !== undefined && row.length !== null && String(row.length).trim() !== "") ||
        (row.width !== undefined && row.width !== null && String(row.width).trim() !== "") ||
        (row.height !== undefined && row.height !== null && String(row.height).trim() !== "") ||
        (row.marketingRemarks && String(row.marketingRemarks).trim() !== "") ||
        (row.cartonSize && String(row.cartonSize).trim() !== "")
      );
    });

    if (filledItems.length === 0) {
      validationErrors.push("Please add at least one line item with specifications / dimensions in Table 2.");
    } else {
      for (let i = 0; i < filledItems.length; i++) {
        const item = filledItems[i];
        
        // 1. Validate all required marketing fields
        for (const field of marketingFields) {
          if (field.required) {
            const val = item[field.key];
            if (val === undefined || val === null || String(val).trim() === "") {
              validationErrors.push(`Item #${i + 1}: Required parameter "${field.label}" is missing.`);
            }
          }
        }

        // 2. Reinforce Product Specifications column to contain L x W x H sequence
        const hasSpecField = marketingFields.some(f => f.key === "specifications");
        if (hasSpecField) {
          const specVal = item.specifications;
          if (!specVal || String(specVal).trim() === "" || String(specVal).trim() === "-") {
            validationErrors.push(`Item #${i + 1}: "Product Specifications" is required and must contain the L x W x H dimension sequence (e.g. 57X51X58 CM or 30x30x5 CM).`);
          } else if (!costingPacking.containsLxWxHSequence(specVal)) {
            validationErrors.push(`Item #${i + 1}: "Product Specifications" must contain the L x W x H dimension sequence (e.g. 57X51X58 CM or 30x30x5 CM).`);
          }
        }

        // 3. Reinforce L x W x H configurations for items with separate Length, Width, Height (e.g. Bedding)
        const hasLengthField = marketingFields.some(f => f.key === "length");
        const hasWidthField = marketingFields.some(f => f.key === "width");
        const hasHeightField = marketingFields.some(f => f.key === "height");

        if (hasLengthField || hasWidthField || hasHeightField) {
          const l = parseFloat(item.length);
          const w = parseFloat(item.width);
          const h = parseFloat(item.height);

          if (isNaN(l) || l <= 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
            validationErrors.push(`Item #${i + 1}: Complete L x W x H configurations (Length, Width, Height) are required and must be numerical values greater than 0.`);
          }
        }

        // 4. Reinforce Carton / Bundle Size if present (must be complete 3D L x W x H dimensions)
        if (item.cartonSize && String(item.cartonSize).trim() !== "" && String(item.cartonSize).trim() !== "0") {
          if (!costingPacking.isValidDimensionString(item.cartonSize)) {
            validationErrors.push(`Item #${i + 1}: "Carton / Bundle Size" must contain complete L x W x H numerical dimensions (e.g. 57X51X58 CM).`);
          }
        }
      }
    }

    if (validationErrors.length > 0) {
      setError(validationErrors.join(" | "));
      Modal.error({
        title: "Cannot Create Costing Request",
        width: 540,
        centered: true,
        content: (
          <div style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 12, color: "#334155", fontSize: "0.92rem", fontWeight: 500 }}>
              The costing request cannot be submitted because required configurations or dimensions are missing:
            </p>
            <div 
              style={{ 
                background: "#fef2f2", 
                border: "1px solid #fecaca", 
                borderRadius: 10, 
                padding: "12px 16px",
                maxHeight: 240,
                overflowY: "auto"
              }}
            >
              <ul style={{ margin: 0, paddingLeft: 18, color: "#b91c1c", fontSize: "0.86rem", lineHeight: 1.6 }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    <strong>{err}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.82rem", color: "#64748b" }}>
              💡 Tip: Make sure full L x W x H numerical configurations and required product specifications are specified.
            </p>
          </div>
        ),
        okText: "Review & Fix"
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerName: finalCustomerName,
        productUnit,
        requestDate: finalRequestDate,
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
      const errMsg = err.message || "Failed to create costing request. Transaction failed.";
      setError(errMsg);
      Modal.error({
        title: "Submission Failed",
        content: errMsg,
        okText: "OK"
      });
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
      source: categories.map(c => c.name),
      visibleRows: 10
    },
    {
      data: "requestDate",
      type: "date",
      dateFormat: "YYYY-MM-DD",
      correctFormat: true,
      defaultDate: getTodayDateStr()
    }
  ];

  const table2Columns = marketingFields.map(f => {
    const colObj = {
      data: f.key,
      title: f.required ? `${f.label} *` : f.label
    };
    if (f.type === "number") {
      colObj.type = "numeric";
      colObj.width = 120;
    } else if (f.type === "select") {
      colObj.type = "dropdown";
      colObj.source = f.options || [];
      colObj.visibleRows = 10;
      colObj.width = 160;
    } else {
      colObj.type = "text";
      colObj.width = f.key === "specifications" ? 280 : (f.key === "description" ? 220 : 180);
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
            title="1. General Information" 
            bordered={true} 
            style={{ borderLeft: "4px solid #6366f1", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            styles={{ body: { padding: 24 } }}
          >
            <div className="hot-container" style={{ maxWidth: 800 }}>
              <HotTable
                ref={hotTable1Ref}
                data={table1Data}
                columns={table1Columns}
                colHeaders={["Customer Name *", "Product Category *", "Request Date *"]}
                rowHeaders={false}
                height="250"
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleTable1Change}
                colWidths={[280, 240, 180]}
              />
            </div>
            <Text type="secondary">Double-click on cells to type or select from the dropdown options.</Text>
          </Card>
        </Col>

        {/* Table 2: Specifications List */}
        <Col span={24}>
          <Card 
            title={`2. Specifications List - ${activeCategory?.name || ""}`}
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
            <div style={{ marginBottom: 16 }}>
              <Tag color="blue" style={{ fontSize: "0.85rem", padding: "4px 8px" }}>
                Hint: Save Excel template as a standard Excel file (.xlsx) before uploading with public tag
              </Tag>
            </div>
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
                  colWidths={(index) => table2Columns[index]?.width || 180}
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

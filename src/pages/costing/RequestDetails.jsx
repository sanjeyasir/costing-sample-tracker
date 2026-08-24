import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as costingService from "../../services/firebase/costingService";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import * as notificationService from "../../services/firebase/notificationService";
import { Row, Col, Card, Typography, Button, Tag, Space, Input, Select, Alert, Spin, Descriptions, Divider, Modal, Upload } from "antd";
import {
  LeftOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  RollbackOutlined,
  EditOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  FileTextOutlined
} from "@ant-design/icons";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;
const { Option } = Select;

export default function RequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [request, setRequest] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editing states (for Finance entry or Admin correction)
  const [costingDraft, setCostingDraft] = useState({});
  const [specsDraft, setSpecsDraft] = useState({});
  const [isAdminCorrecting, setIsAdminCorrecting] = useState(false);

  // Table refs and data
  const hotTableRef = useRef(null);
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    async function loadRequest() {
      try {
        setLoading(true);
        const data = await costingService.getCostingRequestById(id);
        setRequest(data);
        setCostingDraft(data.costing || {});
        setSpecsDraft(data.specs || {});
        
        const cats = await costingService.getProductCategories();
        setCategories(cats);
      } catch (err) {
        console.error("Error loading request:", err);
        setError("Failed to load costing request details.");
      } finally {
        setLoading(false);
      }
    }
    loadRequest();
  }, [id]);

  const activeCategory = (categories || []).find(c => c?.id === request?.productUnit);
  let requestFields = [];
  if (request?.categoryFieldsJson) {
    try {
      requestFields = JSON.parse(request.categoryFieldsJson);
    } catch (e) {
      console.error("Failed to parse categoryFieldsJson:", e);
      requestFields = request?.categoryFields || activeCategory?.fields || [];
    }
  } else {
    requestFields = request?.categoryFields || activeCategory?.fields || [];
  }
  const financeFields = requestFields.filter(f => f.owner === "finance");
  const marketingFields = requestFields.filter(f => f.owner === "marketing");

  const isFinanceOfficer = currentUser.costingRoles?.includes("costing_finance") || currentUser.costingRoles?.includes("admin") || currentUser.roles?.includes("admin");
  const isAdmin = currentUser.roles?.includes("admin") || currentUser.costingRoles?.includes("admin");
  const isCompleted = request?.status === "Costing Completed" || request?.status === "Sent to Marketing";
  const isCostingActive = ((isFinanceOfficer && (request?.status === "Costing in Progress" || request?.status === "Overdue")) || isAdminCorrecting) && !request?.specs?.excelFile;

  // Initialize Handsontable Grid data when request loads
  useEffect(() => {
    if (request && categories.length > 0) {
      const itemsList = request.specs?.items || [request.specs || {}];
      const initialRows = itemsList.map((item, idx) => {
        const rowObj = {
          itemNo: idx + 1
        };
        
        // Specs values
        marketingFields.forEach(f => {
          rowObj[`spec_${f.key}`] = item[f.key] !== undefined ? item[f.key] : "";
        });
        
        // Costing values
        const itemCosting = request.specs?.items 
          ? (costingDraft.items?.[idx] || request.costing?.items?.[idx] || {})
          : (costingDraft || request.costing || {});
        
        financeFields.forEach(f => {
          rowObj[`cost_${f.key}`] = itemCosting[f.key] !== undefined ? itemCosting[f.key] : "";
        });
        
        return rowObj;
      });
      setTableData(initialRows);
    }
  }, [request, categories, isAdminCorrecting]);

  const handleDetailsTableChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;
    
    const gridData = hot.getSourceData();
    
    if (request.specs?.items) {
      const updatedCostingItems = {};
      const updatedSpecsItems = [];
      
      gridData.forEach((row, idx) => {
        const specObj = {};
        marketingFields.forEach(f => {
          specObj[f.key] = row[`spec_${f.key}`];
        });
        updatedSpecsItems.push(specObj);
        
        const costObj = {};
        financeFields.forEach(f => {
          let val = row[`cost_${f.key}`];
          if (f.type === "number" && val !== "" && val !== undefined && val !== null) {
            val = Number(val);
          }
          costObj[f.key] = val;
        });
        updatedCostingItems[idx] = costObj;
      });
      
      setSpecsDraft({ items: updatedSpecsItems });
      setCostingDraft(prev => ({
        ...prev,
        items: updatedCostingItems
      }));
    } else {
      const row = gridData[0] || {};
      
      const specObj = {};
      marketingFields.forEach(f => {
        specObj[f.key] = row[`spec_${f.key}`];
      });
      setSpecsDraft(specObj);
      
      const costObj = {};
      financeFields.forEach(f => {
        let val = row[`cost_${f.key}`];
        if (f.type === "number" && val !== "" && val !== undefined && val !== null) {
          val = Number(val);
        }
        costObj[f.key] = val;
      });
      setCostingDraft(prev => ({
        ...prev,
        ...costObj
      }));
    }
  };

  // Excel handlers
  const handleFinanceExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCostingDraft(prev => ({
        ...prev,
        excelFile: {
          name: file.name,
          content: e.target.result // Base64 Data URL
        }
      }));
      setError("");
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto upload
  };

  const handleDownloadExcel = (fileObj) => {
    if (!fileObj || !fileObj.content) return;
    const link = document.createElement("a");
    link.href = fileObj.content;
    link.download = fileObj.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Workflow Action Handlers
  const handleReceive = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.receiveCostingRequest(id, currentUser);
      setRequest(updated);
      setSuccessMsg("Request received successfully by Finance.");
    } catch (err) {
      setError(err.message || "Failed to receive request.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartCosting = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.startCostingRequest(id);
      setRequest(updated);
      setSuccessMsg("Costing phase started.");
    } catch (err) {
      setError(err.message || "Failed to start costing.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.saveCostingDataDraft(id, costingDraft);
      setRequest(updated);
      setSuccessMsg("Costing draft saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteCosting = async () => {
    setError("");

    if (request.specs?.excelFile) {
      if (!costingDraft.excelFile) {
        return setError("Please upload the completed costing Excel file.");
      }
    } else {
      const itemsCount = request.specs?.items ? request.specs.items.length : 1;
      const costingItems = request.specs?.items ? (costingDraft.items || {}) : costingDraft;
      
      for (let i = 0; i < itemsCount; i++) {
        const itemCosting = request.specs?.items ? costingItems[i] : costingItems;
        if (!itemCosting) {
          return setError(`Please enter costing parameters for Item #${i + 1}.`);
        }
        for (const field of financeFields) {
          if (field.required && (itemCosting[field.key] === undefined || itemCosting[field.key] === "")) {
            return setError(`Item #${i + 1} is missing required costing field: "${field.label}"`);
          }
        }
      }
    }

    try {
      setSaving(true);
      const updated = await costingService.completeCostingRequest(id, costingDraft);
      setRequest(updated);
      setSuccessMsg("Costing successfully completed and marked ready for Marketing.");
    } catch (err) {
      setError(err.message || "Failed to complete costing.");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.reopenCostingRequest(id);
      setRequest(updated);
      setIsAdminCorrecting(false);
      setSuccessMsg("Completed request has been reopened successfully.");
    } catch (err) {
      setError(err.message || "Failed to reopen request.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdminCorrectionSubmit = async () => {
    try {
      setError("");
      setSaving(true);
      await costingService.updateRequestSpecs(id, specsDraft);
      const updated = await costingService.saveCostingDataDraft(id, costingDraft);
      setRequest(updated);
      setIsAdminCorrecting(false);
      setSuccessMsg("Request corrections saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save corrections.");
    } finally {
      setSaving(false);
    }
  };

  const handleNudgeFinance = async () => {
    try {
      setError("");
      setSaving(true);
      const targetUser = request.financeOfficer?.uid || null;
      const targetRole = request.financeOfficer?.uid ? null : "finance";
      
      await notificationService.createNotification({
        userId: targetUser,
        role: targetRole,
        costRequestId: request.id,
        costRequestNo: request.costRequestNo,
        message: `Marketing Officer ${currentUser.displayName || currentUser.email} is requesting an update on costing for Request #${request.costRequestNo}.`
      });
      setSuccessMsg("Nudge notification sent to Finance successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to send nudge notification.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCostSheet = async () => {
    try {
      setError("");
      setSaving(true);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Customer Cost Sheet");

      // Set page details
      worksheet.addRow([]);
      worksheet.addRow(["Hayfibre Marketing Operations - Cost Sheet"]).font = { size: 16, bold: true, color: { argb: "FF0F172A" } };
      worksheet.addRow([`Request No: ${request.costRequestNo}`]).font = { bold: true };
      worksheet.addRow([`Customer Name: ${request.customerName}`]).font = { bold: true };
      worksheet.addRow([`Product Category: ${request.productUnit}`]).font = { bold: true };
      worksheet.addRow([`Date: ${new Date(request.requestDate).toLocaleDateString()}`]);
      worksheet.addRow([]);

      // Get line items
      const itemsList = request.specs?.items && request.specs.items.length > 0 
        ? request.specs.items 
        : [request.specs || {}];
      
      const costingList = request.specs?.items
        ? (request.costing?.items || [])
        : [request.costing || {}];

      // Identify active columns (exclude empty ones)
      const activeMarketingFields = marketingFields.filter(f => {
        return itemsList.some(item => item[f.key] !== undefined && item[f.key] !== null && item[f.key] !== "" && item[f.key] !== "-");
      });

      const activeFinanceFields = financeFields.filter(f => {
        return costingList.some((cItem, idx) => {
          const itemCost = request.specs?.items ? costingList[idx] : request.costing;
          const val = itemCost ? itemCost[f.key] : undefined;
          return val !== undefined && val !== null && val !== "" && val !== "-";
        });
      });

      // Construct table headers
      const headers = ["Item #"];
      activeMarketingFields.forEach(f => headers.push(f.label));
      activeFinanceFields.forEach(f => headers.push(f.label));

      const headerRowIndex = 8;
      const headerRow = worksheet.getRow(headerRowIndex);
      headers.forEach((h, colIdx) => {
        headerRow.getCell(colIdx + 1).value = h;
      });

      // Style header row
      headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0EA5E9" } // Sky blue
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      // Add Data rows
      itemsList.forEach((item, idx) => {
        const itemCosting = request.specs?.items ? costingList[idx] : request.costing;
        const rowData = [idx + 1];

        activeMarketingFields.forEach(f => {
          rowData.push(item[f.key] !== undefined ? item[f.key] : "");
        });

        activeFinanceFields.forEach(f => {
          let val = itemCosting ? itemCosting[f.key] : "";
          if (f.key === "unitCost" && val !== undefined && val !== "") {
            val = `$${Number(val).toFixed(2)}`;
          }
          rowData.push(val);
        });

        const dataRow = worksheet.getRow(headerRowIndex + 1 + idx);
        rowData.forEach((val, colIdx) => {
          dataRow.getCell(colIdx + 1).value = val;
          dataRow.getCell(colIdx + 1).border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
        dataRow.height = 22;
      });

      // Format column widths
      worksheet.columns.forEach((col, colIdx) => {
        let maxLen = 15;
        worksheet.eachRow((row, rIdx) => {
          if (rIdx >= headerRowIndex) {
            const cellVal = row.getCell(colIdx + 1).value;
            if (cellVal) {
              maxLen = Math.max(maxLen, cellVal.toString().length + 4);
            }
          }
        });
        col.width = Math.min(maxLen, 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Cost_Sheet_CR_${request.costRequestNo}_${request.customerName.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccessMsg("Customer Cost Sheet downloaded successfully.");
    } catch (err) {
      console.error("Error exporting cost sheet:", err);
      setError("Failed to generate and download Customer Cost Sheet.");
    } finally {
      setSaving(false);
    }
  };

  // Excel Single Export / Download
  const handleSingleExport = () => {
    if (!request) return;

    if (request.specs?.excelFile) {
      handleDownloadExcel(request.specs.excelFile);
      if (request.costing?.excelFile) {
        handleDownloadExcel(request.costing.excelFile);
      }
      return;
    }

    const data = [];
    data.push(["PRODUCT COSTING SHEET", "", ""]);
    data.push(["Cost Request No:", request.costRequestNo, ""]);
    data.push(["Customer:", request.customerName, ""]);
    data.push(["Status:", request.status, ""]);
    data.push(["Request Date:", request.requestDate ? new Date(request.requestDate).toLocaleDateString() : "", ""]);
    data.push(["Completion Date:", request.completionDate ? new Date(request.completionDate).toLocaleDateString() : "Pending", ""]);
    data.push(["Marketing Officer:", request.marketingOfficer.name, ""]);
    data.push(["Finance Officer:", request.financeOfficer?.name || "Unassigned", ""]);
    data.push(["", "", ""]);

    const headers = ["Item No"];
    marketingFields.forEach(f => headers.push(f.label));
    financeFields.forEach(f => headers.push(f.label));
    data.push(headers);

    const itemsList = request.specs?.items || [request.specs || {}];
    itemsList.forEach((item, index) => {
      const itemCosting = request.specs?.items 
        ? (request.costing?.items?.[index] || {})
        : (request.costing || {});
      const row = [index + 1];
      marketingFields.forEach(f => row.push(item[f.key] || "N/A"));
      financeFields.forEach(f => {
        let val = itemCosting[f.key];
        if (f.key === "unitCost" && val) {
          val = `$${val.toFixed(2)}`;
        }
        row.push(val || "N/A");
      });
      data.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `CR_${request.costRequestNo}`);
    XLSX.writeFile(workbook, `Cost_Request_${request.costRequestNo}.xlsx`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Submitted": return "processing";
      case "Received by Finance": return "warning";
      case "Costing in Progress": return "purple";
      case "Costing Completed":
      case "Sent to Marketing": return "success";
      case "Overdue": return "error";
      default: return "default";
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading request details..." />
      </div>
    );
  }

  // Setup grid columns dynamically
  const gridColumns = [];
  gridColumns.push({
    data: "itemNo",
    title: "#",
    readOnly: true,
    width: 50
  });

  marketingFields.forEach(f => {
    const col = {
      data: `spec_${f.key}`,
      title: `${f.label} (Mkt)`,
      readOnly: !isAdminCorrecting
    };
    if (f.type === "number") col.type = "numeric";
    else if (f.type === "select") {
      col.type = "dropdown";
      col.source = f.options || [];
      col.visibleRows = 10;
    }
    gridColumns.push(col);
  });

  financeFields.forEach(f => {
    const col = {
      data: `cost_${f.key}`,
      title: `${f.label} (Fin)`,
      readOnly: !isCostingActive
    };
    if (f.type === "number") col.type = "numeric";
    else if (f.type === "select") {
      col.type = "dropdown";
      col.source = f.options || [];
      col.visibleRows = 10;
    }
    gridColumns.push(col);
  });

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 32, gap: 16 }}>
        <Col>
          <Space size="middle">
            <Button
              icon={<LeftOutlined />}
              onClick={() => navigate("/costing-requests")}
              style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
            >
              Back
            </Button>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              Request #{request.costRequestNo}
            </Title>
            <Tag color={getStatusColor(request.status)} style={{ fontWeight: 700 }}>
              {request.status}
            </Tag>
          </Space>
        </Col>

        <Col>
          <Space>
            {["Submitted", "Costing in Progress", "Overdue"].includes(request.status) && (
              <Button
                type="primary"
                ghost
                onClick={handleNudgeFinance}
                loading={saving}
                style={{ borderRadius: 8 }}
              >
                Nudge Finance
              </Button>
            )}

            {request.status === "Costing Completed" && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadCostSheet}
                loading={saving}
                style={{ borderRadius: 8, background: "#10b981", borderColor: "#10b981" }}
              >
                Download Customer Cost Sheet
              </Button>
            )}

            {(isCompleted || isAdmin) && (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleSingleExport}
                size="large"
                style={{ borderRadius: 8 }}
              >
                Download Cost Sheet Excel
              </Button>
            )}

            {isAdmin && isCompleted && (
              <Button
                icon={<RollbackOutlined />}
                onClick={handleReopen}
                danger
                size="large"
                style={{ borderRadius: 8 }}
              >
                Reopen Request
              </Button>
            )}

            {isFinanceOfficer && !isCompleted && !isAdminCorrecting && (
              <Button
                type="dashed"
                icon={<EditOutlined />}
                onClick={() => {
                  setIsAdminCorrecting(true);
                  setSpecsDraft(request.specs || {});
                  setCostingDraft(request.costing || {});
                }}
                size="large"
                style={{ borderRadius: 8 }}
              >
                Correct Details
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
      {successMsg && <Alert message={successMsg} type="success" showIcon closable onClose={() => setSuccessMsg("")} style={{ marginBottom: 24, borderRadius: 8 }} />}

      <Row gutter={[24, 24]}>
        {/* Requisition details */}
        <Col span={24}>
          <Card 
            title="General Summary" 
            bordered={true}
            style={{ borderLeft: "4px solid #475569", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
          >
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} layout="vertical" bordered={false}>
              <Descriptions.Item label="CUSTOMER"><strong style={{ color: "#0f172a" }}>{request.customerName}</strong></Descriptions.Item>
              <Descriptions.Item label="PRODUCT CATEGORY"><Tag color="geekblue" style={{ fontWeight: 700 }}>{activeCategory?.name || request.productUnit}</Tag></Descriptions.Item>
              <Descriptions.Item label="MARKETING OFFICER"><span>{request.marketingOfficer.name}</span></Descriptions.Item>
              <Descriptions.Item label="FINANCE OFFICER"><span>{request.financeOfficer?.name || "Unassigned"}</span></Descriptions.Item>
              <Descriptions.Item label="REQUEST DATE"><span>{request.requestDate ? new Date(request.requestDate).toLocaleString() : "-"}</span></Descriptions.Item>
              <Descriptions.Item label="COMPLETION DATE"><span>{request.completionDate ? new Date(request.completionDate).toLocaleString() : "Pending"}</span></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Excel upload interface if file-based costing */}
        {request.specs?.excelFile && (
          <Col span={24}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card title="Marketing Specifications File" bordered={true} style={{ borderRadius: 12 }}>
                  <Alert
                    message="Specifications Document Uploaded by Marketing"
                    description={
                      <div style={{ marginTop: 12 }}>
                        <Space style={{ marginBottom: 12 }}>
                          <FileTextOutlined style={{ fontSize: 24, color: "#0ea5e9" }} />
                          <Text strong>{request.specs.excelFile.name}</Text>
                        </Space>
                        <div>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadExcel(request.specs.excelFile)}
                            style={{ borderRadius: 6 }}
                          >
                            Download Specifications Excel
                          </Button>
                        </div>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Finance Costing File" bordered={true} style={{ borderRadius: 12 }}>
                  {((isFinanceOfficer && (request.status === "Costing in Progress" || request.status === "Overdue")) || isAdminCorrecting) ? (
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <Text type="secondary">
                        Finance costing is spreadsheet-based. Download the specifications sheet, perform calculations, and upload the completed costing sheet below.
                      </Text>

                      <Upload.Dragger
                        multiple={false}
                        beforeUpload={handleFinanceExcelUpload}
                        showUploadList={false}
                        accept=".xlsx,.xls"
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined style={{ fontSize: 32, color: "#6366f1" }} />
                        </p>
                        <p className="ant-upload-text" style={{ fontWeight: 600, fontSize: "0.85rem" }}>Click or drag updated Excel sheet here</p>
                      </Upload.Dragger>

                      {costingDraft.excelFile && (
                        <Card size="small" style={{ border: "1px dashed #10b981", background: "rgba(16, 185, 129, 0.02)" }}>
                          <Space>
                            <FileTextOutlined style={{ color: "#10b981", fontSize: 18 }} />
                            <Text strong>{costingDraft.excelFile.name}</Text>
                          </Space>
                        </Card>
                      )}

                      <Row gutter={12}>
                        <Col span={12}>
                          <Button icon={<SaveOutlined />} onClick={handleSaveDraft} disabled={saving} block>Save Draft</Button>
                        </Col>
                        <Col span={12}>
                          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleCompleteCosting} disabled={saving} block style={{ background: "#10b981", borderColor: "#10b981" }}>Complete</Button>
                        </Col>
                      </Row>
                    </Space>
                  ) : (
                    <div>
                      {request.costing?.excelFile ? (
                        <Alert
                          message="Excel Costing Document"
                          description={
                            <div style={{ marginTop: 12 }}>
                              <Space style={{ marginBottom: 12 }}>
                                <FileTextOutlined style={{ fontSize: 24, color: "#a855f7" }} />
                                <Text strong>{request.costing.excelFile.name}</Text>
                              </Space>
                              <div>
                                <Button
                                  type="primary"
                                  icon={<DownloadOutlined />}
                                  onClick={() => handleDownloadExcel(request.costing.excelFile)}
                                  style={{ borderRadius: 6, background: "#a855f7", borderColor: "#a855f7" }}
                                >
                                  Download Completed Costing Excel
                                </Button>
                              </div>
                            </div>
                          }
                          type="info"
                          showIcon
                        />
                      ) : (
                        <Alert 
                          message="Finance has not uploaded the costing sheet yet."
                          type="warning"
                          showIcon
                        />
                      )}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </Col>
        )}

        {/* Handsontable Specifications & Costing Grid */}
        {!request.specs?.excelFile && (
          <Col span={24}>
            <Card 
              title="Specifications & Costing Grid" 
              bordered={true}
              style={{ borderLeft: "4px solid #0ea5e9", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
              extra={
                isCostingActive && (
                  <Tag color="processing" style={{ fontWeight: 800 }}>COSTING PHASE ACTIVE</Tag>
                )
              }
            >
              {isCostingActive && (
                <Alert
                  message="Spreadsheet Editing Enabled"
                  description="Double click on the green column header cells to input Unit Cost and other costing values directly in Excel style."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <div className="hot-container">
                <HotTable
                  ref={hotTableRef}
                  data={tableData}
                  columns={gridColumns}
                  colHeaders={gridColumns.map(c => c.title)}
                  rowHeaders={false}
                  height="auto"
                  licenseKey="non-commercial-and-evaluation"
                  colWidths={(index) => index === 0 ? 50 : 180}
                  afterChange={handleDetailsTableChange}
                  manualColumnResize={true}
                />
              </div>

              {/* Action Buttons below table */}
              {(isCostingActive || isAdminCorrecting) && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                  {isAdminCorrecting ? (
                    <>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleAdminCorrectionSubmit}
                        disabled={saving}
                        style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                      >
                        Save Corrections
                      </Button>
                      <Button
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                          setIsAdminCorrecting(false);
                          setSpecsDraft(request.specs || {});
                          setCostingDraft(request.costing || {});
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        icon={<SaveOutlined />}
                        onClick={handleSaveDraft}
                        disabled={saving}
                        style={{ borderColor: "#6366f1", color: "#6366f1", fontWeight: 700 }}
                      >
                        Save Draft
                      </Button>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleCompleteCosting}
                        disabled={saving}
                        style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                      >
                        Complete Costing
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          </Col>
        )}

        {/* Workflow Lifecycle Step Actions for Finance */}
        {isFinanceOfficer && !isCompleted && (
          <Col span={24}>
            <Card 
              title={<span style={{ color: "#f59e0b" }}>Workflow Action</span>} 
              bordered={true}
              style={{ borderLeft: "4px solid #f59e0b", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            >
              {request.status === "Submitted" && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleReceive}
                  disabled={saving}
                  size="large"
                  style={{ background: "#f59e0b", borderColor: "#f59e0b", fontWeight: 700, borderRadius: 8, height: 48 }}
                >
                  Receive Request
                </Button>
              )}

              {request.status === "Received by Finance" && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartCosting}
                  disabled={saving}
                  size="large"
                  style={{ background: "#6366f1", borderColor: "#6366f1", fontWeight: 700, borderRadius: 8, height: 48 }}
                >
                  Start Costing Phase
                </Button>
              )}

              {["Costing in Progress", "Overdue"].includes(request.status) && (
                <Text type="secondary" style={{ fontWeight: 500, lineHeight: 1.5, display: "block" }}>
                  {request.specs?.excelFile 
                    ? "Download specifications spreadsheet, perform calculations, and upload the final calculated costing sheet on the right."
                    : "Costing phase is active. Input costing parameters inside the Finance columns in the grid above, then click 'Complete Costing'."
                  }
                </Text>
              )}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}

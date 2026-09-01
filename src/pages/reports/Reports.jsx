import React, { useEffect, useState, useRef } from "react";
import * as sampleService from "../../services/firebase/sampleService";
import * as costingService from "../../services/firebase/costingService";
import { downloadSamplePDF } from "../../utils/pdfGenerator";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Row, Col, Card, Typography, Tag, Button, Space, DatePicker, Select, Tabs, Statistic, Alert, Progress, Tooltip } from "antd";
import {
  DownloadOutlined,
  CalendarOutlined,
  DashboardOutlined,
  UserOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FilterOutlined,
  FilePdfOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function Reports() {
  const [sampleRequests, setSampleRequests] = useState([]);
  const [filteredSamples, setFilteredSamples] = useState([]);
  const [costingRequests, setCostingRequests] = useState([]);
  const [filteredCostings, setFilteredCostings] = useState([]);
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Active Report Tab ("samples" or "costing")
  const [reportSubTab, setReportSubTab] = useState("samples");

  // Filters
  const [dateRange, setDateRange] = useState(null);
  const [productUnit, setProductUnit] = useState("");
  const [status, setStatus] = useState("");
  const [requestType, setRequestType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [marketingOfficer, setMarketingOfficer] = useState("");

  // Refs for Handsontables
  const hotSamplesRef = useRef(null);
  const hotCostingsRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sampleRequests, costingRequests, dateRange, productUnit, status, requestType, customerName, marketingOfficer]);

  const loadData = async () => {
    try {
      setLoading(true);
      const samples = await sampleService.getSampleRequests();
      setSampleRequests(samples);

      const costings = await costingService.getCostingRequests();
      setCostingRequests(costings);

      const cats = await costingService.getProductCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Error loading reports data:", err);
      setError("Failed to fetch reports database.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // 1. Filter Sample Requests
    let samplesResult = [...sampleRequests];
    if (productUnit) {
      samplesResult = samplesResult.filter(r => r.productUnit === productUnit);
    }
    if (status) {
      samplesResult = samplesResult.filter(r => r.status === status);
    }
    if (requestType) {
      samplesResult = samplesResult.filter(r => r.requestType === requestType);
    }
    if (customerName) {
      samplesResult = samplesResult.filter(r => r.customerName === customerName);
    }
    if (marketingOfficer) {
      samplesResult = samplesResult.filter(r => r.requestedBy === marketingOfficer);
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].format("YYYY-MM-DD");
      const end = dateRange[1].format("YYYY-MM-DD");
      samplesResult = samplesResult.filter(r => r.requestDate >= start && r.requestDate <= end);
    }
    samplesResult.sort((a, b) => new Date(b.requestDate || b.createdAt || 0) - new Date(a.requestDate || a.createdAt || 0));
    setFilteredSamples(samplesResult);

    // 2. Filter Costing Requests
    let costingsResult = [...costingRequests];
    if (productUnit) {
      costingsResult = costingsResult.filter(r => r.productUnit?.toLowerCase() === productUnit.toLowerCase());
    }
    if (status) {
      const costStatusMap = {
        "Submitted": "Submitted",
        "In Progress": "Costing in Progress",
        "Overdue": "Overdue",
        "Completed": "Costing Completed"
      };
      const targetStatus = costStatusMap[status] || status;
      costingsResult = costingsResult.filter(r => r.status === targetStatus);
    }
    if (customerName) {
      costingsResult = costingsResult.filter(r => r.customerName === customerName);
    }
    if (marketingOfficer) {
      costingsResult = costingsResult.filter(r => r.marketingOfficer?.name === marketingOfficer);
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].format("YYYY-MM-DD");
      const end = dateRange[1].format("YYYY-MM-DD");
      costingsResult = costingsResult.filter(r => r.requestDate && r.requestDate.split("T")[0] >= start && r.requestDate.split("T")[0] <= end);
    }
    costingsResult.sort((a, b) => new Date(b.requestDate || b.createdAt || 0) - new Date(a.requestDate || a.createdAt || 0));
    setFilteredCostings(costingsResult);
  };

  const handleClearFilters = () => {
    setDateRange(null);
    setProductUnit("");
    setStatus("");
    setRequestType("");
    setCustomerName("");
    setMarketingOfficer("");
  };

  // Get dynamic fields union for costing report
  const allCategoryFields = [];
  categories.forEach(cat => {
    (cat.fields || []).forEach(f => {
      if (!allCategoryFields.some(existing => existing.key === f.key && existing.owner === f.owner)) {
        allCategoryFields.push(f);
      }
    });
  });
  const costingMarketingFields = allCategoryFields.filter(f => f.owner === "marketing");
  const costingFinanceFields = allCategoryFields.filter(f => f.owner === "finance");

  // Get multiplicated flat samples
  const getMultiplicatedSamples = () => {
    const flat = [];
    filteredSamples.forEach(req => {
      const itemsList = req.items && req.items.length > 0 ? req.items : [{
        product: req.product || "-",
        quantity: req.quantity || 1,
        sampleType: req.sampleType || "New Development",
        description: req.description || "-",
        specialNotes: req.specialNotes || "-"
      }];

      itemsList.forEach((item, idx) => {
        flat.push({
          sampleRequestNo: req.sampleRequestNo,
          requestDate: req.requestDate,
          requiredDate: req.requiredDate,
          customerName: req.customerName,
          requestedBy: req.requestedBy,
          productUnit: req.productUnit,
          requestType: req.requestType,
          status: req.status,
          itemNo: idx + 1,
          product: item.product,
          quantity: item.quantity,
          sampleType: item.sampleType,
          description: item.description,
          specialNotes: item.specialNotes
        });
      });
    });
    return flat;
  };

  // Get multiplicated flat costings
  const getMultiplicatedCostings = () => {
    const flat = [];
    filteredCostings.forEach(req => {
      const itemsList = req.specs?.items && req.specs.items.length > 0 ? req.specs.items : [req.specs || {}];

      itemsList.forEach((item, idx) => {
        const itemCosting = req.specs?.items 
          ? (req.costing?.items?.[idx] || {})
          : (req.costing || {});

        const rowObj = {
          costRequestNo: req.costRequestNo,
          requestDate: req.requestDate ? new Date(req.requestDate).toISOString().split("T")[0] : "-",
          customerName: req.customerName,
          productCategory: req.productUnit,
          marketingOfficer: req.marketingOfficer?.name || "-",
          financeOfficer: req.financeOfficer?.name || "Unassigned",
          status: req.status,
          itemNo: idx + 1
        };

        // Specs keys
        costingMarketingFields.forEach(f => {
          rowObj[`spec_${f.key}`] = item[f.key] !== undefined ? item[f.key] : "";
        });

        // Costing keys
        costingFinanceFields.forEach(f => {
          let val = itemCosting[f.key];
          if (f.key === "unitCost" && val !== undefined && val !== "") {
            val = `$${Number(val).toFixed(2)}`;
          }
          rowObj[`cost_${f.key}`] = val !== undefined ? val : "";
        });

        flat.push(rowObj);
      });
    });
    return flat;
  };

  // Calculations for Lead Time Report
  const getLeadTimeStats = () => {
    const completed = filteredSamples.filter(r => r.status === "Completed" && r.actualCompletionDate && r.requestDate);
    if (completed.length === 0) return { avg: "N/A", min: "N/A", max: "N/A", median: "N/A", list: [] };

    const leadTimes = completed.map(r => {
      const start = dayjs(r.requestDate);
      const end = dayjs(r.actualCompletionDate);
      return Math.max(0, end.diff(start, "day"));
    });

    const sum = leadTimes.reduce((a, b) => a + b, 0);
    const avg = (sum / leadTimes.length).toFixed(1);
    const min = Math.min(...leadTimes);
    const max = Math.max(...leadTimes);

    const sorted = [...leadTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);

    const list = completed.map((r, idx) => ({
      key: r.id || idx,
      sampleRequestNo: r.sampleRequestNo,
      customerName: r.customerName,
      product: r.product,
      requestDate: r.requestDate,
      actualCompletionDate: r.actualCompletionDate,
      leadTime: leadTimes[idx]
    }));

    return { avg, min, max, median, list };
  };

  const leadTimeStats = getLeadTimeStats();

  // On-Time Performance Calculations
  const getOnTimeStats = () => {
    const completed = filteredSamples.filter(r => r.status === "Completed");
    if (completed.length === 0) return { total: 0, onTime: 0, late: 0, rate: 0, overdue: 0 };

    let onTime = 0;
    let late = 0;
    
    completed.forEach(r => {
      if (r.actualCompletionDate && r.plannedDeliveryDate) {
        if (r.actualCompletionDate <= r.plannedDeliveryDate) {
          onTime++;
        } else {
          late++;
        }
      } else {
        onTime++;
      }
    });

    const overdue = filteredSamples.filter(r => r.status === "Overdue" || (r.status === "In Progress" && r.plannedDeliveryDate && r.plannedDeliveryDate < new Date().toISOString().split("T")[0])).length;
    const rate = ((onTime / completed.length) * 100).toFixed(1);

    return { total: completed.length, onTime, late, rate, overdue };
  };

  const onTimeStats = getOnTimeStats();

  // Customer Analysis Calculations
  const getCustomerAnalysis = () => {
    const customerMap = {};
    filteredSamples.forEach(r => {
      const cust = r.customerName || "Unknown";
      if (!customerMap[cust]) {
        customerMap[cust] = { name: cust, total: 0, completed: 0, inProgress: 0, overdue: 0, urgent: 0, leadTimes: [] };
      }
      const item = customerMap[cust];
      item.total++;
      if (r.status === "Completed") {
        item.completed++;
        if (r.actualCompletionDate && r.requestDate) {
          const diff = dayjs(r.actualCompletionDate).diff(dayjs(r.requestDate), "day");
          item.leadTimes.push(Math.max(0, diff));
        }
      } else if (r.status === "In Progress") {
        item.inProgress++;
      } else if (r.status === "Overdue") {
        item.overdue++;
      }
      if (r.requestType === "Top Urgent" || r.requestType === "Urgent") {
        item.urgent++;
      }
    });

    return Object.values(customerMap).map((item, idx) => {
      const avgLt = item.leadTimes.length > 0 ? (item.leadTimes.reduce((a, b) => a + b, 0) / item.leadTimes.length).toFixed(1) : "N/A";
      return {
        key: idx,
        name: item.name,
        total: item.total,
        completed: item.completed,
        inProgress: item.inProgress,
        overdue: item.overdue,
        urgent: item.urgent,
        avgLeadTime: avgLt
      };
    });
  };

  const customerAnalysisData = getCustomerAnalysis();

  const removeEmptyColumns = (data) => {
    if (data.length === 0) return data;
    const keys = Object.keys(data[0]);
    const activeKeys = keys.filter(key => {
      return data.some(row => {
        const val = row[key];
        return val !== undefined && val !== null && val !== "" && val !== "-" && val !== "N/A" && val !== "n/a";
      });
    });

    return data.map(row => {
      const cleaned = {};
      activeKeys.forEach(k => {
        cleaned[k] = row[k];
      });
      return cleaned;
    });
  };

  // Exports
  const handleExcelExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetName = reportSubTab === "samples" ? "Sample Requisitions" : "Costing Requests";
    const worksheet = workbook.addWorksheet(sheetName);

    const titleText = reportSubTab === "samples" 
      ? "MANAGEMENT REPORT - SAMPLE REQUISITIONS" 
      : "MANAGEMENT REPORT - COSTING REQUESTS";
      
    let durationText = "Duration: All Time";
    if (dateRange && dateRange[0] && dateRange[1]) {
      durationText = `Duration: ${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format("YYYY-MM-DD")}`;
    }

    // Add Title Row
    const titleRow = worksheet.addRow([titleText]);
    titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "0F172A" } };
    worksheet.mergeCells("A1:H1");

    // Add Duration Row
    const durationRow = worksheet.addRow([durationText]);
    durationRow.font = { name: "Arial", size: 10, italic: true, color: { argb: "64748B" } };
    worksheet.mergeCells("A2:H2");

    // Add blank row
    worksheet.addRow([]);

    let cleanedData = [];
    let headers = [];
    let keys = [];

    if (reportSubTab === "samples") {
      const flatSamples = getMultiplicatedSamples();
      if (flatSamples.length === 0) return;
      cleanedData = removeEmptyColumns(flatSamples);
      keys = Object.keys(cleanedData[0]);
      headers = keys.map(k => {
        const colIdx = sampleGridColumns.findIndex(c => c.data === k);
        if (colIdx !== -1) return sampleHeaders[colIdx];
        return k;
      });
    } else {
      const flatCostings = getMultiplicatedCostings();
      if (flatCostings.length === 0) return;
      cleanedData = removeEmptyColumns(flatCostings);
      keys = Object.keys(cleanedData[0]);
      headers = keys.map(k => {
        const colIdx = costingGridColumns.findIndex(c => c.data === k);
        if (colIdx !== -1) return costingHeaders[colIdx];
        return k;
      });
    }

    // Add Headers row
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "10B981" } // Emerald Green
      };
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FFFFFF" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "medium", color: { argb: "047857" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } }
      };
    });

    // Add data rows
    cleanedData.forEach(row => {
      const rowData = keys.map(k => row[k]);
      const dataRow = worksheet.addRow(rowData);
      dataRow.height = 20;
      dataRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 9 };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "F1F5F9" } },
          bottom: { style: "thin", color: { argb: "F1F5F9" } },
          left: { style: "thin", color: { argb: "F1F5F9" } },
          right: { style: "thin", color: { argb: "F1F5F9" } }
        };
      });
    });

    // Auto-fit Column Widths
    worksheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.row > 3) {
          const cellValue = cell.value ? cell.value.toString() : "";
          if (cellValue.length > maxLen) {
            maxLen = cellValue.length;
          }
        }
      });
      column.width = Math.min(maxLen + 4, 40);
    });

    // Generate blob and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Management_Report_${reportSubTab}_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVExport = () => {
    let csvContent = "";
    let filename = "";

    const titleText = reportSubTab === "samples" 
      ? "MANAGEMENT REPORT - SAMPLE REQUISITIONS" 
      : "MANAGEMENT REPORT - COSTING REQUESTS";
      
    let durationText = "Duration: All Time";
    if (dateRange && dateRange[0] && dateRange[1]) {
      durationText = `Duration: ${dateRange[0].format("YYYY-MM-DD")} to ${dateRange[1].format("YYYY-MM-DD")}`;
    }

    csvContent += `"${titleText.replace(/"/g, '""')}"\n`;
    csvContent += `"${durationText.replace(/"/g, '""')}"\n\n`;

    if (reportSubTab === "samples") {
      const flatSamples = getMultiplicatedSamples();
      if (flatSamples.length === 0) return;
      const cleanedSamples = removeEmptyColumns(flatSamples);
      
      const keys = Object.keys(cleanedSamples[0]);
      const headerRow = keys.map(k => {
        const colIdx = sampleGridColumns.findIndex(c => c.data === k);
        if (colIdx !== -1) return sampleHeaders[colIdx];
        return k;
      });

      csvContent += headerRow.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
      
      cleanedSamples.forEach(row => {
        const line = keys.map(k => {
          const val = row[k] !== undefined && row[k] !== null ? row[k].toString() : "";
          return `"${val.replace(/"/g, '""')}"`;
        });
        csvContent += line.join(",") + "\n";
      });
      filename = `Management_Sample_Report_${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      const flatCostings = getMultiplicatedCostings();
      if (flatCostings.length === 0) return;
      const cleanedCostings = removeEmptyColumns(flatCostings);

      const keys = Object.keys(cleanedCostings[0]);
      const headerRow = keys.map(k => {
        const colIdx = costingGridColumns.findIndex(c => c.data === k);
        if (colIdx !== -1) return costingHeaders[colIdx];
        return k;
      });

      csvContent += headerRow.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

      cleanedCostings.forEach(row => {
        const line = keys.map(k => {
          const val = row[k] !== undefined && row[k] !== null ? row[k].toString() : "";
          return `"${val.replace(/"/g, '""')}"`;
        });
        csvContent += line.join(",") + "\n";
      });
      filename = `Management_Costing_Report_${new Date().toISOString().split("T")[0]}.csv`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Setup sample columns for Handsontable
  const sampleGridColumns = [
    { data: "sampleRequestNo", type: "text", readOnly: true },
    { data: "requestDate", type: "text", readOnly: true },
    { data: "requiredDate", type: "text", readOnly: true },
    { data: "customerName", type: "text", readOnly: true },
    { data: "requestedBy", type: "text", readOnly: true },
    { data: "productUnit", type: "text", readOnly: true },
    { data: "requestType", type: "text", readOnly: true },
    { data: "status", type: "text", readOnly: true },
    { data: "itemNo", type: "numeric", readOnly: true },
    { data: "product", type: "text", readOnly: true },
    { data: "quantity", type: "numeric", readOnly: true },
    { data: "sampleType", type: "text", readOnly: true },
    { data: "description", type: "text", readOnly: true },
    { data: "specialNotes", type: "text", readOnly: true }
  ];

  const sampleHeaders = [
    "Request No", "Request Date", "Required Date", "Customer", "Officer", 
    "Unit", "Urgency", "Status", "Item #", "Product Name", 
    "Qty", "Sample Type", "Description / Specs", "Special Notes"
  ];

  // Setup costing columns for Handsontable
  const costingGridColumns = [
    { data: "costRequestNo", type: "text", readOnly: true },
    { data: "requestDate", type: "text", readOnly: true },
    { data: "customerName", type: "text", readOnly: true },
    { data: "productCategory", type: "text", readOnly: true },
    { data: "marketingOfficer", type: "text", readOnly: true },
    { data: "financeOfficer", type: "text", readOnly: true },
    { data: "status", type: "text", readOnly: true },
    { data: "itemNo", type: "numeric", readOnly: true }
  ];
  
  const costingHeaders = [
    "Request No", "Request Date", "Customer", "Category", 
    "Marketing Officer", "Finance Officer", "Status", "Item #"
  ];

  costingMarketingFields.forEach(f => {
    costingGridColumns.push({ data: `spec_${f.key}`, type: f.type === "number" ? "numeric" : "text", readOnly: true });
    costingHeaders.push(`${f.label} (Mkt)`);
  });

  costingFinanceFields.forEach(f => {
    costingGridColumns.push({ data: `cost_${f.key}`, type: f.type === "number" ? "numeric" : "text", readOnly: true });
    costingHeaders.push(`${f.label} (Fin)`);
  });

  const uniqueCustomers = Array.from(new Set([
    ...sampleRequests.map(r => r.customerName).filter(Boolean),
    ...costingRequests.map(r => r.customerName).filter(Boolean)
  ])).sort();

  const uniqueOfficers = Array.from(new Set([
    ...sampleRequests.map(r => r.requestedBy).filter(Boolean),
    ...costingRequests.map(r => r.marketingOfficer?.name).filter(Boolean)
  ])).sort();

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 32 }}>
        <Col>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Management Reports
          </Title>
          <Text type="secondary">
            Analyze sample development cycles, lead times, costing details, and workload metrics.
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExcelExport} size="large" style={{ borderRadius: 8 }}>
              Export Excel
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleCSVExport} size="large" style={{ borderRadius: 8 }}>
              Export CSV
            </Button>
          </Space>
        </Col>
      </Row>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}

      {/* Reports Filters Card */}
      <Card 
        title={<span><FilterOutlined /> Filter Operations Database</span>}
        style={{ marginBottom: 32, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Filter Date Range</div>
            <RangePicker 
              style={{ width: "100%" }} 
              value={dateRange} 
              onChange={(val) => setDateRange(val)}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Product Unit / Category</div>
            <Select style={{ width: "100%" }} value={productUnit} onChange={(v) => setProductUnit(v)} placeholder="All Units">
              <Option value="">All Units</Option>
              <Option value="Horticulture">Horticulture</Option>
              <Option value="Bedding">Bedding</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Requisition Status</div>
            <Select style={{ width: "100%" }} value={status} onChange={(v) => setStatus(v)} placeholder="All Statuses">
              <Option value="">All Statuses</Option>
              <Option value="Submitted">Submitted (New)</Option>
              <Option value="Request for Resubmission">Awaiting Resubmission</Option>
              <Option value="In Progress">In Progress</Option>
              <Option value="Overdue">Overdue</Option>
              <Option value="Completed">Completed</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Urgency</div>
            <Select style={{ width: "100%" }} value={requestType} onChange={(v) => setRequestType(v)} placeholder="All Urgencies">
              <Option value="">All Urgencies</Option>
              <Option value="Top Urgent">Top Urgent</Option>
              <Option value="Urgent">Urgent</Option>
              <Option value="Normal">Normal</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Customer</div>
            <Select style={{ width: "100%" }} value={customerName} onChange={(v) => setCustomerName(v)} placeholder="All Customers">
              <Option value="">All Customers</Option>
              {uniqueCustomers.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Marketing Officer</div>
            <Select style={{ width: "100%" }} value={marketingOfficer} onChange={(v) => setMarketingOfficer(v)} placeholder="All Officers">
              <Option value="">All Officers</Option>
              {uniqueOfficers.map(o => <Option key={o} value={o}>{o}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button block type="dashed" onClick={handleClearFilters} style={{ borderRadius: 8 }}>
              Clear
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Reports Tabs Layout */}
      <Tabs defaultActiveKey="detailed" size="large" type="card">
        
        {/* Detailed Grid Report */}
        <Tabs.TabPane tab="Detailed Flat Reports" key="detailed">
          <Card 
            bordered={true} 
            style={{ borderRadius: 12, background: "#ffffff" }}
            styles={{ body: { padding: 24 } }}
          >
            <Tabs activeKey={reportSubTab} onChange={setReportSubTab} type="line" style={{ marginBottom: 16 }}>
              <Tabs.TabPane tab="Sample Requisitions Report" key="samples">
                <Alert 
                  message="Line Items Flattened/Multiplicated Grid" 
                  description="Each row represents one line item. Header details are repeated for multiple items in the same requisition."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <div className="hot-container">
                  <HotTable
                    ref={hotSamplesRef}
                    data={getMultiplicatedSamples()}
                    columns={sampleGridColumns}
                    colHeaders={sampleHeaders}
                    rowHeaders={true}
                    colWidths={150}
                    height="400"
                    licenseKey="non-commercial-and-evaluation"
                    manualColumnResize={true}
                  />
                </div>
              </Tabs.TabPane>
              
              <Tabs.TabPane tab="Costing Requests Report" key="costing">
                <Alert 
                  message="Costing Parameters Flattened/Multiplicated Grid" 
                  description="Each row represents one line item spec & calculated cost. Scroll horizontally to inspect marketing and finance parameters side by side."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <div className="hot-container">
                  <HotTable
                    ref={hotCostingsRef}
                    data={getMultiplicatedCostings()}
                    columns={costingGridColumns}
                    colHeaders={costingHeaders}
                    rowHeaders={true}
                    colWidths={150}
                    height="400"
                    licenseKey="non-commercial-and-evaluation"
                    manualColumnResize={true}
                  />
                </div>
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </Tabs.TabPane>

        {/* Lead Time Report */}
        <Tabs.TabPane tab="Lead Time Analysis" key="leadtime">
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Average Lead Time" value={leadTimeStats.avg} suffix="Days" valueStyle={{ color: "#6366f1", fontWeight: 800 }} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Minimum Lead Time" value={leadTimeStats.min} suffix="Days" valueStyle={{ color: "#10b981", fontWeight: 800 }} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Maximum Lead Time" value={leadTimeStats.max} suffix="Days" valueStyle={{ color: "#ef4444", fontWeight: 800 }} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Median Lead Time" value={leadTimeStats.median} suffix="Days" valueStyle={{ color: "#f59e0b", fontWeight: 800 }} /></Card>
            </Col>
          </Row>

          <Card title="Completed Sample Requisitions Lead Time" bordered={true} style={{ borderRadius: 12, background: "#ffffff" }}>
            <div className="hot-container">
              <HotTable
                data={leadTimeStats.list}
                columns={[
                  { data: "sampleRequestNo", type: "text", readOnly: true },
                  { data: "customerName", type: "text", readOnly: true },
                  { data: "product", type: "text", readOnly: true },
                  { data: "requestDate", type: "text", readOnly: true },
                  { data: "actualCompletionDate", type: "text", readOnly: true },
                  { data: "leadTime", type: "numeric", readOnly: true }
                ]}
                colHeaders={["Request No", "Customer Name", "Product", "Request Date", "Completion Date", "Lead Time (Days)"]}
                rowHeaders={true}
                height="300"
                licenseKey="non-commercial-and-evaluation"
                stretchH="all"
              />
            </div>
          </Card>
        </Tabs.TabPane>

        {/* On-Time Performance */}
        <Tabs.TabPane tab="On-Time Performance" key="ontime">
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Total Completed" value={onTimeStats.total} valueStyle={{ fontWeight: 800 }} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Completed On-Time" value={onTimeStats.onTime} valueStyle={{ color: "#10b981", fontWeight: 800 }} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Completed Late" value={onTimeStats.late} valueStyle={{ color: "#ef4444", fontWeight: 800 }} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="On-Time Rate" value={onTimeStats.rate} suffix="%" valueStyle={{ color: "#6366f1", fontWeight: 800 }} /></Card>
            </Col>
          </Row>

          <Card title="On-Time Completion Rate visualizer" bordered={true} style={{ borderRadius: 12, background: "#ffffff", textAlign: "center" }}>
            <Progress
              type="circle"
              percent={parseFloat(onTimeStats.rate) || 0}
              strokeColor={{ "0%": "#818cf8", "100%": "#10b981" }}
              strokeWidth={10}
              size={200}
            />
            <div style={{ marginTop: 24 }}>
              <Text strong style={{ fontSize: "1.1rem" }}>
                Target: 100% SLA Compliance
              </Text>
            </div>
          </Card>
        </Tabs.TabPane>

        {/* Customer Analysis */}
        <Tabs.TabPane tab="Customer Analysis" key="customer">
          <Card bordered={true} style={{ borderRadius: 12, background: "#ffffff" }}>
            <div className="hot-container">
              <HotTable
                data={customerAnalysisData}
                columns={[
                  { data: "name", type: "text", readOnly: true },
                  { data: "total", type: "numeric", readOnly: true },
                  { data: "completed", type: "numeric", readOnly: true },
                  { data: "inProgress", type: "numeric", readOnly: true },
                  { data: "overdue", type: "numeric", readOnly: true },
                  { data: "urgent", type: "numeric", readOnly: true },
                  { data: "avgLeadTime", type: "text", readOnly: true }
                ]}
                colHeaders={["Customer Name", "Total Requests", "Completed", "In Progress", "Overdue", "Urgent Requests", "Avg Lead Time (Days)"]}
                rowHeaders={true}
                height="300"
                licenseKey="non-commercial-and-evaluation"
                stretchH="all"
              />
            </div>
          </Card>
        </Tabs.TabPane>
        
      </Tabs>
    </div>
  );
}

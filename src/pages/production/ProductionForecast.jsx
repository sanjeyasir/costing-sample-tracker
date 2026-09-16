import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Select, 
  DatePicker, 
  Input, 
  Modal, 
  Form, 
  InputNumber, 
  message, 
  Tooltip, 
  Popconfirm, 
  Badge, 
  Divider, 
  Radio, 
  Alert 
} from "antd";
import {
  PlusOutlined,
  SaveOutlined,
  DownloadOutlined,
  ReloadOutlined,
  DashboardOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  StarOutlined,
  SearchOutlined,
  TableOutlined,
  FilterOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  BranchesOutlined,
  FundProjectionScreenOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";

import { 
  FINANCIAL_YEAR_MONTHS, 
  SALES_OFFICERS, 
  DEPARTMENTS, 
  getDepartmentForOfficer, 
  calculateRowMetrics, 
  getDefaultRollingMonths, 
  formatCurrency, 
  formatCompactCurrency, 
  formatPercentage, 
  exportForecastToExcel 
} from "../../utils/productionPlanData";
import { 
  getProductionForecasts, 
  saveProductionForecast, 
  batchSaveProductionForecasts, 
  deleteProductionForecast, 
  resetToExcelBaseline 
} from "../../services/firebase/productionPlanService";

registerAllModules();

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProductionForecast() {
  const navigate = useNavigate();
  const hotTableRef = useRef(null);
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const default4Months = useMemo(() => getDefaultRollingMonths(), []);
  const defaultMonthKeys = useMemo(() => default4Months.map(m => m.monthKey), [default4Months]);
  
  const [viewMode, setViewMode] = useState("rolling"); // "rolling" (4-months), "single", "custom", "all"
  const [selectedMonths, setSelectedMonths] = useState(defaultMonthKeys);
  const [selectedOfficer, setSelectedOfficer] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Modal State for New Entry
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalPreview, setModalPreview] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getProductionForecasts();
      setAllData(data);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Failed to load production forecasts:", err);
      message.error("Failed to load forecast data");
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows to display in Handsontable
  const filteredData = useMemo(() => {
    let list = [...allData];

    if (viewMode !== "all" && selectedMonths && selectedMonths.length > 0) {
      list = list.filter(r => selectedMonths.includes(r.monthKey) || selectedMonths.includes(r.month));
    }

    if (selectedOfficer !== "all") {
      list = list.filter(r => r.salesOfficer === selectedOfficer);
    }

    if (selectedDepartment !== "all") {
      list = list.filter(r => r.department === selectedDepartment);
    }

    if (selectedStatus !== "all") {
      list = list.filter(r => r.status === selectedStatus);
    }

    if (searchText.trim() !== "") {
      const q = searchText.toLowerCase().trim();
      list = list.filter(r => 
        (r.buyer && r.buyer.toLowerCase().includes(q)) ||
        (r.salesOfficer && r.salesOfficer.toLowerCase().includes(q)) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.month && r.month.toLowerCase().includes(q)) ||
        (r.monthName && r.monthName.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allData, viewMode, selectedMonths, selectedOfficer, selectedDepartment, selectedStatus, searchText]);

  // Aggregate summary metrics for current filtered view
  const summaryMetrics = useMemo(() => {
    let bTo = 0;
    let bTeu = 0;
    let bCont = 0;
    let aTo = 0;
    let aTeu = 0;
    let aCont = 0;
    let metCount = 0;
    let newCount = 0;
    let varCount = 0;

    filteredData.forEach(r => {
      bTo += parseFloat(r.budgetTurnover) || 0;
      bTeu += parseFloat(r.budgetTeu) || 0;
      bCont += parseFloat(r.budgetContribution) || 0;

      aTo += parseFloat(r.actualTurnover) || 0;
      aTeu += parseFloat(r.actualTeu) || 0;
      aCont += parseFloat(r.actualContribution) || 0;

      if (r.status === "met") metCount++;
      else if (r.status === "new") newCount++;
      else if (r.status === "variance") varCount++;
    });

    const vTo = aTo - bTo;
    const vTeu = aTeu - bTeu;
    const vCont = aCont - bCont;
    const achRate = bTo > 0 ? (aTo / bTo) * 100 : (aTo > 0 ? 100 : 0);
    const bMargin = bTo > 0 ? (bCont / bTo) : 0;
    const aMargin = aTo > 0 ? (aCont / aTo) : 0;

    return {
      bTo,
      bTeu: Math.round(bTeu * 100) / 100,
      bCont,
      bMargin,
      aTo,
      aTeu: Math.round(aTeu * 100) / 100,
      aCont,
      aMargin,
      vTo,
      vTeu: Math.round(vTeu * 100) / 100,
      vCont,
      achRate: Math.round(achRate * 10) / 10,
      metCount,
      newCount,
      varCount,
      totalRows: filteredData.length
    };
  }, [filteredData]);

  // Handle View Mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === "rolling") {
      setSelectedMonths(defaultMonthKeys);
    } else if (mode === "all") {
      setSelectedMonths(FINANCIAL_YEAR_MONTHS.map(m => m.monthKey));
    }
  };

  // Handsontable Change Handler: Live Recalculations
  const handleHandsontableChange = (changes, source) => {
    if (!changes || source === "loadData") return;

    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;

    // Get table source data
    const sourceData = hot.getSourceData();
    let hasChanges = false;

    changes.forEach(([rowIdx, prop, oldVal, newVal]) => {
      if (oldVal !== newVal) {
        hasChanges = true;
        const targetRow = sourceData[rowIdx];
        if (targetRow) {
          // If salesOfficer changed, update department
          if (prop === "salesOfficer") {
            targetRow.department = getDepartmentForOfficer(newVal);
          }
          // Recalculate row
          const recalculated = calculateRowMetrics(targetRow);
          Object.assign(targetRow, recalculated);
        }
      }
    });

    if (hasChanges) {
      setHasUnsavedChanges(true);
      // Synchronize in-memory allData state
      const updatedMap = new Map(sourceData.map(item => [item.id, item]));
      setAllData(prev => prev.map(item => updatedMap.has(item.id) ? updatedMap.get(item.id) : item));
    }
  };

  // Save All Changes to Firestore / Storage
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const hot = hotTableRef.current?.hotInstance;
      const currentGridData = hot ? hot.getSourceData() : filteredData;

      await batchSaveProductionForecasts(currentGridData);
      setHasUnsavedChanges(false);
      message.success("All production forecast changes saved successfully!");
      await loadData();
    } catch (err) {
      console.error("Save error:", err);
      message.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to Baseline confirmation
  const handleResetBaseline = async () => {
    try {
      setLoading(true);
      await resetToExcelBaseline();
      message.success("Reset successfully to ProductionPlan.xlsx baseline!");
      await loadData();
    } catch (err) {
      console.error("Reset error:", err);
      message.error("Failed to reset baseline.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Add Row directly in active view
  const handleAddInlineRow = () => {
    const defaultMonth = selectedMonths && selectedMonths.length > 0 ? selectedMonths[0] : "2026-09";
    const mObj = FINANCIAL_YEAR_MONTHS.find(m => m.monthKey === defaultMonth) || {
      code: "SEP",
      name: "September",
      defaultYear: 2026,
      monthKey: "2026-09"
    };

    const newRow = calculateRowMetrics({
      id: `fc-new-${Date.now()}`,
      year: mObj.defaultYear,
      month: mObj.code,
      monthName: `${mObj.name} ${mObj.defaultYear}`,
      monthKey: mObj.monthKey,
      salesOfficer: "MM",
      department: "Horticulture",
      buyer: "New Customer",
      budgetTeu: 1.0,
      budgetTurnover: 2000000,
      budgetContribution: 800000,
      budgetMargin: 0.4,
      actualTeu: 0,
      actualTurnover: 0,
      actualContribution: 0,
      actualMargin: 0,
      factoryTeu: 0,
      factoryTurnover: 0,
      factoryConfirmed: false,
      notes: "Newly added forecast entry"
    });

    setAllData(prev => [newRow, ...prev]);
    setHasUnsavedChanges(true);
    message.info(`Added new entry to ${mObj.name} ${mObj.defaultYear}. Click "Save All" when ready.`);
  };

  // Open Modal for Detailed Entry Creation
  const handleOpenAddModal = () => {
    const defaultMonth = selectedMonths && selectedMonths.length > 0 ? selectedMonths[0] : "2026-09";
    form.resetFields();
    form.setFieldsValue({
      monthKey: defaultMonth,
      salesOfficer: "MM",
      department: "Horticulture",
      buyer: "",
      budgetTeu: 1.0,
      budgetTurnover: 2500000,
      budgetContribution: 1000000,
      actualTeu: 0,
      actualTurnover: 0,
      actualContribution: 0,
      notes: ""
    });
    calculateModalPreview();
    setIsModalVisible(true);
  };

  // Calculate live preview in modal
  const calculateModalPreview = () => {
    const values = form.getFieldsValue();
    const calculated = calculateRowMetrics(values);
    setModalPreview(calculated);
  };

  // Submit Modal
  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      const mObj = FINANCIAL_YEAR_MONTHS.find(m => m.monthKey === values.monthKey) || {
        code: "SEP",
        name: "September",
        defaultYear: 2026,
        monthKey: values.monthKey
      };

      const entryToSave = calculateRowMetrics({
        ...values,
        id: `fc-user-${Date.now()}`,
        year: mObj.defaultYear,
        month: mObj.code,
        monthName: `${mObj.name} ${mObj.defaultYear}`,
        monthKey: mObj.monthKey,
        department: values.department || getDepartmentForOfficer(values.salesOfficer)
      });

      await saveProductionForecast(entryToSave);
      message.success(`New forecast entry for ${entryToSave.buyer} added successfully!`);
      setIsModalVisible(false);
      await loadData();
    } catch (err) {
      console.error("Modal submit error:", err);
    }
  };

  // ==========================================
  // HANDSONTABLE COLUMN DEFINITIONS & RENDERERS
  // ==========================================
  const columns = useMemo(() => [
    {
      data: "monthName",
      title: "Month / Year",
      type: "dropdown",
      source: FINANCIAL_YEAR_MONTHS.map(m => `${m.name} ${m.defaultYear}`),
      width: 140,
      className: "htLeft htMiddle"
    },
    {
      data: "salesOfficer",
      title: "Sales Officer",
      type: "dropdown",
      source: SALES_OFFICERS.map(s => s.code),
      width: 100,
      className: "htCenter htMiddle"
    },
    {
      data: "buyer",
      title: "Buyer / Customer",
      type: "text",
      width: 200,
      className: "htLeft htMiddle"
    },
    {
      data: "department",
      title: "Department",
      type: "dropdown",
      source: DEPARTMENTS,
      width: 120,
      className: "htLeft htMiddle"
    },

    // BUDGET GROUP
    {
      data: "budgetTeu",
      title: "TEU Qty",
      type: "numeric",
      numericFormat: { pattern: "0,0.00" },
      width: 90,
      className: "htRight htMiddle"
    },
    {
      data: "budgetTurnover",
      title: "TO-FOB (LKR)",
      type: "numeric",
      numericFormat: { pattern: "0,0" },
      width: 130,
      className: "htRight htMiddle"
    },
    {
      data: "budgetContribution",
      title: "Total Contri",
      type: "numeric",
      numericFormat: { pattern: "0,0" },
      width: 120,
      className: "htRight htMiddle"
    },
    {
      data: "budgetMargin",
      title: "Margin %",
      readOnly: true,
      renderer: (instance, td, row, col, prop, value) => {
        td.className = "htRight htMiddle";
        td.innerText = formatPercentage(value);
        return td;
      },
      width: 90
    },

    // ACTUAL GROUP
    {
      data: "actualTeu",
      title: "TEU Qty",
      type: "numeric",
      numericFormat: { pattern: "0,0.00" },
      width: 90,
      className: "htRight htMiddle"
    },
    {
      data: "actualTurnover",
      title: "TO-FOB (LKR)",
      type: "numeric",
      numericFormat: { pattern: "0,0" },
      width: 130,
      className: "htRight htMiddle"
    },
    {
      data: "actualContribution",
      title: "Total Contri",
      type: "numeric",
      numericFormat: { pattern: "0,0" },
      width: 120,
      className: "htRight htMiddle"
    },
    {
      data: "actualMargin",
      title: "Margin %",
      readOnly: true,
      renderer: (instance, td, row, col, prop, value) => {
        td.className = "htRight htMiddle";
        td.innerText = formatPercentage(value);
        return td;
      },
      width: 90
    },

    // VARIANCE GROUP
    {
      data: "varianceTeu",
      title: "Diff TEU",
      readOnly: true,
      renderer: (instance, td, row, col, prop, value) => {
        const val = parseFloat(value) || 0;
        td.className = "htRight htMiddle " + (val >= 0 ? "ht-num-positive" : "ht-num-negative");
        td.innerText = (val > 0 ? "+" : "") + val.toFixed(2);
        return td;
      },
      width: 90
    },
    {
      data: "varianceTurnover",
      title: "Diff TO-FOB",
      readOnly: true,
      renderer: (instance, td, row, col, prop, value) => {
        const val = parseFloat(value) || 0;
        td.className = "htRight htMiddle " + (val >= 0 ? "ht-num-positive" : "ht-num-negative");
        td.innerText = (val > 0 ? "+" : "") + formatCurrency(val);
        return td;
      },
      width: 120
    },
    {
      data: "achievementRate",
      title: "% Achieved",
      readOnly: true,
      renderer: (instance, td, row, col, prop, value) => {
        const val = parseFloat(value) || 0;
        td.className = "htRight htMiddle " + (val >= 100 ? "ht-num-positive" : (val > 0 ? "ht-num-neutral" : "ht-num-negative"));
        td.innerText = val + "%";
        return td;
      },
      width: 100
    },
    {
      data: "status",
      title: "Status",
      readOnly: true,
      renderer: (instance, td, row, col, prop, value) => {
        const val = String(value || "").toLowerCase();
        td.className = "htCenter htMiddle";
        if (val === "met") {
          td.innerHTML = `<span style="background-color:#dcfce7;color:#15803d;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">✓ MET</span>`;
        } else if (val === "new") {
          td.innerHTML = `<span style="background-color:#dbeafe;color:#1d4ed8;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">★ NEW</span>`;
        } else if (val === "variance") {
          td.innerHTML = `<span style="background-color:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">⚠ VARIANCE</span>`;
        } else {
          td.innerHTML = `<span style="background-color:#f1f5f9;color:#64748b;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;display:inline-block;">PENDING</span>`;
        }
        return td;
      },
      width: 110
    },

    // FACTORY GROUP
    {
      data: "factoryTeu",
      title: "Factory TEU",
      type: "numeric",
      numericFormat: { pattern: "0,0.00" },
      width: 100,
      className: "htRight htMiddle"
    },
    {
      data: "factoryConfirmed",
      title: "Confirmed",
      type: "checkbox",
      width: 90,
      className: "htCenter htMiddle"
    },
    {
      data: "notes",
      title: "Notes / Remarks",
      type: "text",
      width: 220,
      className: "htLeft htMiddle"
    }
  ], []);

  // Grouped Nested Headers
  const nestedHeaders = useMemo(() => [
    [
      { label: "Plan & Customer Info", colspan: 4 },
      { label: "Initial Budget Targets", colspan: 4, className: "ht-header-budget" },
      { label: "Actual Performance", colspan: 4, className: "ht-header-actual" },
      { label: "Variance & Target Achievement", colspan: 4, className: "ht-header-variance" },
      { label: "Factory Confirmation", colspan: 3, className: "ht-header-factory" }
    ],
    [
      "Month / Year", "Officer", "Buyer / Customer", "Department",
      "TEU Qty", "TO-FOB (LKR)", "Total Contri", "Margin %",
      "TEU Qty", "TO-FOB (LKR)", "Total Contri", "Margin %",
      "Diff TEU", "Diff TO-FOB", "% Achieved", "Status",
      "Fact TEU", "Confirmed", "Notes / Remarks"
    ]
  ], []);

  return (
    <div style={{ padding: "16px 24px", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Top Header & Page Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Space orientation="horizontal" size="middle" align="center">
            <div style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 12, 
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white", 
              fontSize: 22,
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}>
              <FundProjectionScreenOutlined />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                Production Plan & Forecast
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Multi-month Budget vs Actual tracking, variance analysis, and factory confirmations
              </Text>
            </div>
          </Space>
        </div>

        <Space size="middle" wrap>
          {hasUnsavedChanges && (
            <Badge status="processing" text="Unsaved Changes Pending" style={{ color: "#d97706", fontWeight: 600 }} />
          )}

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSaveAll}
            style={{ backgroundColor: hasUnsavedChanges ? "#16a34a" : "#2563eb", borderColor: hasUnsavedChanges ? "#16a34a" : "#2563eb", fontWeight: 600, height: 38 }}
          >
            Save All Changes
          </Button>

          <Button
            icon={<PlusOutlined />}
            onClick={handleOpenAddModal}
            style={{ fontWeight: 600, height: 38 }}
          >
            Add New Entry
          </Button>

          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportForecastToExcel(filteredData, `Production_Forecast_${selectedMonths.join("_")}.xlsx`)}
            style={{ height: 38 }}
          >
            Export Excel
          </Button>

          <Button
            type="dashed"
            icon={<DashboardOutlined />}
            onClick={() => navigate("/production-forecast/dashboard")}
            style={{ borderColor: "#6366f1", color: "#4f46e5", fontWeight: 600, height: 38 }}
          >
            View Dashboard
          </Button>

          <Popconfirm
            title="Reset to Excel Baseline?"
            description="This will restore all 331 standard records from ProductionPlan.xlsx. Any manual additions will be reset."
            onConfirm={handleResetBaseline}
            okText="Yes, Reset"
            cancelText="Cancel"
          >
            <Tooltip title="Reset to ProductionPlan.xlsx baseline">
              <Button icon={<ReloadOutlined />} style={{ height: 38 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>

      {/* KPI Summary Cards Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ 
              borderRadius: 12, 
              borderLeft: "4px solid #3b82f6", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              background: "white" 
            }}
          >
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>BUDGET TURNOVER & TEU</span>}
              value={formatCompactCurrency(summaryMetrics.bTo)}
              prefix={<span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 700 }}>LKR</span>}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.bTeu} TEUs)</Text>}
              valueStyle={{ fontWeight: 800, color: "#1e3a8a", fontSize: 20 }}
            />
            <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.bCont)}</Text>
              <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.bMargin)}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ 
              borderRadius: 12, 
              borderLeft: "4px solid #8b5cf6", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              background: "white" 
            }}
          >
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>ACTUAL TURNOVER & TEU</span>}
              value={formatCompactCurrency(summaryMetrics.aTo)}
              prefix={<span style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 700 }}>LKR</span>}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.aTeu} TEUs)</Text>}
              valueStyle={{ fontWeight: 800, color: "#581c87", fontSize: 20 }}
            />
            <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.aCont)}</Text>
              <Text style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.aMargin)}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ 
              borderRadius: 12, 
              borderLeft: `4px solid ${summaryMetrics.vTo >= 0 ? "#10b981" : "#ef4444"}`, 
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              background: "white" 
            }}
          >
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>OVERALL VARIANCE & ACHIEVEMENT</span>}
              value={summaryMetrics.achRate}
              suffix="%"
              prefix={summaryMetrics.vTo >= 0 ? <ArrowUpOutlined style={{ color: "#10b981" }} /> : <ArrowDownOutlined style={{ color: "#ef4444" }} />}
              valueStyle={{ fontWeight: 800, color: summaryMetrics.vTo >= 0 ? "#065f46" : "#991b1b", fontSize: 20 }}
            />
            <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 11, color: summaryMetrics.vTo >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                {summaryMetrics.vTo >= 0 ? "+" : ""}{formatCompactCurrency(summaryMetrics.vTo)} LKR
              </Text>
              <Text style={{ fontSize: 11, color: "#64748b" }}>
                {summaryMetrics.vTeu >= 0 ? "+" : ""}{summaryMetrics.vTeu} TEU
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ 
              borderRadius: 12, 
              borderLeft: "4px solid #f59e0b", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              background: "white" 
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>TARGET PERFORMANCE SPLIT</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <Tag color="success" style={{ fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>
                ✓ {summaryMetrics.metCount} MET
              </Tag>
              <Tag color="processing" style={{ fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>
                ★ {summaryMetrics.newCount} NEW
              </Tag>
              <Tag color="error" style={{ fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>
                ⚠ {summaryMetrics.varCount} VARIANCE
              </Tag>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
              Showing {filteredData.length} records
            </div>
          </Card>
        </Col>
      </Row>

      {/* Interactive Controls & Filters Bar */}
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 14, 
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
          border: "1px solid #e2e8f0" 
        }}
        styles={{ body: { padding: "16px 20px" } }}
      >
        <Row gutter={[16, 12]} align="middle" justify="space-between">
          <Col xs={24} lg={14}>
            <Space size="middle" wrap align="center">
              <div>
                <Text strong style={{ color: "#475569", marginRight: 8, fontSize: 13 }}>
                  <CalendarOutlined style={{ marginRight: 4, color: "#3b82f6" }} /> Time Period:
                </Text>
                <Radio.Group 
                  value={viewMode} 
                  onChange={(e) => handleViewModeChange(e.target.value)} 
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="rolling">Rolling 4 Months</Radio.Button>
                  <Radio.Button value="single">Single Month</Radio.Button>
                  <Radio.Button value="custom">Multi-Select</Radio.Button>
                  <Radio.Button value="all">Full Year (12M)</Radio.Button>
                </Radio.Group>
              </div>

              {viewMode === "rolling" && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {default4Months.map(m => (
                    <Tag key={m.monthKey} color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                      {m.month} {m.year}
                    </Tag>
                  ))}
                </div>
              )}

              {viewMode === "single" && (
                <Select
                  value={selectedMonths[0] || "2026-09"}
                  onChange={(val) => setSelectedMonths([val])}
                  style={{ width: 160 }}
                  size="middle"
                >
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
              )}

              {viewMode === "custom" && (
                <Select
                  mode="multiple"
                  placeholder="Select Months"
                  value={selectedMonths}
                  onChange={(vals) => setSelectedMonths(vals)}
                  style={{ minWidth: 260, maxWidth: 380 }}
                  maxTagCount="responsive"
                  size="middle"
                >
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
              )}
            </Space>
          </Col>

          <Col xs={24} lg={10}>
            <Space size="middle" wrap style={{ width: "100%", justifyContent: "flex-end" }}>
              <Select
                value={selectedOfficer}
                onChange={setSelectedOfficer}
                style={{ width: 130 }}
                placeholder="Sales Officer"
                size="middle"
              >
                <Option value="all">All Officers</Option>
                {SALES_OFFICERS.map(s => (
                  <Option key={s.code} value={s.code}>{s.code} ({s.department.slice(0, 5)})</Option>
                ))}
              </Select>

              <Select
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                style={{ width: 130 }}
                placeholder="Department"
                size="middle"
              >
                <Option value="all">All Depts</Option>
                {DEPARTMENTS.map(d => (
                  <Option key={d} value={d}>{d}</Option>
                ))}
              </Select>

              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                style={{ width: 120 }}
                placeholder="Status"
                size="middle"
              >
                <Option value="all">All Status</Option>
                <Option value="met">Met Only</Option>
                <Option value="new">New Only</Option>
                <Option value="variance">Variance Only</Option>
              </Select>

              <Input
                placeholder="Search Buyer / Customer..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 190 }}
                allowClear
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Handsontable Main Grid Container */}
      <div className="hot-container" style={{ minHeight: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
          <Space size="small">
            <TableOutlined style={{ color: "#3b82f6" }} />
            <Text strong style={{ fontSize: 13, color: "#334155" }}>
              Active Spreadsheet View • {filteredData.length} records
            </Text>
            <Tag color="cyan" style={{ borderRadius: 6, fontSize: 11 }}>
              Double click any cell to edit • Auto-calculates live
            </Tag>
          </Space>

          <Space size="small">
            <Button 
              size="small" 
              type="dashed" 
              icon={<PlusOutlined />} 
              onClick={handleAddInlineRow}
              style={{ fontWeight: 600, fontSize: 12 }}
            >
              Add Row to Active Month
            </Button>
          </Space>
        </div>

        <HotTable
          ref={hotTableRef}
          data={filteredData}
          columns={columns}
          nestedHeaders={nestedHeaders}
          colHeaders={true}
          rowHeaders={true}
          height={540}
          width="100%"
          stretchH="all"
          manualColumnResize={true}
          manualRowResize={true}
          columnSorting={true}
          contextMenu={[
            "row_above", 
            "row_below", 
            "remove_row", 
            "---------", 
            "undo", 
            "redo", 
            "make_read_only", 
            "alignment", 
            "copy", 
            "cut"
          ]}
          afterChange={handleHandsontableChange}
          licenseKey="non-commercial-and-evaluation"
          renderAllRows={false}
          autoWrapRow={true}
          autoWrapCol={true}
        />
      </div>

      {/* Modal for Adding New Entry */}
      <Modal
        title={
          <Space>
            <FundProjectionScreenOutlined style={{ color: "#3b82f6" }} />
            <span>Add New Production Forecast Entry</span>
          </Space>
        }
        open={isModalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={700}
        okText="Add to Forecast"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={calculateModalPreview}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="monthKey" 
                label="Target Month & Year" 
                rules={[{ required: true, message: "Please select target month" }]}
              >
                <Select size="middle">
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item 
                name="salesOfficer" 
                label="Sales Officer" 
                rules={[{ required: true }]}
              >
                <Select size="middle" onChange={(val) => form.setFieldsValue({ department: getDepartmentForOfficer(val) })}>
                  {SALES_OFFICERS.map(s => (
                    <Option key={s.code} value={s.code}>{s.code}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item 
                name="department" 
                label="Department"
              >
                <Select size="middle">
                  {DEPARTMENTS.map(d => (
                    <Option key={d} value={d}>{d}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            name="buyer" 
            label="Buyer / Customer Name" 
            rules={[{ required: true, message: "Please enter customer or company name" }]}
          >
            <Input placeholder="e.g. PRIDE GARDEN PRODUCTS" size="middle" />
          </Form.Item>

          <Divider orientation="left" style={{ margin: "12px 0", fontSize: 13, color: "#1e40af" }}>
            Initial Budget Target
          </Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="budgetTeu" label="Budget TEU Qty">
                <InputNumber min={0} step={0.25} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="budgetTurnover" label="Budget TO-FOB (LKR)">
                <InputNumber min={0} step={100000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="budgetContribution" label="Budget Contribution (LKR)">
                <InputNumber min={0} step={50000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: "12px 0", fontSize: 13, color: "#5b21b6" }}>
            Actual Performance (if already achieved/partially fulfilled)
          </Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="actualTeu" label="Actual TEU Qty">
                <InputNumber min={0} step={0.25} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualTurnover" label="Actual TO-FOB (LKR)">
                <InputNumber min={0} step={100000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualContribution" label="Actual Contribution (LKR)">
                <InputNumber min={0} step={50000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes / Remarks">
            <Input.TextArea rows={2} placeholder="Optional notes, customer feedback, PO status..." />
          </Form.Item>

          {modalPreview && (
            <Card size="small" style={{ background: "#f8fafc", borderRadius: 8, marginTop: 8 }}>
              <Row gutter={16} align="middle">
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Calculated Status:</Text>
                  <div>
                    {modalPreview.status === "met" && <Tag color="success">✓ MET TARGET</Tag>}
                    {modalPreview.status === "new" && <Tag color="processing">★ NEW BUYER</Tag>}
                    {modalPreview.status === "variance" && <Tag color="error">⚠ VARIANCE</Tag>}
                    {modalPreview.status === "pending" && <Tag>PENDING</Tag>}
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Achievement Rate:</Text>
                  <div style={{ fontWeight: 700, color: modalPreview.achievementRate >= 100 ? "#10b981" : "#334155" }}>
                    {modalPreview.achievementRate}%
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Turnover Diff:</Text>
                  <div style={{ fontWeight: 700, color: modalPreview.varianceTurnover >= 0 ? "#10b981" : "#ef4444" }}>
                    {modalPreview.varianceTurnover >= 0 ? "+" : ""}{formatCompactCurrency(modalPreview.varianceTurnover)} LKR
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Budget Margin:</Text>
                  <div style={{ fontWeight: 700, color: "#3b82f6" }}>
                    {formatPercentage(modalPreview.budgetMargin)}
                  </div>
                </Col>
              </Row>
            </Card>
          )}
        </Form>
      </Modal>
    </div>
  );
}

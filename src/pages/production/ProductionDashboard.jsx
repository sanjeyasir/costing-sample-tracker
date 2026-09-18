import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Statistic, 
  Table, 
  Tag, 
  Button, 
  Select, 
  Progress, 
  Space, 
  Divider, 
  Radio, 
  Spin, 
  Tooltip,
  Alert,
  message
} from "antd";
import {
  DashboardOutlined,
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  TableOutlined,
  FilePptOutlined,
  DownloadOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  StarOutlined,
  TeamOutlined,
  ShopOutlined,
  ReloadOutlined,
  SwapRightOutlined
} from "@ant-design/icons";

import { 
  FINANCIAL_YEAR_MONTHS, 
  SALES_OFFICERS, 
  getDefaultRollingMonths, 
  getCurrentMonthKey,
  getMonthRange,
  formatCurrency, 
  formatCompactCurrency, 
  formatPercentage, 
  generatePptExecutiveSummary,
  exportForecastToExcel
} from "../../utils/productionPlanData";
import { getProductionForecasts } from "../../services/firebase/productionPlanService";
import { exportForecastToPowerPoint } from "../../utils/powerPointGenerator";

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProductionDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [exportingPpt, setExportingPpt] = useState(false);
  const [allData, setAllData] = useState([]);
  
  // Dashboard month selection
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const default4Months = useMemo(() => getDefaultRollingMonths(), []);
  const defaultRollingKeys = useMemo(() => default4Months.map(m => m.monthKey), [default4Months]);

  const [viewMode, setViewMode] = useState("single"); // "single" | "from_to" | "rolling" | "all"
  const [singleMonth, setSingleMonth] = useState(currentMonthKey);
  const [fromMonth, setFromMonth] = useState("2026-04");
  const [toMonth, setToMonth] = useState(currentMonthKey);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getProductionForecasts();
      setAllData(data);
    } catch (err) {
      console.error("Failed to load forecast data:", err);
      message.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Compute active month keys based on viewMode
  const activeMonthKeys = useMemo(() => {
    if (viewMode === "single") {
      return [singleMonth];
    }
    if (viewMode === "from_to") {
      return getMonthRange(fromMonth, toMonth);
    }
    if (viewMode === "rolling") {
      return defaultRollingKeys;
    }
    if (viewMode === "all") {
      return FINANCIAL_YEAR_MONTHS.map(m => m.monthKey);
    }
    return [singleMonth];
  }, [viewMode, singleMonth, fromMonth, toMonth, defaultRollingKeys]);

  // Compute human-readable period label
  const activePeriodLabel = useMemo(() => {
    if (viewMode === "single") {
      const m = FINANCIAL_YEAR_MONTHS.find(item => item.monthKey === singleMonth);
      return m ? `${m.name} ${m.defaultYear}` : singleMonth;
    }
    if (viewMode === "from_to") {
      const f = FINANCIAL_YEAR_MONTHS.find(item => item.monthKey === fromMonth);
      const t = FINANCIAL_YEAR_MONTHS.find(item => item.monthKey === toMonth);
      return `From ${f ? f.name + " " + f.defaultYear : fromMonth} To ${t ? t.name + " " + t.defaultYear : toMonth}`;
    }
    if (viewMode === "rolling") {
      return `Rolling 4-Months (${default4Months.map(m => m.month).join(", ")})`;
    }
    return "Full Financial Year 2026-2027 (12 Months)";
  }, [viewMode, singleMonth, fromMonth, toMonth, default4Months]);

  // Filter data according to dashboard month filter
  const currentFilteredData = useMemo(() => {
    if (viewMode === "all") return allData;
    return allData.filter(r => 
      activeMonthKeys.includes(r.monthKey) || 
      activeMonthKeys.includes(r.month) ||
      activeMonthKeys.includes(r.monthName)
    );
  }, [allData, viewMode, activeMonthKeys]);

  // Generate Executive Summary Table (Sheet 3 PPT structure)
  const executiveSummary = useMemo(() => {
    return generatePptExecutiveSummary(currentFilteredData);
  }, [currentFilteredData]);

  // Overall KPI totals
  const kpis = useMemo(() => {
    const tot = executiveSummary.total;
    const bTo = tot.budget.to;
    const aTo = tot.actual.to;
    const vTo = tot.variance.to;
    const achRate = tot.variance.achievementRate;
    const bTeu = tot.budget.teu;
    const aTeu = tot.actual.teu;
    const vTeu = tot.variance.teu;
    const fTo = tot.factory.to;
    const fTeu = tot.factory.teu;

    let metCount = 0;
    let newCount = 0;
    let varCount = 0;

    currentFilteredData.forEach(r => {
      if (r.status === "met") metCount++;
      else if (r.status === "new") newCount++;
      else if (r.status === "variance") varCount++;
    });

    return {
      bTo,
      aTo,
      vTo,
      achRate: Math.round(achRate * 10) / 10,
      bTeu: Math.round(bTeu * 100) / 100,
      aTeu: Math.round(aTeu * 100) / 100,
      vTeu: Math.round(vTeu * 100) / 100,
      fTo,
      fTeu: Math.round(fTeu * 100) / 100,
      bMargin: tot.budget.margin,
      aMargin: tot.actual.margin,
      metCount,
      newCount,
      varCount,
      totalCount: currentFilteredData.length
    };
  }, [executiveSummary, currentFilteredData]);

  // Sales Officer Ranking & Performance
  const officerPerformance = useMemo(() => {
    const officers = {};
    SALES_OFFICERS.forEach(s => {
      officers[s.code] = {
        code: s.code,
        name: s.name,
        department: s.department,
        color: s.color,
        bTo: 0,
        aTo: 0,
        bTeu: 0,
        aTeu: 0,
        bCont: 0,
        aCont: 0,
        rowsCount: 0
      };
    });

    currentFilteredData.forEach(r => {
      const code = r.salesOfficer || "MM";
      if (!officers[code]) {
        officers[code] = {
          code,
          name: code,
          department: r.department || "Horticulture",
          color: "#64748b",
          bTo: 0,
          aTo: 0,
          bTeu: 0,
          aTeu: 0,
          bCont: 0,
          aCont: 0,
          rowsCount: 0
        };
      }
      officers[code].bTo += parseFloat(r.budgetTurnover) || 0;
      officers[code].aTo += parseFloat(r.actualTurnover) || 0;
      officers[code].bTeu += parseFloat(r.budgetTeu) || 0;
      officers[code].aTeu += parseFloat(r.actualTeu) || 0;
      officers[code].bCont += parseFloat(r.budgetContribution) || 0;
      officers[code].aCont += parseFloat(r.actualContribution) || 0;
      officers[code].rowsCount++;
    });

    return Object.values(officers).map(o => {
      const ach = o.bTo > 0 ? (o.aTo / o.bTo) * 100 : (o.aTo > 0 ? 100 : 0);
      const margin = o.aTo > 0 ? (o.aCont / o.aTo) : 0;
      return {
        ...o,
        achRate: Math.round(ach * 10) / 10,
        margin,
        varianceTo: o.aTo - o.bTo,
        varianceTeu: Math.round((o.aTeu - o.bTeu) * 100) / 100
      };
    }).sort((a, b) => b.aTo - a.aTo);
  }, [currentFilteredData]);

  // Month-by-month trajectory for 12 months
  const monthlyTrends = useMemo(() => {
    return FINANCIAL_YEAR_MONTHS.map(m => {
      const monthRows = allData.filter(r => r.monthKey === m.monthKey || r.month === m.code);
      let bTo = 0;
      let aTo = 0;
      let bTeu = 0;
      let aTeu = 0;
      monthRows.forEach(r => {
        bTo += parseFloat(r.budgetTurnover) || 0;
        aTo += parseFloat(r.actualTurnover) || 0;
        bTeu += parseFloat(r.budgetTeu) || 0;
        aTeu += parseFloat(r.actualTeu) || 0;
      });
      const ach = bTo > 0 ? (aTo / bTo) * 100 : (aTo > 0 ? 100 : 0);
      return {
        code: m.code,
        name: m.name,
        monthKey: m.monthKey,
        year: m.defaultYear,
        bTo,
        aTo,
        bTeu: Math.round(bTeu * 10) / 10,
        aTeu: Math.round(aTeu * 10) / 10,
        achRate: Math.round(ach),
        hasActuals: aTo > 0
      };
    });
  }, [allData]);

  // PowerPoint Presentation Export
  const handleExportPowerPoint = async () => {
    try {
      setExportingPpt(true);
      const filename = `Executive_Performance_${activePeriodLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}.pptx`;
      await exportForecastToPowerPoint(currentFilteredData, {
        periodLabel: activePeriodLabel,
        allDataset: allData,
        targetMonthKey: activeMonthKeys[0] || singleMonth || currentMonthKey,
        filename
      });
      message.success(`PowerPoint presentation for ${activePeriodLabel} exported successfully!`);
    } catch (err) {
      console.error("PowerPoint export error:", err);
      message.error("Failed to export PowerPoint presentation.");
    } finally {
      setExportingPpt(false);
    }
  };

  // Table columns for Executive Summary (PPT Sheet 3 format)
  const executiveTableColumns = [
    {
      title: "DEPARTMENT",
      dataIndex: "category",
      key: "category",
      render: (text) => (
        <span style={{ fontWeight: 800, fontSize: 14, color: text === "Total" ? "#0f172a" : "#1e40af" }}>
          {text}
        </span>
      )
    },
    {
      title: "BUDGET TARGETS",
      children: [
        {
          title: "TEU’s",
          key: "bTeu",
          render: (_, row) => <span style={{ fontWeight: 600 }}>{row.budget.teu.toFixed(1)}</span>
        },
        {
          title: "TO (FOB)",
          key: "bTo",
          render: (_, row) => <span>{formatCompactCurrency(row.budget.to)}</span>
        },
        {
          title: "Cont.",
          key: "bCont",
          render: (_, row) => <span>{formatCompactCurrency(row.budget.cont)}</span>
        },
        {
          title: "Margin",
          key: "bMargin",
          render: (_, row) => <span style={{ color: "#3b82f6", fontWeight: 600 }}>{formatPercentage(row.budget.margin)}</span>
        }
      ]
    },
    {
      title: "ACTUAL PERFORMANCE",
      children: [
        {
          title: "TEU’s",
          key: "aTeu",
          render: (_, row) => <span style={{ fontWeight: 600 }}>{row.actual.teu.toFixed(1)}</span>
        },
        {
          title: "TO (FOB)",
          key: "aTo",
          render: (_, row) => <span style={{ fontWeight: 700, color: "#5b21b6" }}>{formatCompactCurrency(row.actual.to)}</span>
        },
        {
          title: "Cont.",
          key: "aCont",
          render: (_, row) => <span>{formatCompactCurrency(row.actual.cont)}</span>
        },
        {
          title: "Margin",
          key: "aMargin",
          render: (_, row) => <span style={{ color: "#8b5cf6", fontWeight: 600 }}>{formatPercentage(row.actual.margin)}</span>
        }
      ]
    },
    {
      title: "FACTORY PERFORMANCE (RATIO)",
      children: [
        {
          title: "Capable TEU",
          key: "fTeu",
          render: (_, row) => <span>{row.factory.teu > 0 ? row.factory.teu.toFixed(1) : "-"}</span>
        },
        {
          title: "Factory TO",
          key: "fTo",
          render: (_, row) => <span>{row.factory.to > 0 ? formatCompactCurrency(row.factory.to) : "-"}</span>
        },
        {
          title: "Cont.",
          key: "fCont",
          render: (_, row) => <span>{row.factory.cont > 0 ? formatCompactCurrency(row.factory.cont) : "-"}</span>
        }
      ]
    },
    {
      title: "VARIANCE & ACHIEVEMENT",
      children: [
        {
          title: "TEU’s",
          key: "vTeu",
          render: (_, row) => (
            <span style={{ fontWeight: 700, color: row.variance.teu >= 0 ? "#10b981" : "#ef4444" }}>
              {row.variance.teu > 0 ? "+" : ""}{row.variance.teu.toFixed(1)}
            </span>
          )
        },
        {
          title: "TO (FOB)",
          key: "vTo",
          render: (_, row) => (
            <span style={{ fontWeight: 700, color: row.variance.to >= 0 ? "#10b981" : "#ef4444" }}>
              {row.variance.to > 0 ? "+" : ""}{formatCompactCurrency(row.variance.to)}
            </span>
          )
        },
        {
          title: "Cont.",
          key: "vCont",
          render: (_, row) => (
            <span style={{ fontWeight: 700, color: row.variance.cont >= 0 ? "#10b981" : "#ef4444" }}>
              {row.variance.cont > 0 ? "+" : ""}{formatCompactCurrency(row.variance.cont)}
            </span>
          )
        },
        {
          title: "% Met",
          key: "vAch",
          render: (_, row) => (
            <Tag color={row.variance.achievementRate >= 100 ? "success" : "error"} style={{ fontWeight: 700 }}>
              {Math.round(row.variance.achievementRate)}%
            </Tag>
          )
        }
      ]
    }
  ];

  const executiveTableData = [
    { key: "horti", ...executiveSummary.horticulture },
    { key: "bedding", ...executiveSummary.bedding },
    { key: "total", ...executiveSummary.total }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" tip="Loading production performance dashboard..." />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Top Header & Page Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Space orientation="horizontal" size="middle" align="center">
            <div style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 12, 
              background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white", 
              fontSize: 22,
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)"
            }}>
              <DashboardOutlined />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                Production & Sales Performance Dashboard
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Executive summary analytics, Department performance (Horti vs Bedding), PPT export, and monthly trends
              </Text>
            </div>
          </Space>
        </div>

        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<FilePptOutlined />}
            loading={exportingPpt}
            onClick={handleExportPowerPoint}
            style={{ backgroundColor: "#d97706", borderColor: "#d97706", fontWeight: 600, height: 38 }}
          >
            Export PowerPoint
          </Button>

          <Button
            type="primary"
            icon={<TableOutlined />}
            onClick={() => navigate("/production-forecast")}
            style={{ backgroundColor: "#2563eb", fontWeight: 600, height: 38 }}
          >
            Open Forecast Grid
          </Button>

          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportForecastToExcel(currentFilteredData, `Executive_Performance_${activePeriodLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`)}
            style={{ height: 38 }}
          >
            Export Excel
          </Button>
        </Space>
      </div>

      {/* Period Filter Card */}
      <Card 
        style={{ 
          marginBottom: 20, 
          borderRadius: 14, 
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
          border: "1px solid #e2e8f0" 
        }}
        styles={{ body: { padding: "14px 20px" } }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space align="center" size="middle" wrap>
            <CalendarOutlined style={{ color: "#6366f1", fontSize: 16 }} />
            <Text strong style={{ color: "#334155", fontSize: 14 }}>Dashboard Time Filter:</Text>
            
            <Radio.Group 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value)} 
              optionType="button"
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="single">Single Month</Radio.Button>
              <Radio.Button value="from_to">From - To Range</Radio.Button>
              <Radio.Button value="rolling">Rolling 4M</Radio.Button>
              <Radio.Button value="all">Full Year (12M)</Radio.Button>
            </Radio.Group>
          </Space>

          <Space align="center" wrap>
            {viewMode === "single" && (
              <Select
                value={singleMonth}
                onChange={setSingleMonth}
                style={{ width: 175 }}
                size="middle"
              >
                {FINANCIAL_YEAR_MONTHS.map(m => (
                  <Option key={m.monthKey} value={m.monthKey}>
                    {m.name} {m.defaultYear} {m.monthKey === currentMonthKey ? "(Current)" : ""}
                  </Option>
                ))}
              </Select>
            )}

            {viewMode === "from_to" && (
              <Space size="small" align="center">
                <Select
                  value={fromMonth}
                  onChange={setFromMonth}
                  style={{ width: 155 }}
                  size="middle"
                >
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
                <SwapRightOutlined style={{ color: "#64748b" }} />
                <Select
                  value={toMonth}
                  onChange={setToMonth}
                  style={{ width: 155 }}
                  size="middle"
                >
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
              </Space>
            )}

            <Tag color="blue" style={{ padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
              {activePeriodLabel}
            </Tag>
          </Space>
        </div>
      </Card>

      {/* High-level KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: 14, 
              background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)", 
              color: "white",
              boxShadow: "0 4px 14px rgba(30, 58, 138, 0.25)",
              border: "none" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "#93c5fd", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px" }}>
              BUDGET TURNOVER TARGET
            </Text>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: "white" }}>
              {formatCompactCurrency(kpis.bTo)} <span style={{ fontSize: 14, fontWeight: 500 }}>LKR</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "#bfdbfe", fontSize: 12 }}>
              <span>Volume: <b>{kpis.bTeu} TEUs</b></span>
              <span>Margin: <b>{formatPercentage(kpis.bMargin)}</b></span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: 14, 
              background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)", 
              color: "white",
              boxShadow: "0 4px 14px rgba(91, 33, 182, 0.25)",
              border: "none" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "#ddd6fe", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px" }}>
              ACTUAL TURNOVER ACHIEVED
            </Text>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: "white" }}>
              {formatCompactCurrency(kpis.aTo)} <span style={{ fontSize: 14, fontWeight: 500 }}>LKR</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "#e9d5ff", fontSize: 12 }}>
              <span>Volume: <b>{kpis.aTeu} TEUs</b></span>
              <span>Margin: <b>{formatPercentage(kpis.aMargin)}</b></span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: 14, 
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)", 
              color: "white",
              boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)",
              border: "none" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "#ccfbf1", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px" }}>
              FACTORY PERFORMANCE (RATIO)
            </Text>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: "white" }}>
              {formatCompactCurrency(kpis.fTo)} <span style={{ fontSize: 14, fontWeight: 500 }}>LKR</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "#ccfbf1", fontSize: 12 }}>
              <span>Capable: <b>{kpis.fTeu} TEUs</b></span>
              <span>Rate: <b>{kpis.aTeu > 0 ? `${Math.round((kpis.fTeu / kpis.aTeu) * 100)}%` : "-"}</b></span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: 14, 
              background: kpis.vTo >= 0 
                ? "linear-gradient(135deg, #065f46 0%, #059669 100%)" 
                : "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", 
              color: "white",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
              border: "none" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px" }}>
              OVERALL TARGET VARIANCE
            </Text>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: "white" }}>
              {kpis.vTo >= 0 ? "+" : ""}{formatCompactCurrency(kpis.vTo)} <span style={{ fontSize: 14, fontWeight: 500 }}>LKR</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
              <span>Achievement: <b>{kpis.achRate}%</b></span>
              <span>Diff TEU: <b>{kpis.vTeu >= 0 ? "+" : ""}{kpis.vTeu}</b></span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* EXECUTIVE SUMMARY TABLE (Sheet 3 PPT Format) */}
      <Card 
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Space>
              <TrophyOutlined style={{ color: "#f59e0b", fontSize: 18 }} />
              <span style={{ fontWeight: 700, color: "#0f172a" }}>
                Executive Performance Summary (Budget vs Actuals vs Factory Confirmed)
              </span>
            </Space>
            <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600 }}>
              {activePeriodLabel}
            </Tag>
          </div>
        }
        style={{ 
          marginBottom: 24, 
          borderRadius: 14, 
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
          border: "1px solid #e2e8f0" 
        }}
      >
        <Table
          dataSource={executiveTableData}
          columns={executiveTableColumns}
          pagination={false}
          bordered
          size="middle"
          rowClassName={(record) => record.category === "Total" ? "bg-slate-100 font-bold" : ""}
        />
      </Card>

      {/* Sales Officer Performance Ranking */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card 
            title={
              <Space>
                <TeamOutlined style={{ color: "#3b82f6" }} />
                <span style={{ fontWeight: 700, color: "#0f172a" }}>Sales Officer Achievement & Ranking</span>
              </Space>
            }
            style={{ 
              borderRadius: 14, 
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
              border: "1px solid #e2e8f0",
              height: "100%" 
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {officerPerformance.map((officer) => (
                <div key={officer.code} style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Space align="center">
                      <Tag color={officer.color} style={{ fontWeight: 700, fontSize: 12, padding: "2px 8px" }}>
                        {officer.code}
                      </Tag>
                      <Text strong style={{ fontSize: 14, color: "#1e293b" }}>{officer.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>({officer.department})</Text>
                    </Space>
                    
                    <div style={{ textAlign: "right" }}>
                      <Text strong style={{ fontSize: 14, color: officer.achRate >= 100 ? "#10b981" : "#4f46e5" }}>
                        {officer.achRate}% Achieved
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                        {formatCompactCurrency(officer.aTo)} / {formatCompactCurrency(officer.bTo)} LKR
                      </Text>
                    </div>
                  </div>

                  <Progress 
                    percent={Math.min(officer.achRate, 100)} 
                    strokeColor={officer.achRate >= 100 ? "#10b981" : officer.color} 
                    showInfo={false} 
                    size="small"
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#64748b" }}>
                    <span>Actual Volume: <b>{officer.aTeu.toFixed(1)} TEU</b></span>
                    <span>Margin: <b>{formatPercentage(officer.margin)}</b></span>
                    <span>Turnover Diff: <b style={{ color: officer.varianceTo >= 0 ? "#10b981" : "#ef4444" }}>{officer.varianceTo >= 0 ? "+" : ""}{formatCompactCurrency(officer.varianceTo)}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card 
            title={
              <Space>
                <ShopOutlined style={{ color: "#8b5cf6" }} />
                <span style={{ fontWeight: 700, color: "#0f172a" }}>Department Split Analysis</span>
              </Space>
            }
            style={{ 
              borderRadius: 14, 
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
              border: "1px solid #e2e8f0",
              height: "100%" 
            }}
          >
            <div style={{ padding: "10px 0" }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text strong style={{ color: "#1e3a8a" }}>🌱 Horticulture Products</Text>
                  <Text strong>{formatPercentage(executiveSummary.horticulture.actual.to / (kpis.aTo || 1))}</Text>
                </div>
                <Progress 
                  percent={Math.round((executiveSummary.horticulture.actual.to / (kpis.aTo || 1)) * 100)} 
                  strokeColor="#3b82f6" 
                  showInfo={false}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: "#64748b" }}>
                  <span>Actual: <b>{formatCompactCurrency(executiveSummary.horticulture.actual.to)} LKR</b></span>
                  <span>Target: <b>{formatCompactCurrency(executiveSummary.horticulture.budget.to)} LKR</b></span>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text strong style={{ color: "#d97706" }}>🛏️ Bedding Products</Text>
                  <Text strong>{formatPercentage(executiveSummary.bedding.actual.to / (kpis.aTo || 1))}</Text>
                </div>
                <Progress 
                  percent={Math.round((executiveSummary.bedding.actual.to / (kpis.aTo || 1)) * 100)} 
                  strokeColor="#f59e0b" 
                  showInfo={false}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: "#64748b" }}>
                  <span>Actual: <b>{formatCompactCurrency(executiveSummary.bedding.actual.to)} LKR</b></span>
                  <span>Target: <b>{formatCompactCurrency(executiveSummary.bedding.budget.to)} LKR</b></span>
                </div>
              </div>

              <Divider style={{ margin: "16px 0" }} />

              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                <Text strong style={{ fontSize: 13, color: "#334155" }}>Quick Executive Summary:</Text>
                <ul style={{ paddingLeft: 18, marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                  <li>Total {kpis.totalCount} customer orders tracked for {activePeriodLabel}.</li>
                  <li>Overall achievement rate is standing at <b>{kpis.achRate}%</b>.</li>
                  <li>Factory capable TEU fulfilment stands at <b>{kpis.fTeu} TEUs</b> ({formatCompactCurrency(kpis.fTo)} LKR).</li>
                </ul>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 12-Month Trajectory Overview */}
      <Card 
        title={
          <Space>
            <CalendarOutlined style={{ color: "#10b981" }} />
            <span style={{ fontWeight: 700, color: "#0f172a" }}>Full Year Monthly Trajectory (FY 2026-2027)</span>
          </Space>
        }
        style={{ 
          borderRadius: 14, 
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
          border: "1px solid #e2e8f0" 
        }}
      >
        <Table
          dataSource={monthlyTrends}
          rowKey="monthKey"
          pagination={false}
          size="small"
          columns={[
            { title: "Month", dataIndex: "name", key: "name", render: (text, r) => <span style={{ fontWeight: 700 }}>{text} {r.year}</span> },
            { title: "Code", dataIndex: "code", key: "code", align: "center", render: c => <Tag color="blue">{c}</Tag> },
            { title: "Budget TO (LKR)", dataIndex: "bTo", key: "bTo", align: "right", render: v => formatCompactCurrency(v) },
            { title: "Budget TEU", dataIndex: "bTeu", key: "bTeu", align: "right", render: v => v.toFixed(1) },
            { title: "Actual TO (LKR)", dataIndex: "aTo", key: "aTo", align: "right", render: (v, r) => <span style={{ fontWeight: 700, color: r.hasActuals ? "#5b21b6" : "#94a3b8" }}>{r.hasActuals ? formatCompactCurrency(v) : "-"}</span> },
            { title: "Actual TEU", dataIndex: "aTeu", key: "aTeu", align: "right", render: (v, r) => r.hasActuals ? v.toFixed(1) : "-" },
            { 
              title: "% Achieved", 
              dataIndex: "achRate", 
              key: "achRate", 
              align: "center", 
              render: (v, r) => r.hasActuals ? (
                <Tag color={v >= 100 ? "success" : "warning"} style={{ fontWeight: 700 }}>
                  {v}%
                </Tag>
              ) : "-"
            },
            {
              title: "Status",
              key: "status",
              align: "center",
              render: (_, r) => {
                if (!r.hasActuals) return <Tag>UPCOMING</Tag>;
                if (r.aTo >= r.bTo) return <Tag color="success">✓ TARGET MET</Tag>;
                return <Tag color="error">⚠ VARIANCE</Tag>;
              }
            }
          ]}
        />
      </Card>
    </div>
  );
}

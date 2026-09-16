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
  Alert
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
  ReloadOutlined
} from "@ant-design/icons";

import { 
  FINANCIAL_YEAR_MONTHS, 
  SALES_OFFICERS, 
  getDefaultRollingMonths, 
  formatCurrency, 
  formatCompactCurrency, 
  formatPercentage, 
  generatePptExecutiveSummary,
  exportForecastToExcel
} from "../../utils/productionPlanData";
import { getProductionForecasts } from "../../services/firebase/productionPlanService";

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProductionDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  
  // Dashboard month selection
  const [selectedMonthKey, setSelectedMonthKey] = useState("all"); // "all", "rolling", or specific month key e.g. "2026-04"
  const default4Months = useMemo(() => getDefaultRollingMonths(), []);
  const defaultMonthKeys = useMemo(() => default4Months.map(m => m.monthKey), [default4Months]);

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
    } finally {
      setLoading(false);
    }
  };

  // Filter data according to dashboard month filter
  const currentFilteredData = useMemo(() => {
    if (selectedMonthKey === "all") return allData;
    if (selectedMonthKey === "rolling") {
      return allData.filter(r => defaultMonthKeys.includes(r.monthKey) || defaultMonthKeys.includes(r.month));
    }
    return allData.filter(r => r.monthKey === selectedMonthKey || r.month === selectedMonthKey);
  }, [allData, selectedMonthKey, defaultMonthKeys]);

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
      title: "BUDGET",
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
      title: "ACTUAL",
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
      title: "FACTORY CONFIRMED",
      children: [
        {
          title: "TEU’s",
          key: "fTeu",
          render: (_, row) => <span>{row.factory.teu > 0 ? row.factory.teu.toFixed(1) : "-"}</span>
        },
        {
          title: "TO (FOB)",
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
      title: "VARIANCE",
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
                Executive summary analytics, Department performance (Horti vs Bedding), PPT output data, and monthly trends
              </Text>
            </div>
          </Space>
        </div>

        <Space size="middle" wrap>
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
            onClick={() => exportForecastToExcel(currentFilteredData, `Executive_Performance_${selectedMonthKey}.xlsx`)}
            style={{ height: 38 }}
          >
            Export Report
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
          <Space align="center" size="middle">
            <CalendarOutlined style={{ color: "#6366f1", fontSize: 16 }} />
            <Text strong style={{ color: "#334155", fontSize: 14 }}>Dashboard Time Filter:</Text>
            
            <Radio.Group 
              value={selectedMonthKey} 
              onChange={(e) => setSelectedMonthKey(e.target.value)} 
              optionType="button"
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="all">Full Financial Year (12M)</Radio.Button>
              <Radio.Button value="rolling">Current + Next 3M (Rolling)</Radio.Button>
            </Radio.Group>
          </Space>

          <Space align="center">
            <Text type="secondary" style={{ fontSize: 13 }}>Select Specific Month:</Text>
            <Select
              value={selectedMonthKey}
              onChange={setSelectedMonthKey}
              style={{ width: 170 }}
              size="middle"
            >
              <Option value="all">Full Financial Year</Option>
              <Option value="rolling">4M Rolling Window</Option>
              {FINANCIAL_YEAR_MONTHS.map(m => (
                <Option key={m.monthKey} value={m.monthKey}>{m.name} ({m.code})</Option>
              ))}
            </Select>
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
              background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)", 
              color: "white",
              boxShadow: "0 4px 14px rgba(76, 29, 149, 0.25)",
              border: "none" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "#c4b5fd", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px" }}>
              ACTUAL TURNOVER ACHIEVED
            </Text>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: "white" }}>
              {formatCompactCurrency(kpis.aTo)} <span style={{ fontSize: 14, fontWeight: 500 }}>LKR</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "#ddd6fe", fontSize: 12 }}>
              <span>Volume: <b>{kpis.aTeu} TEUs</b></span>
              <span>Margin: <b>{formatPercentage(kpis.aMargin)}</b></span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: 14, 
              background: kpis.vTo >= 0 ? "linear-gradient(135deg, #065f46 0%, #059669 100%)" : "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)", 
              color: "white",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
              border: "none" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "#a7f3d0", fontWeight: 700, fontSize: 12, letterSpacing: "0.5px" }}>
              OVERALL VARIANCE (LKR)
            </Text>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: "white" }}>
              {kpis.vTo >= 0 ? "+" : ""}{formatCompactCurrency(kpis.vTo)} <span style={{ fontSize: 14, fontWeight: 500 }}>LKR</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", color: "#e2e8f0", fontSize: 12 }}>
              <span>TEU Diff: <b>{kpis.vTeu >= 0 ? "+" : ""}{kpis.vTeu}</b></span>
              <span>Rate: <b>{kpis.achRate}%</b></span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: 14, 
              background: "white", 
              boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0" 
            }}
            styles={{ body: { padding: "20px" } }}
          >
            <Text style={{ color: "#64748b", fontWeight: 700, fontSize: 12 }}>
              TARGET ACHIEVEMENT RATIO
            </Text>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: kpis.achRate >= 100 ? "#10b981" : "#d97706" }}>
                {kpis.achRate}%
              </span>
              <Text type="secondary" style={{ fontSize: 12 }}>of turnover target</Text>
            </div>
            <Progress 
              percent={Math.min(100, kpis.achRate)} 
              status={kpis.achRate >= 100 ? "success" : "active"}
              strokeColor={kpis.achRate >= 100 ? "#10b981" : "#3b82f6"}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* REPLICATION OF SHEET 3 "PPT OUTPUT DATA" */}
      <Card 
        style={{ 
          marginBottom: 24, 
          borderRadius: 14, 
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)", 
          border: "1px solid #e2e8f0" 
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <Space>
            <FilePptOutlined style={{ color: "#e11d48", fontSize: 20 }} />
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                Executive Performance Summary Table (PPT Output Data)
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Matches Sheet 3 "PPT output data" structure • Department-level comparison (Horticulture vs Bedding)
              </Text>
            </div>
          </Space>

          <Tag color="magenta" style={{ padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
            Period: {selectedMonthKey === "all" ? "Full Financial Year" : (selectedMonthKey === "rolling" ? "4-Month Rolling" : selectedMonthKey)}
          </Tag>
        </div>

        <Table
          dataSource={executiveTableData}
          columns={executiveTableColumns}
          pagination={false}
          bordered
          size="middle"
          rowClassName={(record) => record.category === "Total" ? "bg-slate-100 font-bold" : ""}
          style={{ overflowX: "auto" }}
        />
      </Card>

      {/* Sales Officer Performance Leaderboard & Department Comparison */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {/* Sales Officer Breakdown */}
        <Col xs={24} lg={14}>
          <Card 
            title={
              <Space>
                <TeamOutlined style={{ color: "#3b82f6" }} />
                <span>Sales Officer Performance Leaderboard</span>
              </Space>
            }
            style={{ borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", height: "100%" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {officerPerformance.map((officer, idx) => (
                <div 
                  key={officer.code} 
                  style={{ 
                    padding: "14px 16px", 
                    borderRadius: 12, 
                    border: "1px solid #f1f5f9", 
                    backgroundColor: idx === 0 ? "#f8fafc" : "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Space>
                      {idx === 0 && <TrophyOutlined style={{ color: "#f59e0b", fontSize: 16 }} />}
                      <Tag color={officer.color} style={{ fontWeight: 800, fontSize: 13, borderRadius: 6 }}>
                        {officer.code}
                      </Tag>
                      <Text strong style={{ color: "#1e293b", fontSize: 14 }}>{officer.department}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>({officer.rowsCount} entries)</Text>
                    </Space>

                    <Space size="large">
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Actual TO:</Text>{" "}
                        <Text strong style={{ color: "#4c1d95" }}>{formatCompactCurrency(officer.aTo)} LKR</Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>Target Met:</Text>{" "}
                        <Tag color={officer.achRate >= 100 ? "success" : "warning"} style={{ fontWeight: 700 }}>
                          {officer.achRate}%
                        </Tag>
                      </div>
                    </Space>
                  </div>

                  <Progress 
                    percent={Math.min(100, officer.achRate)} 
                    strokeColor={officer.color}
                    size="small"
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#64748b" }}>
                    <span>Budget: {formatCompactCurrency(officer.bTo)} LKR ({officer.bTeu.toFixed(1)} TEU)</span>
                    <span>Actual: {formatCompactCurrency(officer.aTo)} LKR ({officer.aTeu.toFixed(1)} TEU)</span>
                    <span style={{ fontWeight: 600, color: officer.varianceTo >= 0 ? "#10b981" : "#ef4444" }}>
                      Var: {officer.varianceTo >= 0 ? "+" : ""}{formatCompactCurrency(officer.varianceTo)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Department Comparison Cards */}
        <Col xs={24} lg={10}>
          <Card 
            title={
              <Space>
                <ShopOutlined style={{ color: "#10b981" }} />
                <span>Department Comparison (Horti vs Bedding)</span>
              </Space>
            }
            style={{ borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", height: "100%" }}
          >
            {/* Horticulture */}
            <div style={{ padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1px solid #bbf7d0", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: 16, color: "#166534" }}>🌿 Horticulture</Text>
                <Tag color="green" style={{ fontWeight: 700 }}>DP, HR, MM</Tag>
              </div>
              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Budget TO / TEU:</Text>
                  <div style={{ fontWeight: 700, color: "#14532d" }}>
                    {formatCompactCurrency(executiveSummary.horticulture.budget.to)} LKR
                  </div>
                  <Text style={{ fontSize: 11, color: "#15803d" }}>({executiveSummary.horticulture.budget.teu.toFixed(1)} TEUs)</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Actual TO / TEU:</Text>
                  <div style={{ fontWeight: 700, color: "#166534" }}>
                    {formatCompactCurrency(executiveSummary.horticulture.actual.to)} LKR
                  </div>
                  <Text style={{ fontSize: 11, color: "#15803d" }}>({executiveSummary.horticulture.actual.teu.toFixed(1)} TEUs)</Text>
                </Col>
              </Row>
              <div style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>
                  Achievement: {Math.round(executiveSummary.horticulture.variance.achievementRate)}%
                </Text>
                <Progress 
                  percent={Math.min(100, Math.round(executiveSummary.horticulture.variance.achievementRate))} 
                  strokeColor="#16a34a" 
                  size="small" 
                />
              </div>
            </div>

            {/* Bedding */}
            <div style={{ padding: "16px", borderRadius: 12, background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", border: "1px solid #fcd34d" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: 16, color: "#92400e" }}>🛏️ Bedding</Text>
                <Tag color="gold" style={{ fontWeight: 700 }}>PD</Tag>
              </div>
              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Budget TO / TEU:</Text>
                  <div style={{ fontWeight: 700, color: "#78350f" }}>
                    {formatCompactCurrency(executiveSummary.bedding.budget.to)} LKR
                  </div>
                  <Text style={{ fontSize: 11, color: "#92400e" }}>({executiveSummary.bedding.budget.teu.toFixed(1)} TEUs)</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Actual TO / TEU:</Text>
                  <div style={{ fontWeight: 700, color: "#92400e" }}>
                    {formatCompactCurrency(executiveSummary.bedding.actual.to)} LKR
                  </div>
                  <Text style={{ fontSize: 11, color: "#92400e" }}>({executiveSummary.bedding.actual.teu.toFixed(1)} TEUs)</Text>
                </Col>
              </Row>
              <div style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>
                  Achievement: {Math.round(executiveSummary.bedding.variance.achievementRate)}%
                </Text>
                <Progress 
                  percent={Math.min(100, Math.round(executiveSummary.bedding.variance.achievementRate))} 
                  strokeColor="#d97706" 
                  size="small" 
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Month-by-Month Trajectory (12 Months of Financial Year) */}
      <Card 
        title={
          <Space>
            <CalendarOutlined style={{ color: "#3b82f6" }} />
            <span>12-Month Financial Year Trajectory (APR to MAR)</span>
          </Space>
        }
        style={{ borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" }}
      >
        <Row gutter={[12, 12]}>
          {monthlyTrends.map((m) => (
            <Col xs={24} sm={12} md={8} lg={4} key={m.monthKey}>
              <div 
                onClick={() => setSelectedMonthKey(m.monthKey)}
                style={{ 
                  padding: "12px", 
                  borderRadius: 10, 
                  border: selectedMonthKey === m.monthKey ? "2px solid #3b82f6" : "1px solid #e2e8f0", 
                  backgroundColor: selectedMonthKey === m.monthKey ? "#eff6ff" : (m.hasActuals ? "white" : "#f8fafc"),
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text strong style={{ color: "#0f172a" }}>{m.code}</Text>
                  {m.hasActuals ? (
                    <Tag color={m.achRate >= 100 ? "success" : "warning"} style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>
                      {m.achRate}%
                    </Tag>
                  ) : (
                    <Tag style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>Budget</Tag>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "#64748b" }}>
                  B: {formatCompactCurrency(m.bTo)} LKR
                </div>
                <div style={{ fontSize: 11, color: m.hasActuals ? "#4c1d95" : "#94a3b8", fontWeight: 600 }}>
                  A: {m.hasActuals ? `${formatCompactCurrency(m.aTo)} LKR` : "Pending"}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  {m.aTeu > 0 ? `${m.aTeu} / ${m.bTeu} TEU` : `${m.bTeu} TEU`}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}

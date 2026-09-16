import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Select, 
  Row, 
  Col, 
  Typography, 
  Modal, 
  Form, 
  InputNumber, 
  Switch, 
  message, 
  Tooltip, 
  Statistic,
  Badge
} from "antd";
import {
  BranchesOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  TableOutlined
} from "@ant-design/icons";

import { 
  FINANCIAL_YEAR_MONTHS, 
  SALES_OFFICERS, 
  formatCurrency, 
  formatPercentage 
} from "../../utils/productionPlanData";
import { 
  getProspectPipelines, 
  saveProspect, 
  convertProspectToForecast 
} from "../../services/firebase/productionPlanService";

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProspectPipeline() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [convertForm] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [prospects, setProspects] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [officerFilter, setOfficerFilter] = useState("all");
  const [timelineFilter, setTimelineFilter] = useState("all");

  // Add / Edit Modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProspect, setEditingProspect] = useState(null);

  // Conversion Modal
  const [isConvertModalVisible, setIsConvertModalVisible] = useState(false);
  const [selectedProspectToConvert, setSelectedProspectToConvert] = useState(null);

  useEffect(() => {
    loadProspects();
  }, []);

  const loadProspects = async () => {
    try {
      setLoading(true);
      const data = await getProspectPipelines();
      setProspects(data);
    } catch (err) {
      console.error("Failed to load prospects:", err);
      message.error("Failed to load prospect pipeline");
    } finally {
      setLoading(false);
    }
  };

  const filteredProspects = useMemo(() => {
    let list = [...prospects];

    if (priorityFilter !== "all") {
      list = list.filter(p => p.priority === priorityFilter);
    }
    if (officerFilter !== "all") {
      list = list.filter(p => p.salesOfficer === officerFilter);
    }
    if (timelineFilter !== "all") {
      list = list.filter(p => p.expectedClosingTimeline === timelineFilter);
    }
    if (searchText.trim() !== "") {
      const q = searchText.toLowerCase().trim();
      list = list.filter(p => 
        (p.companyName && p.companyName.toLowerCase().includes(q)) ||
        (p.country && p.country.toLowerCase().includes(q)) ||
        (p.status && p.status.toLowerCase().includes(q)) ||
        (p.salesOfficer && p.salesOfficer.toLowerCase().includes(q))
      );
    }

    return list;
  }, [prospects, priorityFilter, officerFilter, timelineFilter, searchText]);

  // Summary Metrics
  const pipelineMetrics = useMemo(() => {
    let totTeus = 0;
    let totTurnoverMillions = 0;
    let highCount = 0;
    let mediumCount = 0;

    prospects.forEach(p => {
      totTeus += parseFloat(p.estTeus) || 0;
      totTurnoverMillions += parseFloat(p.estTurnover) || 0;
      if (p.priority === "HIGH") highCount++;
      else if (p.priority === "MEDIUM") mediumCount++;
    });

    return {
      totalCount: prospects.length,
      totTeus: Math.round(totTeus * 10) / 10,
      totTurnoverMillions: Math.round(totTurnoverMillions * 10) / 10,
      highCount,
      mediumCount
    };
  }, [prospects]);

  // Open Convert Modal
  const handleOpenConvert = (record) => {
    setSelectedProspectToConvert(record);
    convertForm.resetFields();
    convertForm.setFieldsValue({
      targetMonthKey: "2026-09"
    });
    setIsConvertModalVisible(true);
  };

  // Perform Conversion
  const handleConvertSubmit = async () => {
    try {
      const values = await convertForm.validateFields();
      const mObj = FINANCIAL_YEAR_MONTHS.find(m => m.monthKey === values.targetMonthKey);
      await convertProspectToForecast(selectedProspectToConvert, mObj);
      message.success(`Converted ${selectedProspectToConvert.companyName} into ${mObj.name} forecast successfully!`);
      setIsConvertModalVisible(false);
      navigate("/production-forecast");
    } catch (err) {
      console.error("Conversion error:", err);
      message.error("Failed to convert prospect.");
    }
  };

  // Open Add/Edit Modal
  const handleOpenModal = (record = null) => {
    setEditingProspect(record);
    form.resetFields();
    if (record) {
      form.setFieldsValue({ ...record });
    } else {
      form.setFieldsValue({
        salesOfficer: "MM",
        priority: "HIGH",
        expectedClosingTimeline: "0-6 Months",
        estTeus: 2,
        estTurnover: 5,
        conversionRate: 0.5,
        priceOffered: true,
        sampleDelivered: true,
        status: ""
      });
    }
    setIsModalVisible(true);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      const toSave = {
        ...editingProspect,
        ...values
      };
      await saveProspect(toSave);
      message.success(editingProspect ? "Prospect updated!" : "Prospect created!");
      setIsModalVisible(false);
      await loadProspects();
    } catch (err) {
      console.error("Save prospect error:", err);
    }
  };

  const columns = [
    {
      title: "#",
      dataIndex: "seqNo",
      key: "seqNo",
      width: 60,
      render: (val, _, idx) => <Text type="secondary">{val || idx + 1}</Text>
    },
    {
      title: "Officer",
      dataIndex: "salesOfficer",
      key: "salesOfficer",
      width: 80,
      render: (val) => <Tag color="blue" style={{ fontWeight: 700 }}>{val}</Tag>
    },
    {
      title: "Company / Buyer",
      dataIndex: "companyName",
      key: "companyName",
      width: 220,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{text}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.country}</Text>
        </div>
      )
    },
    {
      title: "Est. TEUs",
      dataIndex: "estTeus",
      key: "estTeus",
      width: 90,
      render: (val) => <span style={{ fontWeight: 600 }}>{val} TEU</span>
    },
    {
      title: "Est Turnover",
      dataIndex: "estTurnover",
      key: "estTurnover",
      width: 120,
      render: (val) => <span style={{ fontWeight: 700, color: "#1e40af" }}>{val}M LKR</span>
    },
    {
      title: "Conversion %",
      dataIndex: "conversionRate",
      key: "conversionRate",
      width: 110,
      render: (val) => (
        <Tag color={val >= 0.6 ? "success" : (val >= 0.4 ? "processing" : "default")} style={{ fontWeight: 700 }}>
          {Math.round((val || 0) * 100)}%
        </Tag>
      )
    },
    {
      title: "Timeline",
      dataIndex: "expectedClosingTimeline",
      key: "expectedClosingTimeline",
      width: 120,
      render: (text) => <Tag style={{ borderRadius: 6 }}>{text}</Tag>
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (val) => {
        if (val === "HIGH") return <Tag color="error" style={{ fontWeight: 700 }}>HIGH</Tag>;
        if (val === "MEDIUM") return <Tag color="warning" style={{ fontWeight: 700 }}>MEDIUM</Tag>;
        return <Tag color="default">LOW</Tag>;
      }
    },
    {
      title: "Price & Sample",
      key: "readiness",
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title={r.priceOffered ? "Price Offered" : "Price Pending"}>
            <Tag color={r.priceOffered ? "cyan" : "default"}>Price: {r.priceOffered ? "✓" : "✗"}</Tag>
          </Tooltip>
          <Tooltip title={r.sampleDelivered ? "Sample Delivered" : "Sample Pending"}>
            <Tag color={r.sampleDelivered ? "purple" : "default"}>Sample: {r.sampleDelivered ? "✓" : "✗"}</Tag>
          </Tooltip>
        </Space>
      )
    },
    {
      title: "Status & Notes",
      dataIndex: "status",
      key: "status",
      render: (text) => (
        <div style={{ maxWidth: 300, whiteSpace: "normal", fontSize: 12, color: "#475569" }}>
          {text}
        </div>
      )
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            type="primary" 
            icon={<ArrowRightOutlined />} 
            onClick={() => handleOpenConvert(record)}
            style={{ backgroundColor: "#10b981", fontSize: 12, fontWeight: 600 }}
          >
            To Forecast
          </Button>
          <Button 
            size="small" 
            onClick={() => handleOpenModal(record)}
            style={{ fontSize: 12 }}
          >
            Edit
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: "20px 24px", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Space orientation="horizontal" size="middle" align="center">
            <div style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 12, 
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white", 
              fontSize: 22,
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
            }}>
              <BranchesOutlined />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                Prospect Pipeline Tracker
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                High-potential prospect accounts, probability conversion rates, and forecast transition (Sheet 1)
              </Text>
            </div>
          </Space>
        </div>

        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            style={{ backgroundColor: "#2563eb", fontWeight: 600, height: 38 }}
          >
            Add New Prospect
          </Button>

          <Button
            icon={<TableOutlined />}
            onClick={() => navigate("/production-forecast")}
            style={{ height: 38 }}
          >
            Production Forecast
          </Button>
        </Space>
      </div>

      {/* KPI Cards Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: "4px solid #3b82f6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>TOTAL PIPELINE PROSPECTS</span>}
              value={pipelineMetrics.totalCount}
              suffix="Accounts"
              valueStyle={{ fontWeight: 800, color: "#1e40af", fontSize: 22 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: "4px solid #10b981", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>ESTIMATED VOLUME POTENTIAL</span>}
              value={pipelineMetrics.totTeus}
              suffix="TEUs"
              valueStyle={{ fontWeight: 800, color: "#065f46", fontSize: 22 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: "4px solid #8b5cf6", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>ESTIMATED TURNOVER VALUE</span>}
              value={pipelineMetrics.totTurnoverMillions}
              suffix="Million LKR"
              valueStyle={{ fontWeight: 800, color: "#5b21b6", fontSize: 22 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: "4px solid #ef4444", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <Statistic
              title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>HIGH PRIORITY OPPORTUNITIES</span>}
              value={pipelineMetrics.highCount}
              suffix={`/ ${pipelineMetrics.totalCount}`}
              valueStyle={{ fontWeight: 800, color: "#991b1b", fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: "1px solid #e2e8f0" }} styles={{ body: { padding: "14px 18px" } }}>
        <Row gutter={[16, 12]} align="middle" justify="space-between">
          <Col xs={24} md={16}>
            <Space size="middle" wrap>
              <Select
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: 140 }}
                placeholder="Priority"
              >
                <Option value="all">All Priorities</Option>
                <Option value="HIGH">HIGH Priority</Option>
                <Option value="MEDIUM">MEDIUM Priority</Option>
                <Option value="LOW">LOW Priority</Option>
              </Select>

              <Select
                value={officerFilter}
                onChange={setOfficerFilter}
                style={{ width: 140 }}
                placeholder="Marketing Person"
              >
                <Option value="all">All Officers</Option>
                {SALES_OFFICERS.map(s => (
                  <Option key={s.code} value={s.code}>{s.code}</Option>
                ))}
              </Select>

              <Select
                value={timelineFilter}
                onChange={setTimelineFilter}
                style={{ width: 150 }}
                placeholder="Timeline"
              >
                <Option value="all">All Timelines</Option>
                <Option value="0-6 Months">0-6 Months</Option>
                <Option value="6-12 Months">6-12 Months</Option>
              </Select>
            </Space>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: "right" }}>
            <Input
              placeholder="Search Company, Country, Status..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: "100%", maxWidth: 300 }}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Prospects Table */}
      <Card style={{ borderRadius: 12, border: "1px solid #e2e8f0" }} styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filteredProspects}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (total) => `Total ${total} prospects` }}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>

      {/* Convert Prospect to Active Forecast Modal */}
      <Modal
        title="Convert Prospect to Active Forecast"
        open={isConvertModalVisible}
        onOk={handleConvertSubmit}
        onCancel={() => setIsConvertModalVisible(false)}
        okText="Confirm & Add to Forecast"
        cancelText="Cancel"
      >
        {selectedProspectToConvert && (
          <Form form={convertForm} layout="vertical" style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f8fafc", borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                {selectedProspectToConvert.companyName} ({selectedProspectToConvert.country})
              </div>
              <Text type="secondary">
                Officer: {selectedProspectToConvert.salesOfficer} • Est. TEUs: {selectedProspectToConvert.estTeus} • Turnover: {selectedProspectToConvert.estTurnover}M LKR
              </Text>
            </div>

            <Form.Item 
              name="targetMonthKey" 
              label="Select Target Forecast Month" 
              rules={[{ required: true, message: "Please select target month" }]}
            >
              <Select size="middle">
                {FINANCIAL_YEAR_MONTHS.map(m => (
                  <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Add / Edit Prospect Modal */}
      <Modal
        title={editingProspect ? "Edit Prospect" : "Add New Prospect"}
        open={isModalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={650}
        okText="Save Prospect"
        cancelText="Cancel"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="companyName" label="Company Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Gaza G" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="country" label="Country" rules={[{ required: true }]}>
                <Input placeholder="e.g. Denmark" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="salesOfficer" label="Marketing Person" rules={[{ required: true }]}>
                <Select>
                  {SALES_OFFICERS.map(s => (
                    <Option key={s.code} value={s.code}>{s.code}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Priority">
                <Select>
                  <Option value="HIGH">HIGH</Option>
                  <Option value="MEDIUM">MEDIUM</Option>
                  <Option value="LOW">LOW</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="expectedClosingTimeline" label="Closing Timeline">
                <Select>
                  <Option value="0-6 Months">0-6 Months</Option>
                  <Option value="6-12 Months">6-12 Months</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="estTeus" label="Est. TEUs">
                <InputNumber min={0} step={0.25} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="estTurnover" label="Est Turnover (Million LKR)">
                <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="conversionRate" label="Conversion Rate (0 to 1)">
                <InputNumber min={0} max={1} step={0.05} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priceOffered" label="Price Offered" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sampleDelivered" label="Sample Delivered" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="Status & Detailed Notes">
            <Input.TextArea rows={3} placeholder="Customer trial status, feedback, pricing discussions..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

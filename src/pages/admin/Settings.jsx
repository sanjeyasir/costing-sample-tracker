import React, { useEffect, useState } from "react";
import * as sampleService from "../../services/firebase/sampleService";
import * as costingService from "../../services/firebase/costingService";
import { isMockMode } from "../../services/firebase/config";
import { Input, Button, Card, Typography, Alert, Spin, Space, Tag, Row, Col } from "antd";
import { SaveOutlined, PlusOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function Settings() {
  const [currentFy, setCurrentFy] = useState("2627");
  const [counterValue, setCounterValue] = useState(0);
  const [costingCounter, setCostingCounter] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [productUnits, setProductUnits] = useState(["Horticulture", "Bedding"]);
  const [requestTypes, setRequestTypes] = useState(["Top Urgent", "Urgent", "Normal"]);
  const [sampleTypes, setSampleTypes] = useState(["New Development", "Pre Production"]);

  // Local form inputs
  const [newUnit, setNewUnit] = useState("");
  const [newUrgency, setNewUrgency] = useState("");
  const [newSampleType, setNewSampleType] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const fyStr = sampleService.getFinancialYearStr();
      setCurrentFy(fyStr);

      // Load counters
      if (isMockMode || true) {
        const counterKey = `sampleRequestCounter_${fyStr}`;
        const counterObj = JSON.parse(localStorage.getItem(counterKey) || '{"current":0}');
        setCounterValue(counterObj.current || 0);

        // Load costing counter
        const costCount = await costingService.getSystemCounter();
        setCostingCounter(costCount);

        // Load custom settings if any
        const savedUnits = localStorage.getItem("settings_productUnits");
        if (savedUnits) setProductUnits(JSON.parse(savedUnits));

        const savedUrgencies = localStorage.getItem("settings_requestTypes");
        if (savedUrgencies) setRequestTypes(JSON.parse(savedUrgencies));

        const savedSampleTypes = localStorage.getItem("settings_sampleTypes");
        if (savedSampleTypes) setSampleTypes(JSON.parse(savedSampleTypes));
      }
    } catch (err) {
      setError("Failed to fetch system configurations.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCounter = () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      
      const counterKey = `sampleRequestCounter_${currentFy}`;
      localStorage.setItem(counterKey, JSON.stringify({ current: Number(counterValue) }));
      setSuccess("Requisition counter settings updated successfully.");
    } catch (err) {
      setError("Failed to update counter settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCostingCounter = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await costingService.updateSystemCounter(Number(costingCounter));
      setSuccess("Product costing counter updated successfully.");
    } catch (err) {
      setError("Failed to update costing counter settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddUnit = () => {
    if (!newUnit.trim()) return;
    const updated = [...productUnits, newUnit.trim()];
    setProductUnits(updated);
    localStorage.setItem("settings_productUnits", JSON.stringify(updated));
    setNewUnit("");
    setSuccess(`Product unit "${newUnit.trim()}" added.`);
  };

  const handleAddUrgency = () => {
    if (!newUrgency.trim()) return;
    const updated = [...requestTypes, newUrgency.trim()];
    setRequestTypes(updated);
    localStorage.setItem("settings_requestTypes", JSON.stringify(updated));
    setNewUrgency("");
    setSuccess(`Urgency type "${newUrgency.trim()}" added.`);
  };

  const handleAddSampleType = () => {
    if (!newSampleType.trim()) return;
    const updated = [...sampleTypes, newSampleType.trim()];
    setSampleTypes(updated);
    localStorage.setItem("settings_sampleTypes", JSON.stringify(updated));
    setNewSampleType("");
    setSuccess(`Sample type "${newSampleType.trim()}" added.`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
          System Settings
        </Title>
        <Text type="secondary">
          Configure financial year, sample request counters, product units, and urgency priority levels.
        </Text>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
      {success && <Alert message={success} type="success" showIcon closable onClose={() => setSuccess("")} style={{ marginBottom: 24, borderRadius: 8 }} />}

      <Row gutter={[24, 24]}>
        {/* Left Side: Sequence counter settings */}
        <Col xs={24} lg={12}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            
            {/* Sample Requisition Counter Card */}
            <Card 
              title="Sample Requisition FY Counter" 
              bordered={true} 
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
              styles={{ body: { padding: 24 } }}
            >
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Text type="secondary">
                  The Sample Requisition Number is generated using sequence: <strong>{currentFy}-001</strong>. 
                  Below is the current sequence count for financial year <strong>20{currentFy.substring(0,2)}/20{currentFy.substring(2,4)}</strong>.
                </Text>

                <div>
                  <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Active Financial Year</div>
                  <Input value={`FY 20${currentFy.substring(0,2)}/20${currentFy.substring(2,4)} (Code: ${currentFy})`} readOnly size="large" style={{ borderRadius: 8 }} />
                </div>

                <div>
                  <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Current Sequence Counter Value</div>
                  <Input 
                    type="number" 
                    value={counterValue} 
                    onChange={(e) => setCounterValue(Number(e.target.value))} 
                    size="large" 
                    style={{ borderRadius: 8 }} 
                  />
                  <Text type="secondary" style={{ fontSize: "0.8rem", display: "block", marginTop: 4 }}>
                    Changing this value alters the serial segment of the next generated requisition number.
                  </Text>
                </div>

                <div style={{ textAlign: "right", marginTop: 12 }}>
                  <Button
                    type="primary"
                    onClick={handleSaveCounter}
                    loading={saving}
                    icon={<SaveOutlined />}
                    size="large"
                    style={{ 
                      borderRadius: 8, 
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      border: "none",
                      fontWeight: 700
                    }}
                  >
                    Save Settings
                  </Button>
                </div>
              </Space>
            </Card>

            {/* Product Costing Counter Card */}
            <Card 
              title="Product Costing Counter" 
              bordered={true} 
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
              styles={{ body: { padding: 24 } }}
            >
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Text type="secondary">
                  The Costing Request Number is generated using the next sequence number. 
                  Configure the serial value for costing request numbers here.
                </Text>

                <div>
                  <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Current Sequence Counter Value</div>
                  <Input 
                    type="number" 
                    value={costingCounter} 
                    onChange={(e) => setCostingCounter(Number(e.target.value))} 
                    size="large" 
                    style={{ borderRadius: 8 }} 
                  />
                  <Text type="secondary" style={{ fontSize: "0.8rem", display: "block", marginTop: 4 }}>
                    Changing this value alters the serial segment of the next generated costing request.
                  </Text>
                </div>

                <div style={{ textAlign: "right", marginTop: 12 }}>
                  <Button
                    type="primary"
                    onClick={handleSaveCostingCounter}
                    loading={saving}
                    icon={<SaveOutlined />}
                    size="large"
                    style={{ 
                      borderRadius: 8, 
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      border: "none",
                      fontWeight: 700
                    }}
                  >
                    Save Settings
                  </Button>
                </div>
              </Space>
            </Card>

          </Space>
        </Col>

        {/* Right Side: Taxonomy Configurations */}
        <Col xs={24} lg={12}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            
            {/* Product Units list */}
            <Card title="Product Units Management" bordered={true} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {productUnits.map(unit => (
                  <Tag color="cyan" key={unit} style={{ fontSize: "0.85rem", padding: "4px 10px" }}>{unit}</Tag>
                ))}
              </div>
              <Space.Compact style={{ width: "100%" }}>
                <Input 
                  placeholder="Add custom product unit..." 
                  value={newUnit} 
                  onChange={(e) => setNewUnit(e.target.value)} 
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUnit}>Add</Button>
              </Space.Compact>
            </Card>

            {/* Request Type management */}
            <Card title="Request Urgencies" bordered={true} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {requestTypes.map(type => (
                  <Tag color="blue" key={type} style={{ fontSize: "0.85rem", padding: "4px 10px" }}>{type}</Tag>
                ))}
              </div>
              <Space.Compact style={{ width: "100%" }}>
                <Input 
                  placeholder="Add custom urgency priority..." 
                  value={newUrgency} 
                  onChange={(e) => setNewUrgency(e.target.value)} 
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUrgency}>Add</Button>
              </Space.Compact>
            </Card>

            {/* Sample Requisition Type */}
            <Card title="Sample Requisition Types" bordered={true} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {sampleTypes.map(stype => (
                  <Tag color="purple" key={stype} style={{ fontSize: "0.85rem", padding: "4px 10px" }}>{stype}</Tag>
                ))}
              </div>
              <Space.Compact style={{ width: "100%" }}>
                <Input 
                  placeholder="Add custom sample type..." 
                  value={newSampleType} 
                  onChange={(e) => setNewSampleType(e.target.value)} 
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSampleType}>Add</Button>
              </Space.Compact>
            </Card>

          </Space>
        </Col>

      </Row>
    </div>
  );
}

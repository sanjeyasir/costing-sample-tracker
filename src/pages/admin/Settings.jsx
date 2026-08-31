import React, { useEffect, useState } from "react";
import * as sampleService from "../../services/firebase/sampleService";
import * as costingService from "../../services/firebase/costingService";
import { isMockMode } from "../../services/firebase/config";
import { Form, Input, Button, Card, Typography, Alert, Spin, Space, List, Tag, Divider, Row, Col, Select } from "antd";
import { SaveOutlined, PlusOutlined, WhatsAppOutlined, SendOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;

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

  // WhatsApp Config States
  const [waProvider, setWaProvider] = useState("openwa");
  const [waServerUrl, setWaServerUrl] = useState("http://localhost:2785");
  const [waApiKey, setWaApiKey] = useState("");
  const [waSessionId, setWaSessionId] = useState("default");
  const [waGlobalOverride, setWaGlobalOverride] = useState(true);
  const [waOverrideNumber, setWaOverrideNumber] = useState("+94767063788");
  const [testNumber, setTestNumber] = useState("+94767063788");
  const [testMessage, setTestMessage] = useState("Hello from the Costing & Sample Tracking System! This is a test WhatsApp notification.");
  const [sendingTest, setSendingTest] = useState(false);

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

      // Load WhatsApp Config
      let waConfig = { provider: "disabled", openwaConfig: {}, globalOverride: true, overrideNumber: "+94767063788" };
      if (!isMockMode) {
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("../../services/firebase/config");
          const configDoc = await getDoc(doc(db, "systemSettings", "whatsappConfig"));
          if (configDoc.exists()) {
            waConfig = configDoc.data();
          }
        } catch (err) {
          console.error("Failed to load WhatsApp settings from Firestore:", err);
        }
      } else {
        const saved = localStorage.getItem("settings_whatsappConfig");
        if (saved) waConfig = JSON.parse(saved);
      }
      setWaProvider(waConfig.provider || "disabled");
      setWaServerUrl(waConfig.openwaConfig?.serverUrl || "");
      setWaApiKey(waConfig.openwaConfig?.apiKey || "");
      setWaSessionId(waConfig.openwaConfig?.sessionId || "default");
      setWaGlobalOverride(waConfig.globalOverride !== false);
      setWaOverrideNumber(waConfig.overrideNumber || "+94767063788");
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

  const handleSaveWhatsAppConfig = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        provider: waProvider,
        openwaConfig: {
          serverUrl: waServerUrl.trim(),
          apiKey: waApiKey.trim(),
          sessionId: waSessionId.trim() || "default"
        },
        globalOverride: !!waGlobalOverride,
        overrideNumber: waOverrideNumber.trim() || "+94767063788"
      };

      if (isMockMode) {
        localStorage.setItem("settings_whatsappConfig", JSON.stringify(payload));
        setSuccess("WhatsApp configurations saved locally (Mock Mode).");
      } else {
        const { doc, setDoc } = await import("firebase/firestore");
        const { db } = await import("../../services/firebase/config");
        await setDoc(doc(db, "systemSettings", "whatsappConfig"), payload, { merge: true });
        setSuccess("WhatsApp configurations saved securely in Firestore.");
      }
    } catch (err) {
      console.error("Save WhatsApp config error:", err);
      setError("Failed to save WhatsApp configurations: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    if (waGlobalOverride && !waOverrideNumber) {
      return setError("Please specify an override phone number.");
    }
    
    try {
      setSendingTest(true);
      setError("");
      setSuccess("");

      const targetNum = waGlobalOverride ? (waOverrideNumber || "+94767063788") : (testNumber || "+94767063788");
      const title = "Test WhatsApp Dispatch";
      const fullMsg = `*${title}*\n\n${testMessage}\n\n_Hayleys Fibre Test Engine_`;

      if (isMockMode) {
        console.log(`[Mock Send Test] Number: ${targetNum}, Msg: ${fullMsg}`);
        const mockWA = JSON.parse(localStorage.getItem("whatsappLogs") || "[]");
        mockWA.push({
          id: `wa-test-${Date.now()}`,
          to: targetNum,
          message: fullMsg,
          provider: waProvider,
          createdAt: new Date().toISOString(),
          status: "simulated",
          response: "Test simulated successfully"
        });
        localStorage.setItem("whatsappLogs", JSON.stringify(mockWA));
        window.dispatchEvent(new Event("storage"));

        window.dispatchEvent(new CustomEvent("whatsapp_notification_sent", {
          detail: { to: targetNum, name: "Test Contact", message: fullMsg, status: "simulated" }
        }));
        setSuccess(`Test WhatsApp message simulated successfully for ${targetNum}.`);
      } else {
        const { httpsCallable } = await import("firebase/functions");
        const { functions } = await import("../../services/firebase/config");
        const sendWhatsAppFunc = httpsCallable(functions, "sendWhatsAppViaAPI");
        const result = await sendWhatsAppFunc({
          to: targetNum,
          message: fullMsg
        });

        window.dispatchEvent(new CustomEvent("whatsapp_notification_sent", {
          detail: { to: targetNum, name: "Test Contact", message: fullMsg, status: result.data.status }
        }));
        
        setSuccess(`Test WhatsApp message dispatched successfully via Cloud Function (Status: ${result.data.status}).`);
      }
    } catch (err) {
      console.error("Test WhatsApp error:", err);
      setError("Failed to dispatch test WhatsApp message: " + err.message);
    } finally {
      setSendingTest(false);
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

            {/* WhatsApp Integration Card */}
            <Card 
              title={
                <Space>
                  <WhatsAppOutlined style={{ color: "#10b981" }} />
                  <span>WhatsApp Alerts Integration (OpenWA)</span>
                </Space>
              }
              bordered={true} 
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
              styles={{ body: { padding: 24 } }}
            >
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Text type="secondary">
                  Connect the tracking system to a self-hosted <strong>OpenWA (wa-automate)</strong> REST API server to broadcast notifications directly to WhatsApp.
                </Text>

                <div>
                  <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Integration Provider</div>
                  <Select 
                    value={waProvider} 
                    onChange={(val) => setWaProvider(val)}
                    size="large"
                    style={{ width: "100%", borderRadius: 8 }}
                  >
                    <Option value="disabled">Disabled / Simulation Mode</Option>
                    <Option value="openwa">OpenWA (Self-hosted wa-automate API)</Option>
                  </Select>
                </div>

                {waProvider === "openwa" && (
                  <>
                    <div>
                      <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>OpenWA Server URL</div>
                      <Input 
                        placeholder="e.g. http://localhost:2785" 
                        value={waServerUrl} 
                        onChange={(e) => setWaServerUrl(e.target.value)}
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                      <Text type="secondary" style={{ fontSize: "0.8rem", display: "block", marginTop: 4 }}>
                        The URL must include the port (e.g. 2785) but not `/api/sessions...` segment.
                      </Text>
                    </div>

                    <div>
                      <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>API Key (X-API-Key)</div>
                      <Input 
                        type="password"
                        placeholder="Optional API Key (configured with -k)" 
                        value={waApiKey} 
                        onChange={(e) => setWaApiKey(e.target.value)}
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                    </div>

                    <div>
                      <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Session ID</div>
                      <Input 
                        placeholder="default" 
                        value={waSessionId} 
                        onChange={(e) => setWaSessionId(e.target.value)}
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  </>
                )}

                <Divider style={{ margin: "6px 0" }} />

                {/* Global Override Settings */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#475569", fontWeight: 600 }}>Global Override Redirect (For Testing)</div>
                    <Text type="secondary" style={{ fontSize: "0.8rem" }}>
                      Send all system alerts to a single testing number.
                    </Text>
                  </div>
                  <Select
                    value={waGlobalOverride ? "enabled" : "disabled"}
                    onChange={(val) => setWaGlobalOverride(val === "enabled")}
                    style={{ width: 120 }}
                  >
                    <Option value="enabled">Enabled</Option>
                    <Option value="disabled">Disabled</Option>
                  </Select>
                </div>

                {waGlobalOverride && (
                  <div>
                    <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Override Phone Number</div>
                    <Input 
                      placeholder="+94767063788" 
                      value={waOverrideNumber} 
                      onChange={(e) => setWaOverrideNumber(e.target.value)}
                      size="large"
                      style={{ borderRadius: 8 }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                  <Button
                    type="primary"
                    onClick={handleSaveWhatsAppConfig}
                    loading={saving}
                    icon={<SaveOutlined />}
                    size="large"
                    style={{ 
                      borderRadius: 8, 
                      fontWeight: 700 
                    }}
                  >
                    Save Config
                  </Button>
                </div>

                <Divider style={{ margin: "6px 0" }} />

                {/* Test Area */}
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Test Alert Output</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input 
                      placeholder="Enter test message body..." 
                      value={testMessage} 
                      onChange={(e) => setTestMessage(e.target.value)}
                      size="large"
                      style={{ borderRadius: 8, flex: 1 }}
                    />
                    <Button
                      type="primary"
                      onClick={handleSendTestWhatsApp}
                      loading={sendingTest}
                      icon={<SendOutlined />}
                      size="large"
                      style={{ 
                        borderRadius: 8, 
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        border: "none",
                        fontWeight: 700 
                      }}
                    >
                      Send Test
                    </Button>
                  </div>
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

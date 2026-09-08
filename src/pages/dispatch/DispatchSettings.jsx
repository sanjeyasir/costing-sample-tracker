import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Upload,
  Input,
  Row,
  Col,
  Space,
  Typography,
  Divider,
  message,
  Alert,
  Spin,
  Tooltip
} from "antd";
import {
  UploadOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  FileImageOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { DEFAULT_DISPATCH_DATA } from "../../utils/dispatchCalculations";
import { getTemplateConfig, saveTemplateConfig } from "../../services/firebase/dispatchService";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function DispatchSettings() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsData, setSettingsData] = useState(DEFAULT_DISPATCH_DATA);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getTemplateConfig();
      if (data) {
        setSettingsData(data);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      message.error("Failed to load dispatch settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleNestedChange = (parent, field, value) => {
    setSettingsData(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [field]: value
      }
    }));
  };

  const handleSignatureUpload = (file) => {
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      message.error("Please upload an image file (PNG/JPG).");
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setSettingsData(prev => ({
        ...prev,
        sender: {
          ...(prev.sender || {}),
          signatureBase64: base64,
          signatureUrl: base64
        }
      }));
      message.success("Signature image loaded! Click 'Save Settings & Defaults' to persist.");
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleRemoveSignature = () => {
    setSettingsData(prev => ({
      ...prev,
      sender: {
        ...(prev.sender || {}),
        signatureBase64: "",
        signatureUrl: ""
      }
    }));
    message.info("Signature image removed.");
  };

  const handleSaveDefaults = async () => {
    try {
      setSaving(true);
      await saveTemplateConfig(settingsData, currentUser);
      message.success("Dispatch settings, company profile & signature saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      message.error("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Spin size="large" tip="Loading Dispatch Settings..." />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Top Header */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 24px",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <Space align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dispatch-tracker")}>
            Back
          </Button>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Dispatch Settings & Defaults
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Manage official authorized signature PNG and default exporter profile used across all documents
            </Text>
          </div>
        </Space>

        <Space wrap>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            style={{ background: "#000000", borderColor: "#000000" }}
            onClick={handleSaveDefaults}
            loading={saving}
          >
            Save Settings & Defaults
          </Button>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        {/* Central Signature PNG Upload */}
        <Col xs={24}>
          <Card
            title={<span style={{ fontWeight: 600 }}>Official Authorized Signature PNG</span>}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Alert
              message="Central Signature Storage"
              description="Upload a transparent or white-background PNG signature once here. It will automatically appear in the signature block on all generated Commercial Invoices, Phyto Applications, and Export Packing Lists."
              type="success"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div 
                style={{ 
                  width: 260, 
                  height: 110, 
                  border: "1.5px dashed #000000", 
                  borderRadius: 8, 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center",
                  background: "#fafafa",
                  overflow: "hidden"
                }}
              >
                {settingsData.sender?.signatureBase64 || settingsData.sender?.signatureUrl ? (
                  <img 
                    src={settingsData.sender.signatureBase64 || settingsData.sender.signatureUrl} 
                    alt="Authorized Signature" 
                    style={{ maxHeight: "85%", maxWidth: "90%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ textAlign: "center", padding: 12 }}>
                    <FileImageOutlined style={{ fontSize: 24, color: "#9ca3af", marginBottom: 4 }} />
                    <div style={{ fontSize: 12, color: "#6b7280" }}>No signature uploaded</div>
                  </div>
                )}
              </div>

              <Space direction="vertical" size="small">
                <Upload
                  beforeUpload={handleSignatureUpload}
                  showUploadList={false}
                  accept="image/png,image/jpeg"
                >
                  <Button icon={<UploadOutlined />} style={{ borderColor: "#000000", fontWeight: 500 }}>
                    Upload Signature PNG
                  </Button>
                </Upload>

                {(settingsData.sender?.signatureBase64 || settingsData.sender?.signatureUrl) && (
                  <Button danger icon={<DeleteOutlined />} size="small" onClick={handleRemoveSignature}>
                    Remove Signature
                  </Button>
                )}
                
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Recommended: High-contrast PNG with transparent or clear white background.
                </Text>
              </Space>
            </div>
          </Card>
        </Col>

        {/* Default Sender / Exporter Profile */}
        <Col xs={24}>
          <Card
            title={<span style={{ fontWeight: 600 }}>Default Exporter / Company Profile</span>}
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Company Name</label>
                <Input
                  value={settingsData.sender?.companyName}
                  onChange={(e) => handleNestedChange("sender", "companyName", e.target.value)}
                  placeholder="e.g. TOYO CUSHION LANKA (PVT) LTD"
                />
              </Col>
              <Col xs={24} sm={12}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Default Marketing Manager / Signer</label>
                <Input
                  value={settingsData.sender?.name}
                  onChange={(e) => handleNestedChange("sender", "name", e.target.value)}
                  placeholder="e.g. Manura Mohotti"
                />
              </Col>
              <Col xs={24} sm={12}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Designation Text</label>
                <Input
                  value={settingsData.sender?.designation}
                  onChange={(e) => handleNestedChange("sender", "designation", e.target.value)}
                  placeholder="e.g. Manager Marketing"
                />
              </Col>
              <Col xs={24} sm={12}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Signature Printed Text</label>
                <Input
                  value={settingsData.sender?.signatureText}
                  onChange={(e) => handleNestedChange("sender", "signatureText", e.target.value)}
                  placeholder="e.g. Manura Mohotti"
                />
              </Col>
              <Col xs={24}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Full Company Address</label>
                <TextArea
                  rows={2}
                  value={settingsData.sender?.address}
                  onChange={(e) => handleNestedChange("sender", "address", e.target.value)}
                  placeholder="e.g. Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka"
                />
              </Col>
              <Col xs={24} sm={8}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Contact Phone</label>
                <Input
                  value={settingsData.sender?.contact}
                  onChange={(e) => handleNestedChange("sender", "contact", e.target.value)}
                  placeholder="e.g. +9474 216 8231"
                />
              </Col>
              <Col xs={24} sm={8}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Email</label>
                <Input
                  value={settingsData.sender?.email}
                  onChange={(e) => handleNestedChange("sender", "email", e.target.value)}
                  placeholder="e.g. info@hayleysfibre.com"
                />
              </Col>
              <Col xs={24} sm={8}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Origin City</label>
                <Input
                  value={settingsData.sender?.originCity}
                  onChange={(e) => handleNestedChange("sender", "originCity", e.target.value)}
                  placeholder="e.g. COLOMBO, SRI LANKA"
                />
              </Col>
            </Row>

            <Divider />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                style={{ background: "#000000", borderColor: "#000000" }}
                onClick={handleSaveDefaults}
                loading={saving}
              >
                Save Settings & Defaults
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

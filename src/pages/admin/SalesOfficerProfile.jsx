import React, { useState, useEffect } from "react";
import {
  Card,
  Input,
  Button,
  Row,
  Col,
  Typography,
  Divider,
  Upload,
  message,
  Alert,
  Space,
  Spin,
  Tag
} from "antd";
import {
  UserOutlined,
  SaveOutlined,
  UploadOutlined,
  DeleteOutlined,
  FileImageOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  GlobalOutlined
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function SalesOfficerProfile() {
  const { currentUser, updateMySalesOfficerProfile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    designation: "Manager Marketing",
    companyName: "Toyo Cushion Lanka Pvt Ltd",
    companyAddress: "No.25 Foster Lane, Colombo 10, Sri Lanka",
    address: "Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka",
    contact: "",
    email: "",
    country: "Sri Lanka",
    originCity: "COLOMBO, SRI LANKA",
    signatureText: "",
    signatureBase64: "",
    signatureUrl: ""
  });

  // Load active user's sales officer profile on mount
  useEffect(() => {
    if (currentUser) {
      const active = currentUser.salesOfficerProfile || {};
      setProfileData({
        name: active.name || currentUser.displayName || "",
        designation: active.designation || "Manager Marketing",
        companyName: active.companyName || "Toyo Cushion Lanka Pvt Ltd",
        companyAddress: active.companyAddress || "No.25 Foster Lane, Colombo 10, Sri Lanka",
        address: active.address || "Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka",
        contact: active.contact || currentUser.phoneNumber || "+9474 216 8231",
        email: active.email || currentUser.email || "",
        country: active.country || "Sri Lanka",
        originCity: active.originCity || "COLOMBO, SRI LANKA",
        signatureText: active.signatureText || active.name || currentUser.displayName || "",
        signatureBase64: active.signatureBase64 || active.signatureUrl || "",
        signatureUrl: active.signatureUrl || active.signatureBase64 || ""
      });
    }
  }, [currentUser]);

  const handleChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
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
      setProfileData(prev => ({
        ...prev,
        signatureBase64: base64,
        signatureUrl: base64
      }));
      message.success("Signature PNG loaded! Click 'Save Profile' to persist.");
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleRemoveSignature = () => {
    setProfileData(prev => ({
      ...prev,
      signatureBase64: "",
      signatureUrl: ""
    }));
    message.info("Signature image removed.");
  };

  const handleSave = async () => {
    if (!profileData.name?.trim()) {
      message.error("Sales Officer Name is required.");
      return;
    }

    try {
      setSaving(true);
      await updateMySalesOfficerProfile({
        ...profileData,
        name: profileData.name.trim(),
        signatureText: profileData.signatureText?.trim() || profileData.name.trim()
      });
      message.success("Sales Officer profile & signature saved successfully! These details will auto-load on login and populate your dispatches.");
    } catch (err) {
      console.error("Failed to save profile:", err);
      message.error("Failed to save profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header Banner */}
      <div 
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
          borderRadius: 16,
          padding: "24px 32px",
          marginBottom: 24,
          color: "#ffffff",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 26, background: "rgba(255,255,255,0.15)", padding: "6px 12px", borderRadius: 10 }}>✍️</span>
            <div>
              <Title level={3} style={{ color: "#ffffff", margin: 0 }}>My Sales Officer Profile & Signature</Title>
              <Text style={{ color: "#cbd5e1", fontSize: 13 }}>
                Configure your official exporter identity, contact details, and authorized signature. Auto-loaded on login for all Dispatches and Sample Requests.
              </Text>
            </div>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700, borderRadius: 8 }}
          onClick={handleSave}
          loading={saving}
        >
          Save Profile Details
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Officer Information Form */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <UserOutlined style={{ color: "#4f46e5" }} />
                <span style={{ fontWeight: 700 }}>Sales Officer / Signer Details</span>
              </Space>
            }
            bordered={true}
            style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff" }}
            styles={{ body: { padding: 24 } }}
          >
            <Alert
              message="Auto-load Active"
              description="These details will automatically pre-populate as the Sender & Authorized Signer whenever you generate Commercial Invoices, Phyto Applications, and Packing Lists directly from Sample Requests or Dispatch entries."
              type="info"
              showIcon
              style={{ marginBottom: 20, borderRadius: 8 }}
            />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Sales Officer Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <Input
                  size="large"
                  placeholder="e.g. Manura Mohotti"
                  value={profileData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Designation / Job Title
                </label>
                <Input
                  size="large"
                  placeholder="e.g. Manager Marketing"
                  value={profileData.designation}
                  onChange={(e) => handleChange("designation", e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Company / Exporter Name
                </label>
                <Input
                  size="large"
                  placeholder="e.g. Toyo Cushion Lanka Pvt Ltd"
                  value={profileData.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  prefix={<BankOutlined style={{ color: "#94a3b8" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Signature Printed Text
                </label>
                <Input
                  size="large"
                  placeholder="e.g. Manura Mohotti"
                  value={profileData.signatureText}
                  onChange={(e) => handleChange("signatureText", e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Official Exporter Address
                </label>
                <TextArea
                  rows={2}
                  placeholder="e.g. Toyo Cushion Lanka Pvt Ltd. No.25 Foster Lane, Colombo 10, Sri Lanka"
                  value={profileData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Contact Phone / Mobile
                </label>
                <Input
                  size="large"
                  placeholder="e.g. +9474 216 8231"
                  value={profileData.contact}
                  onChange={(e) => handleChange("contact", e.target.value)}
                  prefix={<PhoneOutlined style={{ color: "#94a3b8" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Email Address
                </label>
                <Input
                  size="large"
                  placeholder="e.g. Manura.Mohotti@hayleysfibre.com"
                  value={profileData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Origin Country
                </label>
                <Input
                  size="large"
                  placeholder="e.g. Sri Lanka"
                  value={profileData.country}
                  onChange={(e) => handleChange("country", e.target.value)}
                  prefix={<GlobalOutlined style={{ color: "#94a3b8" }} />}
                  style={{ borderRadius: 8 }}
                />
              </Col>

              <Col xs={24} sm={12}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Origin Port / City
                </label>
                <Input
                  size="large"
                  placeholder="e.g. COLOMBO, SRI LANKA"
                  value={profileData.originCity}
                  onChange={(e) => handleChange("originCity", e.target.value)}
                  style={{ borderRadius: 8 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right Column: Signature PNG Box & Live Document Preview */}
        <Col xs={24} lg={9}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* Signature PNG Card */}
            <Card
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: "#10b981" }} />
                  <span style={{ fontWeight: 700 }}>Authorized Signature PNG</span>
                </Space>
              }
              bordered={true}
              style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff" }}
              styles={{ body: { padding: 24 } }}
            >
              <Paragraph style={{ color: "#64748b", fontSize: 12, marginBottom: 16 }}>
                Upload your transparent or clean white-background signature image. It will appear on all generated Commercial Invoices, Phyto Applications, and Packing Lists.
              </Paragraph>

              <div 
                style={{ 
                  width: "100%", 
                  height: 120, 
                  border: "2px dashed #cbd5e1", 
                  borderRadius: 10, 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  background: "#f8fafc",
                  overflow: "hidden",
                  marginBottom: 16
                }}
              >
                {profileData.signatureBase64 || profileData.signatureUrl ? (
                  <img 
                    src={profileData.signatureBase64 || profileData.signatureUrl} 
                    alt="Authorized Signature" 
                    style={{ maxHeight: "85%", maxWidth: "90%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ textAlign: "center", padding: 12 }}>
                    <FileImageOutlined style={{ fontSize: 32, color: "#94a3b8", marginBottom: 6 }} />
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>No signature image uploaded</div>
                  </div>
                )}
              </div>

              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Upload
                  beforeUpload={handleSignatureUpload}
                  showUploadList={false}
                  accept="image/png,image/jpeg"
                >
                  <Button icon={<UploadOutlined />} style={{ borderRadius: 8, borderColor: "#4f46e5", color: "#4f46e5" }}>
                    Upload Signature PNG
                  </Button>
                </Upload>

                {(profileData.signatureBase64 || profileData.signatureUrl) && (
                  <Button danger icon={<DeleteOutlined />} onClick={handleRemoveSignature} style={{ borderRadius: 8 }}>
                    Remove
                  </Button>
                )}
              </Space>
            </Card>

            {/* Document Signature Stamp Preview */}
            <Card
              title={<span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>Live Invoice Sign-off Preview</span>}
              bordered={true}
              style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#fdfbf7" }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, background: "#ffffff" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                  For and on behalf of {profileData.companyName || "TOYO CUSHION LANKA (PVT) LTD"}:
                </div>
                <div style={{ height: 50, display: "flex", alignItems: "center", marginBottom: 4 }}>
                  {profileData.signatureBase64 || profileData.signatureUrl ? (
                    <img
                      src={profileData.signatureBase64 || profileData.signatureUrl}
                      alt="Signature"
                      style={{ maxHeight: 45, maxWidth: 140, objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ fontStyle: "italic", color: "#94a3b8", fontSize: 13 }}>[Signature Image Here]</span>
                  )}
                </div>
                <div style={{ borderTop: "1px solid #000000", width: 180, paddingTop: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#000000" }}>
                    {profileData.signatureText || profileData.name || "Authorized Signatory"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {profileData.designation || "Manager Marketing"}
                  </div>
                </div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

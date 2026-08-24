import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Form, Input, Button, Card, Typography, Alert, Spin } from "antd";
import { MailOutlined, ArrowLeftOutlined, KeyOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function ForgotPassword() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { resetPassword } = useAuth();

  const onFinish = async (values) => {
    const { email } = values;
    try {
      setMessage("");
      setError("");
      setLoading(true);
      await resetPassword(email);
      setMessage("Your password reset request has been submitted to the administrator.");
    } catch (err) {
      let errMsg = err.message || "";
      if (errMsg.includes("user-not-found") || errMsg.includes("Email not registered")) {
        errMsg = "No account found with this email address.";
      } else {
        errMsg = errMsg.replace(/^Error:\s*/, "") || "Failed to submit request.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 50%), #f8fafc",
      padding: "24px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Decorative Blur Blobs */}
      <div style={{
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: "50%",
        filter: "blur(80px)",
        background: "rgba(99, 102, 241, 0.08)",
        top: "-10%",
        left: "5%",
        zIndex: 0
      }} />
      <div style={{
        position: "absolute",
        width: 400,
        height: 400,
        borderRadius: "50%",
        filter: "blur(100px)",
        background: "rgba(16, 185, 129, 0.04)",
        bottom: "-10%",
        right: "5%",
        zIndex: 0
      }} />

      <Card 
        bordered={true}
        style={{ 
          width: "100%", 
          maxWidth: 450, 
          borderRadius: 20, 
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          zIndex: 1
        }}
        styles={{ body: { padding: "40px 32px" } }}
      >
        <Spin spinning={loading} size="large" tip="Processing...">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 32 }}>
            <div style={{
              backgroundColor: "#6366f1",
              borderRadius: "16px",
              padding: "12px",
              display: "flex",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
              marginBottom: 16
            }}>
              <KeyOutlined style={{ color: "#fff", fontSize: 32 }} />
            </div>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: 0.5 }}>
              Reset Password
            </Title>
            <Text type="secondary" style={{ marginTop: 4, lineHeight: 1.4 }}>
              Enter your email below. Your administrator will be notified to approve the reset request.
            </Text>
          </div>

          {error && (
            <Alert 
              message={error} 
              type="error" 
              showIcon 
              style={{ marginBottom: 24, borderRadius: 8 }} 
            />
          )}

          {message && (
            <Alert 
              message={message} 
              type="success" 
              showIcon 
              style={{ marginBottom: 24, borderRadius: 8 }} 
            />
          )}

          <Form
            name="forgot_password_form"
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
          >
            <Form.Item
              name="email"
              label={<span style={{ color: "#475569", fontWeight: 600 }}>Email Address</span>}
              rules={[
                { required: true, message: "Please enter your email address." },
                { type: "email", message: "Please enter a valid email address." }
              ]}
            >
              <Input 
                prefix={<MailOutlined style={{ color: "rgba(0,0,0,0.4)" }} />} 
                placeholder="email@example.com" 
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                size="large" 
                block
                style={{ 
                  height: 48, 
                  borderRadius: 8, 
                  fontWeight: 700, 
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)"
                }}
              >
                Send Reset Request
              </Button>
            </Form.Item>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <Link to="/login" style={{ color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <ArrowLeftOutlined /> Back to Login
              </Link>
            </div>
          </Form>
        </Spin>
      </Card>
    </div>
  );
}

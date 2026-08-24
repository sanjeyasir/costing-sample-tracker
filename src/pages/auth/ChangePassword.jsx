import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as authService from "../../services/firebase/authService";
import { Form, Input, Button, Card, Typography, Alert, Spin } from "antd";
import { LockOutlined, SafetyCertificateOutlined, CheckCircleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function ChangePassword() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const onFinish = async (values) => {
    const { password, confirmPassword } = values;
    if (password.length < 6) {
      return setError("For security, password must be at least 6 characters long.");
    }
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    try {
      setError("");
      setLoading(true);
      await authService.updateUserPassword(password);
      
      // Do not log out here, otherwise ProtectedRoute redirects to login immediately.
      setIsSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = async () => {
    try {
      setLoading(true);
      await logout();
      window.location.href = "/login";
    } catch (err) {
      window.location.href = "/login";
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
        {isSuccess ? (
          // Success State View
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{
              backgroundColor: "#10b981",
              borderRadius: "50%",
              padding: "16px",
              display: "flex",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
              marginBottom: 24
            }}>
              <CheckCircleOutlined style={{ color: "#fff", fontSize: 40 }} />
            </div>
            
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: 0.5, marginBottom: 12 }}>
              Password Updated!
            </Title>
            
            <Text type="secondary" style={{ fontSize: "1.05rem", lineHeight: 1.5, marginBottom: 32, display: "block" }}>
              Your temporary password has been successfully replaced. Please sign in again using your new credentials.
            </Text>

            <Button 
              type="primary" 
              size="large" 
              block
              loading={loading}
              onClick={handleGoToLogin}
              style={{ 
                height: 48, 
                borderRadius: 8, 
                fontWeight: 700, 
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                border: "none",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)"
              }}
            >
              Go to Login Page
            </Button>
          </div>
        ) : (
          // Form Entry View
          <Spin spinning={loading} size="large" tip="Updating Password...">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 32 }}>
              <div style={{
                backgroundColor: "#6366f1",
                borderRadius: "16px",
                padding: "12px",
                display: "flex",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                marginBottom: 16
              }}>
                <SafetyCertificateOutlined style={{ color: "#fff", fontSize: 32 }} />
              </div>
              <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: 0.5 }}>
                Reset Password Required
              </Title>
              <Text type="secondary" style={{ marginTop: 4, lineHeight: 1.4 }}>
                An Administrator created your account. Please set your new custom password to continue.
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

            <Form
              name="change_password_form"
              layout="vertical"
              requiredMark={false}
              onFinish={onFinish}
            >
              <Form.Item
                name="password"
                label={<span style={{ color: "#475569", fontWeight: 600 }}>New Password</span>}
                rules={[
                  { required: true, message: "Please enter your new password." },
                  { min: 6, message: "Password must be at least 6 characters." }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined style={{ color: "rgba(0,0,0,0.4)" }} />} 
                  placeholder="New Password (min 6 characters)" 
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={<span style={{ color: "#475569", fontWeight: 600 }}>Confirm New Password</span>}
                rules={[{ required: true, message: "Please confirm your new password." }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: "rgba(0,0,0,0.4)" }} />}
                  placeholder="Confirm Password"
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  size="large" 
                  block
                  style={{ 
                    height: 48, 
                    borderRadius: 8, 
                    fontWeight: 700, 
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
                  }}
                >
                  Update & Continue
                </Button>
              </Form.Item>

              <Button 
                type="text" 
                onClick={logout} 
                block
                style={{ color: "#64748b", fontWeight: 600, height: 40 }}
              >
                Cancel & Sign Out
              </Button>
            </Form>
          </Spin>
        )}
      </Card>
    </div>
  );
}

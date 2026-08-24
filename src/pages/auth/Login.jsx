import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Form, Input, Button, Card, Typography, Alert, Spin } from "antd";
import { MailOutlined, LockOutlined, BranchesOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any previous active auth sessions on mount to avoid stale session state
    logout().catch(err => console.error("Stale session clear error:", err));
  }, []);

  const onFinish = async (values) => {
    const { email, password } = values;
    try {
      setError("");
      setLoading(true);
      const user = await login(email, password);
      if (user && user.requirePasswordChange) {
        navigate("/change-password");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      let errMsg = err.message || "";
      if (errMsg.includes("user-not-found") || errMsg.includes("User not found")) {
        errMsg = "No account found with this email address.";
      } else if (errMsg.includes("wrong-password") || errMsg.includes("password you entered is incorrect")) {
        errMsg = "Incorrect password. Please try again.";
      } else if (errMsg.includes("user-disabled") || errMsg.includes("deactivated")) {
        errMsg = "This user account has been deactivated by an Administrator.";
      } else {
        errMsg = errMsg.replace(/^Error:\s*/, "") || "Login failed. Please check your credentials and try again.";
      }
      setError(errMsg);
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
        <Spin spinning={loading} size="large" tip="Signing In...">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 32 }}>
            <div style={{
              backgroundColor: "#10b981", // Emerald green for organic/fibre brand
              borderRadius: "16px",
              padding: "12px",
              display: "flex",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
              marginBottom: 16
            }}>
              <BranchesOutlined style={{ color: "#fff", fontSize: 32 }} />
            </div>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: 0.5 }}>
              Hayfibre Marketing Operations
            </Title>
            <Text type="secondary" style={{ marginTop: 4 }}>
              Integrated Costing & Sample Requisition Hub
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
            name="login_form"
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

            <Form.Item
              name="password"
              label={<span style={{ color: "#475569", fontWeight: 600 }}>Password</span>}
              rules={[{ required: true, message: "Please enter your password." }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "rgba(0,0,0,0.4)" }} />}
                placeholder="••••••••"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
              <Link to="/forgot-password" style={{ color: "#10b981", fontWeight: 600 }}>
                Forgot Password?
              </Link>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
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
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
}

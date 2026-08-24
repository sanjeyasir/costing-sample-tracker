import React, { useEffect, useState } from "react";
import * as userService from "../../services/firebase/userService";
import { Table, Select, Switch, Alert, Spin, Button, Modal, Form, Input, Card, Space, Typography, Row, Col, Tabs, Tag, Checkbox } from "antd";
import { UserAddOutlined, LockOutlined, MailOutlined, SafetyOutlined, FolderAddOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { getPendingPasswordResets, approvePasswordReset } from "../../services/firebase/authService";

const { Title, Text } = Typography;
const { Option } = Select;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create User Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [resetRequests, setResetRequests] = useState([]);
  const [loadingResets, setLoadingResets] = useState(false);

  // Role management States
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [roleError, setRoleError] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleModule, setRoleModule] = useState("costing");
  const [roleType, setRoleType] = useState("creator");
  
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();

    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUsers(),
        loadRoles(),
        loadResetRequests()
      ]);
    } catch (err) {
      console.error("Error loading users administration data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadResetRequests = async () => {
    try {
      setLoadingResets(true);
      const data = await getPendingPasswordResets();
      setResetRequests(data);
    } catch (err) {
      console.error("Error loading reset requests:", err);
    } finally {
      setLoadingResets(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await userService.getUserRoles();
      setAvailableRoles(data);
    } catch (err) {
      console.error("Error loading roles:", err);
    }
  };

  const handleApproveReset = async (requestId, email) => {
    try {
      setError("");
      setSuccess("");
      await approvePasswordReset(requestId);
      setSuccess(`Password reset email successfully sent to ${email}.`);
      loadResetRequests();
    } catch (err) {
      console.error("Error approving reset:", err);
      setError(err.message || "Failed to approve password reset request.");
    }
  };

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to fetch users list.");
    }
  };

  const handleModuleRoleChange = async (uid, costingRoles, sampleRoles) => {
    try {
      setError("");
      setSuccess("");
      await userService.updateUserModuleRoles(uid, costingRoles, sampleRoles);
      setSuccess("User roles updated successfully.");
      
      // Update local state
      setUsers(prev => prev.map(u => u.uid === uid ? { 
        ...u, 
        costingRoles, 
        sampleRoles, 
        costingRole: costingRoles[0] || "none",
        sampleRole: sampleRoles[0] || "none",
        role: [...costingRoles, ...sampleRoles].filter(r => r && r !== "none") 
      } : u));
    } catch (err) {
      setError("Failed to update user roles.");
    }
  };

  const handleStatusToggle = async (uid, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      setError("");
      setSuccess("");
      await userService.updateUserStatus(uid, newStatus);
      setSuccess(`User marked as ${newStatus} successfully.`);
      
      // Update local state
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, status: newStatus } : u));
    } catch (err) {
      setError("Failed to update user status.");
    }
  };

  const handleCreateUserSubmit = async (values) => {
    const { displayName, email, password, costingRoles, sampleRoles } = values;
    try {
      setCreateError("");
      setCreateLoading(true);

      const result = await userService.createUser({
        displayName,
        email,
        password,
        costingRoles,
        sampleRoles
      });

      if (result.success) {
        setSuccess(`User account ${email} created successfully.`);
        setOpenDialog(false);
        form.resetFields();
        loadUsers();
      }
    } catch (err) {
      console.error("Error creating user:", err);
      setCreateError(err.message?.replace(/^Error:\s*/, "") || "Failed to create user account.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateRoleSubmit = async () => {
    if (!newRoleName.trim()) {
      return setRoleError("Role Name is required.");
    }

    try {
      setRoleError("");
      setRoleLoading(true);
      
      await userService.createUserRole({ 
        name: newRoleName.trim(),
        module: roleModule,
        roleType: roleType,
        permissions: [roleModule]
      });
      
      setSuccess(`Custom role "${newRoleName.trim()}" created successfully.`);
      setNewRoleName("");
      setRoleModule("costing");
      setRoleType("creator");
      setOpenRoleDialog(false);
      loadRoles();
    } catch (err) {
      setRoleError(err.message || "Failed to create custom role.");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    Modal.confirm({
      title: "Delete Custom Role",
      content: `Are you sure you want to delete the role "${roleName}"? Users with this role assigned will no longer have it.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          setError("");
          setSuccess("");
          await userService.deleteUserRole(roleId);
          setSuccess(`Custom role "${roleName}" deleted successfully.`);
          loadRoles();
          loadUsers(); // reload users to sync any removed roles
        } catch (err) {
          setError(err.message || "Failed to delete role.");
        }
      }
    });
  };

  if (loading && users.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading users management dashboard..." />
      </div>
    );
  }

  const userColumns = [
    {
      title: "Name",
      dataIndex: "displayName",
      key: "displayName",
      render: (text) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{text || "N/A"}</span>
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email"
    },
    {
      title: "Costing Module Roles",
      key: "costingRoles",
      render: (_, record) => {
        const costingRoles = availableRoles.filter(r => r.module === "costing" || r.id === "admin");
        const val = record.costingRoles || (record.costingRole && record.costingRole !== "none" ? [record.costingRole] : []);
        return (
          <Select
            mode="multiple"
            value={val}
            onChange={(vals) => handleModuleRoleChange(record.uid, vals, record.sampleRoles || (record.sampleRole && record.sampleRole !== "none" ? [record.sampleRole] : []))}
            style={{ width: "100%", minWidth: 180 }}
            placeholder="Costing roles"
          >
            {costingRoles.map((role) => (
              <Option key={role.id} value={role.id}>
                {role.name}
              </Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: "Sample Module Roles",
      key: "sampleRoles",
      render: (_, record) => {
        const sampleRoles = availableRoles.filter(r => r.module === "sample" || r.id === "admin");
        const val = record.sampleRoles || (record.sampleRole && record.sampleRole !== "none" ? [record.sampleRole] : []);
        return (
          <Select
            mode="multiple"
            value={val}
            onChange={(vals) => handleModuleRoleChange(record.uid, record.costingRoles || (record.costingRole && record.costingRole !== "none" ? [record.costingRole] : []), vals)}
            style={{ width: "100%", minWidth: 180 }}
            placeholder="Sample roles"
          >
            {sampleRoles.map((role) => (
              <Option key={role.id} value={role.id}>
                {role.name}
              </Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => (
        <Switch
          checked={record.status === "active"}
          onChange={() => handleStatusToggle(record.uid, record.status)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
        />
      )
    }
  ];

  const resetColumns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{text}</span>
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email"
    },
    {
      title: "Requested Date",
      dataIndex: "requestedAt",
      key: "requestedAt",
      render: (date) => date ? new Date(date).toLocaleString() : "N/A"
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          onClick={() => handleApproveReset(record.id, record.email)}
          style={{ borderRadius: 6, borderColor: "#10b981", color: "#10b981" }}
        >
          Approve & Send Reset Link
        </Button>
      )
    }
  ];

  const roleColumns = [
    {
      title: "Role ID",
      dataIndex: "id",
      key: "id",
      render: (id) => <Text code>{id}</Text>
    },
    {
      title: "Role Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{text}</span>
    },
    {
      title: "Module Association",
      key: "module",
      render: (_, record) => {
        const isCore = ["admin", "costing_marketing", "costing_finance", "costing_viewer", "sample_marketing", "sample_sampling", "sample_viewer"].includes(record.id);
        if (record.id === "admin") return <Tag color="green">Global Module</Tag>;
        const mod = record.module || (isCore ? (record.id.startsWith("costing") ? "costing" : "sample") : "global");
        if (mod === "costing") return <Tag color="cyan">Costing Module</Tag>;
        if (mod === "sample") return <Tag color="blue">Sample Module</Tag>;
        return <Tag color="orange">Global / Admin</Tag>;
      }
    },
    {
      title: "View/Access Type",
      key: "roleType",
      render: (_, record) => {
        const isCore = ["costing_marketing", "costing_finance", "costing_viewer", "sample_marketing", "sample_sampling", "sample_viewer"].includes(record.id);
        let type = record.roleType;
        if (isCore) {
          if (record.id.endsWith("marketing")) type = "creator";
          else if (record.id.endsWith("finance")) type = "analyst";
          else if (record.id.endsWith("sampling")) type = "developer";
          else if (record.id.endsWith("viewer")) type = "viewer";
        }
        if (record.id === "admin") type = "administrator";
        
        switch (type) {
          case "creator": return <Tag color="orange">Marketing / Creator</Tag>;
          case "analyst": return <Tag color="purple">Finance / Analyst</Tag>;
          case "developer": return <Tag color="green">Sampling / Developer</Tag>;
          case "viewer": return <Tag color="gray">Auditor / Viewer</Tag>;
          case "administrator": return <Tag color="red">Full Access</Tag>;
          default: return <Tag>{type || "N/A"}</Tag>;
        }
      }
    },
    {
      title: "Role Type",
      key: "type",
      render: (_, record) => {
        const isCore = ["admin", "costing_marketing", "costing_finance", "costing_viewer", "sample_marketing", "sample_sampling", "sample_viewer"].includes(record.id);
        return <Tag color={isCore ? "blue" : "purple"}>{isCore ? "System Core" : "Custom Role"}</Tag>;
      }
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, record) => {
        if (record.id === "admin") return <Text type="secondary" style={{ fontSize: "0.85rem" }}>System Protected</Text>;
        return (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRole(record.id, record.name)}
          />
        );
      }
    }
  ];

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
          User & Roles Management
        </Title>
        <Text type="secondary">
          Manage user credentials, assign multi-role security accesses, and define custom business roles.
        </Text>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
      {success && <Alert message={success} type="success" showIcon closable onClose={() => setSuccess("")} style={{ marginBottom: 24, borderRadius: 8 }} />}

      <Tabs defaultActiveKey="users" type="line" size="large">
        {/* TAB 1: User Management */}
        <Tabs.TabPane tab="User Management" key="users">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24, marginTop: 12 }}>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setOpenDialog(true)}
              size="large"
              style={{
                borderRadius: 8,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                border: "none",
                fontWeight: 700
              }}
            >
              Add User Account
            </Button>
          </div>

          <Card 
            bordered={true} 
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 24 }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={users}
              columns={userColumns}
              rowKey="uid"
              pagination={false}
              style={{ background: "transparent" }}
            />
          </Card>

          {/* Pending Password Reset Requests Section */}
          <Card 
            bordered={true}
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            styles={{ body: { padding: 24 } }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <SafetyOutlined style={{ color: "#10b981", fontSize: 20 }} />
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                Pending Password Reset Requests
              </Title>
            </div>
            <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
              Review and approve user requests to reset passwords. Approving will trigger the reset flow.
            </Text>

            <Table
              dataSource={resetRequests}
              columns={resetColumns}
              rowKey="id"
              pagination={false}
              loading={loadingResets}
              locale={{ emptyText: "No pending password reset requests." }}
              style={{ background: "transparent" }}
            />
          </Card>
        </Tabs.TabPane>

        {/* TAB 2: Roles Management */}
        <Tabs.TabPane tab="Roles Management" key="roles">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24, marginTop: 12 }}>
            <Button
              type="primary"
              icon={<FolderAddOutlined />}
              onClick={() => { setOpenRoleDialog(true); setRoleError(""); }}
              size="large"
              style={{
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                border: "none",
                fontWeight: 700
              }}
            >
              Add Custom Role
            </Button>
          </div>

          <Card 
            bordered={true} 
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={availableRoles}
              columns={roleColumns}
              rowKey="id"
              pagination={false}
              style={{ background: "transparent" }}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* Add User Dialog Modal */}
      <Modal
        title="Register New User"
        open={openDialog}
        onCancel={() => setOpenDialog(false)}
        footer={null}
        width={450}
        centered
        styles={{ content: { borderRadius: 16, background: "#ffffff" } }}
      >
        {createError && <Alert message={createError} type="error" showIcon style={{ marginBottom: 20 }} />}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUserSubmit}
          requiredMark={true}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="displayName"
            label={<span style={{ color: "#475569", fontWeight: 600 }}>Full Name</span>}
            rules={[{ required: true, message: "Full Name is required." }]}
          >
            <Input placeholder="John Doe" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span style={{ color: "#475569", fontWeight: 600 }}>Email Address</span>}
            rules={[
              { required: true, message: "Email address is required." },
              { type: "email", message: "Please enter a valid email." }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="john@costing.com" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: "#475569", fontWeight: 600 }}>Temporary Password</span>}
            rules={[
              { required: true, message: "Temporary password is required." },
              { min: 6, message: "Password must be at least 6 characters." }
            ]}
            help="User will be forced to change it on first login."
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="costingRoles"
            label={<span style={{ color: "#475569", fontWeight: 600 }}>Costing Module Roles</span>}
            initialValue={["costing_marketing"]}
            rules={[{ required: true, message: "Please select at least one costing role." }]}
          >
            <Select mode="multiple" placeholder="Select Costing roles" size="large" style={{ width: "100%", borderRadius: 8 }}>
              {availableRoles.filter(r => r.module === "costing" || r.id === "admin").map((role) => (
                <Option key={role.id} value={role.id}>
                  {role.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="sampleRoles"
            label={<span style={{ color: "#475569", fontWeight: 600 }}>Sample Module Roles</span>}
            initialValue={["sample_marketing"]}
            rules={[{ required: true, message: "Please select at least one sample role." }]}
          >
            <Select mode="multiple" placeholder="Select Sample roles" size="large" style={{ width: "100%", borderRadius: 8 }}>
              {availableRoles.filter(r => r.module === "sample" || r.id === "admin").map((role) => (
                <Option key={role.id} value={role.id}>
                  {role.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: "right", marginTop: 24 }}>
            <Space>
              <Button onClick={() => setOpenDialog(false)} style={{ borderRadius: 8 }}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createLoading}
                style={{ 
                  borderRadius: 8, 
                  fontWeight: 700, 
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none"
                }}
              >
                Create Account
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Role Dialog Modal */}
      <Modal
        title="Add Custom Role"
        open={openRoleDialog}
        onCancel={() => setOpenRoleDialog(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpenRoleDialog(false)} style={{ borderRadius: 8 }}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleCreateRoleSubmit}
            loading={roleLoading}
            style={{ 
              borderRadius: 8, 
              fontWeight: 700, 
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              border: "none"
            }}
          >
            Create Role
          </Button>
        ]}
        width={380}
        centered
        styles={{ content: { borderRadius: 16, background: "#ffffff" } }}
      >
        {roleError && <Alert message={roleError} type="error" showIcon style={{ marginBottom: 20 }} />}
        
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Role Name</div>
            <Input 
              placeholder="e.g. Costing Viewer, Auditor" 
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Select Module Association</div>
            <Select 
              value={roleModule} 
              onChange={(val) => {
                setRoleModule(val);
                setRoleType("creator");
              }}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
            >
              <Option value="costing">Costing Management Module</Option>
              <Option value="sample">Sample Requisitions Module</Option>
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Select Access/View Type</div>
            <Select 
              value={roleType} 
              onChange={(val) => setRoleType(val)}
              size="large"
              style={{ width: "100%", borderRadius: 8 }}
            >
              {roleModule === "costing" ? (
                <>
                  <Option value="creator">Marketing View (Create & View Requests)</Option>
                  <Option value="analyst">Finance View (Perform Costing & View)</Option>
                  <Option value="viewer">Auditor View (Read-Only View)</Option>
                </>
              ) : (
                <>
                  <Option value="creator">Marketing View (Create, Edit & View Requests)</Option>
                  <Option value="developer">Sampling Team View (Develop, Complete & View)</Option>
                  <Option value="viewer">Auditor View (Read-Only View)</Option>
                </>
              )}
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

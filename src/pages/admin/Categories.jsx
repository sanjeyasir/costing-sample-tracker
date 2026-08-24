import React, { useEffect, useState } from "react";
import * as costingService from "../../services/firebase/costingService";
import {
  Row,
  Col,
  Card,
  Typography,
  Input,
  Button,
  Table,
  Tag,
  Alert,
  Spin,
  Space,
  Switch,
  Select,
  Divider,
  Modal,
  Tooltip
} from "antd";
import { PlusOutlined, DeleteOutlined, FolderAddOutlined, EditOutlined, ExclamationCircleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal States
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null); // null means creating, string means editing
  const [dialogError, setDialogError] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [fields, setFields] = useState([
    { key: "description", label: "Product Description", type: "text", required: true, owner: "marketing" }
  ]);

  // Field creation states
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldOwner, setFieldOwner] = useState("marketing");
  const [fieldRequired, setFieldRequired] = useState(true);
  const [fieldOptions, setFieldOptions] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await costingService.getProductCategories();
      setCategories(data);
    } catch (err) {
      setError("Failed to fetch product categories.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingCategoryId(null);
    setNewCatName("");
    setFields([
      { key: "description", label: "Product Description", type: "text", required: true, owner: "marketing" }
    ]);
    setDialogError("");
    setFieldLabel("");
    setFieldOptions("");
    setFieldType("text");
    setFieldOwner("marketing");
    setFieldRequired(true);
    setOpenDialog(true);
  };

  const handleOpenEditDialog = (category) => {
    setEditingCategoryId(category.id);
    setNewCatName(category.name);
    setFields(category.fields || []);
    setDialogError("");
    setFieldLabel("");
    setFieldOptions("");
    setFieldType("text");
    setFieldOwner("marketing");
    setFieldRequired(true);
    setOpenDialog(true);
  };

  const handleDeleteCategory = (category) => {
    Modal.confirm({
      title: "Delete Product Category",
      icon: <ExclamationCircleOutlined style={{ color: "#ef4444" }} />,
      content: `Are you sure you want to delete the category "${category.name}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          setError("");
          setSuccess("");
          await costingService.deleteProductCategory(category.id);
          setSuccess(`Category "${category.name}" deleted successfully.`);
          loadCategories();
        } catch (err) {
          setError(err.message || "Failed to delete product category.");
        }
      }
    });
  };

  const handleAddField = () => {
    setDialogError("");
    if (!fieldLabel.trim()) {
      return setDialogError("Field label is required.");
    }
    const key = fieldLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) {
      return setDialogError("Invalid field label. Use alphanumeric characters.");
    }
    
    // Check if key already exists
    if (fields.some(f => f.key === key)) {
      return setDialogError("A field with this name already exists in this category.");
    }

    if (fieldType === "select" && !fieldOptions.trim()) {
      return setDialogError("Dropdown Choice List requires comma-separated options.");
    }

    const newField = {
      key,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      owner: fieldOwner
    };

    if (fieldType === "select") {
      newField.options = fieldOptions.split(",").map(o => o.trim()).filter(Boolean);
    }

    setFields([...fields, newField]);
    setFieldLabel("");
    setFieldOptions("");
  };

  const handleRemoveField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return setDialogError("Category Name is required.");
    if (fields.length === 0) return setDialogError("Please add at least one specification field.");

    try {
      setDialogError("");
      setError("");
      setSuccess("");

      if (editingCategoryId) {
        // Edit Mode
        await costingService.updateProductCategory(editingCategoryId, {
          name: newCatName.trim(),
          fields
        });
        setSuccess(`Category "${newCatName.trim()}" updated successfully.`);
      } else {
        // Create Mode
        await costingService.createProductCategory({
          name: newCatName.trim(),
          fields
        });
        setSuccess(`Category "${newCatName.trim()}" registered successfully.`);
      }
      
      setOpenDialog(false);
      loadCategories();
    } catch (err) {
      setDialogError(err.message || "Failed to save category.");
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading categories..." />
      </div>
    );
  }

  const categoryTableColumns = [
    { title: "Field Label", dataIndex: "label", key: "label", render: (t) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{t}</span> },
    { title: "Type", dataIndex: "type", key: "type" },
    { 
      title: "Owner", 
      dataIndex: "owner", 
      key: "owner", 
      render: (owner) => (
        <Tag color={owner === "marketing" ? "cyan" : "purple"} style={{ textTransform: "capitalize", fontWeight: 600 }}>
          {owner}
        </Tag>
      )
    },
    { title: "Required", dataIndex: "required", key: "required", render: (req) => req ? "Yes" : "No" }
  ];

  const reviewTableColumns = [
    { title: "Label", dataIndex: "label", key: "label", render: (t) => <span style={{ fontWeight: 600, color: "#0f172a" }}>{t}</span> },
    { title: "Type", dataIndex: "type", key: "type" },
    { title: "Owner", dataIndex: "owner", key: "owner", render: (o) => <span style={{ textTransform: "capitalize" }}>{o}</span> },
    { 
      title: "Action", 
      key: "action", 
      align: "right",
      render: (_, record, index) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleRemoveField(index)}
          disabled={record.key === "description"}
        />
      )
    }
  ];

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 32 }}>
        <Col>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>
            Product Categories
          </Title>
          <Text type="secondary">
            Manage custom forms and dynamic fields for costing sheets.
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<FolderAddOutlined />}
            onClick={handleOpenCreateDialog}
            size="large"
            style={{ 
              borderRadius: 8, 
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
              fontWeight: 700 
            }}
          >
            Add Category
          </Button>
        </Col>
      </Row>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
      {success && <Alert message={success} type="success" showIcon closable onClose={() => setSuccess("")} style={{ marginBottom: 24, borderRadius: 8 }} />}

      {/* Grid of categories */}
      <Row gutter={[24, 24]}>
        {(categories || []).map((cat) => (
          <Col xs={24} lg={12} key={cat.id}>
            <Card 
              title={<span style={{ color: "#0f172a" }}>{cat.name}</span>} 
              bordered={true} 
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
              extra={
                <Space>
                  <Tooltip title="Edit Category">
                    <Button 
                      type="text" 
                      icon={<EditOutlined style={{ color: "#6366f1" }} />} 
                      onClick={() => handleOpenEditDialog(cat)} 
                    />
                  </Tooltip>
                  <Tooltip title="Delete Category">
                    <Button 
                      type="text" 
                      danger
                      icon={<DeleteOutlined />} 
                      onClick={() => handleDeleteCategory(cat)} 
                    />
                  </Tooltip>
                </Space>
              }
            >
              <Table 
                dataSource={cat.fields || []}
                columns={categoryTableColumns}
                rowKey="key"
                pagination={false}
                size="small"
                style={{ background: "transparent" }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Add / Edit Category Dialog Modal */}
      <Modal
        title={editingCategoryId ? "Edit Product Category" : "Add Product Category"}
        open={openDialog}
        onCancel={() => setOpenDialog(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpenDialog(false)} style={{ borderRadius: 8 }}>
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            onClick={handleSaveCategory} 
            disabled={!newCatName || fields.length === 0}
            style={{ 
              borderRadius: 8,
              fontWeight: 700, 
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none"
            }}
          >
            {editingCategoryId ? "Save Changes" : "Create Category"}
          </Button>
        ]}
        width={900}
        centered
        styles={{ content: { borderRadius: 16, background: "#ffffff" } }}
      >
        {dialogError && <Alert message={dialogError} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
        
        <Row gutter={24} style={{ marginTop: 16 }}>
          {/* Left Side: Field Definer Form */}
          <Col xs={24} md={10}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <div>
                <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Category Name</div>
                <Input 
                  placeholder="e.g., Bedding, Horticulture" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </div>

              <Divider style={{ margin: "12px 0" }} />
              
              <Text strong style={{ color: "#0f172a", display: "block" }}>Define New Field</Text>

              <div>
                <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Field Label</div>
                <Input 
                  placeholder="e.g., NC/RC Ratio, GSM" 
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Field Type</div>
                <Select
                  value={fieldType}
                  onChange={(val) => setFieldType(val)}
                  size="large"
                  style={{ width: "100%", borderRadius: 8 }}
                >
                  <Option value="text">Text Input</Option>
                  <Option value="number">Number</Option>
                  <Option value="textarea">Multi-line Text</Option>
                  <Option value="select">Dropdown Choice List</Option>
                </Select>
              </div>

              {fieldType === "select" && (
                <div>
                  <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Options (Comma separated)</div>
                  <Input 
                    placeholder="Organic, Non-Organic" 
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    size="large"
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}

              <div>
                <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>Field Owner</div>
                <Select
                  value={fieldOwner}
                  onChange={(val) => setFieldOwner(val)}
                  size="large"
                  style={{ width: "100%", borderRadius: 8 }}
                >
                  <Option value="marketing">Marketing (Input on Request)</Option>
                  <Option value="finance">Finance (Input during Costing)</Option>
                </Select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Switch checked={fieldRequired} onChange={(val) => setFieldRequired(val)} />
                <span style={{ color: "#475569", fontWeight: 600 }}>Required Field</span>
              </div>

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddField}
                block
                size="large"
                style={{ borderRadius: 8, color: "#6366f1", borderColor: "#6366f1", background: "transparent" }}
              >
                Add Field Definition
              </Button>
            </Space>
          </Col>

          {/* Right Side: Fields review list */}
          <Col xs={24} md={14}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ color: "#0f172a" }}>Review Registered Fields ({fields.length})</Text>
            </div>
            
            <Table
              dataSource={fields}
              columns={reviewTableColumns}
              rowKey="key"
              pagination={false}
              size="small"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden"
              }}
            />
          </Col>
        </Row>
      </Modal>
    </div>
  );
}

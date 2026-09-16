import React, { useState, useEffect } from "react";
import { Modal, Input, Button, Card, Row, Col, Typography, Tag, Space, Upload, message, Tabs, Empty } from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  CheckOutlined,
  UploadOutlined,
  FileImageOutlined,
  SaveOutlined
} from "@ant-design/icons";
import * as quotationService from "../../services/firebase/quotationService";

const { Text, Title, Paragraph } = Typography;

export default function SavedDetailsModal({ visible, onClose, onSelect, category = "bedding" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("library");

  // New Preset creation form states
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSpecs, setNewSpecs] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    if (visible) {
      loadProducts();
    }
  }, [visible, category]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const list = await quotationService.getSavedProducts(category);
      setProducts(list);
    } catch (err) {
      console.error(err);
      message.error("Failed to load saved products library.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomImageUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setNewImageUrl(e.target.result);
      message.success("Image uploaded successfully.");
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleSaveNewPreset = async () => {
    if (!newName.trim() && !newDesc.trim()) {
      return message.warning("Please enter a name or description for this preset.");
    }
    try {
      setSavingPreset(true);
      const saved = await quotationService.saveProductPreset({
        name: newName.trim() || newDesc.trim(),
        description: newDesc.trim() || newName.trim(),
        specifications: newSpecs.trim(),
        imageUrl: newImageUrl,
        category: category.toLowerCase()
      });
      message.success("Preset saved to Library!");
      setNewName("");
      setNewDesc("");
      setNewSpecs("");
      setNewImageUrl("");
      setActiveTab("library");
      loadProducts();
    } catch (err) {
      console.error(err);
      message.error("Failed to save preset.");
    } finally {
      setSavingPreset(false);
    }
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.specifications && p.specifications.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      title={
        <Space>
          <FileImageOutlined style={{ color: "#0284c7" }} />
          <span>Saved Product Details & Image Library ({category.toUpperCase()})</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "library",
            label: "Product Catalog Library",
            children: (
              <div>
                <Input
                  placeholder="Search by name, description, or specs..."
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ marginBottom: 16, borderRadius: 8 }}
                  allowClear
                />

                <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                  {filtered.length === 0 ? (
                    <Empty description="No saved product details match your search." />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filtered.map((item) => (
                        <Col xs={24} sm={12} key={item.id}>
                          <Card
                            hoverable
                            style={{ 
                              borderRadius: 10, 
                              border: "1px solid #e2e8f0", 
                              height: "100%",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between"
                            }}
                            bodyStyle={{ padding: 14 }}
                          >
                            <div>
                              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    style={{
                                      width: 60,
                                      height: 60,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                      border: "1px solid #cbd5e1"
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 60,
                                      height: 60,
                                      borderRadius: 6,
                                      background: "#f1f5f9",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#94a3b8"
                                    }}
                                  >
                                    <FileImageOutlined style={{ fontSize: 24 }} />
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Text strong style={{ fontSize: "0.95rem", color: "#0f172a", display: "block" }}>
                                    {item.name || item.description}
                                  </Text>
                                  <Tag color="cyan" style={{ fontSize: 11, marginTop: 4 }}>
                                    {item.category || category}
                                  </Tag>
                                </div>
                              </div>

                              <Paragraph
                                ellipsis={{ rows: 2 }}
                                style={{ fontSize: "0.8rem", color: "#475569", marginBottom: 8 }}
                              >
                                {item.specifications || item.description}
                              </Paragraph>
                            </div>

                            <Button
                              type="primary"
                              icon={<CheckOutlined />}
                              onClick={() => {
                                onSelect(item);
                                onClose();
                              }}
                              block
                              style={{
                                borderRadius: 6,
                                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                borderColor: "#0284c7",
                                marginTop: 8
                              }}
                            >
                              Apply to Item Row
                            </Button>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>
              </div>
            )
          },
          {
            key: "create",
            label: "Add New Saved Preset",
            children: (
              <div style={{ padding: "8px 0" }}>
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <div>
                    <Text strong>Product Preset Name / Identifier:</Text>
                    <Input
                      placeholder="e.g. 30 CM Round Weed Disc"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{ marginTop: 4, borderRadius: 6 }}
                    />
                  </div>

                  <div>
                    <Text strong>Standard Description:</Text>
                    <Input
                      placeholder="e.g. FHN0954"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      style={{ marginTop: 4, borderRadius: 6 }}
                    />
                  </div>

                  <div>
                    <Text strong>Product Specifications:</Text>
                    <Input.TextArea
                      rows={3}
                      placeholder="e.g. 30 CM | ROUND WEED DISC | 800 GSM | LATEX TREATED"
                      value={newSpecs}
                      onChange={(e) => setNewSpecs(e.target.value)}
                      style={{ marginTop: 4, borderRadius: 6 }}
                    />
                  </div>

                  <div>
                    <Text strong>Product Image:</Text>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
                      <Upload
                        beforeUpload={handleCustomImageUpload}
                        showUploadList={false}
                        accept="image/*"
                      >
                        <Button icon={<UploadOutlined />} style={{ borderRadius: 6 }}>
                          Upload Image File
                        </Button>
                      </Upload>
                      <Input
                        placeholder="Or enter Image URL (https://...)"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        style={{ flex: 1, borderRadius: 6 }}
                      />
                    </div>
                    {newImageUrl && (
                      <div style={{ marginTop: 10 }}>
                        <img
                          src={newImageUrl}
                          alt="Preview"
                          style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #cbd5e1" }}
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSaveNewPreset}
                    loading={savingPreset}
                    block
                    size="large"
                    style={{
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      borderColor: "#059669",
                      fontWeight: 700,
                      marginTop: 12
                    }}
                  >
                    Save Preset to Catalog
                  </Button>
                </Space>
              </div>
            )
          }
        ]}
      />
    </Modal>
  );
}

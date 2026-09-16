import React, { useState, useEffect } from "react";
import { Modal, Table, Tag, Typography, Button, Space, Empty, Spin } from "antd";
import { HistoryOutlined, ReloadOutlined } from "@ant-design/icons";
import * as quotationService from "../../services/firebase/quotationService";

const { Text } = Typography;

export default function ParametersLogModal({ visible, onClose, costRequestId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadLogs();
    }
  }, [visible, costRequestId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await quotationService.getParameterLogs(costRequestId);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 170,
      render: (ts) => ts ? new Date(ts).toLocaleString() : "-"
    },
    {
      title: "User",
      dataIndex: "user",
      key: "user",
      width: 150,
      render: (u) => (
        <div>
          <Text strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>
            {u?.name || u?.email || "System"}
          </Text>
          {u?.role && <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>{u.role}</Tag>}
        </div>
      )
    },
    {
      title: "Parameter",
      dataIndex: "paramName",
      key: "paramName",
      width: 150,
      render: (p) => <Tag color="purple" style={{ fontWeight: 700 }}>{p}</Tag>
    },
    {
      title: "Previous Value",
      dataIndex: "oldValue",
      key: "oldValue",
      width: 130,
      render: (v) => <span style={{ color: "#ef4444", textDecoration: "line-through" }}>{v !== undefined ? String(v) : "-"}</span>
    },
    {
      title: "New Value",
      dataIndex: "newValue",
      key: "newValue",
      width: 130,
      render: (v) => <span style={{ color: "#10b981", fontWeight: 700 }}>{v !== undefined ? String(v) : "-"}</span>
    },
    {
      title: "Reason / Comment",
      dataIndex: "reason",
      key: "reason",
      render: (r) => <span style={{ color: "#475569" }}>{r || "Parameter updated in Quotation Suite"}</span>
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <HistoryOutlined style={{ color: "#8b5cf6" }} />
          <span>Financial Parameters Change Log & Audit History</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
          Refresh
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      width={880}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin tip="Loading parameter logs..." />
        </div>
      ) : logs.length === 0 ? (
        <Empty description="No parameter changes recorded yet. Changes made in the Quotation Suite will appear here." />
      ) : (
        <Table
          dataSource={logs}
          columns={columns}
          rowKey={(record, idx) => record.id || idx}
          pagination={{ pageSize: 8 }}
          size="small"
        />
      )}
    </Modal>
  );
}

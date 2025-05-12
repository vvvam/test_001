import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  ColorPicker,
  Tag,
  Tooltip,
  message,
  Divider,
  Typography,
  Row,
  Col,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import type { Color } from 'antd/es/color-picker';
import { invoke } from '@tauri-apps/api/core';

const { Title, Text } = Typography;

// 分类项接口
interface CategoryItem {
  id: string;
  label: string;
  value: string;
  color: string;
  isSystem?: boolean;
  createdAt?: number;
}

// 默认分类
const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'category_all', label: '全部', value: 'all', color: '#d9d9d9', isSystem: true },
  { id: 'category_text', label: '文本', value: 'text', color: '#1890ff', isSystem: true },
  { id: 'category_code', label: '代码', value: 'code', color: '#52c41a', isSystem: true },
  { id: 'category_link', label: '链接', value: 'link', color: '#722ed1', isSystem: true },
  { id: 'category_email', label: '邮箱', value: 'email', color: '#faad14', isSystem: true },
  { id: 'category_password', label: '密码', value: 'password', color: '#f5222d', isSystem: true },
  { id: 'category_other', label: '其他', value: 'other', color: '#d9d9d9', isSystem: true },
  { id: 'category_study', label: '学习', value: 'study', color: '#13c2c2', isSystem: false },
  { id: 'category_work', label: '工作', value: 'work', color: '#2f54eb', isSystem: false },
  { id: 'category_life', label: '生活', value: 'life', color: '#eb2f96', isSystem: false }
];

// 预设颜色选项
const PRESET_COLORS = [
  '#1677ff', '#f5222d', '#fa541c', '#fa8c16', '#faad14',
  '#a0d911', '#52c41a', '#13c2c2', '#2f54eb', '#722ed1',
  '#eb2f96', '#000000', '#333333', '#666666', '#999999',
];

// 分类管理组件
const CategorySettings: React.FC = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [form] = Form.useForm();
  
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [colorValue, setColorValue] = useState<string>('#1677ff');
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string>('新标签');
  const [valueModifiedByUser, setValueModifiedByUser] = useState<boolean>(false);

  // 加载分类数据
  useEffect(() => {
    fetchCategories();
  }, []);

  // 从Tauri后端加载分类
  const fetchCategories = async () => {
    setLoading(true);
    try {
      // 尝试从Tauri后端获取分类
      const categories = await invoke<CategoryItem[]>('get_categories');
      if (categories && categories.length > 0) {
        setCategories(categories);
      } else {
        // 如果后端没有分类数据，尝试从localStorage获取
        loadCategories();
      }
    } catch (error) {
      console.error('从Tauri获取分类失败:', error);
      // 如果Tauri调用失败，回退到localStorage
      loadCategories();
    } finally {
      setLoading(false);
    }
  };

  // 从localStorage加载分类
  const loadCategories = () => {
    try {
      const savedCategories = localStorage.getItem('custom_categories');
      if (savedCategories) {
        setCategories(JSON.parse(savedCategories));
      } else {
        // 首次使用，初始化默认分类
        setCategories(DEFAULT_CATEGORIES);
        localStorage.setItem('custom_categories', JSON.stringify(DEFAULT_CATEGORIES));
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      message.error('加载分类设置失败');
    }
  };

  // 保存分类到localStorage
  const saveCategories = (newCategories: CategoryItem[]) => {
    try {
      localStorage.setItem('custom_categories', JSON.stringify(newCategories));
      message.success('分类设置已保存');
    } catch (error) {
      console.error('保存分类失败:', error);
      message.error('保存分类设置失败');
    }
  };

  // 添加或编辑分类
  const handleAddOrEditCategory = async (values: any) => {
    try {
      // 使用colorValue替代表单中的color
      const formData = {
        ...values,
        color: colorValue,
      };

      if (editingCategory) {
        // 尝试使用Tauri API
        try {
          await invoke('update_category', { id: editingCategory.id, ...formData });
          message.success('分类已更新');
        } catch (error) {
          console.warn('Tauri API调用失败，使用本地存储:', error);
          // 回退到本地存储
          const newCategories = [...categories];
          const index = newCategories.findIndex(c => c.id === editingCategory.id);
          if (index !== -1) {
            newCategories[index] = {
              ...newCategories[index],
              ...formData
            };
          }
          setCategories(newCategories);
          saveCategories(newCategories);
        }
      } else {
        // 尝试使用Tauri API
        try {
          await invoke('add_category', formData);
          message.success('分类已添加');
        } catch (error) {
          console.warn('Tauri API调用失败，使用本地存储:', error);
          // 回退到本地存储
          const newCategories = [...categories];
          newCategories.push({
            id: `category_${Date.now()}`,
            ...formData,
            isSystem: false,
            createdAt: Date.now()
          });
          setCategories(newCategories);
          saveCategories(newCategories);
        }
      }
      setModalVisible(false);
      form.resetFields();
      fetchCategories();
    } catch (error) {
      console.error('保存分类失败:', error);
      message.error('保存分类失败，请重试');
    }
  };

  // 删除分类
  const handleDeleteCategory = (id: string) => {
    const newCategories = categories.filter(cat => cat.id !== id);
    setCategories(newCategories);
    saveCategories(newCategories);
  };

  // 显示添加/编辑模态框
  const showModal = (category?: CategoryItem) => {
    if (category) {
      setEditingCategory(category);
      form.setFieldsValue(category);
      setColorValue(category.color || '#1677ff');
      setPreviewLabel(category.label);
      setValueModifiedByUser(true); // 编辑模式下不自动修改value
    } else {
      setEditingCategory(null);
      form.resetFields();
      setColorValue('#1677ff');
      setPreviewLabel('新标签');
      setValueModifiedByUser(false); // 重置标记
      setSelectedColorIndex(0); // 默认选择第一个预设颜色
    }
    setModalVisible(true);
  };

  // 处理颜色变更
  const handleColorChange = (color: Color, hex: string) => {
    // 确保使用hex字符串格式
    setColorValue(hex);
    setSelectedColorIndex(null); // 清除预设颜色选择状态
  };

  // 处理标签文本变更
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const label = e.target.value || '新标签';
    setPreviewLabel(label);
    
    // 自动生成value，仅在新增模式且用户未手动修改value时
    if (!editingCategory && !valueModifiedByUser) {
      const generatedValue = generateValueFromLabel(label);
      form.setFieldsValue({ value: generatedValue });
    }
  };
  
  // 处理标识值变更
  const handleValueChange = () => {
    setValueModifiedByUser(true);
  };

  // 选择预设颜色
  const selectPresetColor = (color: string, index: number) => {
    setColorValue(color);
    setSelectedColorIndex(index);
  };

  // 生成标识值（如果未提供）
  const generateValueFromLabel = (label: string): string => {
    return label.toLowerCase().replace(/\s+/g, '_');
  };

  // 重置分类到默认设置
  const handleResetCategories = () => {
    Modal.confirm({
      title: '确定要重置所有分类吗？',
      content: '此操作将恢复所有默认分类，并删除所有自定义分类。此操作不可撤销。',
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          // 尝试使用Tauri API
          try {
            await invoke('reset_categories');
            message.success('分类已重置为默认设置');
          } catch (error) {
            console.warn('Tauri API调用失败，使用本地存储重置:', error);
            // 回退到本地存储
            setCategories(DEFAULT_CATEGORIES);
            localStorage.setItem('custom_categories', JSON.stringify(DEFAULT_CATEGORIES));
            message.success('分类已重置为默认设置');
          }
          fetchCategories();
        } catch (error) {
          console.error('重置分类失败:', error);
          message.error('重置分类失败，请重试');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 渲染分类标签
  const renderCategoryTag = (category: CategoryItem) => {
    return (
      <Tag
        color={category.color}
        style={{
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '14px'
        }}
      >
        {category.label}
      </Tag>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: '分类名称',
      dataIndex: 'label',
      key: 'label',
      render: (_: string, record: CategoryItem) => (
        <Space>
          {renderCategoryTag(record)}
          {record.isSystem && <Tag color="default">系统</Tag>}
        </Space>
      ),
    },
    {
      title: '标识',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (color: string) => (
        <div style={{ 
          width: '20px', 
          height: '20px', 
          backgroundColor: color, 
          borderRadius: '4px',
          border: '1px solid #d9d9d9'
        }} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CategoryItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此分类吗？"
            description={record.isSystem ? "删除系统分类可能会影响系统功能，确定要继续吗？" : "此操作不可撤销"}
            onConfirm={() => handleDeleteCategory(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="category-settings-container">
      <Card
        title="分类管理"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetCategories}
            >
              重置默认
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              添加分类
            </Button>
          </Space>
        }
        bordered={false}
        className="glass-effect"
      >
        <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
          你可以自定义分类来组织剪贴板内容。分类将用于在剪贴板历史中标记和筛选内容。
        </Text>
        <Divider />
        
        <Table
          columns={columns}
          dataSource={categories}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingCategory ? "编辑分类" : "添加分类"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingCategory(null);
        }}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddOrEditCategory}
        >
          <Form.Item
            name="label"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input onChange={handleLabelChange} />
          </Form.Item>

          <Form.Item
            name="value"
            label={
              <Space>
                <span>标识值</span>
                <Tooltip title="标识值用于系统内部识别分类，只能包含小写字母、数字和下划线">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[
              { required: true, message: '请输入标识值' },
              { pattern: /^[a-z0-9_]+$/, message: '标识值只能包含小写字母、数字和下划线' }
            ]}
            tooltip="标识值用于系统内部识别分类，只能包含小写字母、数字和下划线"
          >
            <Input 
              placeholder="例如：work_notes" 
              onChange={handleValueChange}
            />
          </Form.Item>

          <Form.Item label="标签颜色">
            <div className="color-preset-container">
              {PRESET_COLORS.map((color, index) => (
                <div
                  key={index}
                  className={`color-preset-item ${selectedColorIndex === index ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => selectPresetColor(color, index)}
                />
              ))}
            </div>
            <ColorPicker
              value={colorValue}
              onChange={handleColorChange}
              showText
              disabledAlpha
            />
          </Form.Item>

          <Form.Item label="预览效果">
            <div
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: colorValue,
                color: '#fff',
                fontSize: '12px',
                marginRight: '8px',
              }}
            >
              {previewLabel}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategorySettings; 
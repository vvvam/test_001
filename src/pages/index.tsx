import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  List, 
  Tag, 
  Divider, 
  Spin, 
  Empty, 
  Progress,
  Button,
  Tooltip,
  Space,
  Avatar,
  Modal
} from 'antd';
import {
  CopyOutlined,
  StarOutlined,
  PushpinOutlined,
  CalendarOutlined,
  RiseOutlined,
  SyncOutlined,
  PieChartOutlined,
  FileTextOutlined,
  CodeOutlined,
  LinkOutlined,
  MailOutlined,
  LockOutlined,
  BookOutlined,
  LaptopOutlined,
  SmileOutlined,
  EllipsisOutlined,
  RobotOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ApiOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useClipboardStore } from '../store/clipboardStore';
import { useTheme } from '../context/ThemeContext';
import { getCategoryColor, getCategoryLabel } from '../constants/categories';
import { format, subDays, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// 获取图标组件
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'text': return <FileTextOutlined />;
    case 'code': return <CodeOutlined />;
    case 'link': return <LinkOutlined />;
    case 'email': return <MailOutlined />;
    case 'password': return <LockOutlined />;
    case 'study': return <BookOutlined />;
    case 'work': return <LaptopOutlined />;
    case 'life': return <SmileOutlined />;
    case 'other': return <EllipsisOutlined />;
    default: return <FileTextOutlined />;
  }
};

// 仪表盘页面组件
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  const { 
    items, 
    loading, 
    fetchItems,
    copyToClipboard
  } = useClipboardStore();
  
  // 本地状态
  const [refreshing, setRefreshing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>({
    os: '',
    version: '',
    memoryUsage: 0,
    cpuUsage: 0,
    startTime: null,
    uptime: 0
  });
  
  // 刷新数据
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await fetchItems();
      await fetchSystemInfo();
    } catch (error) {
      console.error('刷新数据失败:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // 获取系统信息
  const fetchSystemInfo = async () => {
    try {
      const info = await invoke('get_system_info');
      setSystemInfo(info || {
        os: '未知',
        version: '未知',
        memoryUsage: 0,
        cpuUsage: 0,
        startTime: Date.now(),
        uptime: 0
      });
    } catch (error) {
      console.error('获取系统信息失败:', error);
      setSystemInfo({
        os: '未知',
        version: '未知',
        memoryUsage: 0,
        cpuUsage: 0,
        startTime: Date.now(),
        uptime: 0
      });
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchItems();
    // fetchSystemInfo(); // 不再立即调用

    // 延迟获取系统信息
    const initialFetchTimeout = setTimeout(() => {
      fetchSystemInfo();
    }, 4000); // 延迟 2 秒

    // 定时刷新系统信息
    const intervalId = setInterval(() => {
      fetchSystemInfo();
    }, 30000); // 每30秒更新一次
    
    return () => {
      clearTimeout(initialFetchTimeout); // 清理延迟定时器
      clearInterval(intervalId);
    };
  }, [fetchItems]);
  
  // 数据计算
  const totalItems = items.length;
  const favoritedItems = items.filter(item => item.favorite).length;
  const pinnedItems = items.filter(item => item.pinned).length;
  
  // 统计AI分析总数，添加日志
  console.log('计算AI分析总数，所有项目:', items.length);
  const itemsWithAnalysis = items.filter(item => (item.aiAnalysisCount || 0) > 0);
  console.log('有AI分析计数的项目数:', itemsWithAnalysis.length);
  if (itemsWithAnalysis.length > 0) {
    console.log('AI分析计数示例:', 
      itemsWithAnalysis.slice(0, 3).map(item => ({ 
        id: item.id, 
        count: item.aiAnalysisCount 
      }))
    );
  }
  
  const totalAIAnalysisCount = items.reduce((total, item) => total + (item.aiAnalysisCount || 0), 0);
  console.log('AI分析总数:', totalAIAnalysisCount);
  
  const todayItems = items.filter(item => isToday(new Date(item.timestamp))).length;
  const weekItems = items.filter(item => isThisWeek(new Date(item.timestamp))).length;
  const monthItems = items.filter(item => isThisMonth(new Date(item.timestamp))).length;
  
  // 计算分类统计
  const categoryStats: Record<string, number> = {};
  items.forEach(item => {
    const category = item.category || 'other';
    if (!categoryStats[category]) {
      categoryStats[category] = 0;
    }
    categoryStats[category]++;
  });
  
  // 排序分类，从高到低
  const sortedCategories = Object.entries(categoryStats)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  
  // 计算分类百分比
  const getCategoryPercentage = (count: number) => {
    return totalItems ? Math.round((count / totalItems) * 100) : 0;
  };
  
  // 最近项目
  const recentItems = [...items]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  
  // 常用项目 (基于时间戳排序，因为没有accessCount字段)
  const frequentItems = [...items]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
  
  // 获取过去7天的日期和数据
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'MM-dd');
      const count = items.filter(item => {
        const itemDate = new Date(item.timestamp);
        return format(itemDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      }).length;
      data.push({ date: dateStr, count });
    }
    return data;
  };
  
  // 计算图表数据
  const chartData = getLast7DaysData();
  const maxCount = Math.max(...chartData.map(item => item.count)) || 1;
  
  // 获取最常分析的项目
  const mostAnalyzedItems = [...items]
    .filter(item => (item.aiAnalysisCount || 0) > 0)
    .sort((a, b) => (b.aiAnalysisCount || 0) - (a.aiAnalysisCount || 0))
    .slice(0, 6);
  
  // 获取最常用的10个项目
  const getTopItems = () => {
    // 复制一份数据以避免排序修改原始数据
    const sortedItems = [...items]
      .sort((a, b) => (b.aiAnalysisCount || 0) - (a.aiAnalysisCount || 0))
      .slice(0, 10);
    return sortedItems;
  };
  
  // 截断长文本，添加省略号
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  // 清除所有数据，带确认提示
  const handleClearAll = () => {
    Modal.confirm({
      title: '确认清空',
      content: '将清空所有剪贴板记录、分析历史等数据，此操作不可恢复，是否继续？',
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        useClipboardStore.getState().clearAll();
      }
    });
  };
  
  return (
    <div className="dashboard-container" style={{ padding: '0 12px 24px', height: '100%', overflowY: 'auto' }}>
      <div className="dashboard-header" style={{ margin: '16px 0 24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={3} style={{ marginBottom: 8 }}>仪表盘</Title>
            <Text type="secondary">
              查看系统状态和剪贴板数据统计
            </Text>
          </Col>
          <Col>
            <Space>
              <Button 
                type="primary"
                onClick={() => navigate('/home')}
              >
                管理剪贴板
              </Button>
              <Button 
                icon={<SyncOutlined spin={refreshing} />}
                onClick={refreshData}
                loading={refreshing || loading}
              >
                刷新数据
              </Button>
              <Button 
                danger
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
                loading={refreshing || loading}
              >
                清空数据
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
      
      <Spin spinning={loading && !items.length}>
        <Row gutter={[16, 16]}>
          {/* 总体统计卡片 */}
          <Col xs={24} sm={24} md={24} lg={24}>
            <Card 
              className="glass-effect" 
              bordered={false}
              style={{ 
                borderRadius: '12px',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}
            >
              <Row gutter={[32, 16]}>
                <Col xs={12} sm={12} md={6} lg={6}>
                  <Statistic 
                    title="总条目" 
                    value={totalItems} 
                    prefix={<CopyOutlined />} 
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col xs={12} sm={12} md={6} lg={6}>
                  <Statistic 
                    title="收藏条目" 
                    value={favoritedItems} 
                    prefix={<StarOutlined style={{ color: '#faad14' }} />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col xs={12} sm={12} md={6} lg={6}>
                  <Statistic 
                    title="置顶条目" 
                    value={pinnedItems} 
                    prefix={<PushpinOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col xs={12} sm={12} md={6} lg={6}>
                  <Statistic 
                    title="AI分析总数" 
                    value={totalAIAnalysisCount} 
                    prefix={<ApiOutlined style={{ color: '#722ed1' }} />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          
          <Col xs={24} sm={24} md={12} lg={8}>
            <Card 
              title={<><CalendarOutlined /> 时间统计</>} 
              className="glass-effect" 
              bordered={false}
              style={{ 
                borderRadius: '12px',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.05)',
                height: '100%'
              }}
            >
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px', color: isDarkMode ? '#e0e0e0' : 'rgba(0, 0, 0, 0.85)' }}>今日</div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'baseline', 
                      justifyContent: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '25px', fontWeight: 'bold', color: '#1890ff' }}>{todayItems}</span>
                      <span style={{ fontSize: '12px', marginLeft: '4px', color: isDarkMode ? '#aaa' : 'rgba(0, 0, 0, 0.45)' }}>/ {totalItems}</span>
                    </div>
                    <Progress 
                      percent={totalItems ? Math.round((todayItems / totalItems) * 100) : 0} 
                      size="small" 
                      showInfo={false} 
                      strokeColor="#1890ff" 
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', marginBottom: '8px', color: isDarkMode ? '#e0e0e0' : 'rgba(0, 0, 0, 0.85)' }}>本周</div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'baseline', 
                      justifyContent: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '25px', fontWeight: 'bold', color: '#52c41a' }}>{weekItems}</span>
                      <span style={{ fontSize: '12px', marginLeft: '4px', color: isDarkMode ? '#aaa' : 'rgba(0, 0, 0, 0.45)' }}>/ {totalItems}</span>
                    </div>
                    <Progress 
                      percent={totalItems ? Math.round((weekItems / totalItems) * 100) : 0} 
                      size="small" 
                      showInfo={false} 
                      strokeColor="#52c41a" 
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', marginBottom: '8px', color: isDarkMode ? '#e0e0e0' : 'rgba(0, 0, 0, 0.85)' }}>本月</div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'baseline', 
                      justifyContent: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '25px', fontWeight: 'bold', color: '#722ed1' }}>{monthItems}</span>
                      <span style={{ fontSize: '12px', marginLeft: '4px', color: isDarkMode ? '#aaa' : 'rgba(0, 0, 0, 0.45)' }}>/ {totalItems}</span>
                    </div>
                    <Progress 
                      percent={totalItems ? Math.round((monthItems / totalItems) * 100) : 0} 
                      size="small" 
                      showInfo={false} 
                      strokeColor="#722ed1" 
                    />
                  </div>
                </Col>
              </Row>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div>
                <Title level={5}>系统信息</Title>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <div style={{ marginBottom: "6px" }}>
                      <Text type="secondary" style={{ fontSize: "13px" }}>内存使用：</Text>
                      <span style={{ 
                        float: "right", 
                        fontSize: "13px", 
                        fontWeight: "bold",
                        color: systemInfo.memoryUsage > 80 ? "#ff4d4f" : (systemInfo.memoryUsage > 60 ? "#faad14" : "#52c41a")
                      }}>
                        {systemInfo.memoryUsage || 0}%
                      </span>
                    </div>
                    <Progress 
                      percent={systemInfo.memoryUsage || 0} 
                      size="small" 
                      showInfo={false}
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': systemInfo.memoryUsage > 80 ? '#ff4d4f' : (systemInfo.memoryUsage > 60 ? '#faad14' : '#52c41a'),
                      }}
                      trailColor={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                      style={{ marginBottom: "4px" }}
                    />
                    {systemInfo.memoryTotal && (
                      <div style={{ fontSize: "12px", color: isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}>
                        已用: {((systemInfo.memoryTotal * systemInfo.memoryUsage / 100) / (1024 * 1024 * 1024)).toFixed(2)}GB / 总计: {(systemInfo.memoryTotal / (1024 * 1024 * 1024)).toFixed(2)}GB
                      </div>
                    )}
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: "6px" }}>
                      <Text type="secondary" style={{ fontSize: "13px" }}>CPU使用：</Text>
                      <span style={{ 
                        float: "right", 
                        fontSize: "13px", 
                        fontWeight: "bold",
                        color: systemInfo.cpuUsage > 80 ? "#ff4d4f" : (systemInfo.cpuUsage > 60 ? "#faad14" : "#52c41a")
                      }}>
                        {systemInfo.cpuUsage ? systemInfo.cpuUsage.toFixed(1) : 0}%
                      </span>
                    </div>
                    <Progress 
                      percent={systemInfo.cpuUsage || 0} 
                      size="small" 
                      showInfo={false}
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': systemInfo.cpuUsage > 80 ? '#ff4d4f' : (systemInfo.cpuUsage > 60 ? '#faad14' : '#52c41a'),
                      }}
                      trailColor={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                      style={{ marginBottom: "4px" }}
                    />
                    <div style={{ fontSize: "12px", color: isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}>
                      {systemInfo.uptime ? `已运行: ${Math.floor(systemInfo.uptime / 3600)}小时${Math.floor((systemInfo.uptime % 3600) / 60)}分钟` : "获取中..."}
                    </div>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>
          
          {/* 分类统计 */}
          <Col xs={24} sm={24} md={12} lg={8}>
            <Card 
              title={<><PieChartOutlined /> 分类统计</>} 
              className="glass-effect" 
              bordered={false}
              style={{ 
                borderRadius: '12px',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.05)',
                height: '100%'
              }}
            >
              {sortedCategories.length > 0 ? (
                <List
                  dataSource={sortedCategories}
                  renderItem={item => (
                    <List.Item>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div style={{ marginRight: 12 }}>
                          <Tag 
                            icon={getCategoryIcon(item.category)}
                            color={getCategoryColor(item.category)}
                            style={{ 
                              padding: '4px 8px',
                              borderRadius: '12px'
                            }}
                          >
                            {getCategoryLabel(item.category)}
                          </Tag>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Progress 
                            percent={getCategoryPercentage(item.count)} 
                            size="small"
                            format={percent => `${item.count} (${percent}%)`}
                            strokeColor={getCategoryColor(item.category) || '#1890ff'}
                          />
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无分类数据" />
              )}
            </Card>
          </Col>
          
          {/* 最近记录 */}
          <Col xs={24} sm={24} md={24} lg={8}>
            <Card 
              title={<><ClockCircleOutlined /> 最近记录</>}
              className="glass-effect" 
              bordered={false}
              style={{ 
                borderRadius: '12px',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.05)',
                height: '100%'
              }}
              extra={
                <Button type="link" onClick={() => navigate('/home')}>
                  查看全部
                </Button>
              }
            >
              {recentItems.length > 0 ? (
                <List
                  dataSource={recentItems}
                  style={{ maxHeight: '500px', overflowY: 'auto' }}
                  renderItem={item => (
                    <List.Item
                      className="list-item-hover"
                      style={{ borderRadius: '8px', padding: '8px' }}
                      actions={[
                        <Tooltip title="复制到剪贴板">
                          <Button 
                            type="text" 
                            icon={<CopyOutlined />} 
                            onClick={() => copyToClipboard(item.id)}
                          />
                        </Tooltip>,
                        <Tooltip title="AI分析">
                          <Button 
                            type="text" 
                            icon={<RobotOutlined />} 
                            onClick={() => navigate(`/chat?item=${item.id}`)}
                          />
                        </Tooltip>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<FileTextOutlined />} />}
                        title={truncateText(item.content, 50)}
                        description={`使用次数: ${item.aiAnalysisCount || 0} | ${dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}`}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无记录" />
              )}
            </Card>
          </Col>
          
          {/* 统计图表 - 简单趋势图 */}
          <Col xs={24} sm={24} md={24} lg={24}>
            <Card 
              title={<><BarChartOutlined /> 剪贴板记录趋势</>}
              className="glass-effect" 
              bordered={false}
              style={{ 
                borderRadius: '12px',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.05)',
                marginTop: 16
              }}
            >
              <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 10px' }}>
                {chartData.map((item, index) => (
                  <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '13%' }}>
                    <div 
                      style={{ 
                        height: `${(item.count / maxCount) * 150}px`, 
                        width: '100%', 
                        backgroundColor: item.count > 0 ? '#1890ff' : '#f0f0f0',
                        borderRadius: '4px 4px 0 0',
                        minHeight: '4px',
                        transition: 'all 0.3s ease',
                        opacity: item.count > 0 ? 0.7 : 0.3,
                      }}
                    />
                    <div style={{ marginTop: '8px', fontSize: '12px', color: isDarkMode ? '#eee' : '#666' }}>
                      {item.date}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          
          {/* 热门AI分析项目 */}
          <Col xs={24} sm={24} md={24} lg={24} style={{ marginTop: 16 }}>
            <Card 
              title={<><ApiOutlined /> 热门AI分析项目</>}
              className="glass-effect" 
              bordered={false}
              style={{ 
                borderRadius: '12px',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}
            >
              {mostAnalyzedItems.length > 0 ? (
                <List
                  dataSource={mostAnalyzedItems}
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
                  renderItem={item => (
                    <List.Item>
                      <Card 
                        size="small" 
                        hoverable
                        title={
                          <div style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            width: '100%'
                          }}>
                            {item.content.substring(0, 30)}
                            {item.content.length > 30 ? '...' : ''}
                          </div>
                        }
                        style={{ marginBottom: 8 }}
                        extra={
                          <Tag color="#722ed1">
                            <ApiOutlined /> {item.aiAnalysisCount}
                          </Tag>
                        }
                        actions={[
                          <Tooltip title="复制到剪贴板">
                            <CopyOutlined key="copy" onClick={() => copyToClipboard(item.id)} />
                          </Tooltip>,
                          <Tooltip title="AI分析">
                            <RobotOutlined key="analyze" onClick={() => navigate(`/chat?item=${item.id}`)} />
                          </Tooltip>
                        ]}
                      >
                        <div style={{ 
                          height: 40, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          color: isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)',
                          fontSize: '12px'
                        }}>
                          {item.content.substring(0, 100)}
                          {item.content.length > 100 ? '...' : ''}
                        </div>
                      </Card>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无AI分析记录" />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Dashboard; 
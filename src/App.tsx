import React from 'react';
import { Routes, Route, useSearchParams, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Roles from './pages/Roles';
import Chat from './pages/Chat';
import AISettings from './pages/AISettings';
import FloatClipboard from './pages/FloatClipboard';
import Dashboard from './pages/index';

const { Content } = Layout;

const App: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isFloatWindow = searchParams.get('window') === 'float_clipboard';

  if (isFloatWindow) {
    // 如果是浮动窗口，只显示浮动剪贴板组件
    return <FloatClipboard />;
  }

  return (
    <Layout style={{ 
      height: '100vh',
      background: 'transparent'
    }}>
      <Sidebar />
      <Layout className="site-layout" style={{ 
        background: 'transparent',
        display: 'flex',
        height: '100vh',
        overflow: 'hidden'
      }}>
        <Content className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/home" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ai-settings" element={<AISettings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App; 
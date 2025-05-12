import React from 'react';
import { Window } from '@tauri-apps/api/window';
import { 
  MinusOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { Space, Button, Typography } from 'antd';
import { useTheme } from '../context/ThemeContext';

const { Text } = Typography;

const TitleBar: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [isMaximized, setIsMaximized] = React.useState(false);

  React.useEffect(() => {
    // 初始检查窗口状态
    const checkMaximize = async () => {
      try {
        const appWindow = Window.getCurrent();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error('无法检查窗口状态:', error);
      }
    };

    checkMaximize();

    // 监听窗口大小变化
    const setupListener = async () => {
      try {
        const appWindow = Window.getCurrent();
        const unlisten = await appWindow.onResized(() => {
          checkMaximize();
        });
        return unlisten;
      } catch (error) {
        console.error('设置窗口大小变化监听失败:', error);
        return () => {};
      }
    };

    const unlistenPromise = setupListener();
    
    return () => {
      // 清理事件监听
      unlistenPromise.then(unlisten => {
        if (typeof unlisten === 'function') {
          unlisten();
        }
      }).catch(error => {
        console.error('清理监听器失败:', error);
      });
    };
  }, []);

  // 窗口控制函数
  const minimizeWindow = async () => {
    try {
      const appWindow = Window.getCurrent();
      await appWindow.minimize();
    } catch (error) {
      console.error('最小化窗口失败:', error);
    }
  };
  
  const toggleMaximize = async () => {
    try {
      const appWindow = Window.getCurrent();
      if (isMaximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch (error) {
      console.error('切换最大化状态失败:', error);
    }
  };

  const closeWindow = async () => {
    try {
      const appWindow = Window.getCurrent();
      await appWindow.close();
    } catch (error) {
      console.error('关闭窗口失败:', error);
    }
  };

  return (
    <div
      className="title-bar"
      style={{
        height: '32px',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 12px',
        background: isDarkMode ? 'rgba(33, 33, 33, 0.9)' : 'rgba(248, 248, 248, 0.9)',
        // @ts-ignore
        WebkitAppRegion: 'drag',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
      }}
      data-tauri-drag-region
    >
      <div className="app-title" style={{ display: 'flex', alignItems: 'center' }}>
        <img
          src="/icon.svg"
          alt="Copy2AI"
          style={{ height: '16px', marginRight: '8px' }}
        />
        <Text strong style={{ fontSize: '14px' }}>Copy2AI</Text>
      </div>

      <Space 
        // @ts-ignore
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          onClick={minimizeWindow}
          style={{ padding: '4px 8px' }}
        />
        <Button
          type="text"
          size="small"
          icon={isMaximized ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={toggleMaximize}
          style={{ padding: '4px 8px' }}
        />
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={closeWindow}
          danger
          style={{ padding: '4px 8px' }}
        />
      </Space>
    </div>
  );
};

export default TitleBar; 
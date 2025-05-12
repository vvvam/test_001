import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

// 导出 ThemeType
export type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  isDarkMode: boolean;
}

// 创建一个默认值对象，避免使用null
const defaultContext: ThemeContextType = {
  theme: 'light',
  setTheme: () => {},
  isDarkMode: false,
};

// 创建Context
export const ThemeContext = createContext<ThemeContextType>(defaultContext);

// 自定义Hook 用于在组件内部使用主题
export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

// 确保ThemeProvider是一个正确的函数组件
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 从本地存储获取主题设置，默认为浅色
  const [theme, setTheme] = useState<ThemeType>(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      return (savedTheme as ThemeType) || 'light';
    } catch (e) {
      console.error('无法读取本地存储的主题设置:', e);
      return 'light';
    }
  });

  // 判断是否为暗黑模式
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      if (theme === 'system') {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return theme === 'dark';
    } catch (e) {
      console.error('无法检测系统主题偏好:', e);
      return true;
    }
  });

  // 当主题更改时更新文档的类和本地存储
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);

      // 根据系统主题或用户选择设置模式
      if (theme === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDark);
        document.body.className = prefersDark ? 'dark-theme' : 'light-theme';
      } else {
        setIsDarkMode(theme === 'dark');
        document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
      }
    } catch (e) {
      console.error('无法更新主题设置:', e);
    }
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    if (theme === 'system') {
      try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleChange = (e: MediaQueryListEvent) => {
          setIsDarkMode(e.matches);
          document.body.className = e.matches ? 'dark-theme' : 'light-theme';
        };
        
        // 使用正确的添加事件监听器方法
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', handleChange);
        } else {
          // 兼容旧版浏览器
          // @ts-ignore
          mediaQuery.addListener(handleChange);
        }
        
        return () => {
          // 清理事件监听器
          if (mediaQuery.removeEventListener) {
            mediaQuery.removeEventListener('change', handleChange);
          } else {
            // 兼容旧版浏览器
            // @ts-ignore
            mediaQuery.removeListener(handleChange);
          }
        };
      } catch (e) {
        console.error('无法监听系统主题变化:', e);
      }
    }
  }, [theme]);

  // 设置Ant Design主题
  const antdThemeConfig = {
    algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#f5222d',
      colorInfo: '#1890ff',
      borderRadius: 8,
      wireframe: false,
      fontFamily: 'Roboto, "SF Pro Display", "Segoe UI", sans-serif',
      // 添加阴影效果
      boxShadow: isDarkMode 
        ? '0 6px 16px -8px rgba(0, 0, 0, 0.32), 0 9px 28px 0 rgba(0, 0, 0, 0.2), 0 12px 48px 16px rgba(0, 0, 0, 0.12)'
        : '0 6px 16px -8px rgba(0, 0, 0, 0.08), 0 9px 28px 0 rgba(0, 0, 0, 0.05), 0 12px 48px 16px rgba(0, 0, 0, 0.03)',
    },
    components: {
      Button: {
        colorPrimary: '#1890ff',
        algorithm: true,
        borderRadius: 6,
      },
      Menu: {
        colorBgContainer: 'transparent',
      },
      Card: {
        colorBgContainer: isDarkMode ? 'rgba(36, 40, 56, 0.9)' : 'rgba(255, 255, 255, 0.95)',
        borderRadiusLG: 8,
      },
      Drawer: {
        colorBgElevated: isDarkMode ? 'rgba(36, 40, 56, 0.95)' : 'rgba(255, 255, 255, 0.98)',
      },
      Modal: {
        colorBgElevated: isDarkMode ? 'rgba(36, 40, 56, 0.95)' : 'rgba(255, 255, 255, 0.98)',
      },
      Input: {
        colorBgContainer: isDarkMode ? 'rgba(45, 45, 45, 0.7)' : 'rgba(255, 255, 255, 0.8)',
        activeBorderColor: '#1890ff',
      },
      Select: {
        colorBgElevated: isDarkMode ? 'rgba(36, 40, 56, 0.95)' : 'rgba(255, 255, 255, 0.98)',
      },
      Table: {
        colorBgContainer: isDarkMode ? 'rgba(36, 40, 56, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      },
      Layout: {
        colorBgHeader: 'transparent',
        colorBgBody: 'transparent',
      },
    },
  };

  // 确保在组件内部返回Provider
  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDarkMode }}>
      <ConfigProvider theme={antdThemeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}; 
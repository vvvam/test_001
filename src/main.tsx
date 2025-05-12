import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './styles/card.css';
import 'antd/dist/reset.css';
import { ThemeProvider } from './context/ThemeContext';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';

// 添加全局样式
const style = document.createElement('style');
style.textContent = `
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
`;
document.head.appendChild(style);

// 渲染根组件
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ConfigProvider locale={zhCN}>
          <App />
        </ConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
); 
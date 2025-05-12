import React, { useState } from 'react';
import { useShortcut } from '../hooks/useShortcut';

const ShortcutExample: React.FC = () => {
  const [counter, setCounter] = useState(0);
  const [lastShortcut, setLastShortcut] = useState<string | null>(null);
  
  // 使用Alt+C增加计数器
  useShortcut('Alt+C', () => {
    setCounter(prev => prev + 1);
    setLastShortcut('Alt+C');
  });
  
  // 使用Alt+F重置计数器
  useShortcut('Alt+F', () => {
    setCounter(0);
    setLastShortcut('Alt+F');
  });
  
  return (
    <div className="p-4 border rounded-md shadow-sm">
      <h2 className="text-xl font-bold mb-4">快捷键演示</h2>
      <div className="mb-2">计数器: <span className="font-semibold">{counter}</span></div>
      {lastShortcut && (
        <div className="mb-2">最后触发的快捷键: <span className="font-semibold">{lastShortcut}</span></div>
      )}
      <div className="mt-4 text-sm text-gray-600">
        <p>• Alt+C: 增加计数器</p>
        <p>• Alt+F: 重置计数器</p>
      </div>
    </div>
  );
};

export default ShortcutExample; 
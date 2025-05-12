import { useEffect } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

/**
 * 快捷键钩子，用于注册全局快捷键
 * 
 * @param shortcut 快捷键字符串，如 "Alt+C"
 * @param callback 快捷键触发时的回调函数
 */
export function useShortcut(shortcut: string, callback: () => void) {
  useEffect(() => {
    // 注册快捷键
    const setupShortcut = async () => {
      try {
        // 检查快捷键是否已注册
        const registered = await isRegistered(shortcut);
        
        // 如果已注册，先取消注册
        if (registered) {
          await unregister(shortcut);
        }
        
        // 注册快捷键
        await register(shortcut, (event) => {
          // 只处理按下状态
          if (event.state === 'Pressed') {
            callback();
          }
        });
        
        console.log(`已注册快捷键: ${shortcut}`);
      } catch (error) {
        console.error(`注册快捷键 ${shortcut} 失败:`, error);
      }
    };
    
    setupShortcut();
    
    // 组件卸载时清理
    return () => {
      unregister(shortcut).catch(err => {
        console.error(`取消注册快捷键 ${shortcut} 失败:`, err);
      });
    };
  }, [shortcut, callback]);
} 
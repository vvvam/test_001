// 导出所有类型定义
export * from './clipboard';

// 声明Tauri API相关模块
declare module '@tauri-apps/api/core' {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare module '@tauri-apps/api/event' {
  export function emit(event: string, payload?: any): Promise<void>;
  export function listen(event: string, handler: (event: any) => void): Promise<() => void>;
}

declare module '@tauri-apps/api/webviewWindow' {
  export interface WebviewWindow {
    label: string;
    url(): Promise<string>;
    setTitle(title: string): Promise<void>;
    setSize(size: { width: number; height: number }): Promise<void>;
    setPosition(position: { x: number; y: number }): Promise<void>;
    center(): Promise<void>;
    isVisible(): Promise<boolean>;
    show(): Promise<void>;
    hide(): Promise<void>;
    isFocused(): Promise<boolean>;
    setFocus(): Promise<void>;
    unminimize(): Promise<void>;
  }
  
  export function getCurrentWebviewWindow(): WebviewWindow;
  export function getAll(): WebviewWindow[];
} 
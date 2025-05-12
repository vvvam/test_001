# Copy2AI

Copy2AI 是一款跨平台桌面应用程序，旨在高效管理剪贴板历史记录，并通过 AI 辅助功能提升用户处理文本和数据的效率。

## 主要功能

- 剪贴板历史记录管理：自动保存系统剪贴板内容，支持搜索、分类和过滤
- 剪贴板条目操作：置顶、收藏、分类、删除等
- AI 辅助功能：翻译、总结内容
- 自定义 AI 角色：创建和管理不同角色的 AI 助手
- 系统集成：系统托盘、全局快捷键、自启动等

## 功能特点

### 角色管理功能

- 角色管理支持通过JSON文件进行持久化存储
- 基本操作：添加、编辑、删除角色
- 高级操作：复制角色、批量删除、导入导出
- 角色分类与筛选：按类别筛选角色
- 角色排序：支持按名称、类别等不同方式排序
- 批量选择：支持多选操作模式
- 默认角色保护：防止误删除系统默认角色

## 技术栈

- 前端：React、TypeScript、Zustand、Ant Design
- 后端：Rust、Tauri v2
- 数据存储：本地 JSON 文件

## 开发

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Rust 和 Tauri CLI
# 详见 https://tauri.app/guides/getting-started/prerequisites
```

### 开发模式

```bash
# 启动开发服务器
npm run tauri dev
```

### 构建应用

```bash
# 构建应用
npm run tauri build
```

## 项目结构

```
copy2ai/
├── src/                    # 前端代码
│   ├── components/         # React 组件
│   ├── pages/              # 页面组件
│   ├── store/              # Zustand 状态管理
│   ├── models/             # 数据模型
│   ├── utils/              # 工具函数
│   ├── App.tsx             # 应用主组件
│   └── main.tsx            # 入口文件
│
├── src-tauri/              # Rust 后端代码
│   ├── src/                # Rust 源代码
│   │   ├── main.rs         # 主入口文件
│   │   ├── clipboard.rs    # 剪贴板相关功能
│   │   ├── storage.rs      # 数据存储
│   │   └── ai.rs           # AI 相关功能
│   ├── Cargo.toml          # Rust 依赖配置
│   └── tauri.conf.json     # Tauri 配置
│
└── README.md               # 项目说明
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

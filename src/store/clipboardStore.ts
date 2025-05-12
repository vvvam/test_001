import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';
import { ClipboardItem, ClipboardFilter, ClipboardOperationResult, ClearOption } from '../models/clipboard';
import { detectCategory } from '../constants/categories';
import { message } from 'antd';

// 剪贴板状态接口
interface ClipboardState {
  items: ClipboardItem[];
  filteredItems: ClipboardItem[];
  loading: boolean;
  error: string | null;
  searchText: string;
  showFavoritesOnly: boolean;
  showPinnedOnly: boolean;
  selectedCategory: string | null;
  
  // 缓存与性能相关
  isInitialized: boolean;
  isEventListenerSet: boolean;
  categoryCache: Record<string, ClipboardItem[]>;
  
  // 操作方法
  fetchItems: () => Promise<void>;
  initializeStore: () => Promise<void>;
  setSearchText: (text: string) => void;
  setShowFavoritesOnly: (value: boolean) => void;
  setShowPinnedOnly: (value: boolean) => void;
  setSelectedCategory: (category: string | null) => void;
  applyFilters: () => void;
  
  addItem: (content: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  favoriteItem: (id: string) => Promise<void>;
  pinItem: (id: string) => Promise<void>;
  editItem: (id: string, newContent: string) => Promise<void>;
  copyToClipboard: (id: string) => Promise<void>;
  translateItem: (id: string) => Promise<void>;
  summarizeItem: (id: string) => Promise<void>;
  categorizeItem: (id: string, category: string) => Promise<void>;
  updateAIAnalysisCount: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  clearItems: (option: ClearOption) => Promise<void>;
  
  // 监听事件
  setupEventListeners: () => Promise<void>;
}

// 创建剪贴板状态仓库
export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  filteredItems: [],
  loading: false,
  error: null,
  searchText: '',
  showFavoritesOnly: false,
  showPinnedOnly: false,
  selectedCategory: null,
  isInitialized: false,
  isEventListenerSet: false,
  categoryCache: {},
  
  // 初始化存储
  initializeStore: async () => {
    // 如果已经初始化过，则直接返回
    if (get().isInitialized) {
      // 仍然确保事件监听器设置
      if (!get().isEventListenerSet) {
        await get().setupEventListeners();
      }
      return;
    }
    
    set({ loading: true });
    
    try {
      await get().fetchItems();
      
      // 确保事件监听器已设置
      if (!get().isEventListenerSet) {
        await get().setupEventListeners();
      }
      
      set({ isInitialized: true });
    } catch (error) {
      console.error('初始化存储失败:', error);
      set({ error: `初始化失败: ${error}` });
    } finally {
      set({ loading: false });
    }
  },
  
  // 获取所有剪贴板条目
  fetchItems: async () => {
    // 如果已经在加载中，避免重复请求
    if (get().loading) return;
    
    set({ loading: true, error: null });
    try {
      // 调用Rust后端获取剪贴板历史
      console.log('开始获取剪贴板历史...');
      const result = await invoke<ClipboardItem[]>('get_clipboard_history');
      console.log(`获取到 ${result.length} 条剪贴板记录`);
      
      // 预处理分类缓存，提高筛选性能
      const categoryCache: Record<string, ClipboardItem[]> = {};
      
      // 构建各分类的缓存
      result.forEach(item => {
        // 确保每个项目都有分类
        const category = item.category || 'text';
        if (!categoryCache[category]) {
          categoryCache[category] = [];
        }
        categoryCache[category].push(item);
      });
      
      set({ 
        items: result, 
        categoryCache,
        isInitialized: true
      });
      get().applyFilters();
    } catch (error) {
      set({ error: `获取剪贴板历史失败: ${error}` });
      console.error('获取剪贴板历史失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 设置搜索文本
  setSearchText: (text: string) => {
    set({ searchText: text });
    get().applyFilters();
  },
  
  // 设置只显示收藏
  setShowFavoritesOnly: (value: boolean) => {
    set({ showFavoritesOnly: value });
    get().applyFilters();
  },
  
  // 设置只显示固定项
  setShowPinnedOnly: (value: boolean) => {
    set({ showPinnedOnly: value });
    get().applyFilters();
  },
  
  // 设置选中的分类
  setSelectedCategory: (category: string | null) => {
    set({ selectedCategory: category });
    get().applyFilters();
  },
  
  // 应用筛选器 - 优化版
  applyFilters: () => {
    const { 
      items, 
      searchText, 
      showFavoritesOnly, 
      showPinnedOnly, 
      selectedCategory,
      categoryCache
    } = get();
    
    // 如果没有项目，直接设置空数组
    if (!items || items.length === 0) {
      set({ filteredItems: [] });
      return;
    }
    
    // 使用 requestAnimationFrame 优化性能
    requestAnimationFrame(() => {
      let filtered: ClipboardItem[];
      
      // 优先使用分类缓存来提高筛选速度
      if (selectedCategory && !showFavoritesOnly && !showPinnedOnly && !searchText) {
        filtered = [...(categoryCache[selectedCategory] || [])];
      } else {
        // 复制数组以避免修改原始数据
        filtered = [...items];
        
        // 使用更高效的筛选方式
        if (searchText) {
          const lowerSearchText = searchText.toLowerCase();
          filtered = filtered.filter(item => 
            item.content.toLowerCase().includes(lowerSearchText)
          );
        }
        
        // 应用收藏筛选
        if (showFavoritesOnly) {
          filtered = filtered.filter(item => item.favorite);
        }
        
        // 应用固定项筛选
        if (showPinnedOnly) {
          filtered = filtered.filter(item => item.pinned);
        }
        
        // 应用分类筛选
        if (selectedCategory) {
          filtered = filtered.filter(item => item.category === selectedCategory);
        }
      }
      
      // 首先按照重要性排序（固定 > 收藏），然后按照时间戳逆序排序（新的在前）
      filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.timestamp - a.timestamp; // 时间戳降序排序，确保新的内容在前
      });
      
      // 添加序号信息
      filtered = filtered.map((item, index) => ({
        ...item,
        index: index + 1 // 从1开始的序号
      }));
      
      set({ filteredItems: filtered });
    });
  },
  
  // 添加剪贴板条目
  addItem: async (content: string) => {
    set({ loading: true, error: null });
    try {
      const newItem: ClipboardItem = {
        id: uuidv4(),
        content,
        timestamp: Date.now(),
        favorite: false,
        pinned: false,
        category: detectCategory(content)
      };
      
      // 调用Rust后端保存剪贴板条目
      const result = await invoke<ClipboardOperationResult>('add_clipboard_item', { item: newItem });
      
      if (result.success) {
        // 更新本地数据和分类缓存
        set(state => {
          // 更新项目数组
          const updatedItems = [newItem, ...state.items];
          
          // 更新分类缓存
          const updatedCache = { ...state.categoryCache };
          const category = newItem.category || 'text';
          
          if (!updatedCache[category]) {
            updatedCache[category] = [];
          }
          updatedCache[category] = [newItem, ...updatedCache[category]];
          
          return { 
            items: updatedItems,
            categoryCache: updatedCache 
          };
        });
        
        get().applyFilters();
      } else {
        set({ error: result.message || '添加剪贴板条目失败' });
      }
    } catch (error) {
      set({ error: `添加剪贴板条目失败: ${error}` });
      console.error('添加剪贴板条目失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 删除剪贴板条目
  removeItem: async (id: string) => {
    set({ loading: true, error: null });
    try {
      // 获取要删除的项目，用于更新缓存
      const { items, categoryCache } = get();
      const itemToRemove = items.find(item => item.id === id);
      
      if (!itemToRemove) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      // 调用Rust后端删除剪贴板条目
      const result = await invoke<ClipboardOperationResult>('remove_clipboard_item', { id });
      
      if (result.success) {
        // 更新本地数据和分类缓存
        set(state => {
          // 从项目数组中移除
          const updatedItems = state.items.filter(item => item.id !== id);
          
          // 更新分类缓存
          const updatedCache = { ...state.categoryCache };
          const category = itemToRemove.category || 'text';
          
          if (updatedCache[category]) {
            updatedCache[category] = updatedCache[category].filter(item => item.id !== id);
          }
          
          return { 
            items: updatedItems,
            categoryCache: updatedCache 
          };
        });
        
        get().applyFilters();
      } else {
        set({ error: result.message || '删除剪贴板条目失败' });
      }
    } catch (error) {
      set({ error: `删除剪贴板条目失败: ${error}` });
      console.error('删除剪贴板条目失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 收藏/取消收藏剪贴板条目
  favoriteItem: async (id: string) => {
    try {
      const { items } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      const updatedItem = { ...item, favorite: !item.favorite };
      
      // 乐观更新UI
      set(state => ({
        items: state.items.map(i => i.id === id ? updatedItem : i),
        loading: true
      }));
      
      // 应用筛选以更新视图
      get().applyFilters();
      
      // 异步调用Rust后端更新剪贴板条目
      const result = await invoke<ClipboardOperationResult>('update_clipboard_item', { item: updatedItem });
      
      if (!result.success) {
        // 如果失败，回滚更新
        set(state => ({
          items: state.items.map(i => i.id === id ? item : i),
          loading: false,
          error: result.message || '更新剪贴板条目失败'
        }));
        get().applyFilters();
      }
    } catch (error) {
      set({ 
        error: `更新剪贴板条目失败: ${error}`,
        loading: false 
      });
      console.error('更新剪贴板条目失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 固定/取消固定剪贴板条目
  pinItem: async (id: string) => {
    try {
      const { items } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      const updatedItem = { ...item, pinned: !item.pinned };
      
      // 乐观更新UI
      set(state => ({
        items: state.items.map(i => i.id === id ? updatedItem : i),
        loading: true
      }));
      
      // 应用筛选以更新视图
      get().applyFilters();
      
      // 异步调用Rust后端更新剪贴板条目
      const result = await invoke<ClipboardOperationResult>('update_clipboard_item', { item: updatedItem });
      
      if (!result.success) {
        // 如果失败，回滚更新
        set(state => ({
          items: state.items.map(i => i.id === id ? item : i),
          loading: false,
          error: result.message || '更新剪贴板条目失败'
        }));
        get().applyFilters();
      }
    } catch (error) {
      set({ 
        error: `更新剪贴板条目失败: ${error}`,
        loading: false 
      });
      console.error('更新剪贴板条目失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 复制到剪贴板
  copyToClipboard: async (id: string) => {
    try {
      const { items } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      // 调用Rust后端将内容复制到系统剪贴板
      const result = await invoke<ClipboardOperationResult>('copy_to_clipboard', { content: item.content });
      
      if (!result.success) {
        set({ error: result.message || '复制到剪贴板失败' });
      }
    } catch (error) {
      set({ error: `复制到剪贴板失败: ${error}` });
      console.error('复制到剪贴板失败:', error);
    }
  },
  
  // 翻译剪贴板条目
  translateItem: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { items } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      // 调用Rust后端翻译内容
      const result = await invoke<ClipboardOperationResult>('translate_content', { 
        id, 
        content: item.content 
      });
      
      if (result.success && result.data) {
        const updatedItem = { ...item, translation: result.data.translation };
        
        set(state => ({
          items: state.items.map(i => i.id === id ? updatedItem : i)
        }));
        get().applyFilters();
      } else {
        set({ error: result.message || '翻译内容失败' });
      }
    } catch (error) {
      set({ error: `翻译内容失败: ${error}` });
      console.error('翻译内容失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 总结剪贴板条目
  summarizeItem: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { items } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      // 调用Rust后端总结内容
      const result = await invoke<ClipboardOperationResult>('summarize_content', { 
        id, 
        content: item.content 
      });
      
      if (result.success && result.data) {
        const updatedItem = { ...item, summary: result.data.summary };
        
        set(state => ({
          items: state.items.map(i => i.id === id ? updatedItem : i)
        }));
        get().applyFilters();
      } else {
        set({ error: result.message || '总结内容失败' });
      }
    } catch (error) {
      set({ error: `总结内容失败: ${error}` });
      console.error('总结内容失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 为剪贴板条目设置分类
  categorizeItem: async (id: string, category: string) => {
    try {
      const { items, categoryCache } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      // 乐观更新UI
      const oldCategory = item.category;
      const updatedItem = { ...item, category };
      
      // 更新本地状态以立即反映变化
      set(state => {
        // 更新items数组
        const updatedItems = state.items.map(i => i.id === id ? updatedItem : i);
        
        // 更新分类缓存
        const updatedCache = { ...state.categoryCache };
        
        // 从旧分类中删除
        if (oldCategory) {
          updatedCache[oldCategory] = (updatedCache[oldCategory] || [])
            .filter(i => i.id !== id);
        }
        
        // 添加到新分类
        if (!updatedCache[category]) {
          updatedCache[category] = [];
        }
        updatedCache[category] = [...updatedCache[category], updatedItem];
        
        return {
          items: updatedItems,
          categoryCache: updatedCache,
          loading: true // 设置为加载中，但不阻塞UI
        };
      });
      
      // 应用筛选以更新视图
      get().applyFilters();
      
      // 异步调用后端API更新
      const result = await invoke<ClipboardOperationResult>('update_clipboard_item', { item: updatedItem });
      
      if (!result.success) {
        // 如果后端更新失败，回滚更改
        set(state => ({
          items: state.items.map(i => i.id === id ? item : i),
          loading: false,
          error: result.message || '更新剪贴板条目分类失败'
        }));
        get().applyFilters();
      }
    } catch (error) {
      set({ 
        error: `更新剪贴板条目分类失败: ${error}`,
        loading: false 
      });
      console.error('更新剪贴板条目分类失败:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  // 清空所有剪贴板条目
  clearAll: async () => {
    set({ loading: true, error: null });
    try {
      // 调用Rust后端清空剪贴板历史
      const result = await invoke<ClipboardOperationResult>('clear_clipboard_history');
      
      if (result.success) {
        set({ items: [], filteredItems: [], categoryCache: {} });
        message.success('已清空所有剪贴板历史');
      } else {
        set({ error: result.message || '清空剪贴板历史失败' });
        message.error(result.message || '清空剪贴板历史失败');
      }
    } catch (error) {
      set({ error: `清空剪贴板历史失败: ${error}` });
      console.error('清空剪贴板历史失败:', error);
      message.error(`清空失败: ${error}`);
    } finally {
      set({ loading: false });
    }
  },
  
  // 清空特定条件的剪贴板条目
  clearItems: async (option: ClearOption) => {
    set({ loading: true, error: null });
    
    try {
      let itemsToKeep: ClipboardItem[] = [];
      const { items } = get();
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 设置为本周日
      weekStart.setHours(0, 0, 0, 0);
      
      switch (option) {
        case ClearOption.ALL:
          // 清空所有，复用现有方法
          return await get().clearAll();
          
        case ClearOption.TODAY:
          // 保留不是今天的条目
          itemsToKeep = items.filter(item => item.timestamp < todayStart.getTime());
          message.success('已清空今天的剪贴板历史');
          break;
          
        case ClearOption.THIS_WEEK:
          // 保留不是本周的条目
          itemsToKeep = items.filter(item => item.timestamp < weekStart.getTime());
          message.success('已清空本周的剪贴板历史');
          break;
          
        case ClearOption.PINNED:
          // 清空所有固定项
          itemsToKeep = items.filter(item => !item.pinned);
          message.success('已清空所有固定的剪贴板条目');
          break;
          
        case ClearOption.FAVORITES:
          // 清空所有收藏项
          itemsToKeep = items.filter(item => !item.favorite);
          message.success('已清空所有收藏的剪贴板条目');
          break;
      }
      
      // 调用后端批量删除接口
      // 注意：这里可能需要添加一个新的后端API来支持批量删除
      // 目前我们可以通过多次调用单个删除API来实现
      const itemsToDelete = items.filter(item => 
        !itemsToKeep.some(keepItem => keepItem.id === item.id)
      );
      
      // 批量删除操作
      const deletePromises = itemsToDelete.map(item => 
        invoke<ClipboardOperationResult>('remove_clipboard_item', { id: item.id })
      );
      
      await Promise.all(deletePromises);
      
      // 更新前端状态
      set(state => {
        // 重建分类缓存
        const categoryCache: Record<string, ClipboardItem[]> = {};
        itemsToKeep.forEach(item => {
          const category = item.category || 'text';
          if (!categoryCache[category]) {
            categoryCache[category] = [];
          }
          categoryCache[category].push(item);
        });
        
        return {
          items: itemsToKeep,
          categoryCache
        };
      });
      
      // 应用筛选器
      get().applyFilters();
      
    } catch (error) {
      set({ error: `清空剪贴板条目失败: ${error}` });
      console.error('清空剪贴板条目失败:', error);
      message.error(`清空失败: ${error}`);
    } finally {
      set({ loading: false });
    }
  },
  
  // 编辑剪贴板条目
  editItem: async (id: string, newContent: string) => {
    set({ loading: true, error: null });
    try {
      const { items } = get();
      const item = items.find(item => item.id === id);
      
      if (!item) {
        set({ error: '找不到指定的剪贴板条目' });
        return;
      }
      
      // 调用Rust后端编辑剪贴板条目
      const result = await invoke<ClipboardOperationResult>('edit_clipboard_item', { 
        id, 
        newContent 
      });
      
      if (result.success) {
        // 更新本地数据和分类缓存
        set(state => {
          // 创建更新后的项目
          const updatedItem: ClipboardItem = {
            ...item,
            content: newContent,
            translation: undefined, // 清除翻译，因为内容已更改
            summary: undefined // 清除摘要，因为内容已更改
          };
          
          // 更新项目数组
          const updatedItems = state.items.map(i => 
            i.id === id ? updatedItem : i
          );
          
          // 更新分类缓存
          const updatedCache = { ...state.categoryCache };
          
          // 从原分类中移除
          const oldCategory = item.category || 'text';
          if (updatedCache[oldCategory]) {
            updatedCache[oldCategory] = updatedCache[oldCategory].filter(i => i.id !== id);
          }
          
          // 添加到新分类中（如果分类变化）
          const newCategory = item.category || 'text'; // 保持原分类
          if (!updatedCache[newCategory]) {
            updatedCache[newCategory] = [];
          }
          updatedCache[newCategory].push(updatedItem);
          
          return { 
            items: updatedItems,
            categoryCache: updatedCache 
          };
        });
        
        message.success('编辑成功');
        get().applyFilters();
      } else {
        set({ error: result.message || '编辑剪贴板条目失败' });
        message.error(result.message || '编辑失败');
      }
    } catch (error) {
      set({ error: `编辑剪贴板条目失败: ${error}` });
      console.error('编辑剪贴板条目失败:', error);
      message.error(`编辑失败: ${error}`);
    } finally {
      set({ loading: false });
    }
  },
  
  // 更新AI分析次数
  updateAIAnalysisCount: async (id) => {
    const item = get().items.find(item => item.id === id);
    if (!item) return;
    
    try {
      const newCount = (item.aiAnalysisCount || 0) + 1;
      // 创建一个用于发送到后端的更新对象
      const updatedItem = {
        ...item,
        aiAnalysisCount: newCount
        // 后端会通过 serde 自动处理字段映射
      };
      
      console.log('发送到后端的更新项目:', JSON.stringify(updatedItem));
      
      const result = await invoke<ClipboardOperationResult>(
        'update_clipboard_item',
        { item: updatedItem }
      );
      
      if (result.success) {
        set(state => ({
          items: state.items.map(i => i.id === id ? { ...i, aiAnalysisCount: newCount } : i)
        }));
        
        // 重新应用筛选器
        get().applyFilters();
        
        console.log(`AI分析次数已更新: ${item.id}, 新计数: ${newCount}`);
        //message.success(`AI分析计数已更新 (${newCount})`);
      } else {
        console.error('更新AI分析次数失败:', result.message);
        //message.error(`更新AI分析次数失败: ${result.message}`);
      }
    } catch (error) {
      console.error('更新AI分析次数失败:', error);
      //message.error('更新AI分析次数失败');
    }
  },
  
  // 监听事件
  setupEventListeners: async () => {
    // 避免重复设置事件监听
    if (get().isEventListenerSet) {
      console.log('事件监听器已设置，跳过');
      return;
    }
    
    try {
      console.log('正在设置剪贴板变化事件监听...');
      // 监听 clipboard-change 事件
      await listen('clipboard-change', async () => {
        console.log('接收到剪贴板变化事件，刷新数据...');
        
        // 当收到剪贴板变化事件时，重新获取剪贴板历史
        await get().fetchItems();
      });
      
      console.log('已成功设置剪贴板变化事件监听');
      set({ isEventListenerSet: true });
    } catch (error) {
      console.error('设置事件监听失败:', error);
      set({ error: `设置事件监听失败: ${error}` });
    }
  }
})); 
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'react-hot-toast';
import { Role, RoleOperationResult } from '../models/role';

/**
 * 角色管理Store的状态
 */
interface RoleState {
  roles: Role[];
  loading: boolean;
  selectedRole: Role | null;
  defaultRole: Role | null;
  
  // 加载所有角色
  loadRoles: () => Promise<void>;
  // 添加角色
  addRole: (role: Omit<Role, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  // 更新角色
  updateRole: (role: Role) => Promise<boolean>;
  // 删除角色
  deleteRole: (id: string) => Promise<boolean>;
  // 重置角色为默认设置
  resetRole: (id: string) => Promise<boolean>;
  // 设置选中的角色
  setSelectedRole: (role: Role | null) => void;
}

/**
 * 角色管理Store
 */
const useRoleStore = create<RoleState>((set, get) => ({
  roles: [],
  loading: false,
  selectedRole: null,
  defaultRole: null,
  
  // 加载所有角色
  loadRoles: async () => {
    set({ loading: true });
    try {
      const roles = await invoke<Role[]>('get_roles');
      set({ roles, loading: false });
    } catch (error) {
      console.error('加载角色失败:', error);
      toast.error('加载角色失败');
      set({ loading: false });
    }
  },
  
  // 添加角色
  addRole: async (role) => {
    set({ loading: true });
    try {
      // 直接传递各个字段，而不是整个对象
      // 注意：进行字段名映射，从前端命名规则转换为后端命名规则
      const result = await invoke<RoleOperationResult>('add_role', { 
        name: role.name,
        description: role.description,
        systemPrompt: role.system_prompt,  // 前端: system_prompt -> 后端: systemPrompt
        icon: role.icon || '💻',
        isCustom: role.is_custom,          // 前端: is_custom -> 后端: isCustom
        avatar: role.avatar || null
      });
      
      if (result.success) {
        toast.success(result.message || '添加角色成功');
        // 重新加载角色列表
        await get().loadRoles();
        set({ loading: false });
        return true;
      } else {
        toast.error(result.message || '添加角色失败');
        set({ loading: false });
        return false;
      }
    } catch (error) {
      console.error('添加角色失败:', error);
      toast.error('添加角色失败');
      set({ loading: false });
      return false;
    }
  },
  
  // 更新角色
  updateRole: async (role) => {
    set({ loading: true });
    try {
      // 更新角色的更新时间
      const updatedRole: Role = {
        ...role,
        updated_at: Date.now(),
      };
      
      // 将整个角色对象作为命令参数
      const result = await invoke<RoleOperationResult>('update_role', { role: updatedRole });
      
      if (result.success) {
        toast.success(result.message || '更新角色成功');
        // 重新加载角色列表
        await get().loadRoles();
        set({ loading: false });
        return true;
      } else {
        toast.error(result.message || '更新角色失败');
        set({ loading: false });
        return false;
      }
    } catch (error) {
      console.error('更新角色失败:', error);
      toast.error('更新角色失败');
      set({ loading: false });
      return false;
    }
  },
  
  // 删除角色
  deleteRole: async (id) => {
    set({ loading: true });
    try {
      const result = await invoke<RoleOperationResult>('delete_role', { id });
      
      if (result.success) {
        toast.success(result.message || '删除角色成功');
        // 重新加载角色列表
        await get().loadRoles();
        set({ loading: false });
        return true;
      } else {
        toast.error(result.message || '删除角色失败');
        set({ loading: false });
        return false;
      }
    } catch (error) {
      console.error('删除角色失败:', error);
      toast.error('删除角色失败');
      set({ loading: false });
      return false;
    }
  },
  
  // 重置角色为默认设置
  resetRole: async (id) => {
    set({ loading: true });
    try {
      const result = await invoke<RoleOperationResult>('reset_role', { id });
      
      if (result.success) {
        toast.success(result.message || '重置角色成功');
        // 重新加载角色列表
        await get().loadRoles();
        set({ loading: false });
        return true;
      } else {
        toast.error(result.message || '重置角色失败');
        set({ loading: false });
        return false;
      }
    } catch (error) {
      console.error('重置角色失败:', error);
      toast.error('重置角色失败');
      set({ loading: false });
      return false;
    }
  },
  
  // 设置选中的角色
  setSelectedRole: (role) => {
    set({ selectedRole: role });
  },
}));

export default useRoleStore; 
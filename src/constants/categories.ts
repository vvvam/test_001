/**
 * 预定义的内容分类
 */
export interface CategoryItem {
  id?: string;
  label: string;
  value: string;
  color: string;
  isSystem?: boolean;
  createdAt?: number;
}

export const PREDEFINED_CATEGORIES: CategoryItem[] = [
  { label: '全部', value: 'all', color: '' },
  { label: '文本', value: 'text', color: 'blue' },
  { label: '代码', value: 'code', color: 'green' },
  { label: '链接', value: 'link', color: 'purple' },
  { label: '邮箱', value: 'email', color: 'gold' },
  { label: '密码', value: 'password', color: 'red' },
  { label: '其他', value: 'other', color: 'default' }
];

/**
 * 获取所有分类（包括自定义分类）
 */
export const getAllCategories = (): CategoryItem[] => {
  try {
    const savedCategories = localStorage.getItem('custom_categories');
    if (savedCategories) {
      return JSON.parse(savedCategories);
    }
  } catch (error) {
    console.error('读取自定义分类失败', error);
  }
  
  return PREDEFINED_CATEGORIES;
};

/**
 * 基于内容自动检测类别
 * @param content 内容文本
 * @returns 检测到的类别
 */
export const detectCategory = (content: string): string => {
  // 链接检测
  if (content.match(/^https?:\/\//i)) return 'link';
  
  // 邮箱检测
  if (content.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)) return 'email';
  
  // 代码检测
  if (content.match(/<[^>]*>/) || 
      content.match(/function\s*\(/) || 
      content.match(/^\s*import\s+/) || 
      content.match(/\{\s*[\w\d_]+:\s*[\w\d_]+\s*\}/)) {
    return 'code';
  }
  
  // 密码检测
  if (content.match(/\b(?:password|pwd|密码)\b/i)) return 'password';
  
  // 默认为文本
  return 'text';
};

/**
 * 获取分类对应的颜色
 * @param category 分类名
 * @returns 颜色名或颜色代码
 */
export const getCategoryColor = (category?: string): string => {
  if (!category) return '';
  
  // 从所有分类中查找（包括自定义分类）
  const allCategories = getAllCategories();
  const found = allCategories.find((c: CategoryItem) => c.value === category);
  
  if (found) {
    return found.color;
  }
  
  return 'default';
};

/**
 * 获取分类的标签名
 * @param category 分类名
 * @returns 显示的标签名
 */
export const getCategoryLabel = (category?: string): string => {
  if (!category) return '';
  
  // 从所有分类中查找（包括自定义分类）
  const allCategories = getAllCategories();
  const found = allCategories.find((c: CategoryItem) => c.value === category);
  
  return found ? found.label : category;
}; 
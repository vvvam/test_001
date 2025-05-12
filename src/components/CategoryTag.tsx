import React from 'react';
import { Tag } from 'antd';
import { getCategoryColor, getCategoryLabel } from '../constants/categories';

interface CategoryTagProps {
  category: string;
  size?: 'small' | 'default' | 'large';
  onClick?: () => void;
  selected?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * 统一的分类标签组件
 */
const CategoryTag: React.FC<CategoryTagProps> = ({
  category,
  size = 'default',
  onClick,
  selected = false,
  style,
  className
}) => {
  if (!category) return null;

  const color = getCategoryColor(category);
  const label = getCategoryLabel(category);
  
  // 大小设置
  const sizeStyle = {
    small: {
      padding: '0 6px',
      fontSize: '11px',
      borderRadius: '10px',
    },
    default: {
      padding: '2px 8px',
      fontSize: '12px',
      borderRadius: '12px',
    },
    large: {
      padding: '4px 10px',
      fontSize: '14px',
      borderRadius: '14px',
    }
  };
  
  // 基础样式
  const baseStyle: React.CSSProperties = {
    ...sizeStyle[size],
    display: 'inline-block',
    transition: 'all 0.2s ease',
    opacity: selected ? 1 : 0.85,
    cursor: onClick ? 'pointer' : 'default',
    ...style
  };

  return (
    <Tag
      color={color}
      style={baseStyle}
      onClick={onClick}
      className={className}
    >
      {label}
    </Tag>
  );
};

export default CategoryTag; 
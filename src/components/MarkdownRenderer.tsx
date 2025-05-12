import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../context/ThemeContext';
import '../styles/markdown.css';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

// 定义组件道具类型
interface HeadingProps {
  node?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

interface TableProps {
  children?: React.ReactNode;
  [key: string]: any;
}

interface LinkProps {
  children?: React.ReactNode;
  href?: string;
  [key: string]: any;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ children, className }) => {
  const { isDarkMode } = useTheme();
  const [processedContent, setProcessedContent] = useState<string>('');
  const [showThinking, setShowThinking] = useState<boolean>(false);
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [hasThinkingTags, setHasThinkingTags] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const thinkingContentRef = useRef<HTMLDivElement>(null);
  const lastThinkingContentLength = useRef<number>(0);

  // 自动滚动到思考内容底部
  useEffect(() => {
    if (isProcessing && showThinking && thinkingContentRef.current) {
      // 只有当内容增加时才自动滚动
      if (thinkingContent.length > lastThinkingContentLength.current) {
        thinkingContentRef.current.scrollTop = thinkingContentRef.current.scrollHeight;
        thinkingContentRef.current.classList.add('thinking-scroll-active');
        
        // 移除滚动样式以便下次添加
        setTimeout(() => {
          if (thinkingContentRef.current) {
            thinkingContentRef.current.classList.remove('thinking-scroll-active');
          }
        }, 500);
      }
      
      // 更新内容长度参考值
      lastThinkingContentLength.current = thinkingContent.length;
    }
  }, [thinkingContent, isProcessing, showThinking]);

  // 立即检测消息开头是否有思考标签，并自动显示思考内容
  useEffect(() => {
    if (!children) return;
    
    // 检测消息开头是否有思考标签
    const hasOpeningThinkTag = (content: string): boolean => {
      const patterns = [
        /<think>/i,
        /<thinking>/i,
        /<reasoning>/i,
        /<reflection>/i,
        /<内部思考>/i,
        /<思考>/i,
        /<思维链>/i,
        /<chain-of-thought>/i,
        /<deliberation>/i,
        /<internal>/i,
        /\[\[思考\]\]/i,
        /\[\[think\]\]/i,
        /\[\[thinking\]\]/i,
        /&lt;think&gt;/i,
        /&lt;thinking&gt;/i,
        /&lt;思考&gt;/i,
        /\/\/ 思考:/i,
        /\/\/ thinking:/i,
        /\/\*[\s]*思考[\s]*\*\//i,
        /\/\*[\s]*thinking[\s]*\*\//i
      ];
      
      // 只检查内容的前200个字符，提高性能
      const startContent = content.substring(0, 200);
      return patterns.some(pattern => pattern.test(startContent));
    };
    
    // 检测是否有完整的思考标签对
    const hasCompleteThinkingTag = (content: string): boolean => {
      const patterns = [
        /<think>[\s\S]*?<\/think>/i,
        /<thinking>[\s\S]*?<\/thinking>/i,
        /<reasoning>[\s\S]*?<\/reasoning>/i,
        /<reflection>[\s\S]*?<\/reflection>/i,
        /<内部思考>[\s\S]*?<\/内部思考>/i,
        /<思考>[\s\S]*?<\/思考>/i,
        /<思维链>[\s\S]*?<\/思维链>/i,
        /<chain-of-thought>[\s\S]*?<\/chain-of-thought>/i,
        /<deliberation>[\s\S]*?<\/deliberation>/i,
        /<internal>[\s\S]*?<\/internal>/i,
        /\[\[思考\]\][\s\S]*?\[\[\/思考\]\]/i,
        /\[\[think\]\][\s\S]*?\[\[\/think\]\]/i,
        /\[\[thinking\]\][\s\S]*?\[\[\/thinking\]\]/i,
        /&lt;think&gt;[\s\S]*?&lt;\/think&gt;/i,
        /&lt;thinking&gt;[\s\S]*?&lt;\/thinking&gt;/i,
        /&lt;思考&gt;[\s\S]*?&lt;\/思考&gt;/i,
        /\/\*[\s]*思考[\s]*\*\/[\s\S]*?\/\*[\s]*思考结束[\s]*\*\//i,
        /\/\*[\s]*thinking[\s]*\*\/[\s\S]*?\/\*[\s]*end thinking[\s]*\*\//i
      ];
      
      return patterns.some(pattern => pattern.test(content));
    };
    
    // 如果内容开头有思考标签但还没有完整的结束标签
    if (hasOpeningThinkTag(children) && !hasCompleteThinkingTag(children)) {
      // 检测到消息开头有思考标签，还在流式接收中
      setIsProcessing(true);
      // 自动显示思考状态
      setShowThinking(true);
      // 提取当前部分思考内容
      processThinkingContent(children);
    } else if (hasCompleteThinkingTag(children)) {
      // 检测到完整的思考标签对，说明思考内容已全部接收
      setIsProcessing(false);
      processThinkingContent(children);
    } else {
      setIsProcessing(false);
      processThinkingContent(children);
    }
  }, [children]);

  // 处理思考标签内容
  const processThinkingContent = (content: string) => {
    if (!content) {
      setProcessedContent('');
      setHasThinkingTags(false);
      setThinkingContent('');
      return;
    }
    
    // 支持多种思考标签格式
    const thinkingTagPatterns = [
      /<think>([\s\S]*?)<\/think>/g,       // Deepseek r1 格式
      /<thinking>([\s\S]*?)<\/thinking>/g, // 另一种可能的格式
      /<reasoning>([\s\S]*?)<\/reasoning>/g, // 推理格式
      /<reflection>([\s\S]*?)<\/reflection>/g, // 反思格式
      /<内部思考>([\s\S]*?)<\/内部思考>/g,  // 中文格式
      /<思考>([\s\S]*?)<\/思考>/g,         // 简化中文格式
      /<思维链>([\s\S]*?)<\/思维链>/g,      // 思维链中文格式
      /<chain-of-thought>([\s\S]*?)<\/chain-of-thought>/g, // 思维链英文格式
      /<reasoning>([\s\S]*?)<\/reasoning>/g, // 推理格式
      /<deliberation>([\s\S]*?)<\/deliberation>/g, // 深思熟虑格式
      /<internal>([\s\S]*?)<\/internal>/g, // 内部格式
      /\[\[思考\]\]([\s\S]*?)\[\[\/思考\]\]/g, // 另一种中文格式
      /\[\[think\]\]([\s\S]*?)\[\[\/think\]\]/g, // 另一种英文格式
      /\[\[thinking\]\]([\s\S]*?)\[\[\/thinking\]\]/g, // 另一种英文格式
      // 增加转义的标签格式
      /&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/g,
      /&lt;thinking&gt;([\s\S]*?)&lt;\/thinking&gt;/g,
      /&lt;思考&gt;([\s\S]*?)&lt;\/思考&gt;/g,
      // 处理单行注释思考样式
      /\/\/ 思考: (.*?)(?:\n|$)/g,
      /\/\/ thinking: (.*?)(?:\n|$)/g,
      /\/\/ 思维链: (.*?)(?:\n|$)/g,
      /\/\/ chain of thought: (.*?)(?:\n|$)/g,
      // 处理多行注释格式
      /\/\*[\s]*思考[\s]*\*\/([\s\S]*?)\/\*[\s]*思考结束[\s]*\*\//g,
      /\/\*[\s]*thinking[\s]*\*\/([\s\S]*?)\/\*[\s]*end thinking[\s]*\*\//g
    ];
    
    let processedText = content;
    let hasAnyThinkingTags = false;
    let extractedThinking = '';
    
    // 提取所有思考内容并替换
    for (const pattern of thinkingTagPatterns) {
      try {
        const matches = [...processedText.matchAll(pattern)];
        if (matches.length > 0) {
          hasAnyThinkingTags = true;
          
          // 收集所有思考内容
          matches.forEach(match => {
            if (match[1]) {
              extractedThinking += match[1] + '\n\n';
            }
          });
          
          // 替换思考内容标签
          processedText = processedText.replace(pattern, '');
        }
      } catch (error) {
        // 静默处理错误
      }
    }
    
    // 处理未闭合的思考标签（流式接收时可能出现）
    if (isProcessing) {
      // 检测开放的思考标签 <think>内容尚未结束（还没有</think>）
      const openTagPatterns = [
        { open: /<think>/i, close: /<\/think>/i },
        { open: /<thinking>/i, close: /<\/thinking>/i },
        { open: /<思考>/i, close: /<\/思考>/i },
        { open: /<思维链>/i, close: /<\/思维链>/i },
        { open: /<chain-of-thought>/i, close: /<\/chain-of-thought>/i },
        { open: /<reasoning>/i, close: /<\/reasoning>/i },
        { open: /<reflection>/i, close: /<\/reflection>/i },
        { open: /<内部思考>/i, close: /<\/内部思考>/i },
        { open: /<deliberation>/i, close: /<\/deliberation>/i },
        { open: /<internal>/i, close: /<\/internal>/i },
        { open: /\[\[思考\]\]/i, close: /\[\[\/思考\]\]/i },
        { open: /\[\[think\]\]/i, close: /\[\[\/think\]\]/i },
        { open: /\[\[thinking\]\]/i, close: /\[\[\/thinking\]\]/i }
      ];
      
      for (const { open, close } of openTagPatterns) {
        if (open.test(processedText) && !close.test(processedText)) {
          hasAnyThinkingTags = true;
          
          // 提取开放标签后的所有内容作为思考内容
          const openTagMatch = open.exec(processedText);
          if (openTagMatch && openTagMatch.index !== undefined) {
            const startIndex = openTagMatch.index + openTagMatch[0].length;
            const unclosedThinking = processedText.substring(startIndex);
            
            if (unclosedThinking.trim()) {
              extractedThinking += unclosedThinking + '\n\n(思考内容正在生成中...)';
              
              // 从原内容中移除正在生成的思考内容，因为它还没有完成
              processedText = processedText.substring(0, openTagMatch.index);
            }
          }
        }
      }
    }
    
    // 更新状态
    setHasThinkingTags(hasAnyThinkingTags);
    setThinkingContent(extractedThinking.trim() || '思考内容正在生成中...');
    setProcessedContent(processedText.trim());
  };
  
  const formatMarkdown = (content: string): string => {
    if (!content) return '';
    
    try {
      // 1. 确保标题格式正确 (# 后有空格)
      let text = content.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
      
      // 2. 确保处理多行标题
      text = text.replace(/^(#{1,6}\s.*?)(\n)(?!\n)/gm, '$1\n\n');
      
      // 3. 确保标题后面有空行
      text = text.replace(/^(#{1,6}\s.*?)(\n)(?!\n)/gm, '$1\n\n');
      
      // 4. 确保空行正确处理
      text = text.replace(/\n{3,}/g, '\n\n');
      
      // 5. 特殊处理文本开头的标题
      if (text.trim().startsWith('#')) {
        const firstLine = text.trim().split('\n')[0];
        if (!firstLine.match(/^#{1,6}\s/)) {
          text = text.replace(firstLine, firstLine.replace(/^(#+)/, '$1 '));
        }
      }
      
      return text;
    } catch (error) {
      return content;
    }
  };
  
  const components = {
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={isDarkMode ? atomDark : oneLight}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    table({ children, ...props }: TableProps) {
      return (
        <div className="table-container">
          <table {...props}>{children}</table>
        </div>
      );
    },
    a({ children, href, ...props }: LinkProps) {
      const isExternal = href && (href.startsWith('http') || href.startsWith('https'));
      return (
        <a 
          href={href} 
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    // 自定义标题渲染
    h1: ({ children, ...props }: HeadingProps) => (
      <h1 className="md-heading md-h1" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: HeadingProps) => (
      <h2 className="md-heading md-h2" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: HeadingProps) => (
      <h3 className="md-heading md-h3" {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: HeadingProps) => (
      <h4 className="md-heading md-h4" {...props}>{children}</h4>
    ),
    h5: ({ children, ...props }: HeadingProps) => (
      <h5 className="md-heading md-h5" {...props}>{children}</h5>
    ),
    h6: ({ children, ...props }: HeadingProps) => (
      <h6 className="md-heading md-h6" {...props}>{children}</h6>
    ),
    // 自定义段落渲染
    p: ({ children, ...props }: any) => {
      // 如果内容为空，添加一个不可见的空格以保持段落高度
      if (!children || (Array.isArray(children) && children.length === 0)) {
        return <p className="empty-p" {...props}>&nbsp;</p>;
      }
      return <p {...props}>{children}</p>;
    }
  };
  
  return (
    <div className={`markdown-wrapper markdown-content ${className || ''} ${isDarkMode ? 'dark-theme' : ''}`}>
      {hasThinkingTags && (
        <div className="thinking-control">
          <button 
            onClick={() => setShowThinking(!showThinking)} 
            className={`thinking-toggle ${showThinking ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
          >
            <span className="thinking-indicator"></span>
            <span className="thinking-label">{showThinking ? '隐藏思考过程' : '显示思考过程'}</span>
            {isProcessing && <span className="thinking-processing-indicator">思考中...</span>}
          </button>
          
          {showThinking && (
            <div 
              className={`thinking-content ${isProcessing ? 'processing' : ''}`}
              ref={thinkingContentRef}
            >
              <div className="thinking-header">
                <span className="thinking-title">AI的思考过程</span>
                {isProcessing && <span className="thinking-live-indicator"></span>}
              </div>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={components}
              >
                {formatMarkdown(thinkingContent)}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
      
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {formatMarkdown(processedContent)}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 
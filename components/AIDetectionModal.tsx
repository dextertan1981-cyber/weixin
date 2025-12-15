/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ShieldCheckIcon, ClipboardDocumentIcon, SparklesIcon, ArrowTopRightOnSquareIcon, PencilIcon, BugAntIcon, PaintBrushIcon, CodeBracketSquareIcon, CpuChipIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { ChartPieIcon } from '@heroicons/react/24/solid';
import { rewriteTextSegment, smartFormatContent, analyzeStyleAndGeneratePrompt } from '../gemini';
import { DebugModal } from './DebugModal';

interface AIDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  currentHtml?: string;
  onFixStrategy?: (strategy: string) => void;
  currentStrategy?: string;
  fixCount?: number; // Optimization version counter
  failedStrategies?: string[]; // List of already failed strategies
}

const TENCENT_URL = 'https://matrix.tencent.com/ai-detect/ai_gen';
const DEFAULT_INSTRUCTION = "用更自然、口语化的语气改写，去除翻译腔。";

export const AIDetectionModal: React.FC<AIDetectionModalProps> = ({ 
    isOpen, onClose, content, 
    currentHtml = "", onFixStrategy = () => {}, currentStrategy = "section", fixCount = 0, failedStrategies = []
}) => {
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<{human: number, ai: number, suspected: number} | null>(null);
  
  // Reverse Engineering State
  const [showReverseEngineer, setShowReverseEngineer] = useState(false);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const styleEditorRef = useRef<HTMLDivElement>(null);

  const [isFormatting, setIsFormatting] = useState(false);

  // Rewrite Modal State
  const [showRewriteDialog, setShowRewriteDialog] = useState(false);
  const [rewriteTargetElement, setRewriteTargetElement] = useState<HTMLElement | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState(DEFAULT_INSTRUCTION);
  const [isRewriting, setIsRewriting] = useState(false);
  
  // Debug Modal State
  const [showDebugModal, setShowDebugModal] = useState(false);

  // Track the editing element to handle pastes and rewrites
  const editorRef = useRef<HTMLDivElement>(null);

  // When modal opens, populate the editor with clean text initially
  useEffect(() => {
    if (isOpen && editorRef.current) {
        // Just text content initially
        const clean = content.replace(/<[^>]+>/g, '');
        editorRef.current.innerText = clean;
        setResult(null); 
    }
  }, [isOpen, content]);

  const handleJumpToTencent = () => {
    setDetecting(true);
    const currentText = editorRef.current?.innerText || "";
    navigator.clipboard.writeText(currentText).then(() => {
    }).catch(err => console.error(err));
    window.open(TENCENT_URL, '_blank');
    setTimeout(() => {
        setDetecting(false);
    }, 1000);
  };

  const handleCopyText = () => {
      const currentText = editorRef.current?.innerText || "";
      navigator.clipboard.writeText(currentText).then(() => {
          alert("文本已复制，可前往检测");
      }).catch(err => console.error("复制失败", err));
  };

  // Reverse Engineering Logic
  const handleReverseEngineer = async () => {
      if (!styleEditorRef.current) return;
      const htmlContent = styleEditorRef.current.innerHTML;
      if (!htmlContent.trim()) {
          alert("请先粘贴包含排版的文章内容");
          return;
      }
      
      setAnalyzingStyle(true);
      setGeneratedPrompt("");
      try {
          const prompt = await analyzeStyleAndGeneratePrompt(htmlContent);
          setGeneratedPrompt(prompt);
      } catch (e) {
          console.error(e);
          setGeneratedPrompt("分析失败，请重试。");
      } finally {
          setAnalyzingStyle(false);
      }
  };

  // Auto Formatting Logic
  const handleAutoFormat = async () => {
      if (!editorRef.current) return;
      const rawText = editorRef.current.innerText;
      if (!rawText.trim()) return;

      setIsFormatting(true);
      try {
          const htmlSnippet = await smartFormatContent(rawText);
          const styledHtml = applyWeChatStyles(htmlSnippet); // Apply current formatting logic locally
          editorRef.current.innerHTML = styledHtml;
          setTimeout(analyzePastedContent, 200);
      } catch (e) {
          console.error("Format failed", e);
          alert("自动排版失败，请稍后重试");
      } finally {
          setIsFormatting(false);
      }
  };

  // Local style injector for the modal preview (simplified version of App.tsx logic)
  const applyWeChatStyles = (html: string): string => {
      // NOTE: For the AI Detection Modal, we use a simple generic format. 
      // The heavy duty strategies are in App.tsx.
      // We'll mimic the "section" strategy here for consistency.
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const applyStyle = (element: HTMLElement, defaultStyles: Partial<CSSStyleDeclaration>) => {
          for (const [key, value] of Object.entries(defaultStyles)) {
              if (!element.style[key as any]) {
                  element.style[key as any] = value as string;
              }
          }
      };
      
      const headers = doc.querySelectorAll('h2, h3');
      headers.forEach(header => {
          const el = header as HTMLElement;
          const section = doc.createElement('section');
          section.style.cssText = `text-align: center; margin-top: 40px; margin-bottom: 16px; line-height: 1.4;`;
          const strong = doc.createElement('strong');
          strong.style.cssText = `font-size: 17px; font-weight: bold; color: #333333;`;
          strong.innerHTML = el.innerHTML;
          section.appendChild(strong);
          if (el.parentNode) el.parentNode.replaceChild(section, el);
      });
      
      const paragraphs = doc.querySelectorAll('p');
      paragraphs.forEach(p => {
          const el = p as HTMLElement;
          if (!el.querySelector('strong') || el.style.textAlign !== 'center') {
              applyStyle(el, {
                  margin: '0 0 16px 0', fontSize: '16px', lineHeight: '1.75', color: '#333333', textAlign: 'justify'
              });
          }
      });

      const bolds = doc.querySelectorAll('strong, b');
      bolds.forEach(el => {
          if (el.parentElement?.tagName !== 'SECTION') {
              (el as HTMLElement).style.cssText = 'font-weight: 700; color: #333333;';
          }
      });
      
      const ems = doc.querySelectorAll('em');
      ems.forEach(el => {
          const strong = doc.createElement('strong');
          strong.style.cssText = 'color: #ff5f00; font-weight: bold; font-style: normal; padding: 0 2px;';
          strong.innerHTML = el.innerHTML;
          if (el.parentNode) el.parentNode.replaceChild(strong, el);
      });

      return doc.body.innerHTML;
  };

  const handleClear = () => {
    if (editorRef.current) {
        editorRef.current.innerHTML = "";
        setResult(null);
    }
  };

  // Helper to determine if a color is "suspicious"
  const getSegmentType = (element: HTMLElement): 'ai' | 'suspected' | null => {
      const style = window.getComputedStyle(element);
      const bg = style.backgroundColor; 
      
      const rgb = bg.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
          const [r, g, b, a] = rgb.map(Number);
          if (rgb.length === 4 && a === 0) return null; 

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isNeutral = (max - min) < 20; 

          if ((r > 245 && g > 245 && b > 245) || (style.opacity === '0') || (r < 15 && g < 15 && b < 15) || isNeutral) {
              return null;
          }
          
          if (r > 200 && g < 180 && b < 180) return 'ai';
          if (r > 100 && b > 180 && g < 150) return 'ai';
          if (r > 180 && g > 150 && b < 150) return 'suspected';
          
          return 'suspected';
      }
      return null;
  };

  const injectRewriteButtons = () => {
      if (!editorRef.current) return;
      const allElements = editorRef.current.querySelectorAll('*');
      allElements.forEach((el) => {
          const element = el as HTMLElement;
          if (element.classList.contains('ai-rewrite-ui')) return;
          if (element.tagName === 'BUTTON') return;
          if (element.closest('.ai-rewrite-ui')) return; 

          const type = getSegmentType(element);
          
          if (type) {
              if (element.querySelector('.ai-rewrite-btn')) return;

              element.style.position = 'relative';
              element.style.display = 'inline-block'; 
              
              const btn = document.createElement('button');
              btn.className = 'ai-rewrite-btn ai-rewrite-ui';
              btn.contentEditable = "false"; 
              
              btn.style.position = 'absolute';
              btn.style.top = '-20px'; 
              btn.style.right = '-10px';
              btn.style.backgroundColor = type === 'ai' ? '#ef4444' : '#f59e0b'; 
              btn.style.color = '#ffffff';
              btn.style.borderRadius = '6px';
              btn.style.padding = '2px 8px';
              btn.style.fontSize = '12px';
              btn.style.fontWeight = 'bold';
              btn.style.cursor = 'pointer';
              btn.style.zIndex = '50';
              btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
              btn.style.border = '1px solid white';
              btn.style.whiteSpace = 'nowrap';
              btn.style.display = 'flex';
              btn.style.alignItems = 'center';
              btn.style.gap = '4px';

              btn.innerHTML = getBtnIconHtml();

              btn.onclick = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRewriteInstruction(DEFAULT_INSTRUCTION);
                  setRewriteTargetElement(element);
                  setShowRewriteDialog(true);
              };

              element.appendChild(btn);
          }
      });
  };

  const getBtnIconHtml = () => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 12px; height: 12px;">
      <path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6.97 11.03a.75.75 0 111.06-1.06l.75.75-.75.75zM11.03 6.97a.75.75 0 111.06-1.06l.75.75-.75.75zM8.196 11.23a.75.75 0 011.06 1.06l-.75.75.75.75a.75.75 0 11-1.06 1.06l-.75-.75-.75.75a.75.75 0 11-1.06-1.06l.75-.75-.75-.75z" clip-rule="evenodd" />
    </svg>
    AI改写
  `;

  const executeRewrite = async () => {
      if (!rewriteTargetElement || isRewriting) return;
      
      setIsRewriting(true);
      const element = rewriteTargetElement;
      
      const btn = element.querySelector('.ai-rewrite-btn') as HTMLElement;
      if (btn) {
          btn.innerHTML = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 思考中...`;
          btn.style.backgroundColor = '#9ca3af'; 
      }

      try {
          const originalText = element.innerText; 
          const context = editorRef.current?.innerText || "";
          const newText = await rewriteTextSegment(originalText, context, rewriteInstruction);
          
          element.innerText = newText;
          element.style.backgroundColor = 'transparent';
          element.style.color = '#15803d'; 
          element.style.fontWeight = 'bold';
          element.style.textDecoration = 'none';
          
          analyzePastedContent();
          
          setShowRewriteDialog(false);
          setRewriteTargetElement(null);
      } catch (err) {
          console.error("Rewrite failed", err);
          if (btn) btn.innerHTML = `重试`; 
      } finally {
          setIsRewriting(false);
      }
  };

  const analyzePastedContent = () => {
      if (!editorRef.current) return;
      
      const container = editorRef.current;
      const textNodes: {type: 'human' | 'ai' | 'suspected', length: number}[] = [];
      let totalLength = 0;

      const walk = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || "";
              if (!text.trim()) return;

              let type: 'human' | 'ai' | 'suspected' = 'human';
              
              if (node.parentElement) {
                  const segType = getSegmentType(node.parentElement);
                  if (segType) type = segType;
              }

              textNodes.push({ type, length: text.length });
              totalLength += text.length;
          } else {
              node.childNodes.forEach(walk);
          }
      };

      walk(container);
      injectRewriteButtons();

      if (totalLength === 0) return;

      const stats = textNodes.reduce((acc, curr) => {
          acc[curr.type] += curr.length;
          return acc;
      }, { human: 0, ai: 0, suspected: 0 });

      setResult({
          human: Math.round((stats.human / totalLength) * 100),
          ai: Math.round((stats.ai / totalLength) * 100),
          suspected: Math.round((stats.suspected / totalLength) * 100)
      });
  };
  
  const handlePaste = () => {
      setTimeout(analyzePastedContent, 100);
  };
  
  useEffect(() => {
      if (editorRef.current) {
          injectRewriteButtons();
      }
  }, []);

  if (!isOpen) return null;

  return (
    <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                    <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">AI 内容检测与优化助手</h2>
                    <p className="text-xs text-gray-500">支持分析腾讯/朱雀系统检测结果，并提供智能改写</p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-gray-50 relative">
            
            {/* Left: Text Source (Editable) */}
            <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden m-4 bg-white rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <ClipboardDocumentIcon className="w-4 h-4" />
                        待检测文本 / 粘贴结果区域
                    </span>
                    <div className="flex gap-3 items-center">
                        <button 
                            onClick={() => setShowDebugModal(true)}
                            className="text-xs font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded"
                        >
                            <WrenchScrewdriverIcon className="w-3 h-3" />
                            DEBUG 调试
                        </button>
                        <div className="h-3 w-px bg-gray-300"></div>
                        <button 
                            onClick={() => setShowReverseEngineer(true)}
                            className={`text-xs font-medium flex items-center gap-1 text-gray-500 hover:text-indigo-600`}
                        >
                            <CodeBracketSquareIcon className="w-3 h-3" />
                            样式逆向
                        </button>
                        <div className="h-3 w-px bg-gray-300"></div>
                        <button 
                            onClick={handleAutoFormat}
                            disabled={isFormatting}
                            className={`text-xs font-medium flex items-center gap-1 ${isFormatting ? 'text-indigo-400 cursor-wait' : 'text-indigo-600 hover:text-indigo-800'} relative`}
                        >
                            {isFormatting ? (
                                <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <PaintBrushIcon className="w-3 h-3" />
                            )}
                            一键排版
                            {fixCount > 0 && (
                                <span className="absolute -top-3 -right-3 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                    v{fixCount}
                                </span>
                            )}
                        </button>
                        <div className="h-3 w-px bg-gray-300"></div>
                        <button onClick={handleCopyText} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                            <ClipboardDocumentIcon className="w-3 h-3" />
                            一键复制
                        </button>
                        <button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-500 hover:underline">
                            清空内容
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 relative">
                    <div 
                        ref={editorRef}
                        contentEditable
                        onPaste={handlePaste}
                        className="outline-none min-h-full text-gray-600 leading-relaxed whitespace-pre-wrap text-justify text-base"
                        style={{ minHeight: '100%' }}
                    >
                    </div>
                    
                    {!editorRef.current?.innerText && (
                        <div className="absolute top-6 left-6 text-gray-400 pointer-events-none">
                            1. 点击右侧“一键跳转朱雀系统”，文本将自动复制。<br/>
                            2. 在官网完成检测后，全选并复制检测结果（包含颜色的文字）。<br/>
                            3. 将结果粘贴回此处，即可点击右上角按钮进行改写。
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Analysis Result */}
            <div className="w-full lg:w-[400px] flex flex-col m-4 ml-0 bg-white rounded-xl shadow-sm overflow-hidden shrink-0">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <ChartPieIcon className="w-4 h-4" />
                        检测报告
                    </span>
                </div>
                
                <div className="flex-1 p-6 flex flex-col items-center justify-center relative">
                    {detecting ? (
                        <div className="text-center animate-pulse">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <ArrowTopRightOnSquareIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                            </div>
                            <p className="text-gray-800 font-medium">正在跳转检测官网...</p>
                            <p className="text-xs text-gray-400 mt-2 px-8">文本已自动复制</p>
                        </div>
                    ) : result ? (
                        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Summary Box */}
                            <div className={`mb-8 p-4 rounded-lg text-center ${result.human > 60 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                                <span className="font-bold text-lg">
                                    {result.human > 60 ? '人工创作特征显著' : '疑似包含 AI 生成内容'}
                                </span>
                                <div className="text-xs mt-1 opacity-80">
                                    提示：点击有色段落右上角的按钮可一键改写
                                </div>
                            </div>

                            {/* Chart Representation */}
                            <div className="relative w-48 h-48 mx-auto mb-8">
                                <div 
                                    className="w-full h-full rounded-full"
                                    style={{
                                        background: `conic-gradient(
                                            #4ade80 0% ${result.human}%, 
                                            #facc15 ${result.human}% ${result.human + result.suspected}%, 
                                            #ef4444 ${result.human + result.suspected}% 100%
                                        )`
                                    }}
                                ></div>
                                <div className="absolute inset-6 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                                    <span className="text-3xl font-bold text-gray-800">{result.human}%</span>
                                    <span className="text-xs text-gray-400">人工特征</span>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="space-y-3 px-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                        <span className="text-sm text-gray-600">人工特征</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-800">{result.human}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                        <span className="text-sm text-gray-600">疑似 AI</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-800">{result.suspected}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <span className="text-sm text-gray-600">AI 特征</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-800">{result.ai}%</span>
                                </div>
                            </div>
                            
                            {(result.ai > 0 || result.suspected > 0) && (
                                <div className="mt-6 flex items-center justify-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded-lg text-xs">
                                    <SparklesIcon className="w-4 h-4" />
                                    <span>建议反复改写直至人工特征 100%</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400">
                            <ShieldCheckIcon className="w-16 h-16 mx-auto mb-3 opacity-20" />
                            <p>粘贴检测结果后自动分析</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-gray-100">
                    <button
                        onClick={handleJumpToTencent}
                        disabled={detecting}
                        className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                            ${detecting 
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30 active:scale-[0.98]'
                            }
                        `}
                    >
                        {detecting ? (
                            '正在跳转...'
                        ) : (
                            <>
                                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                                一键跳转朱雀系统
                            </>
                        )}
                    </button>
                </div>
            </div>
            </div>

            {/* Reverse Engineering Modal */}
            {showReverseEngineer && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl h-[80vh] mx-4 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <CodeBracketSquareIcon className="w-5 h-5 text-indigo-600" />
                                公众号样式逆向工程
                            </h3>
                            <button onClick={() => setShowReverseEngineer(false)} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 flex gap-4 overflow-hidden">
                            <div className="flex-1 flex flex-col border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                                <div className="px-3 py-2 border-b border-gray-200 bg-white text-xs text-gray-500 font-medium">
                                    在此粘贴微信公众号预览文章（保留格式）
                                </div>
                                <div 
                                    ref={styleEditorRef}
                                    contentEditable
                                    className="flex-1 p-4 outline-none overflow-y-auto"
                                    style={{ minHeight: '200px' }}
                                />
                            </div>

                            <div className="w-1/3 flex flex-col border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                                <div className="px-3 py-2 border-b border-gray-200 bg-white text-xs text-gray-500 font-medium flex justify-between items-center">
                                    <span>生成的 AI 排版指令</span>
                                    {generatedPrompt && (
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedPrompt);
                                                alert("已复制指令");
                                            }}
                                            className="text-indigo-600 hover:text-indigo-800"
                                        >
                                            复制
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 p-3 overflow-y-auto text-xs font-mono text-gray-700 whitespace-pre-wrap bg-white">
                                    {analyzingStyle ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                            <CpuChipIcon className="w-8 h-8 animate-spin-slow text-indigo-500" />
                                            <span>AI 正在分析样式...</span>
                                        </div>
                                    ) : generatedPrompt ? (
                                        generatedPrompt
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-center p-4">
                                            点击下方按钮开始分析
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setShowReverseEngineer(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleReverseEngineer}
                                disabled={analyzingStyle}
                                className={`px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2
                                    ${analyzingStyle ? 'opacity-50 cursor-wait' : ''}
                                `}
                            >
                                <SparklesIcon className="w-4 h-4" />
                                开始逆向工程
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rewrite Instruction Dialog */}
            {showRewriteDialog && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <PencilIcon className="w-5 h-5 text-indigo-600" />
                                AI 改写指令
                            </h3>
                            <button onClick={() => setShowRewriteDialog(false)} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                请告诉 AI 如何修改这段文字：
                            </label>
                            <textarea
                                value={rewriteInstruction}
                                onChange={(e) => setRewriteInstruction(e.target.value)}
                                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm text-gray-700"
                                placeholder="例如：把这句话改得更口语化一些，不要太生硬..."
                            />
                        </div>
                        
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowRewriteDialog(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={executeRewrite}
                                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <SparklesIcon className="w-4 h-4" />
                                开始改写
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>

        {/* Debug Modal */}
        <DebugModal 
            isOpen={showDebugModal}
            onClose={() => setShowDebugModal(false)}
            sourceHtml={currentHtml}
            onApplyFix={onFixStrategy}
            currentStrategy={currentStrategy}
            failedStrategies={failedStrategies} // Pass list of already failed strategies
        />
    </>
  );
};
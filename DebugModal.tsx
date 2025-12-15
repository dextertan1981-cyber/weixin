/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, WrenchScrewdriverIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { analyzeLayoutDiff } from '../gemini';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceHtml: string;
  onApplyFix: (newStrategy: string) => void;
  currentStrategy: string;
  failedStrategies?: string[];
}

export const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose, sourceHtml, onApplyFix, currentStrategy, failedStrategies = [] }) => {
  const [pastedHtml, setPastedHtml] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [suggestedStrategy, setSuggestedStrategy] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const pasteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAnalysis(null);
      setSuggestedStrategy(null);
      setPastedHtml('');
      if (pasteRef.current) {
          pasteRef.current.innerHTML = '';
      }
    }
  }, [isOpen]);

  const handleCalibrate = async () => {
    if (!pastedHtml.trim()) {
      alert("请在右侧粘贴从微信公众号复制回来的代码");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setSuggestedStrategy(null);

    // Accumulate all failures: explicitly passed failed strategies + the current one (since user is debugging it)
    const effectiveFailures = [...new Set([...failedStrategies, currentStrategy])];

    try {
        const result = await analyzeLayoutDiff(sourceHtml, pastedHtml, effectiveFailures);
        // Explicitly append recommendation to the text for clarity
        const enhancedAnalysis = `${result.reasoning}\n\n👉 强烈推荐尝试新方案：${result.recommendedStrategy}`;
        setAnalysis(enhancedAnalysis);
        setSuggestedStrategy(result.recommendedStrategy);
    } catch (error) {
        console.error("AI Analysis failed:", error);
        setAnalysis("AI 分析服务连接失败。");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleFix = () => {
      if (suggestedStrategy) {
          onApplyFix(suggestedStrategy);
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
                <WrenchScrewdriverIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-gray-900">AI 样式调试与矫正实验室</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>当前策略: <span className="font-mono font-bold bg-gray-200 px-1 rounded uppercase">{currentStrategy}</span></span>
                    {analysis && <span className="text-green-600 flex items-center gap-1"><CpuChipIcon className="w-3 h-3" /> AI 分析完成</span>}
                </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
            {/* Left: Source */}
            <div className="flex-1 flex flex-col border-r border-gray-200 bg-gray-50">
                <div className="px-4 py-2 bg-white border-b border-gray-100 text-xs font-bold text-gray-500 flex justify-between">
                    <span>原始一键排版代码 (只读)</span>
                    <span className="text-indigo-500">已自动标记标题 ID</span>
                </div>
                <div className="flex-1 p-4 overflow-auto font-mono text-xs text-gray-600 whitespace-pre-wrap select-all">
                    {sourceHtml}
                </div>
            </div>

            {/* Right: Paste */}
            <div className="flex-1 flex flex-col bg-white relative">
                <div className="px-4 py-2 bg-white border-b border-gray-100 text-xs font-bold text-gray-500">
                    在此粘贴微信公众号保存后的内容
                </div>
                {/* Replaced textarea with contentEditable div to support HTML pasting */}
                <div 
                    ref={pasteRef}
                    className="flex-1 p-4 w-full h-full outline-none font-mono text-xs text-gray-800 bg-white overflow-auto border-0"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setPastedHtml(e.currentTarget.innerHTML)}
                />
                {!pastedHtml && (
                    <div className="absolute top-12 left-4 right-4 text-gray-400 text-xs pointer-events-none select-none">
                        请将左侧代码复制到微信公众号编辑器 -&gt; 保存 -&gt; 再从微信编辑器复制回来粘贴到这里...
                        <br/><br/>
                        (支持直接粘贴富文本格式，AI 将自动分析样式丢失情况)
                    </div>
                )}
            </div>
        </div>

        {/* Analysis Panel (Bottom) */}
        <div className="h-auto min-h-[180px] bg-white border-t border-gray-200 p-6 flex flex-col gap-4">
            {!analysis ? (
                <div className="flex items-center justify-center h-full">
                    <button 
                        onClick={handleCalibrate}
                        disabled={isAnalyzing}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all transform hover:scale-105
                            ${isAnalyzing ? 'bg-gray-400 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-indigo-500/30'}
                        `}
                    >
                        {isAnalyzing ? (
                            <>
                                <CpuChipIcon className="w-5 h-5 animate-spin" />
                                AI 正在深度分析 DOM 差异...
                            </>
                        ) : (
                            <>
                                <CpuChipIcon className="w-5 h-5" />
                                启动 AI 诊断与修复
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="flex items-start gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex-1 p-5 rounded-xl bg-gray-50 border border-gray-100 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
                            AI 诊断报告
                        </h4>
                        <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                            {analysis}
                        </div>
                    </div>
                    
                    <div className="w-72 flex flex-col items-center justify-center gap-3 pt-2 shrink-0">
                        {suggestedStrategy ? (
                            <button 
                                onClick={handleFix}
                                className="w-full px-6 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-xl hover:shadow-green-500/30 flex items-center justify-center gap-2 transition-all animate-pulse transform hover:scale-[1.02]"
                            >
                                <CheckCircleIcon className="w-6 h-6" />
                                <div>
                                    <div className="text-xs font-medium opacity-90">应用 AI 推荐方案</div>
                                    <div className="text-lg uppercase">{suggestedStrategy}</div>
                                </div>
                            </button>
                        ) : (
                            <div className="text-sm text-green-600 font-medium flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-lg">
                                <CheckCircleIcon className="w-4 h-4" />
                                无需修复
                            </div>
                        )}
                        <button onClick={() => setAnalysis(null)} className="text-sm text-gray-400 hover:text-gray-600 underline mt-2">
                            重新分析
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
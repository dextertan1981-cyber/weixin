/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { generateArticle, addIllustrationsToArticle } from './services/gemini';
import { PencilSquareIcon, SparklesIcon, Cog6ToothIcon, ChevronUpIcon, ArrowPathIcon, ClipboardDocumentIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/solid';

// Default configurations based on user request
const DEFAULT_TITLE_CONFIG = `1. 标题字数15-50字
2. 固定格式：少儿科普故事《{topic}》
3. 检查是否避免标题党‌：标题需与内容高度相关，避免夸大或误导。
4. 优化策略：
   - 悬念式、直言式、疑问式、消息式、命令式
   - 名人效应、借势营销、夺眼球式、警告式
   - 数字式、用趣式、励志式、经验式、鼓舞式、指导式、建议式
5. 如果没有优化空间，就无需优化，直接使用用户输入的主题。`;

const DEFAULT_ARTICLE_CONFIG = `1. 风格：以故事的方式讲述科普知识。
   - 受众：35~45岁宝妈和7~14孩子，以及教育工作者。
   - 场景：亲子阅读或朋友圈分享。
2. 字数：1200-2500字。
3. 写作技巧：
   - 开篇：调动读者情绪、激发引导思考，引发阅读兴趣。
   - 结构：开门见山提出观点，着重情感共鸣，以情动人。
   - 语言：个人深度思考风格，简洁的日常表达。
   - 句式：长短句组合，短句为主，错落有致。避免单个句子超过3行。
   - 禁忌词：避免使用“首先、其次、最后、总而言之、总之”。
   - 杜绝AI味：不要使用“繁杂的世界，快节奏的世界”等虚无形容词。
4. 限制：
   - 禁止出现英文、单词。
   - 严格遵循字数要求。
   - 必须原创，严禁抄袭。
   - 符合法律法规，无敏感内容。`;

// Helper function to inject inline styles for WeChat compatibility
// WeChat editor strips classes but preserves inline styles
const formatHtmlForWeChat = (html: string) => {
  let formatted = html;
  
  // Paragraphs: Comfortable reading spacing, dark grey color
  formatted = formatted.replace(/<p>/g, '<p style="font-size: 16px; line-height: 1.8; margin-bottom: 20px; text-align: justify; color: #333;">');
  
  // H2 (Subtitles): Green accent typical for WeChat, bold, spacing
  formatted = formatted.replace(/<h2>/g, '<h2 style="font-size: 18px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; color: #07c160; padding-left: 10px; border-left: 4px solid #07c160; line-height: 1.4;">');
  
  // H3: Similar to H2 but smaller or different accent if generated
  formatted = formatted.replace(/<h3>/g, '<h3 style="font-size: 17px; font-weight: bold; margin-top: 25px; margin-bottom: 12px; color: #333;">');

  // Lists: Indentation and spacing
  formatted = formatted.replace(/<ul>/g, '<ul style="margin-bottom: 20px; padding-left: 20px; list-style-type: disc; color: #555;">');
  formatted = formatted.replace(/<ol>/g, '<ol style="margin-bottom: 20px; padding-left: 20px; list-style-type: decimal; color: #555;">');
  formatted = formatted.replace(/<li>/g, '<li style="margin-bottom: 8px; line-height: 1.6;">');
  
  // Bold text: Green accent to match headings
  formatted = formatted.replace(/<strong>/g, '<strong style="color: #07c160; font-weight: bold;">');
  formatted = formatted.replace(/<b>/g, '<strong style="color: #07c160; font-weight: bold;">');

  // Blockquotes: Light grey background, border
  formatted = formatted.replace(/<blockquote>/g, '<blockquote style="background-color: #f7f7f7; border-left: 4px solid #d1d5db; padding: 16px; margin: 20px 0; color: #666; font-size: 15px; border-radius: 4px;">');

  return formatted;
};

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [titleConfig, setTitleConfig] = useState(DEFAULT_TITLE_CONFIG);
  const [articleConfig, setArticleConfig] = useState(DEFAULT_ARTICLE_CONFIG);
  
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  
  // Refs for direct DOM access (needed for copying modified content)
  const articleBodyRef = useRef<HTMLDivElement>(null);
  
  // Copy state feedback
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    setGeneratedTitle('');
    setGeneratedBody('');
    
    try {
      // Replace placeholder in title config if present
      const processedTitleConfig = titleConfig.replace(/{topic}/g, topic);
      
      const html = await generateArticle(topic, processedTitleConfig, articleConfig);
      
      // Parse the HTML to separate H1 from the rest
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const h1 = doc.querySelector('h1');
      let titleText = '';
      let bodyHtml = '';

      if (h1) {
        titleText = h1.innerText;
        h1.remove(); // Remove h1 from doc to get the rest as body
        bodyHtml = doc.body.innerHTML;
      } else {
        // Fallback if no h1 found
        bodyHtml = html;
      }

      setGeneratedTitle(titleText);
      
      // Apply WeChat formatting immediately
      const formattedBody = formatHtmlForWeChat(bodyHtml);
      setGeneratedBody(formattedBody);

    } catch (error) {
      console.error(error);
      setGeneratedBody('<p>生成失败，请重试</p>');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('确定要恢复默认设置吗？')) {
      setTitleConfig(DEFAULT_TITLE_CONFIG);
      setArticleConfig(DEFAULT_ARTICLE_CONFIG);
    }
  };

  const handleAutoGenerateImages = async () => {
    // Get current HTML content
    let currentHtml = '';
    if (articleBodyRef.current) {
        currentHtml = articleBodyRef.current.innerHTML;
    } else if (generatedBody) {
        currentHtml = generatedBody;
    }

    if (!currentHtml) {
        alert("请先生成文章内容。");
        return;
    }

    setGeneratingImages(true);
    try {
        const updatedHtml = await addIllustrationsToArticle(currentHtml);
        setGeneratedBody(updatedHtml);
    } catch (error) {
        console.error(error);
        alert("配图生成失败，请稍后重试。");
    } finally {
        setGeneratingImages(false);
    }
  };

  const copyToClipboard = async (text: string, isTitle: boolean) => {
    try {
      if (isTitle) {
        await navigator.clipboard.writeText(text);
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      } else {
        // For body, we use the REF to get the current content (including user pasted images)
        // instead of the 'generatedBody' state which is just the initial AI text.
        // Important: Since we have applied inline styles via formatHtmlForWeChat,
        // copying the innerHTML here will preserve those styles for WeChat.
        const contentToCopy = articleBodyRef.current ? articleBodyRef.current.innerHTML : text;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentToCopy;
        document.body.appendChild(tempDiv);
        
        const range = document.createRange();
        range.selectNode(tempDiv);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        
        document.execCommand('copy');
        
        window.getSelection()?.removeAllRanges();
        document.body.removeChild(tempDiv);

        setCopiedBody(true);
        setTimeout(() => setCopiedBody(false), 2000);
      }
    } catch (err) {
      console.error('Copy failed', err);
      alert('复制失败，请手动复制');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] py-12 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <PencilSquareIcon className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-2">
            公众号一键发文
          </h1>
          <p className="text-lg text-gray-500">
            输入主题，AI 自动为您创作爆款文章
          </p>
        </div>

        {/* Input & Settings Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-10 border border-gray-100 transition-all duration-300">
          
          {/* Main Input Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="请输入文章主题（例如：职场沟通技巧、夏季减肥食谱...）"
              className="flex-1 text-lg px-6 py-4 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all placeholder-gray-400"
              disabled={loading}
            />
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`
                flex items-center justify-center px-4 py-4 rounded-xl border-2 transition-all
                ${showSettings ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-500'}
              `}
              title="生成设置"
            >
              <Cog6ToothIcon className={`h-6 w-6 transition-transform duration-500 ${showSettings ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className={`
                flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 min-w-[140px]
                ${loading || !topic.trim() 
                  ? 'bg-gray-400 cursor-not-allowed shadow-none hover:translate-y-0' 
                  : 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/30'}
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>生成中</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-6 w-6" />
                  <span>生成文章</span>
                </>
              )}
            </button>
          </div>

          {/* Settings Panel */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showSettings ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
             <div className="border-t border-gray-100 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Cog6ToothIcon className="h-5 w-5 text-green-600" />
                    高级设置
                  </h3>
                  <button onClick={handleResetSettings} className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1 transition-colors">
                    <ArrowPathIcon className="h-3 w-3" />
                    恢复默认
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Title Settings */}
                   <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-600">标题生成设置</label>
                      <textarea 
                        value={titleConfig}
                        onChange={(e) => setTitleConfig(e.target.value)}
                        className="w-full h-64 p-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none font-mono leading-relaxed"
                        placeholder="在此输入标题生成规则..."
                      />
                      <p className="text-xs text-gray-400">支持使用 {`{topic}`} 作为用户主题的占位符</p>
                   </div>

                   {/* Article Settings */}
                   <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-600">文章内容设置</label>
                      <textarea 
                        value={articleConfig}
                        onChange={(e) => setArticleConfig(e.target.value)}
                        className="w-full h-64 p-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none font-mono leading-relaxed"
                        placeholder="在此输入文章生成规则..."
                      />
                   </div>
                </div>
                
                <div className="flex justify-center mt-4">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                    收起设置
                  </button>
                </div>
             </div>
          </div>
        </div>

        {/* Result Section */}
        {(generatedTitle || generatedBody) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* 1. Title Section */}
            {generatedTitle && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden relative group">
                <div className="absolute top-4 right-4 z-10">
                   <button 
                    onClick={() => copyToClipboard(generatedTitle, true)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm
                      ${copiedTitle 
                        ? 'bg-green-50 text-green-600 border border-green-200' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-green-500 hover:text-green-600'
                      }
                    `}
                   >
                     {copiedTitle ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                     {copiedTitle ? '已复制' : '复制标题'}
                   </button>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
                  <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">标题</span>
                </div>
                <div className="p-6 md:p-8">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                    {generatedTitle}
                  </h1>
                </div>
              </div>
            )}

            {/* 2. Article Body Section */}
            {generatedBody && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
                
                {/* Header with Actions */}
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md bg-gray-50/95">
                   <div className="flex items-center gap-3 w-full sm:w-auto">
                     <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">文章正文</span>
                     <div className="flex gap-1.5 opacity-50">
                       <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                       <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                       <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      {/* AI Image Generation Button */}
                      <button 
                        onClick={handleAutoGenerateImages}
                        disabled={generatingImages}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all shadow-sm
                            ${generatingImages 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-400 cursor-wait' 
                                : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                            }
                        `}
                      >
                         {generatingImages ? (
                             <>
                                <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>AI 绘图中...</span>
                             </>
                         ) : (
                             <>
                                <PhotoIcon className="h-4 w-4" />
                                <span>AI 自动配图</span>
                             </>
                         )}
                      </button>

                      {/* Copy Body Button */}
                      <button 
                        onClick={() => copyToClipboard(generatedBody, false)}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm
                          ${copiedBody
                            ? 'bg-green-50 text-green-600 border border-green-200' 
                            : 'bg-white text-gray-500 border border-gray-200 hover:border-green-500 hover:text-green-600'
                          }
                        `}
                      >
                        {copiedBody ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                        {copiedBody ? '已复制' : '复制正文'}
                      </button>
                   </div>
                </div>
                
                {/* Article Content - Editable for Image Paste */}
                <div 
                  ref={articleBodyRef}
                  className="prose prose-lg max-w-none p-8 sm:p-12 text-gray-800 outline-none focus:bg-white transition-colors"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  dangerouslySetInnerHTML={{ __html: generatedBody }} 
                  onFocus={(e) => {
                    // Slight visual cue that it is editable
                    e.currentTarget.classList.add('bg-gray-50/50');
                  }}
                  onBlur={(e) => {
                    e.currentTarget.classList.remove('bg-gray-50/50');
                  }}
                />
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
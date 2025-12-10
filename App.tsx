/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { generateArticle, addIllustrationsToArticle, generateSpeech } from './gemini';
import { AIDetectionModal } from './components/AIDetectionModal';
import { 
  PencilSquareIcon, 
  SparklesIcon, 
  Cog6ToothIcon, 
  ChevronUpIcon, 
  ArrowPathIcon, 
  ClipboardDocumentIcon, 
  CheckIcon, 
  PhotoIcon,
  SpeakerWaveIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/solid';

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

/**
 * Advanced HTML formatter for WeChat Official Accounts.
 * Parses HTML and applies inline styles strictly to ensure compatibility.
 */
const formatHtmlForWeChat = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Container Wrapper (Section)
  // Use a wrapper with an ID for easier selection during copy
  const wrapper = doc.createElement('section');
  // WeChat standard styling
  wrapper.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.75;
    color: #333333;
    letter-spacing: 0.034em;
    text-align: justify;
    word-break: break-all;
    box-sizing: border-box;
    margin: 0;
    padding: 10px;
  `;
  wrapper.setAttribute('data-tool', 'AIWriter');

  // Move all body children to wrapper
  while (doc.body.firstChild) {
    wrapper.appendChild(doc.body.firstChild);
  }
  doc.body.appendChild(wrapper);

  // 2. Process Elements
  const processNode = (node: Element) => {
    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    
    // Ensure box-sizing everywhere
    if (element.style) {
        element.style.boxSizing = 'border-box';
    }

    // H2 - Subtitles (Centered and Bold)
    if (tagName === 'h2') {
      element.style.cssText = `
        font-size: 17px;
        font-weight: bold;
        margin-top: 40px;
        margin-bottom: 24px;
        color: #333333;
        text-align: center !important;
        line-height: 1.4;
        box-sizing: border-box;
        display: block;
        width: 100%;
        margin-left: auto;
        margin-right: auto;
      `;
    }
    // H3 - Small headers (Centered and Bold)
    else if (tagName === 'h3') {
        element.style.cssText = `
          font-size: 17px;
          font-weight: bold;
          margin-top: 30px;
          margin-bottom: 20px;
          color: #333333;
          text-align: center !important;
          line-height: 1.4;
          box-sizing: border-box;
          display: block;
          width: 100%;
          margin-left: auto;
          margin-right: auto;
        `;
    }
    // P - Paragraphs
    else if (tagName === 'p') {
      element.style.cssText = `
        margin: 0 0 24px 0;
        font-size: 16px;
        line-height: 1.8;
        color: #333333;
        text-align: justify;
        box-sizing: border-box;
      `;
    }
    // IMG - Images (Critical for WeChat)
    else if (tagName === 'img') {
        // Strict inline styles for WeChat
        element.style.cssText = `
            display: block;
            margin: 0 auto;
            max-width: 100% !important;
            height: auto !important;
            border-radius: 6px;
            box-sizing: border-box;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            visibility: visible !important; 
            opacity: 1 !important;
        `;
        element.removeAttribute('width');
        element.removeAttribute('height');
        
        if (element.parentElement && element.parentElement.tagName.toLowerCase() === 'figure') {
            const figure = element.parentElement as HTMLElement;
            figure.style.cssText = "margin: 20px 0; padding: 0; text-align: center; display: block; width: 100%; box-sizing: border-box;";
        }
    }
    // Strong/Bold (For key words)
    else if (tagName === 'strong' || tagName === 'b') {
        element.style.cssText = `
            font-weight: 700;
            color: #333333;
        `;
    }
    // EM - Uncommon Nouns (Italic + Color)
    else if (tagName === 'em') {
        element.style.cssText = `
            font-style: italic;
            color: #ff5f00; /* Bright Orange */
            font-weight: bold;
            padding: 0 2px;
        `;
    }
    // Underline (For golden sentences)
    else if (tagName === 'u') {
        element.style.cssText = `
            text-decoration: underline;
            text-decoration-color: #ff5f00;
            text-decoration-thickness: 1.5px;
            text-underline-offset: 4px;
        `;
    }
    // Lists - Default clear style if they appear (though disabled in prompt)
    else if (tagName === 'ul' || tagName === 'ol') {
        element.style.cssText = `margin: 0 0 20px 20px; padding: 0;`;
    }
    else if (tagName === 'li') {
        element.style.cssText = `margin-bottom: 8px;`;
    }
  };

  // Walk the tree
  const walk = (root: Element) => {
    processNode(root);
    for (let i = 0; i < root.children.length; i++) {
      walk(root.children[i]);
    }
  };

  walk(wrapper);

  // Replace <figure> with <p> for better compatibility after processing
  let formattedHtml = doc.body.innerHTML;
  formattedHtml = formattedHtml.replace(/<figure/g, '<p').replace(/<\/figure>/g, '</p>');

  return formattedHtml;
};

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [titleConfig, setTitleConfig] = useState(DEFAULT_TITLE_CONFIG);
  const [articleConfig, setArticleConfig] = useState(DEFAULT_ARTICLE_CONFIG);
  
  // New Settings
  const [imageCount, setImageCount] = useState(1);
  
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  
  // Detection Modal State
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  
  // Refs for direct DOM access
  const articleBodyRef = useRef<HTMLDivElement>(null);
  
  // Copy state feedback
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    setGeneratedTitle('');
    setGeneratedBody('');
    setAudioUrls([]); 
    
    try {
      const processedTitleConfig = titleConfig.replace(/{topic}/g, topic);
      const html = await generateArticle(topic, processedTitleConfig, articleConfig);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const h1 = doc.querySelector('h1');
      let titleText = '';
      let bodyHtml = '';

      if (h1) {
        titleText = h1.innerText;
        h1.remove(); 
        bodyHtml = doc.body.innerHTML;
      } else {
        bodyHtml = html;
      }

      setGeneratedTitle(titleText);
      
      // Use the new Robust WeChat Formatter
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
      setImageCount(1);
    }
  };

  const handleAutoGenerateImages = async () => {
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
        const updatedHtml = await addIllustrationsToArticle(currentHtml, imageCount);
        setGeneratedBody(updatedHtml);
    } catch (error) {
        console.error(error);
        alert("配图生成失败，请稍后重试。");
    } finally {
        setGeneratingImages(false);
    }
  };

  const handleGenerateAudio = async () => {
      let textContent = '';
      if (articleBodyRef.current) {
          textContent = articleBodyRef.current.innerText;
      } else if (generatedBody) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = generatedBody;
          textContent = tempDiv.innerText;
      }

      if (!textContent.trim()) {
          alert("没有可朗读的正文内容");
          return;
      }

      setGeneratingAudio(true);
      setAudioUrls([]); 
      try {
          const blobs = await generateSpeech(textContent);
          if (blobs && blobs.length > 0) {
              const urls = blobs.map(blob => URL.createObjectURL(blob));
              setAudioUrls(urls);
          } else {
              alert("语音生成失败，未能生成有效音频");
          }
      } catch (error) {
          console.error(error);
          alert("语音生成出错");
      } finally {
          setGeneratingAudio(false);
      }
  };

  const handleDownloadAudio = (url: string, index: number) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `article_audio_part${index + 1}_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const handleAIDetection = () => {
      if (!generatedBody && !articleBodyRef.current?.innerHTML) {
          alert("请先生成文章内容");
          return;
      }
      setShowDetectionModal(true);
  };

  const copyToClipboard = async (text: string, isTitle: boolean) => {
    try {
      if (isTitle) {
        await navigator.clipboard.writeText(text);
        setCopiedTitle(true);
        setTimeout(() => setCopiedTitle(false), 2000);
      } else {
        const contentToCopy = articleBodyRef.current ? articleBodyRef.current.innerHTML : text;
        
        // Create a temporary container to select HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentToCopy;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
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
      
      {/* AI Detection Modal */}
      <AIDetectionModal 
        isOpen={showDetectionModal} 
        onClose={() => setShowDetectionModal(false)} 
        content={articleBodyRef.current?.innerText || generatedBody.replace(/<[^>]+>/g, '') || ''}
      />

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
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showSettings ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
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
                        className="w-full h-48 p-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none font-mono leading-relaxed"
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
                        className="w-full h-48 p-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none font-mono leading-relaxed"
                        placeholder="在此输入文章生成规则..."
                      />
                   </div>
                </div>

                {/* Illustration Settings */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <PhotoIcon className="h-4 w-4 text-indigo-500" />
                        AI 插图设置
                    </h4>
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-600">生成数量:</label>
                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                            <input 
                                type="range" 
                                min="1" 
                                max="6" 
                                value={imageCount} 
                                onChange={(e) => setImageCount(parseInt(e.target.value))}
                                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <span className="text-sm font-bold text-indigo-600 w-6 text-center">{imageCount}</span>
                            <span className="text-xs text-gray-400">张</span>
                        </div>
                        <p className="text-xs text-gray-400 ml-2">第一张为封面图，其余按内容自动插入。</p>
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
                   
                   <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
                      
                      {/* AI Detection Button */}
                      <button 
                        onClick={handleAIDetection}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm bg-white text-gray-500 border border-gray-200 hover:border-blue-500 hover:text-blue-600"
                      >
                         <ShieldCheckIcon className="h-4 w-4" />
                         <span>AI 检测</span>
                      </button>

                      {/* Generate Audio Button */}
                      {audioUrls.length > 0 ? (
                          <div className="flex items-center gap-2">
                             {audioUrls.map((url, index) => (
                                <button 
                                  key={index}
                                  onClick={() => handleDownloadAudio(url, index)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
                                >
                                   <ArrowDownTrayIcon className="h-4 w-4" />
                                   <span>下载语音 {index + 1}</span>
                                </button>
                             ))}
                          </div>
                      ) : (
                          <button 
                            onClick={handleGenerateAudio}
                            disabled={generatingAudio}
                            className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all shadow-sm
                                ${generatingAudio
                                    ? 'bg-orange-50 border-orange-200 text-orange-400 cursor-wait' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-orange-500 hover:text-orange-600'
                                }
                            `}
                          >
                             {generatingAudio ? (
                                <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                             ) : (
                                <SpeakerWaveIcon className="h-4 w-4" />
                             )}
                             <span>{generatingAudio ? '生成语音...' : '语音生成'}</span>
                          </button>
                      )}

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
                                <span>AI 绘图...</span>
                             </>
                         ) : (
                             <>
                                <PhotoIcon className="h-4 w-4" />
                                <span>AI 配图 ({imageCount})</span>
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
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { generateArticle, addIllustrationsToArticle, generateSpeech, mergeWavBlobs, generateVideoScript, generateVeoVideo } from './services/gemini';
import { AIDetectionModal } from './components/AIDetectionModal';
import { EmoticonModal } from './components/EmoticonModal';
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
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  FaceSmileIcon,
  VideoCameraIcon,
  PlayCircleIcon
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
   - 符合法律法规，无敏感内容。

---
【高级风格指令：去AI化特别设定】

【一、赋予角色】
你是一名资深育儿专家，你擅长创作育儿领域的自媒体爆款文章。你的主要职责是创作更有人情味儿、更自然流畅、消除机器写作痕迹，长短句结合，减少使用列表和总结，减少连接词的爆款内容，内容要打破AI生硬感，从语言风格、情感传递到逻辑架构，全方位地让文章更贴合人类真实的写作习惯。

【二、人物画像】
作为语言风格转换专家，你对人类写作的独特魅力有着深刻的洞察。你擅长将AI生成的“冰冷”文本，转化为通俗易懂的口语化表达。凭借多年的经验，你能迅速发现AI文本里那些重复啰嗦的词句、缺失情感的描述，还有生硬突兀的逻辑转折，并精准地进行优化调整。

【三、人物技能】
1.文本分析能力：你能敏锐地捕捉到AI文本中那些模板化、程式化的语言，清晰分辨出与人类写作的差异之处。
2.创造性写作技巧：你通过巧妙替换词汇、灵活调整句式、增添情感色彩等方式，为文章注入新的活力。
3.细致编辑能力：你会精心优化文章的结构，理顺逻辑脉络，让文章读起来更加顺畅自然。

【四、写作目标】
你的目标很明确，就是让AI生成的文章无限接近人类的写作风格，让内容变得更口语化，减少AI痕迹，增强文章的自然感和独特个性，给文章注入情感元素，让它更具吸引力和可读性，真正做到“以情动人，以文服人”。

【五、约束条件】
在对文章进行调整时，你必须始终坚守一个原则：保证原有信息准确无误，绝不改变文章的核心意图和内容，不要凭空捏造案例。`;

/**
 * Advanced HTML formatter for WeChat Official Accounts.
 * Supports multiple centering strategies for headers.
 */
const formatHtmlForWeChat = (html: string, strategy: string = 'section'): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Container Wrapper
  const wrapper = doc.createElement('section');
  wrapper.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.75;
    color: #333333;
    letter-spacing: 0.034em;
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

  // Special Handling for CSS Injection Strategy (Method 3 from Screenshot)
  if (strategy === 'css-injection') {
      const styleTag = doc.createElement('style');
      styleTag.textContent = `
        .wx-title-center {
            text-align: center !important;
            display: block;
            margin-top: 40px;
            margin-bottom: 16px;
            font-weight: bold;
        }
      `;
      wrapper.prepend(styleTag);
  }

  // Helper to merge styles safely
  const applyStyle = (element: HTMLElement, defaultStyles: Partial<CSSStyleDeclaration>) => {
      for (const [key, value] of Object.entries(defaultStyles)) {
          if (!element.style[key as any]) {
              element.style[key as any] = value as string;
          }
      }
      element.style.boxSizing = 'border-box';
  };

  // 2. Process Headers (H2, H3) based on Strategy
  const headers = wrapper.querySelectorAll('h2, h3');
  headers.forEach(header => {
      const el = header as HTMLElement;
      let container: HTMLElement;
      let contentContainer: HTMLElement | null = null;

      // --- STRATEGY SWITCHER ---
      if (strategy === 'fieldset') {
          // Fieldset Strategy
          container = doc.createElement('fieldset');
          container.style.cssText = `border: 0; margin: 40px 0 16px 0; text-align: center; display: block;`;
          contentContainer = container;

      } else if (strategy === 'table') {
          // Table Strategy (Nuclear)
          const table = doc.createElement('table');
          table.setAttribute('width', '100%');
          table.style.cssText = "width: 100%; border: 0; margin-top: 40px; margin-bottom: 16px;";
          const tr = doc.createElement('tr');
          const td = doc.createElement('td');
          td.setAttribute('align', 'center'); // Explicit HTML attribute
          td.style.textAlign = "center";
          td.style.verticalAlign = "middle";
          tr.appendChild(td);
          table.appendChild(tr);
          
          container = table; 
          contentContainer = td;

      } else if (strategy === 'center-tag') {
          // Deprecated Center Tag (with style)
          container = doc.createElement('center');
          container.style.cssText = `margin-top: 40px; margin-bottom: 16px; display: block;`;
          contentContainer = container;

      } else if (strategy === 'clean-center') {
          // Clean Center Tag (Method 2 from Screenshot - NO STYLE ATTRIBUTE)
          container = doc.createElement('center');
          // Intentionally NO style.cssText here to see if inline styles were the trigger for stripping
          contentContainer = container;

      } else if (strategy === 'css-injection') {
          // CSS Injection Strategy (Method 3 from Screenshot)
          container = doc.createElement('div');
          container.className = 'wx-title-center'; // Relies on the <style> block added above
          // We also add inline as a backup, but the class is the main attempt
          container.style.textAlign = 'center'; 
          contentContainer = container;

      } else if (strategy === 'flex') {
          // Flexbox Strategy
          container = doc.createElement('div');
          container.style.cssText = `display: flex; justify-content: center; align-items: center; margin-top: 40px; margin-bottom: 16px;`;
          contentContainer = container;
      
      } else if (strategy === 'grid') {
          // Grid Strategy
          container = doc.createElement('div');
          container.style.cssText = `display: grid; place-items: center; margin-top: 40px; margin-bottom: 16px;`;
          contentContainer = container;

      } else if (strategy === 'blockquote') {
          // Blockquote Strategy
          container = doc.createElement('blockquote');
          container.style.cssText = `margin: 40px 0 16px 0; padding: 0; border: none; text-align: center; display: block;`;
          contentContainer = container;

      } else if (strategy === 'div-align') {
          // Div with align attribute Strategy (HTML4 legacy)
          container = doc.createElement('div');
          container.setAttribute('align', 'center'); 
          container.style.cssText = `margin-top: 40px; margin-bottom: 16px;`;
          contentContainer = container;

      } else if (strategy === 'p-align') {
          // Paragraph with align attribute Strategy
          container = doc.createElement('p');
          container.setAttribute('align', 'center');
          container.style.cssText = `margin-top: 40px; margin-bottom: 16px; text-align: center;`;
          contentContainer = container;

      } else if (strategy === 'caption') {
          // Table Caption Strategy
          const table = doc.createElement('table');
          table.setAttribute('width', '100%');
          table.style.cssText = "width: 100%; border: none; margin: 40px 0 16px 0; padding: 0;";
          const caption = doc.createElement('caption');
          caption.setAttribute('align', 'center'); 
          caption.style.cssText = "text-align: center; caption-side: top;";
          table.appendChild(caption);
          container = table;
          contentContainer = caption;

      } else {
          // Default: Section Strategy
          container = doc.createElement('section');
          container.style.cssText = `text-align: center; margin-top: 40px; margin-bottom: 16px; line-height: 1.4; display: block;`;
          contentContainer = container;
      }

      // Mark for Debugging
      container.setAttribute('data-wx-marker', 'title-wrapper');

      const strong = doc.createElement('strong');
      strong.style.cssText = `
        font-size: 17px; 
        font-weight: bold; 
        color: #333333; 
      `;
      strong.innerHTML = el.innerHTML;
      
      if (contentContainer) {
          contentContainer.appendChild(strong);
      } else {
          container.appendChild(strong);
      }

      if (el.parentNode) {
          el.parentNode.replaceChild(container, el);
      }
  });

  // 3. Process Paragraphs
  const paragraphs = wrapper.querySelectorAll('p');
  paragraphs.forEach(p => {
      const el = p as HTMLElement;
      // Skip if it's already a centered header wrapper we just created
      const isHeaderWrapper = 
        (el.querySelector('strong') && el.style.textAlign === 'center') || 
        el.getAttribute('align') === 'center' ||
        el.tagName === 'CENTER' || 
        el.className.includes('wx-title-center');
      
      if (!isHeaderWrapper) {
          applyStyle(el, {
            margin: '0 0 16px 0', 
            fontSize: '16px',
            lineHeight: '1.75',
            color: '#333333',
            textAlign: 'justify'
          });
      }
  });

  // 4. Process Inline Styles
  const replaceWithSpan = (selector: string, styles: string) => {
      const elements = wrapper.querySelectorAll(selector);
      elements.forEach(el => {
          const span = doc.createElement('span');
          span.style.cssText = styles;
          span.innerHTML = el.innerHTML;
          if (el.parentNode) {
              el.parentNode.replaceChild(span, el);
          }
      });
  };

  // Strong/Bold
  const bolds = wrapper.querySelectorAll('strong, b');
  bolds.forEach(el => {
      const parent = el.parentElement;
      const isHeaderStrong = parent?.getAttribute('data-wx-marker') === 'title-wrapper' || 
                             parent?.tagName === 'TD' ||
                             parent?.tagName === 'CENTER' ||
                             parent?.tagName === 'CAPTION' ||
                             parent?.className.includes('wx-title-center');

      if (!isHeaderStrong) {
          (el as HTMLElement).style.cssText = 'font-weight: 700; color: #333333;';
      }
  });
  
  // EM -> Color highlight -> Convert to STRONG
  const ems = wrapper.querySelectorAll('em');
  ems.forEach(el => {
      const strong = doc.createElement('strong');
      strong.style.cssText = 'color: #ff5f00; font-weight: bold; font-style: normal; padding: 0 2px;';
      strong.innerHTML = el.innerHTML;
      if (el.parentNode) el.parentNode.replaceChild(strong, el);
  });
  
  // U -> Underline
  replaceWithSpan('u', 'text-decoration: underline; text-decoration-color: #ff5f00; text-decoration-thickness: 1.5px; text-underline-offset: 4px;');

  // 5. Process Images
  const images = wrapper.querySelectorAll('img');
  images.forEach(img => {
      const el = img as HTMLElement;
      el.style.cssText = `
        display: block;
        margin: 0 auto;
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      `;
      if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'figure') {
          const parent = el.parentElement;
          const section = doc.createElement('section');
          section.style.cssText = "text-align: center; margin: 20px 0;";
          parent.parentNode?.insertBefore(section, parent);
          section.appendChild(el);
          parent.remove();
      }
  });

  return doc.body.innerHTML;
};

const App: React.FC = () => {
  // New State for Mode Switching
  const [appMode, setAppMode] = useState<'article' | 'video'>('article');

  const [topic, setTopic] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [titleConfig, setTitleConfig] = useState(DEFAULT_TITLE_CONFIG);
  const [articleConfig, setArticleConfig] = useState(DEFAULT_ARTICLE_CONFIG);
  
  const [imageCount, setImageCount] = useState(1);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [generatedVideoScript, setGeneratedVideoScript] = useState(''); // New state for video script
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null); // New state for Veo video
  const [generatingVideo, setGeneratingVideo] = useState(false); // Veo loading state

  const [rawBodyHtml, setRawBodyHtml] = useState(''); // Store raw HTML for re-formatting
  
  const [loading, setLoading] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [showEmoticonModal, setShowEmoticonModal] = useState(false);
  
  // INITIALIZE WITH FAILURE HISTORY (V11) based on user's request
  const [centeringStrategy, setCenteringStrategy] = useState('section');
  const [failedStrategies, setFailedStrategies] = useState<string[]>([
      'section', 
      'table', 
      'center-tag', 
      'flex', 
      'grid', 
      'fieldset',
      'blockquote',
      'div-align',
      'p-align',
      'caption'
  ]); 
  
  // Optimization version counter initialized to 11
  const [fixCount, setFixCount] = useState(11);
  
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  // Helper to re-apply formatting when strategy changes
  const applyFormatting = (html: string, strategy: string) => {
      return formatHtmlForWeChat(html, strategy);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    // Reset specific states
    setGeneratedTitle('');
    setGeneratedBody('');
    setRawBodyHtml('');
    setAudioUrls([]); 
    setGeneratedVideoScript('');
    setGeneratedVideoUrl(null);
    
    try {
      if (appMode === 'article') {
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
          setRawBodyHtml(bodyHtml);
          
          const formattedBody = applyFormatting(bodyHtml, centeringStrategy);
          setGeneratedBody(formattedBody);

      } else {
          // Video Mode: Generate Script
          const scriptHtml = await generateVideoScript(topic);
          setGeneratedVideoScript(scriptHtml);
      }

    } catch (error) {
      console.error(error);
      if (appMode === 'article') {
        setGeneratedBody('<p>生成失败，请重试</p>');
      } else {
        setGeneratedVideoScript('<p>脚本生成失败，请重试</p>');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVeo = async () => {
    // 1. Check for API Key selection (Required for Veo)
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
        // Trigger key selection dialog
        try {
            await window.aistudio.openSelectKey();
            // Race condition mitigation: assume success if no error thrown
        } catch (e: any) {
            if (e.message && e.message.includes("Requested entity was not found")) {
                 alert("API Key 选择失败，请重试。");
                 return;
            }
        }
    }

    // 2. Start generation
    if (!topic) return;
    setGeneratingVideo(true);
    setGeneratedVideoUrl(null);

    try {
        // Construct a prompt for Veo based on topic
        const videoPrompt = `A high quality, cinematic vertical video about ${topic}. Detailed, 4k resolution, realistic lighting.`;
        const videoUrl = await generateVeoVideo(videoPrompt);
        
        if (videoUrl) {
            setGeneratedVideoUrl(videoUrl);
        } else {
            alert("视频生成失败或超时。");
        }
    } catch (e) {
        console.error("Veo Error:", e);
        alert("生成视频时出错。");
    } finally {
        setGeneratingVideo(false);
    }
  };

  const handleApplyStrategy = (newStrategy: string) => {
      // Add previous strategy to failed list before switching
      setFailedStrategies(prev => [...prev, centeringStrategy]);

      setCenteringStrategy(newStrategy);
      // Increment fix count
      setFixCount(prev => prev + 1);
      
      if (rawBodyHtml) {
          const formatted = applyFormatting(rawBodyHtml, newStrategy);
          setGeneratedBody(formatted);
          alert(`已应用修复策略：${newStrategy}。优化版本: v${fixCount + 1}`);
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
        setRawBodyHtml(updatedHtml); // Update raw with images
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

  const handleMergeAudio = async () => {
    if (audioUrls.length <= 1) return;
    try {
        const blobPromises = audioUrls.map(url => fetch(url).then(r => r.blob()));
        const blobs = await Promise.all(blobPromises);
        const mergedBlob = await mergeWavBlobs(blobs);
        const mergedUrl = URL.createObjectURL(mergedBlob);
        
        const a = document.createElement('a');
        a.href = mergedUrl;
        a.download = `merged_audio_full_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(mergedUrl);
    } catch (e) {
        console.error("Merge failed", e);
        alert("语音合并失败");
    }
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

  const isArticleMode = appMode === 'article';

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-500 ${isArticleMode ? 'bg-[#f5f7fa]' : 'bg-slate-900'}`}>
      
      {/* AI Detection Modal */}
      <AIDetectionModal 
        isOpen={showDetectionModal} 
        onClose={() => setShowDetectionModal(false)} 
        content={articleBodyRef.current?.innerText || generatedBody.replace(/<[^>]+>/g, '') || ''}
        currentHtml={articleBodyRef.current?.innerHTML || generatedBody}
        onFixStrategy={handleApplyStrategy} 
        currentStrategy={centeringStrategy}
        fixCount={fixCount}
        failedStrategies={failedStrategies}
      />

      {/* Emoticon Modal */}
      <EmoticonModal 
        isOpen={showEmoticonModal}
        onClose={() => setShowEmoticonModal(false)}
      />

      <div className="max-w-5xl mx-auto relative">
        
        {/* === FEATURE: Standalone AI Emoticon Launcher === */}
        {/* Positioned absolute left for desktop, centered inline for mobile */}
        <div className="absolute top-0 left-0 hidden xl:flex flex-col items-center gap-3 -ml-44 animate-in slide-in-from-left-8 duration-700 z-10">
            <button 
                onClick={() => setShowEmoticonModal(true)}
                className="group relative w-32 h-32 bg-white rounded-3xl shadow-xl border-4 border-white hover:border-pink-200 transition-all duration-300 transform hover:scale-105 hover:-rotate-3 overflow-hidden flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50"
            >
                {/* 3D-style Character Placeholder */}
                {/* Updated URL as per user request */}
                <div className="absolute inset-0 bg-[url('https://mmbiz.qpic.cn/mmbiz_png/ypaNfibVOzdNUezrnHvWZlOEqFibwLibNLiaZiaG7WAkFhgS9uDLwwIHXBqFqjY2Ribu8JV53pdA7HmHycB9FiaJILm3Q/0?wx_fmt=png&from=appmsg')] bg-cover bg-center opacity-90 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500"></div>
                
                {/* Glassmorphism Label */}
                <div className="absolute inset-x-0 bottom-0 bg-white/80 backdrop-blur-sm py-1.5 text-center border-t border-white/50">
                   <span className="text-xs font-bold text-pink-600 block leading-tight">AI 表情包</span>
                </div>
                
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            </button>
            <div className="bg-white px-3 py-1.5 rounded-full shadow-sm border border-pink-100 text-xs font-bold text-gray-500 flex items-center gap-1.5">
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
                独立功能
            </div>
        </div>

        {/* Mobile Launcher */}
        <div className="xl:hidden flex justify-center mb-8">
             <button 
                onClick={() => setShowEmoticonModal(true)}
                className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-sm border border-gray-200 text-gray-700 font-bold hover:border-pink-300 hover:text-pink-600 transition-all active:scale-95"
             >
                <FaceSmileIcon className="w-5 h-5 text-pink-500" />
                打开 AI 表情包制作
             </button>
        </div>

        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
             {/* Mode Switcher */}
             <div className="bg-white/10 backdrop-blur-md p-1 rounded-2xl flex shadow-xl border border-white/20">
                <button
                    onClick={() => setAppMode('article')}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300
                        ${isArticleMode 
                            ? 'bg-green-500 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                    `}
                >
                    <PencilSquareIcon className="w-5 h-5" />
                    <span>公众号</span>
                </button>
                <button
                    onClick={() => setAppMode('video')}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300
                        ${!isArticleMode 
                            ? 'bg-orange-500 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
                    `}
                >
                    <VideoCameraIcon className="w-5 h-5" />
                    <span>视频号</span>
                </button>
             </div>
          </div>
          <h1 className={`text-4xl font-extrabold tracking-tight sm:text-5xl mb-2 transition-colors ${isArticleMode ? 'text-gray-900' : 'text-white'}`}>
            {isArticleMode ? '公众号一键发文' : '视频号一键发文'}
          </h1>
          <p className={`text-lg transition-colors ${isArticleMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {isArticleMode ? '输入主题，AI 自动为您创作爆款文章' : '输入主题，AI 自动为您创作爆款短视频脚本'}
          </p>
        </div>

        {/* Input & Settings Section */}
        <div className={`rounded-2xl shadow-xl p-6 mb-10 border transition-all duration-300 
            ${isArticleMode ? 'bg-white border-gray-100' : 'bg-slate-800 border-slate-700'}`}>
          
          {/* Main Input Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder={isArticleMode ? "请输入文章主题（例如：职场沟通技巧...）" : "请输入短视频主题（例如：30秒学会做红烧肉...）"}
              className={`flex-1 text-lg px-6 py-4 rounded-xl border-2 outline-none transition-all
                  ${isArticleMode 
                      ? 'border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 placeholder-gray-400 bg-white' 
                      : 'border-slate-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-slate-500 bg-slate-900 text-white'
                  }
              `}
              disabled={loading}
            />
            
            {isArticleMode && (
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
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className={`
                flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 min-w-[140px]
                ${loading || !topic.trim() 
                  ? 'bg-gray-400 cursor-not-allowed shadow-none hover:translate-y-0' 
                  : isArticleMode 
                        ? 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/30'
                        : 'bg-orange-600 hover:bg-orange-500 hover:shadow-orange-500/30'
                }
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{isArticleMode ? '生成中' : '策划中'}</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-6 w-6" />
                  <span>{isArticleMode ? '生成文章' : '生成脚本'}</span>
                </>
              )}
            </button>
          </div>

          {/* Settings Panel (Article Mode Only) */}
          {isArticleMode && (
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
                            <p className="text-xs text-gray-400 ml-2">第一张为封面图，最后一张为结尾图，其余自动分布。</p>
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
          )}
        </div>

        {/* --- ARTICLE MODE RESULT --- */}
        {isArticleMode && (generatedTitle || generatedBody) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Title Section */}
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

            {/* Article Body Section */}
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
                             {audioUrls.length > 1 && (
                                <button 
                                  onClick={handleMergeAudio}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
                                  title="将所有片段合并为一个文件下载"
                                >
                                   <ArrowsRightLeftIcon className="h-4 w-4" />
                                   <span>合并语音</span>
                                </button>
                             )}
                             {audioUrls.map((url, index) => (
                                <button 
                                  key={index}
                                  onClick={() => handleDownloadAudio(url, index)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
                                >
                                   <ArrowDownTrayIcon className="h-4 w-4" />
                                   <span>下载 {index + 1}</span>
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

                      {/* AI Emoticon Button (Inline version still exists if user scrolls down) */}
                      <button 
                        onClick={() => setShowEmoticonModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all shadow-sm bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100 hover:border-pink-300"
                      >
                         <FaceSmileIcon className="h-4 w-4" />
                         <span>AI 表情包</span>
                      </button>

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
                
                {/* Article Content */}
                <div 
                  ref={articleBodyRef}
                  className="prose prose-lg max-w-none p-8 sm:p-12 text-gray-800 outline-none focus:bg-white transition-colors"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  dangerouslySetInnerHTML={{ __html: generatedBody }} 
                  onFocus={(e) => {
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

        {/* --- VIDEO MODE RESULT --- */}
        {!isArticleMode && generatedVideoScript && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                 <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden relative">
                    
                    {/* Video Header */}
                    <div className="bg-slate-700/50 px-6 py-4 border-b border-slate-600 flex justify-between items-center">
                        <span className="text-sm font-bold uppercase text-orange-400 tracking-wider flex items-center gap-2">
                             <VideoCameraIcon className="w-5 h-5" />
                             视频脚本 & 演示
                        </span>
                        
                        <div className="flex gap-3">
                             {/* Generate Veo Video Button */}
                             <button
                                onClick={handleGenerateVeo}
                                disabled={generatingVideo}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg
                                    ${generatingVideo 
                                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:shadow-orange-500/30 active:scale-[0.98]'
                                    }
                                `}
                             >
                                 {generatingVideo ? (
                                     <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        正在渲染 (Veo AI)...
                                     </>
                                 ) : (
                                     <>
                                        <PlayCircleIcon className="w-5 h-5" />
                                        生成演示视频 (Veo)
                                     </>
                                 )}
                             </button>

                             <button 
                                onClick={() => copyToClipboard(generatedVideoScript, false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 transition-all"
                            >
                                <ClipboardDocumentIcon className="h-4 w-4" />
                                复制脚本
                            </button>
                        </div>
                    </div>

                    {/* Veo Video Player (if generated) */}
                    {generatedVideoUrl && (
                        <div className="bg-black p-6 flex flex-col items-center justify-center border-b border-slate-700">
                             <div className="w-[360px] max-w-full aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-700 relative group">
                                 <video 
                                    src={generatedVideoUrl} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="w-full h-full object-cover"
                                 />
                                 <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-mono">
                                     Generated by Veo
                                 </div>
                             </div>
                             <a 
                                href={generatedVideoUrl} 
                                download={`veo_video_${Date.now()}.mp4`}
                                className="mt-4 text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1"
                             >
                                 <ArrowDownTrayIcon className="w-4 h-4" />
                                 下载视频
                             </a>
                        </div>
                    )}

                    {/* Script Content */}
                    <div 
                        className="prose prose-invert prose-lg max-w-none p-8 text-slate-300 outline-none"
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        dangerouslySetInnerHTML={{ __html: generatedVideoScript }} 
                    />
                 </div>
             </div>
        )}

      </div>
    </div>
  );
};

export default App;
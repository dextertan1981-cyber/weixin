/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Sanitizes HTML by removing heavy content (base64 images) and unnecessary tags
 * to prevent token limits and parsing errors during analysis.
 */
function sanitizeHtmlForAnalysis(html: string): string {
    // 1. Remove base64 image data (src="data:...")
    let sanitized = html.replace(/src="data:[^"]+"/g, 'src="[IMAGE_DATA_REMOVED]"');
    
    // 2. Remove script and style tags content
    sanitized = sanitized.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
    sanitized = sanitized.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");

    // 3. Simplify footnotes or heavy nesting if necessary
    // (We keep structure but maybe strip huge lists if they look like raw data)
    
    return sanitized;
}

export async function generateArticle(
  topic: string, 
  titleInstructions: string, 
  articleInstructions: string
): Promise<string> {
  try {
    const prompt = `你是一位专业的微信公众号文章创作者。请根据以下配置创作一篇文章。

主题：${topic}

---
【标题生成规则（最高优先级）】
${titleInstructions}

*重要指令*：
1. 如果【标题生成规则】中指定了“固定格式”或具体的模板，请**严格逐字执行**，绝对不要在前后添加任何修饰语、副标题或标点符号。
2. 即使有“优化策略”，若与“固定格式”冲突，以“固定格式”为准。
3. 请确保标题字数严格符合要求。

---
【文章内容规则】
${articleInstructions}

---
【排版与格式特别要求（必须严格遵守）】
1. **标题格式**：
   - 文章内的小标题（Section Headers）请使用 <h2> 或 <h3> 标签。
   - **字数限制**：小标题字数必须控制在 **15字以内**，简短有力。
   - 标题内容不需要加序号。
   - **严禁**使用 Markdown 的 # 标记。

2. **移动端阅读体验（Mobile First）**：
   - **段落长度**：严格控制段落长度。**每个段落不超过 3 行**（在手机屏幕上）。
   - **句子结构**：必须将长句拆分为短句。中文阅读讲究“气口”和节奏，避免大段文字造成的压抑感。
   - **换行策略**：多使用换行，让版面疏朗。

3. **重点标记（方便儿童识字与阅读）**：
   - **加粗**：请将文中的关键名词、成语使用 <strong> 或 <b> 标签加粗。
   - **醒目名词**：请将文中的**地名**、**生僻名词**、或**需要特别强调的概念**使用 <em> 标签包裹。这将被渲染为斜体且醒目的颜色。
   - **下划线**：请将文中的**金句**、**核心观点**或**富有哲理的句子**使用 <u> 标签添加下划线。
   
4. **禁用格式**：
   - **严禁**使用列表（<ul>, <ol>, <li>）。请将列表内容改写为自然段落。
   - **严禁**使用引用块（<blockquote>）。
   - **严禁**使用代码块。

---
【输出格式要求（程序必须可解析）】
1. **必须**返回一段纯 HTML 代码。
2. 文章标题**必须且只能**包含在唯一的 <h1> 标签中，放在开头。
3. 正文内容紧接在 <h1> 之后。
4. 不要包含 <html>, <head>, <body> 标签。
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    // Clean up potential markdown code blocks if the model adds them
    let text = response.text || "";
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    
    return text;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return "<h1>生成失败</h1><p>生成文章时遇到错误，请稍后重试。</p><p>请检查网络连接或 API 配额。</p>";
  }
}

/**
 * Smartly formats raw text into structured HTML for WeChat.
 * STRICT MODE: NO CONTENT MODIFICATION ALLOWED.
 * HIGHLIGHTING STRATEGY: ULTRA MINIMALIST & FIRST OCCURRENCE ONLY.
 */
export async function smartFormatContent(text: string): Promise<string> {
  try {
    const prompt = `
    你是一位微信公众号排版专家。请将以下纯文本内容重新排版为结构化的 HTML 格式。

    【最高指令：严禁修改原文】
    1. **绝对禁止**修改文章中的任何文字。
    2. **绝对禁止**修改、删除或增加任何标点符号。
    3. **绝对禁止**纠正错别字或语病。
    4. **绝对禁止**改写句子结构。
    *注意：程序将对比输入和输出的字符，如果发现文字内容有变，将被视为严重错误。*

    【排版与标记策略（极简主义 - 拒绝视觉疲劳）】
    1. **HTML 结构**：
       - 标题 -> <h2>标题内容</h2> (去掉序号)
       - 正文 -> <p>正文内容</p>
    
    2. **重点标记规则（重要：克制与稀缺）**：
       - **核心聚焦**：整篇文章中，**最多只标记 3-5 个**最核心、最关键的概念。绝对不要遍地开花。
       - **去重原则**：核心概念在全文中**只标记第一次出现**。后续再次出现时，绝对不要标记。
       - **过滤干扰**：严禁标记普通的陪衬名词（如“风”、“雨”、“桌子”、“老师”、“冬天”、“清晨”）。只标记那些真正需要读者注意的独特概念（如“量子纠缠”、“水蒸气”、“光合作用”）。
       - **段落限制**：绝大多数段落应该没有任何标记。严禁一段话里出现多个颜色标记。
       - **标记语法**：
         - 核心名词（首次出现） -> <em>名词</em>
         - 金句/重点 -> <u>句子</u>
         - 强调词 -> <strong>词语</strong>

    3. **拆分段落（仅添加换行）**：
       - 如果一个 <p> 段落内容过长（超过 80 字），请在标点符号后将其拆分为两个 <p> 段落。
       - 拆分时，**必须保留**原有的标点符号，不得修改。

    【待排版文本】
    ${text.substring(0, 15000)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    let html = response.text || "";
    html = html.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    return html;
  } catch (error) {
    console.error("Smart Format Error:", error);
    throw error;
  }
}

/**
 * Analyzes HTML content to extract styling rules and generates a system prompt.
 */
export async function analyzeStyleAndGeneratePrompt(htmlContent: string): Promise<string> {
  try {
    // Sanitize first to remove huge base64 strings
    const cleanedHtml = sanitizeHtmlForAnalysis(htmlContent);
    
    // Only take a subset to avoid token limits if the user pastes a huge article
    const snippet = cleanedHtml.substring(0, 20000); 

    const prompt = `
    任务：分析以下从微信公众号后台复制的 HTML 片段（包含内联样式），逆向工程其排版规则，并生成一段“AI排版指令”。
    如果遇到无法识别的自定义标签（如 footnotes, mp-widgets），请自动忽略它们，只关注标准文本和图片的排版。

    【目标】
    提取出文章的视觉风格规则，重点关注：
    1. **标题样式 (H2/H3)**：分析 color (颜色代码), font-size, text-align (居中?), padding, margin, border (下划线/左边框?), background。
       *特别注意：标题是否居中？如果居中，请在指令中明确写出“标题需居中”。*
    2. **正文样式 (P)**：分析 font-size (通常14px-17px), line-height, margin-bottom, color, text-align。
    3. **强调样式 (Strong/Bold)**：分析颜色、是否加粗。
    4. **特殊标记 (Underline/Italic/EM)**：分析颜色、下划线样式。
    
    【输出要求】
    请直接输出一段清晰的**Prompt 指令**，我可以将其复制到 AI 的“排版要求”或“文章内容规则”中。
    
    格式示例：
    "排版规则关键词：
    1. 正文：字号 16px，行间距 1.75，颜色 #333333。
    2. 二级标题：居中对齐，字号 18px，颜色 #E67e22，带有底部边框...
    ..."
    
    【待分析的 HTML 片段】
    ${snippet}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return response.text || "分析失败，未能提取有效规则。";
  } catch (error) {
    console.error("Style Analysis Error:", error);
    return "分析出错，请重试。建议减少粘贴的内容量，或仅粘贴正文部分。";
  }
}

/**
 * Analyzes the layout difference between Source HTML and Pasted HTML
 * to diagnose why formatting (especially centering) was lost.
 */
export async function analyzeLayoutDiff(sourceHtml: string, pastedHtml: string, failedStrategies: string[] = []): Promise<{reasoning: string, recommendedStrategy: string}> {
    try {
        // Sanitize to avoid token limits
        const cleanSource = sanitizeHtmlForAnalysis(sourceHtml).substring(0, 5000);
        const cleanPasted = sanitizeHtmlForAnalysis(pastedHtml).substring(0, 5000);
        
        // Remove duplicates and empty strings
        const bannedList = [...new Set(failedStrategies)].filter(Boolean);

        const prompt = `
        你是一位前端 CSS 专家，专门负责调试微信公众号（Rich Text Editor）的排版兼容性问题。
        
        【任务】
        对比以下两段 HTML 代码：
        1. "Source HTML" (我们发送给微信编辑器的原始代码)。
        2. "Pasted HTML" (用户保存后，从微信编辑器复制回来的代码)。
        
        【核心问题】
        重点检查**标题的居中对齐（Center Alignment）**是否丢失。微信编辑器以过滤 CSS 而闻名。
        
        【黑名单：已验证失效的策略 (严禁重复推荐)】
        [ ${bannedList.join(', ')} ]
        
        【核心指令】
        请推荐一个**尚未尝试过**的修复策略。
        如果 "table" 已经在黑名单中，绝对不要再推荐 "table"。
        如果 "center-tag" 已经在黑名单中，绝对不要再推荐 "center-tag"。
        必须推荐一个新的。

        【可用策略池 (按推荐优先级排序)】
        1. "table": 核弹级策略 (使用 <table width="100%"><tr><td align="center">)。兼容性最强。
        2. "center-tag": 复古策略 (使用 <center> 标签)。当 style 属性被完全剥离时有效。
        3. "flex": 现代策略 (display: flex; justify-content: center)。
        4. "grid": 网格策略 (display: grid; place-items: center)。
        5. "fieldset": 容器策略 (使用 <fieldset> 容器)。
        6. "section": 标准策略 (使用 <section style="text-align:center">)。
        
        【输入数据】
        Source HTML Snippet:
        \`\`\`html
        ${cleanSource}
        \`\`\`

        Pasted HTML Snippet:
        \`\`\`html
        ${cleanPasted}
        \`\`\`

        【输出要求】
        请返回严格的 JSON 格式：
        {
            "reasoning": "分析原因（例如：微信过滤了 align 属性...）。明确指出因为 [X] 策略已失效，所以现在尝试 [Y]。",
            "recommendedStrategy": "从策略池中选一个未在黑名单中的策略。"
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const result = JSON.parse(response.text || "{}");
        
        // Safety check: if AI hallucinates and returns a banned strategy, override it
        let recommended = result.recommendedStrategy || "table";
        if (bannedList.includes(recommended)) {
            const allStrategies = ['table', 'center-tag', 'flex', 'grid', 'fieldset', 'section'];
            const available = allStrategies.find(s => !bannedList.includes(s));
            recommended = available || 'table'; // Fallback to table if absolutely everything failed (loop restart)
            result.reasoning += ` (AI 自动修正：原推荐 ${result.recommendedStrategy} 已在黑名单，自动切换为 ${recommended})`;
        }

        return {
            reasoning: result.reasoning || "无法分析具体原因，建议尝试更强力的兼容模式。",
            recommendedStrategy: recommended
        };

    } catch (error) {
        console.error("Layout Analysis Error:", error);
        return {
            reasoning: "AI 分析服务暂时不可用，根据经验，表格布局(Table)通常是最稳妥的解决方案。",
            recommendedStrategy: "table"
        };
    }
}

/**
 * Analyzes the article to find suitable spots for illustrations, 
 * generates them, and inserts them into the HTML.
 * 
 * @param articleHtml The article HTML content
 * @param imageCount Total number of images to generate (default 1, max 6)
 */
export async function addIllustrationsToArticle(articleHtml: string, imageCount: number = 1): Promise<string> {
  try {
    // 1. Analyze the text to find insertion points
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = articleHtml;
    // Normalize text to avoid whitespace issues
    const articleText = tempDiv.innerText; 
    
    // Determine how many inline images we need (Total - 1 cover image)
    const inlineCount = Math.max(0, imageCount - 1);

    const analysisPrompt = `
      我有一篇公众号文章，请务必为我规划 **${imageCount}** 张配图。
      
      【数量严格要求】
      返回的 JSON 数组长度必须**严格等于 ${imageCount}**。
      即使文章较短，也请均匀分布，找出 ${imageCount} 个不同的配图位置。
      
      【结构规划】
      1. 数组第 1 项：必须是“封面图” (isCover: true)。无需 contextSnippet。
      2. 数组第 2 至 ${imageCount} 项（共 ${inlineCount} 张）：必须是“插图” (isCover: false)。
      
      【插图位置规则 (contextSnippet)】
      - 请在文章原文中寻找 ${inlineCount} 个不同的段落。
      - "contextSnippet" 必须是该段落中一段**连续的、完全一致的**原文文本（约 15-30 字）。
      - 请直接**复制粘贴**原文，**严禁修改**任何字词或标点符号，否则程序无法定位插入点。
      - 尽量选择不包含 HTML 标签（如加粗/变色）的纯文本句子，或者包含完整标点符号的句子。
      
      【配图画面要求】
      风格：3D卡通动漫风格
      构图：16:9 满屏构图，兼容 12:5 (2.4:1) 裁剪。
      内容：根据上下文描述场景，严禁出现文字。
      
      【文章内容】
      ${articleText.substring(0, 15000)}
    `;

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: analysisPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              isCover: { type: Type.BOOLEAN },
              contextSnippet: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            },
            required: ['isCover', 'imagePrompt']
          }
        }
      }
    });

    const plans = JSON.parse(analysisResponse.text || "[]");
    
    if (!plans || plans.length === 0) {
      throw new Error("Failed to analyze image locations");
    }

    let updatedHtml = articleHtml;

    // 2. Generate images for each plan
    for (const plan of plans) {
      try {
        console.log("Generating image for:", plan.imagePrompt);
        
        const refinedPrompt = `3D cartoon anime style, 16:9 aspect ratio. 
        IMPORTANT: Generate a full-screen image without any black bars, borders, or letterboxing. Fill the entire canvas.
        COMPOSITION: The main subject (character/object) must be strictly centered vertically and horizontally. 
        CRITICAL: The subject must be small enough to fit entirely within the middle 50% of the image height. 
        The top 25% and bottom 25% of the image must be filled with extended background (sky, ground, environment) to allow for 2.4:1 cropping without cutting off the subject's head or feet. 
        Cinematic lighting, high quality, vivid colors. ${plan.imagePrompt}`;

        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
             parts: [{ text: refinedPrompt }]
          },
          config: {
             // @ts-ignore
             imageConfig: {
                aspectRatio: "16:9"
             }
          }
        });
        
        let base64Image = null;
        if (imageResponse.candidates?.[0]?.content?.parts) {
            for (const part of imageResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Image = part.inlineData.data;
                    break;
                }
            }
        }

        if (base64Image) {
           const imgTag = `
             <figure style="margin: 20px 0; text-align: center;">
               <img src="data:image/jpeg;base64,${base64Image}" style="display: block; width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 0 auto;" alt="AI插图" />
             </figure>
           `;
           
           if (plan.isCover) {
             // Prepend to the beginning of the body
             updatedHtml = imgTag + updatedHtml;
           } else if (plan.contextSnippet) {
             // Insert inline logic
             const snippet = plan.contextSnippet.trim();
             
             // 1. Try strict match with escaped regex
             const escapedSnippet = snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             // Try to find the snippet, possibly followed by closing tag
             const regex = new RegExp(`(${escapedSnippet}[^<]*</p>)`, 'i');
             
             if (regex.test(updatedHtml)) {
               updatedHtml = updatedHtml.replace(regex, `$1${imgTag}`);
             } else {
               // 2. Fallback: simple string replace
               if (updatedHtml.includes(snippet)) {
                    updatedHtml = updatedHtml.replace(snippet, `${snippet}${imgTag}`);
               } else {
                   // 3. Last resort: match substring
                   const shortSnippet = snippet.substring(0, 15);
                   if (shortSnippet.length > 10 && updatedHtml.includes(shortSnippet)) {
                        updatedHtml = updatedHtml.replace(shortSnippet, `${shortSnippet}${imgTag}`);
                   }
               }
             }
           }
        }

      } catch (imgError) {
        console.error("Error generating single image:", imgError);
      }
    }

    return updatedHtml;

  } catch (error) {
    console.error("Illustration Generation Error:", error);
    throw error;
  }
}

/**
 * Splits text into segments suitable for TTS (approx 300 chars).
 */
function splitTextForTTS(text: string, limit: number = 300): string[] {
    const segments: string[] = [];
    const rawParts = text.split(/([。！？；.?!;\n]+)/);
    const sentences: string[] = [];
    let currentBuffer = "";
    
    for (let i = 0; i < rawParts.length; i++) {
        currentBuffer += rawParts[i];
        if (/[。！？；.?!;\n]+/.test(rawParts[i])) {
            sentences.push(currentBuffer);
            currentBuffer = "";
        }
    }
    if (currentBuffer.trim()) {
        sentences.push(currentBuffer);
    }

    let currentSegment = "";
    for (const sent of sentences) {
        if (currentSegment.length + sent.length > limit) {
             if (currentSegment.trim()) {
                 segments.push(currentSegment);
                 currentSegment = "";
             }
             currentSegment = sent;
        } else {
             currentSegment += sent;
        }
    }
    if (currentSegment.trim()) {
        segments.push(currentSegment);
    }
    return segments;
}

/**
 * Generates speech from text using Gemini TTS.
 */
export async function generateSpeech(text: string): Promise<Blob[]> {
  try {
    const segments = splitTextForTTS(text, 300);
    const blobs: Blob[] = [];
    
    const segmentPromises = segments.map(async (segmentText, index) => {
        try {
            if (!segmentText.trim()) return null;

            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash-preview-tts",
              contents: [{ parts: [{ text: segmentText }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Puck' },
                    },
                },
              },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) return null;

            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const wavBytes = pcmToWav(bytes, 24000, 1, 16);
            return new Blob([wavBytes], { type: 'audio/wav' });
        } catch (e) {
            console.error(`Failed to generate audio for segment ${index}`, e);
            return null;
        }
    });

    const results = await Promise.all(segmentPromises);
    results.forEach(res => {
        if (res) blobs.push(res);
    });

    return blobs;

  } catch (error) {
    console.error("Speech Generation Error:", error);
    return [];
  }
}

/**
 * Merges multiple WAV blobs into a single WAV blob.
 * Assumes all blobs have the same format (24kHz, 1 channel, 16-bit).
 */
export async function mergeWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) return new Blob([]);
  if (blobs.length === 1) return blobs[0];

  const buffers = await Promise.all(blobs.map(b => b.arrayBuffer()));
  
  // Assume standard 44-byte WAV header for 16-bit PCM mono
  // We'll use the first buffer's header as a template
  const firstBuffer = buffers[0];
  const header = firstBuffer.slice(0, 44);
  const headerView = new DataView(header);
  
  // Calculate total data length
  let totalDataLength = 0;
  const pcmParts: ArrayBuffer[] = [];

  for (const buffer of buffers) {
    // Skip 44 bytes header
    const data = buffer.slice(44);
    pcmParts.push(data);
    totalDataLength += data.byteLength;
  }

  // Update header with new size
  // ChunkSize (offset 4) = 36 + SubChunk2Size
  headerView.setUint32(4, 36 + totalDataLength, true);
  // SubChunk2Size (offset 40) = totalDataLength
  headerView.setUint32(40, totalDataLength, true);

  // Combine
  const combinedBuffer = new Uint8Array(44 + totalDataLength);
  combinedBuffer.set(new Uint8Array(header), 0);
  
  let offset = 44;
  for (const part of pcmParts) {
    combinedBuffer.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }

  return new Blob([combinedBuffer], { type: 'audio/wav' });
}

/**
 * Rewrites a specific segment of text to sound more human.
 */
export async function rewriteTextSegment(originalText: string, context: string, instruction?: string): Promise<string> {
  try {
     const instructionText = instruction 
        ? `3. **特别要求**：${instruction}`
        : `3. 语言表达要更自然、口语化或更具情感色彩。`;

     const prompt = `
     任务：改写以下文字，使其更具“人味”，完全去除AI生成的痕迹。
     
     【上下文背景】
     ${context.substring(0, 300)}...
     
     【待改写文字】
     "${originalText}"
     
     【要求】
     1. 保持原意不变。
     2. 去除生硬的逻辑连接词（如“首先”、“其次”）。
     ${instructionText}
     4. 只需要返回改写后的纯文本，不要包含引号或其他解释说明。
     `;

     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: prompt
     });

     return response.text?.trim() || originalText;
  } catch (error) {
    console.error("Rewrite Error:", error);
    return originalText;
  }
}

/**
 * Generates a single high-quality emoticon based on reference.
 * Strictly NO TEXT.
 */
async function generateSingleEmoticon(referenceImageBase64: string, emotion: string): Promise<string | null> {
    try {
        const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
        
        const prompt = `
        Create a 3D cartoon/anime sticker of this character.
        Expression: ${emotion}.
        
        CRITICAL RULES:
        1. NO TEXT. NO SPEECH BUBBLES. NO WORDS. (Global audience).
        2. White Background.
        3. High quality, expressive, cute.
        4. Full head and shoulders shot.
        5. Just the character on white background.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: "1:1" }
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return part.inlineData.data;
            }
        }
        return null;
    } catch (error) {
        console.error(`Error generating ${emotion}:`, error);
        return null;
    }
}

/**
 * Generates a set of 8 emoticons in parallel with batching to avoid rate limits.
 * Returns an array of 8 base64 strings.
 */
export async function generateEmoticonSet(referenceImageBase64: string): Promise<string[]> {
    const emotions = [
        "Happy / Laughing", "Sad / Crying", "Angry / Burning", "Love / Heart Eyes",
        "Shocked / Surprised", "Sleeping / Zzz", "Thumbs Up / OK", "Thinking / Question Mark"
    ];

    try {
        const results: (string | null)[] = [];
        
        // Batch size of 3 to avoid hitting rate limits (Quota Exceeded)
        const batchSize = 3;
        
        for (let i = 0; i < emotions.length; i += batchSize) {
            const batch = emotions.slice(i, i + batchSize);
            // Process chunk
            const batchPromises = batch.map(emotion => generateSingleEmoticon(referenceImageBase64, emotion));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Optional tiny delay between batches if needed, but the await above acts as a throttle
            // await new Promise(r => setTimeout(r, 500));
        }
        
        // Filter out failures and return valid base64 strings
        return results.filter(img => img !== null).map(img => `data:image/png;base64,${img}`);
    } catch (error) {
        console.error("Emoticon Set Generation Error:", error);
        return [];
    }
}

/**
 * Generates a sprite sheet (sequence frames) for a specific sticker.
 * Returns the base64 of the sprite sheet (2x2 grid = 4 frames).
 * REVERTED to 2x2 grid for stability as per user request.
 */
export async function generateAnimationSpriteSheet(referenceImageBase64: string, emotionContext: string): Promise<string | null> {
    try {
        const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");

        const prompt = `
        Generate a "Sprite Sheet" for a smooth animation of this character.
        Action: ${emotionContext} (Continuous smooth loop).
        
        LAYOUT:
        - Strictly a 2 columns x 2 rows GRID (4 frames total).
        - Aspect Ratio: 1:1 SQUARE frames.
        
        CRITICAL CONSISTENCY RULES:
        1. Keep ALL accessories (necklace, hat, earrings) visible and identical in EVERY frame. Do NOT let them disappear or flicker.
        2. Keep the character's face size and position stable.
        3. NO TEXT. NO WORDS.
        4. White Background.

        STRICT NEGATIVE CONSTRAINTS (DO NOT DO THIS):
        - DO NOT ADD ANY NEW ACCESSORIES (No hats, no glasses, no items) that are not in the original image.
        - DO NOT CHANGE CAMERA ANGLE. Keep the exact same view (e.g. if original is 3/4 view, keep it 3/4 view).
        - DO NOT FLIP the image horizontally.
        - DO NOT change the outfit or color.
        
        MOTION GUIDANCE:
        - Only animate small details: blinking eyes, mouth movement, slight head bob, hair floating.
        - Keep the body relatively still to ensure smooth looping.
        - The goal is a subtle "breathing" or "alive" effect, NOT a scene change.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                // @ts-ignore
                imageConfig: { aspectRatio: "1:1" } // 2x2 grid fits perfectly in 1:1 square
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Sprite Sheet Error:", error);
        return null;
    }
}

/**
 * Generates a video script for a vertical short video.
 */
export async function generateVideoScript(topic: string): Promise<string> {
    try {
        const prompt = `
        Create a detailed script for a 30-60 second vertical short video (TikTok/Reels/Shorts).
        Topic: ${topic}
        
        Format the output as clean HTML with the following structure:
        - Use <h3> for Scene Headers (e.g., "Scene 1: Hook").
        - Use <p><strong>Visual:</strong> [Description]</p> for visual instructions.
        - Use <p><strong>Audio:</strong> [Dialogue/Voiceover]</p> for audio/speech.
        - Add <p><em>(Duration: X seconds)</em></p> for timing.
        
        Style: Engaging, fast-paced, viral potential.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        let text = response.text || "";
        text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
        return text;
    } catch (error) {
        console.error("Video Script Generation Error:", error);
        return "<h3>Error</h3><p>Failed to generate video script.</p>";
    }
}

/**
 * Generates a Veo video based on a prompt.
 */
export async function generateVeoVideo(prompt: string): Promise<string | null> {
    try {
        // Create a new GoogleGenAI instance to ensure the correct API key is used
        const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        let operation = await veoAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '1080p',
                aspectRatio: '9:16'
            }
        });

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            // @ts-ignore
            operation = await veoAi.operations.getVideosOperation({operation: operation});
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) return null;

        // Fetch the actual video bytes using the URI + API Key
        const videoResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        console.error("Veo Generation Error:", error);
        return null;
    }
}

/**
 * Wraps raw PCM data with a WAV header.
 */
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const headerLength = 44;
  const dataLength = pcmData.length;
  const fileSize = headerLength + dataLength;
  const wavBuffer = new Uint8Array(fileSize);
  const view = new DataView(wavBuffer.buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); 
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); 
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  wavBuffer.set(pcmData, 44);

  return wavBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

2. **重点标记（方便儿童识字与阅读）**：
   - **加粗**：请将文中的关键名词、成语使用 <strong> 或 <b> 标签加粗。
   - **醒目名词**：请将文中的**地名**、**生僻名词**、或**需要特别强调的概念**使用 <em> 标签包裹。这将被渲染为斜体且醒目的颜色。
   - **下划线**：请将文中的**金句**、**核心观点**或**富有哲理的句子**使用 <u> 标签添加下划线。
   
3. **禁用格式**：
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
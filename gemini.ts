/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";

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
【输出格式要求（程序必须可解析）】
1. **必须**返回一段纯 HTML 代码。
2. 文章标题**必须且只能**包含在唯一的 <h1> 标签中。
3. <h1> 标签必须放在返回内容的开头。
4. 正文内容紧接在 <h1> 之后，包含 <h2>, <p>, <ul> 等标签。
5. 不要包含 <html>, <head>, <body>, <!DOCTYPE> 等标签。
6. 不要使用 Markdown 代码块标记（如 \`\`\`html）。
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
 */
export async function addIllustrationsToArticle(articleHtml: string): Promise<string> {
  try {
    // 1. Analyze the text to find insertion points
    // We strip HTML tags for the prompt context to keep it clean, but we need unique snippets to match back.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = articleHtml;
    const articleText = tempDiv.innerText;

    const analysisPrompt = `
      我有一篇公众号文章，请帮我分析剧情和场景变换，找出 2 个最适合插入配图的位置。
      
      【配图要求】
      风格：3D卡通动漫风格
      构图：16:9 满屏构图，必须兼容 12:5 (2.4:1) 的超宽幅裁剪。
      内容：根据上下文描述场景，严禁出现文字、字母或数字。
      
      【文章内容】
      ${articleText.substring(0, 10000)}

      【输出要求】
      请返回一个 JSON 数组，包含 2 个对象。每个对象有以下属性：
      1. "contextSnippet": 必须是文章原文中**完全一致**的一段话（约 10-20 个字），图片将插入在这段话所在的段落之后。请确保这段话在文中是唯一的。
      2. "imagePrompt": 具体的英文绘画提示词（Prompt），用于生成 3D 卡通动漫风格的插图。请在提示词中强调主体必须非常小且居中，四周有大量留白。
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
              contextSnippet: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            }
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
        
        // Revised prompt strategy:
        // 1. Explicitly request NO black bars / borders.
        // 2. Enforce centering: Subject in the middle 50% height.
        // 3. Request background extension: Top/Bottom 25% must be sky/ground.
        const refinedPrompt = `3D cartoon anime style, 16:9 aspect ratio. 
        IMPORTANT: Generate a full-screen image without any black bars, borders, or letterboxing. Fill the entire canvas.
        COMPOSITION: The main subject (character/object) must be strictly centered vertically and horizontally. 
        CRITICAL: The subject must be small enough to fit entirely within the middle 50% of the image height. 
        The top 25% and bottom 25% of the image must be filled with extended background (sky, ground, environment) to allow for 2.4:1 cropping without cutting off the subject's head or feet. 
        Cinematic lighting, high quality, vivid colors. ${plan.imagePrompt}`;

        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image', // High speed image generation
          contents: {
             parts: [{ text: refinedPrompt }]
          },
          config: {
             // Use 16:9 aspect ratio (API standard), prompt handles the composition structure
             // @ts-ignore
             imageConfig: {
                aspectRatio: "16:9"
             }
          }
        });
        
        // Extract the base64 image
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
           // WeChat friendly styling: display block, max-width 100%, rounded corners
           const imgTag = `
             <figure style="margin: 20px 0; text-align: center;">
               <img src="data:image/jpeg;base64,${base64Image}" style="display: block; width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 0 auto;" alt="AI插图" />
             </figure>
           `;
           
           // Insert the image after the paragraph containing the snippet
           // Escape special regex chars in snippet
           const escapedSnippet = plan.contextSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           // Match the snippet, followed by any characters until the closing p tag
           const regex = new RegExp(`(${escapedSnippet}[^<]*</p>)`, 'i');
           
           if (regex.test(updatedHtml)) {
             updatedHtml = updatedHtml.replace(regex, `$1${imgTag}`);
           } else {
             // Fallback: just replace the snippet itself if p tag strict match fails
             updatedHtml = updatedHtml.replace(plan.contextSnippet, `${plan.contextSnippet}${imgTag}`);
           }
        }

      } catch (imgError) {
        console.error("Error generating single image:", imgError);
        // Continue to next image even if one fails
      }
    }

    return updatedHtml;

  } catch (error) {
    console.error("Illustration Generation Error:", error);
    throw error;
  }
}
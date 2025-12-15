/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef } from 'react';
import { XMarkIcon, PhotoIcon, ArrowPathIcon, FaceSmileIcon, ArrowDownTrayIcon, FilmIcon, QuestionMarkCircleIcon, InformationCircleIcon, CubeTransparentIcon } from '@heroicons/react/24/outline';
import { generateEmoticonSet, generateAnimationSpriteSheet } from '../services/gemini';
import JSZip from 'jszip';

interface EmoticonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmoticonModal: React.FC<EmoticonModalProps> = ({ isOpen, onClose }) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  // Store 8 separate images instead of one grid
  const [emoticonList, setEmoticonList] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Labels for the 8 slots to map to filenames
  const emotionLabels = [
      "Happy", "Sad", "Angry", "Love",
      "Shocked", "Sleep", "OK", "Think"
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setReferenceImage(ev.target.result as string);
          setEmoticonList([]); // Clear previous
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!referenceImage) {
        alert("请先上传参考图");
        return;
    }
    
    setIsGenerating(true);
    setEmoticonList([]);
    
    try {
        // Generate 8 distinct images
        const results = await generateEmoticonSet(referenceImage);
        if (results.length > 0) {
            setEmoticonList(results);
        } else {
            alert("生成失败，请重试");
        }
    } catch (e) {
        console.error(e);
        alert("生成出错");
    } finally {
        setIsGenerating(false);
    }
  };

  /**
   * SMART ALIGNMENT & CLEANUP ALGORITHM
   * 1. Removes white background (makes it transparent).
   * 2. Calculates the bounding box of the character (non-transparent pixels).
   * 3. Re-draws the character perfectly centered on the canvas (0,0 center alignment).
   */
  const processAndCenterFrame = (
      ctx: CanvasRenderingContext2D, 
      width: number, 
      height: number
  ): ImageData => {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      
      let minX = width, minY = height, maxX = 0, maxY = 0;
      let hasContent = false;

      // 1. Remove Background (White -> Transparent) & Find Bounds
      // Threshold for "White": RGB > 230
      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              // If pixel is near white, make it transparent
              if (r > 230 && g > 230 && b > 230) {
                  data[idx + 3] = 0; // Alpha = 0
              } else {
                  // If pixel is not transparent
                  if (data[idx + 3] > 0) {
                      if (x < minX) minX = x;
                      if (x > maxX) maxX = x;
                      if (y < minY) minY = y;
                      if (y > maxY) maxY = y;
                      hasContent = true;
                  }
              }
          }
      }

      if (!hasContent) return imgData; // Return original if empty

      // 2. Calculate Centering Shift
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      
      // Target Center
      const targetCenterX = width / 2;
      const targetCenterY = height / 2;
      
      // Current Center
      const currentCenterX = minX + contentWidth / 2;
      const currentCenterY = minY + contentHeight / 2;
      
      const shiftX = Math.round(targetCenterX - currentCenterX);
      const shiftY = Math.round(targetCenterY - currentCenterY);

      // 3. Create New Buffer and Draw Shifted
      const newImgData = new ImageData(width, height);
      const newData = newImgData.data;

      for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
              const srcIdx = (y * width + x) * 4;
              
              const newX = x + shiftX;
              const newY = y + shiftY;

              if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
                  const destIdx = (newY * width + newX) * 4;
                  newData[destIdx] = data[srcIdx];
                  newData[destIdx + 1] = data[srcIdx + 1];
                  newData[destIdx + 2] = data[srcIdx + 2];
                  newData[destIdx + 3] = data[srcIdx + 3];
              }
          }
      }

      return newImgData;
  };

  // Slices a 2x2 sprite sheet into 4 individual PNG blobs, applying centering
  const sliceSpriteSheet = async (spriteSheetBase64: string): Promise<Blob[]> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (!ctx) return reject("Canvas error");

              const cols = 2; // 2 columns
              const rows = 2; // 2 rows
              const frameWidth = Math.floor(img.width / cols);
              const frameHeight = Math.floor(img.height / rows);
              
              canvas.width = frameWidth;
              canvas.height = frameHeight;

              const blobs: Blob[] = [];
              let processedCount = 0;
              const totalFrames = cols * rows; // 4

              for (let y = 0; y < rows; y++) {
                  for (let x = 0; x < cols; x++) {
                      // 1. Clear canvas
                      ctx.clearRect(0, 0, frameWidth, frameHeight);
                      
                      // 2. Draw raw frame chunk
                      ctx.drawImage(
                          img, 
                          x * frameWidth, y * frameHeight, frameWidth, frameHeight, // Source
                          0, 0, frameWidth, frameHeight // Dest
                      );
                      
                      // 3. APPLY ALIGNMENT & BACKGROUND REMOVAL
                      const processedData = processAndCenterFrame(ctx, frameWidth, frameHeight);
                      ctx.putImageData(processedData, 0, 0);
                      
                      // 4. Export
                      canvas.toBlob((blob) => {
                          if (blob) blobs.push(blob);
                          processedCount++;
                          if (processedCount === totalFrames) resolve(blobs);
                      }, 'image/png');
                  }
              }
          };
          img.onerror = reject;
          img.src = spriteSheetBase64;
      });
  };

  const handleStickerClick = async (index: number) => {
      // 0. Check busy state
      if (animatingIndex !== null) return;

      const targetImage = emoticonList[index];
      if (!targetImage) return;

      const label = emotionLabels[index] || `Expression_${index}`;
      
      // 1. START GENERATION
      setAnimatingIndex(index);

      try {
          // Generate Sprite Sheet (2x2 grid)
          const spriteSheet = await generateAnimationSpriteSheet(targetImage, label);
          
          if (!spriteSheet) {
              throw new Error("Failed to generate sprite sheet");
          }

          // Slice & Auto-Align (Handles 4 frames)
          const frames = await sliceSpriteSheet(spriteSheet);

          // 2. CREATE ZIP FOLDER
          const zip = new JSZip();
          // Create a folder inside the zip for neatness (optional, but good practice)
          const folder = zip.folder(`${label}_Animation_4Frames`);
          
          if (folder) {
              frames.forEach((blob, i) => {
                  folder.file(`${label}_Frame_${String(i + 1).padStart(2, '0')}.png`, blob);
              });

              // Generate Zip Blob
              const content = await zip.generateAsync({ type: "blob" });

              // 3. TRIGGER SINGLE DOWNLOAD
              const a = document.createElement('a');
              a.href = URL.createObjectURL(content);
              a.download = `${label}_Animation_Pack_4FPS.zip`; // The file that acts like a folder
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);

              setTimeout(() => {
                  alert(`✅ 动画生成完毕！\n\n已下载 "${label}_Animation_Pack_4FPS.zip"。\n\n✨ 优化内容：\n1. 稳定输出：回归 4 帧经典布局，杜绝切片错位。\n2. 细节锁定：已修复配饰闪烁问题。\n3. 智能对齐：已自动居中。`);
              }, 500);
          }

      } catch (e) {
          console.error("Animation generation failed", e);
          alert("生成动画时遇到错误，请检查网络或重试。");
      } finally {
          setAnimatingIndex(null);
      }
  };

  const handleDownloadAllStatic = () => {
      emoticonList.forEach((src, i) => {
          const a = document.createElement('a');
          a.href = src;
          a.download = `${emotionLabels[i]}_static.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-lg">
                <FaceSmileIcon className="w-6 h-6 text-pink-600" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-gray-900">AI 国际化无字表情包制作</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>严格 2x4 布局</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-bold">
                        <CubeTransparentIcon className="w-3 h-3" />
                        智能对齐 (Auto-Center) + 4帧稳定版
                    </span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <button 
                        onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
                        className="flex items-center gap-1 text-pink-500 hover:text-pink-700 underline"
                    >
                        <InformationCircleIcon className="w-3 h-3" />
                        关于弹窗密钥
                    </button>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* API Key Help Panel (Conditional) */}
        {showApiKeyHelp && (
            <div className="bg-pink-50 px-6 py-3 border-b border-pink-100 text-sm text-pink-800 flex items-start gap-3 animate-in slide-in-from-top-2">
                <QuestionMarkCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold">为什么会弹出 "Choose a paid key" 对话框？</p>
                    <p className="opacity-80 mt-1">
                        为了生成高质量、可商用的图像和动画，系统连接的是 Google 专业的生成式 AI 模型。
                        当您点击生成时，如果检测到您的环境未配置特定权限，可能会请求您选择一个项目密钥。
                        <br/>
                        <strong className="text-pink-900">操作指南：</strong>直接点击对话框中的 "Create a new key" 或选择已有项目即可。这是 Google AI Studio 的标准安全流程，您的密钥仅用于本次生成。
                    </p>
                </div>
                <button onClick={() => setShowApiKeyHelp(false)} className="ml-auto text-pink-400 hover:text-pink-600">
                    <XMarkIcon className="w-4 h-4" />
                </button>
            </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6 bg-gray-50">
            
            {/* Left: Reference Input */}
            <div className="w-1/4 flex flex-col gap-4 shrink-0">
                <div className="font-bold text-gray-700 flex items-center gap-2">
                    <PhotoIcon className="w-5 h-5 text-gray-400" />
                    1. 角色参考图
                </div>
                
                <div 
                    className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden bg-white
                        ${referenceImage ? 'border-pink-300' : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50'}
                    `}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {referenceImage ? (
                        <img src={referenceImage} alt="Ref" className="w-full h-full object-contain p-2" />
                    ) : (
                        <div className="text-center text-gray-400 p-4">
                            <PhotoIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">上传图片</p>
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={!referenceImage || isGenerating || (animatingIndex !== null)}
                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all
                        ${!referenceImage || isGenerating || (animatingIndex !== null)
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-pink-500/30 active:scale-[0.98]'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            正在绘制8张表情...
                        </>
                    ) : (
                        <>
                            <FaceSmileIcon className="w-5 h-5" />
                            生成全套表情
                        </>
                    )}
                </button>

                <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs text-gray-500 space-y-2 shadow-sm flex-1">
                    <p className="font-bold text-gray-700">制作人提示：</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>AI 将生成 8 张<strong>无文字</strong>表情。</li>
                        <li>点击右侧任意表情，即可下载<strong>整理好的 ZIP 包</strong>。</li>
                        <li>内含 4 张序列帧 (2x2)，已自动<strong>去除背景</strong>并<strong>居中对齐</strong>。</li>
                    </ul>
                </div>
            </div>

            {/* Right: Output Grid */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="font-bold text-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaceSmileIcon className="w-5 h-5 text-gray-400" />
                        2. 表情包预览 (点击任意图片生成动画)
                    </div>
                    {emoticonList.length > 0 && (
                         <button 
                            onClick={handleDownloadAllStatic}
                            className="text-xs text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1 bg-pink-50 px-3 py-1.5 rounded-full border border-pink-200"
                         >
                             <ArrowDownTrayIcon className="w-4 h-4" />
                             一键下载所有静态图
                         </button>
                    )}
                </div>

                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-inner p-6 overflow-y-auto">
                    {isGenerating ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <div className="w-16 h-16 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
                            <p>AI 正在并行绘制 8 个独立表情...</p>
                            <p className="text-xs mt-2">预计耗时 10-20 秒</p>
                        </div>
                    ) : emoticonList.length > 0 ? (
                        <div className="grid grid-cols-4 gap-4 h-full content-start">
                            {/* 2 Rows x 4 Cols = 8 slots */}
                            {emoticonList.map((src, idx) => (
                                <div 
                                    key={idx} 
                                    className="relative group aspect-square bg-gray-50 rounded-lg border border-gray-100 hover:border-pink-400 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                                    onClick={() => handleStickerClick(idx)}
                                >
                                    <img src={src} className="w-full h-full object-contain p-2" alt={`sticker-${idx}`} />
                                    
                                    {/* Slot Label */}
                                    <div className="absolute top-2 left-2 bg-black/5 text-gray-400 text-[10px] px-1.5 rounded">
                                        {emotionLabels[idx]}
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
                                        <div className="bg-white text-pink-600 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                            <FilmIcon className="w-3 h-3" />
                                            生成 ZIP 动画包
                                        </div>
                                    </div>

                                    {/* Loading State Overlay */}
                                    {animatingIndex === idx && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 cursor-wait">
                                            <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                            <span className="text-[10px] font-bold text-pink-600">正在生成 4 帧动画...</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300">
                            <div className="grid grid-cols-4 gap-4 w-3/4 opacity-30 mb-4">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300"></div>
                                ))}
                            </div>
                            <p>等待生成...</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
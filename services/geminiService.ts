import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSingularity = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: `你是一个超大质量黑洞的意识。
            分析提供的图像。这个物体即将被你的事件视界吞噬。
            
            请返回一个 JSON 对象，包含：
            - "subject": 识别出的物体名称（中文，2-5个字）。
            - "message": 一段神秘、宏大、略带压迫感或科学性的描述，说明你将如何解构这种物质（中文，最多30个字）。
            - "dangerLevel": 一个 0 到 100 之间的数字，表示该物体为你增加了多少能量/质量。`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            message: { type: Type.STRING },
            dangerLevel: { type: Type.NUMBER },
          },
          required: ["subject", "message", "dangerLevel"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("虚空没有回应。");

    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("奇点通讯失败:", error);
    return {
      subject: "未知物质",
      message: "虚空无法解析此结构。",
      dangerLevel: 0
    };
  }
};
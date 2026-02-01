
import { GoogleGenAI, Type } from "@google/genai";
import { Dataset, AIResponse } from "../types";

export const analyzeData = async (
  query: string,
  dataset: Dataset,
  history: { role: string; content: string }[]
): Promise<AIResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Provide a rich context with more metadata and a representative sample
  const dataSample = dataset.data.slice(0, 15);
  const columnsList = dataset.columns.join(', ');
  
  // Create a summary of numeric vs categorical columns for the AI
  const columnTypes = dataset.columns.map(col => {
    const val = dataset.data.find(r => r[col] !== null && r[col] !== undefined)?.[col];
    return `${col} (${typeof val})`;
  }).join(', ');

  const systemInstruction = `You are a Senior Data Scientist at InsightAI. Your goal is to provide deep, actionable insights and beautiful visualizations for any user query regarding their dataset.

Dataset Metadata:
- File Name: ${dataset.name}
- Total Records: ${dataset.data.length}
- Columns & types: ${columnTypes}

Sample Data Context:
${JSON.stringify(dataSample)}

STRICT OPERATIONAL GUIDELINES:
1. ANALYZE: Carefully process the user's question relative to ALL available columns.
2. TEXTUAL RESPONSE: 
   - 'summary': A punchy, one-sentence headline of the main finding.
   - 'insight': A detailed, professional analysis. Break down trends, identify outliers, or answer specific calculations requested.
3. VISUALIZATION:
   - Always try to generate a chart if the data allows for comparison, distribution, or trends.
   - Choose 'bar' for categories, 'line' for time/sequences, 'pie' for parts-of-a-whole, 'scatter' for correlations.
   - Map 'chartData' to:
     - [{ "name": "Label", "value": 123 }, ...] for bar/line/pie.
     - [{ "x": 10, "y": 20 }, ...] for scatter.
   - Use high-quality, descriptive 'xAxisLabel' and 'yAxisLabel'.
4. FALLBACK: If the data cannot answer the question, explain why clearly in the 'insight' and set 'chartType' to 'none'.
5. OUTPUT: Return ONLY a valid JSON object following the responseSchema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            insight: { type: Type.STRING },
            chartType: { type: Type.STRING, description: "One of: bar, line, pie, scatter, none" },
            chartData: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER }
                }
              }
            },
            xAxisLabel: { type: Type.STRING },
            yAxisLabel: { type: Type.STRING },
            suggestion: { type: Type.STRING, description: "A relevant follow-up question." }
          },
          required: ["summary", "insight", "chartType", "chartData"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty AI response.");
    
    const parsed = JSON.parse(text);
    return parsed as AIResponse;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "InsightAI is having trouble processing this request. Please try a different question.");
  }
};

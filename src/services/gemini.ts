import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMosquitoAnswer(question: string, history: any[], additionalContext: string) {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `You are "Zanzara Impariamo", an expert on mosquitoes. 
  You provide precise and correct information about mosquitoes in both Tamil and English.
  Use the following additional knowledge if provided: ${additionalContext}.
  Always respond in the language the user used (Tamil or English).`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      ...history,
      { role: "user", parts: [{ text: question }] }
    ],
    config: {
      systemInstruction,
    },
  });

  return response.text;
}

export async function textToSpeech(text: string) {
  const model = "gemini-2.5-flash-preview-tts";
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/wav;base64,${base64Audio}`;
  }
  return null;
}

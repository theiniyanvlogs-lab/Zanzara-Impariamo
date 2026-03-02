import { GoogleGenAI, Modality } from "@google/genai";

/**
 * ✅ IMPORTANT:
 * Netlify + Vite environment variables must use:
 * import.meta.env.VITE_*
 */
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

/* =====================================================
   MOSQUITO QUESTION ANSWER
===================================================== */

export async function getMosquitoAnswer(
  question: string,
  history: any[],
  additionalContext: string
) {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
You are "Zanzara Impariamo", an expert on mosquitoes.
You provide scientifically accurate information about mosquitoes.

Rules:
- Answer in Tamil if user asks in Tamil.
- Answer in English if user asks in English.
- Keep answers clear and educational.
- Use additional knowledge if provided.

Additional Knowledge:
${additionalContext}
`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      ...history,
      {
        role: "user",
        parts: [{ text: question }],
      },
    ],
    config: {
      systemInstruction,
    },
  });

  return response.text;
}

/* =====================================================
   TEXT TO SPEECH
===================================================== */

export async function textToSpeech(text: string) {
  const model = "gemini-2.5-flash-preview-tts";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text }],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Kore",
          },
        },
      },
    },
  });

  const base64Audio =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (base64Audio) {
    return `data:audio/wav;base64,${base64Audio}`;
  }

  return null;
}

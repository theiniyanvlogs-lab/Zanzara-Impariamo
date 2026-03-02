import { GoogleGenAI, Modality } from "@google/genai";

/* =====================================================
   ✅ SAFE ENV LOADING (VITE + NETLIFY)
===================================================== */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Safety check (prevents blank screen)
if (!API_KEY) {
  console.error("❌ Gemini API key missing!");
}

/* =====================================================
   ✅ GEMINI CLIENT
===================================================== */

const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

/* =====================================================
   ✅ MOSQUITO QUESTION ANSWER
===================================================== */

export async function getMosquitoAnswer(
  question: string,
  history: any[] = [],
  additionalContext: string = ""
) {
  try {
    const model = "gemini-1.5-flash";

    const systemInstruction = `
You are "Zanzara Impariamo", an expert on mosquitoes.

Rules:
- Reply in Tamil if question is Tamil.
- Reply in English if question is English.
- Keep answers short, scientific, and clear.
- Be educational and accurate.

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

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "⚠️ AI response failed. Please try again.";
  }
}

/* =====================================================
   ✅ TEXT TO SPEECH
===================================================== */

export async function textToSpeech(text: string) {
  try {
    const model = "gemini-1.5-flash";

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

    const audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audio) return null;

    return `data:audio/wav;base64,${audio}`;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

import { GoogleGenAI, Modality } from "@google/genai";

/* =====================================================
   ✅ LOAD GEMINI API KEY (VITE + NETLIFY SAFE)
===================================================== */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ Gemini API key missing.");
}

/* =====================================================
   ✅ GEMINI CLIENT
===================================================== */

const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

/* =====================================================
   ✅ MOSQUITO AI ANSWER
===================================================== */

export async function getMosquitoAnswer(
  question: string,
  history: any[] = [],
  additionalContext: string = ""
) {
  try {
    const model = "gemini-2.0-flash";

    const systemInstruction = `
You are "Zanzara Impariamo", a mosquito science expert.

Rules:
- Answer Tamil questions in Tamil.
- Answer English questions in English.
- Keep answers clear, scientific and educational.
- Avoid unnecessary long explanations.

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
   ✅ TEXT TO SPEECH (VOICE)
===================================================== */

export async function textToSpeech(text: string) {
  try {
    const model = "gemini-2.0-flash-exp";

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

    const audioBase64 =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) return null;

    return `data:audio/wav;base64,${audioBase64}`;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMosquitoAnswer(question: string, history: any[], additionalContext: string) {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `You are "Zanzara Impariamo", an expert on mosquitoes. 
  You provide precise and correct information about mosquitoes in both Tamil and English.
  Use the following additional knowledge if provided: ${additionalContext}.
  You MUST return your response in a JSON format with two fields: "english" and "tamil".
  The "english" field should contain the English explanation.
  The "tamil" field should contain the Tamil translation.
  Ensure both are detailed and accurate.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      ...history,
      { role: "user", parts: [{ text: question }] }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          english: { type: Type.STRING },
          tamil: { type: Type.STRING }
        },
        required: ["english", "tamil"]
      }
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return data;
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    return { english: response.text || "", tamil: "" };
  }
}

export async function textToSpeech(text: string) {
  const model = "gemini-2.5-flash-preview-tts";
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Read this clearly: ${text}` }] }],
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
      // The model returns raw PCM data (L16, 24kHz). We need to wrap it in a WAV header.
      return pcmToWav(base64Audio, 24000);
    }
  } catch (error) {
    console.error("TTS API Error:", error);
  }
  return null;
}

function pcmToWav(pcmBase64: string, sampleRate: number): string {
  const pcmData = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true); // PCM
  // channel count
  view.setUint16(22, 1, true); // Mono
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, pcmData.length, true);

  const blob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

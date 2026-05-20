import { Mistral } from '@mistralai/mistralai';
import { NextResponse } from 'next/server';
// import * as dotenv from 'dotenv';

// dotenv.config();

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const sampleRate= 16000

export async function POST(req: Request) {
  const { messages, voiceId } = await req.json();

  try {
    const ttsResponse = await client.audio.speech.complete({
      model: "voxtral-mini-tts-2603",
      input: messages,
      voiceId: voiceId,
      responseFormat: "wav",
    });
      

    const audioBase64 = await ttsResponse.audioData;
    return NextResponse.json({
      audio: audioBase64,

    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur API Mistral" }, { status: 500 });
  }
}
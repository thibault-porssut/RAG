import { Mistral } from '@mistralai/mistralai';
import { NextResponse } from 'next/server';
// import * as dotenv from 'dotenv';

// dotenv.config();

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

export async function POST(req: Request) {
  const { messages, voiceId } = await req.json();

  try {
    console.log("1. Chat Completion");
    console.log(messages);

    const chatResponse = await client.chat.complete({
      model: "mistral-large-latest",
      messages:[{ role: 'user', content: messages }] ,
    });
    const assistantText = chatResponse.choices[0].message.content;

    console.log("Text to Speech");
    const ttsResponse = await client.audio.speech.complete({
      model: "voxtral-mini-tts-2603",
      input: assistantText,
      voiceId: voiceId,
      responseFormat: "wav",
    });
      
    console.log("convertit l'audio en base64");

    // On convertit l'audio en base64 pour le renvoyer facilement au front
    const audioBase64 = await ttsResponse.audioData;
    // const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      text: assistantText,
      audio: audioBase64
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur API Mistral" }, { status: 500 });
  }
}
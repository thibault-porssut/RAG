import { Mistral } from '@mistralai/mistralai';
import { NextResponse } from 'next/server';
// import * as dotenv from 'dotenv';

// dotenv.config();

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const sampleRate= 16000

// const get_wav_duration = (audio_bytes) => {
//   const binaryString = atob(audio_bytes);
//     const dataSizeInBytes = binaryString.length - 44; // Taille moins l'entête
    
//     // En Mono 16-bit, 1 échantillon = 2 octets
//     const totalSamples = dataSizeInBytes / 2; 
    
//     return totalSamples / sampleRate;
  
// }

export async function POST(req: Request) {
  const { messages, voiceId } = await req.json();

  try {
    console.log("1. Chat Completion");
    // console.log(messages);

    const chatResponse = await client.chat.complete({
      model: "mistral-large-2512",
      // messages:[{ role: 'user', content: messages }] ,
      messages:messages ,

    });
    const assistantText = chatResponse.choices[0].message.content;

    console.log("Text to Speech");
    // console.log(assistantText);
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
    // const duration =get_wav_duration(audioBase64)


    return NextResponse.json({
      text: assistantText,
      audio: audioBase64,
      // duration : duration
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur API Mistral" }, { status: 500 });
  }
}
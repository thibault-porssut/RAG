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
  const { messages } = await req.json();

  try {
  
    const chatResponse = await client.chat.complete({
      model: "mistral-large-2512",
      messages:messages ,

    });
    const assistantText = chatResponse.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      text: assistantText,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur API Mistral" }, { status: 500 });
  }
}
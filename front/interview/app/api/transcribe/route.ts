
import { RealtimeTranscription } from "@mistralai/mistralai/extra/realtime";
import { AudioEncoding } from "@mistralai/mistralai/extra/realtime";
import { NextResponse } from 'next/server';
// import { arrayBuffer } from "stream/consumers";
import { Readable ,PassThrough} from "stream";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';



// if (ffmpegStatic) {
//     ffmpeg.setFfmpegPath(ffmpegStatic);
// }

const client = new RealtimeTranscription({ apiKey: process.env.MISTRAL_API_KEY });


export async function POST(audioBytes: Request) {
  
  const formData = await audioBytes.formData();
  const file = formData.get('file') as File;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const pcmStream = new PassThrough();
  const inputStream = Readable.from(buffer)
  
  // ffmpeg(inputStream)
  //           .toFormat('s16le')      // Format PCM 16 bits Little Endian
  //           .audioChannels(1)       // Mono (Mistral préfère)
  //           .audioFrequency(16000)  // 16kHz comme demandé dans ta config
  //           .on('error', (err) => console.error('FFmpeg Error:', err))
  //           .pipe(pcmStream);       // Envoie le résultat dans notre pcmStream

  const audioFormat = {
  encoding: AudioEncoding.PcmS16le,
  sampleRate: 16000,
  };  
  const full_transcription: string[] = []
  try {
      
    for await (const event  of client.transcribeStream(
      inputStream,
      "voxtral-mini-transcribe-realtime-2602",
      { audioFormat }
    )) {
  
      if (event.type == 'transcription.text.delta') {
        const text = (event as any).text;
        full_transcription.push(text )
      }
      else if (event.type == 'transcription.done') {;
        break;
      }
      else if (event.type === "error") {
        const error = (event as any).error;
        const errorMessage = typeof error.message === "string"
          ? error.message
          : JSON.stringify(error.message);
        console.error(`\nTranscription error: ${errorMessage}`);
        process.exitCode = 1;
        break;
      }

    }
  }
  catch(error) {
    console.log("Error during transcription"+error)
    return;
  }
  finally {
    return NextResponse.json({
          text: full_transcription.join("")
        });
  }
  
}
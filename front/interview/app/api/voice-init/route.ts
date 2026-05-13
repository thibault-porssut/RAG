
import { Mistral } from "@mistralai/mistralai";
import { readFileSync } from "fs";
import { NextResponse } from 'next/server';



const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });


export async function POST() {
  
  const sampleAudio = readFileSync("uploads/sample_female.opus").toString("base64");
  const voice = await client.audio.voices.create({
    name: "interviewer_voice",
    sampleAudio: sampleAudio,
    sampleFilename: "sample_female.opus",
    languages: ["en", "fr"],
    gender: "female",
  });
   
  return NextResponse.json({
    text: voice.id
  })
  
}

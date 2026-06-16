import postgres from 'postgres';
import { NextResponse } from 'next/server';
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });


async function insertMessageToTranscriptTable(role:string,content_text:string,path_to_sound:string,user:string) {

  await sql`
  INSERT INTO transcript (interviews_id, role, content_text,path_to_sound)
  VALUES (
    ${user}, 
    ${role}, 
    ${content_text},
    ${path_to_sound}
  )`;
}

export async function POST(
  request: Request
) {
  try {
  const body = await request.json();
  const { role, content_text, path_to_sound, user } = body;
    await insertMessageToTranscriptTable(role, content_text, path_to_sound, user)
  return NextResponse.json({ status: 201 })
    
  }
  catch(error) {
     console.error("Error when adding transcript", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
  

}

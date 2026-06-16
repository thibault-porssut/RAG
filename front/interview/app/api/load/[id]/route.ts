import { NextResponse } from 'next/server';
import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function getExistingTranscript(id: string) {
  const result = await await sql`
    SELECT role, content_text as content 
    FROM transcript 
    WHERE interviews_id = ${id}
    ORDER BY created_at DESC
  `;
  return result || null;
}


export async function GET(
  request: Request,
  { params }: { params: Promise <{id: string }> }) {
  try {
    const { id } = await params;

    const userData = await getExistingTranscript(id);
  
    return NextResponse.json(
      { userData: userData }, { status: 200 });
    
  }
  catch(error) {
     console.error("Error when adding transcript", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
  

}

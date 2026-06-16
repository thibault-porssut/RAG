
import { NextResponse } from 'next/server';
import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });


async function insertMessageToInterviewTable(username:string,api_config:string,system_prompt:string) {
  const result= await sql`
  
  INSERT INTO interviews(username,api_config,system_prompt)
  VALUES(
  ${username},
  ${JSON.stringify(api_config)},
  ${system_prompt}
  )
  RETURNING id
  `;

  return result[0];

}


async function getExistingInterview(username: string) {
  const result = await sql`SELECT id,interview_done FROM interviews WHERE username = ${username}`;
  return result[0] || null;
}


export async function POST(
  request: Request
) {
  try{
    const body = await request.json();
    const { username, api_config, system_prompt } = body;

    const alreadyExist =await getExistingInterview(username);

    if(alreadyExist)
    {

       return NextResponse.json({ id: alreadyExist.id, state: alreadyExist.interview_done}, { status: 200 })
    }
    else {
        
        const newInterview = await insertMessageToInterviewTable(username, api_config, system_prompt)

  
        return NextResponse.json({ id: newInterview.id }, { status: 201 })
    }


  }catch (error) {
    console.error("Error when creating the interview", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}




   

import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl:  'verify-full' });

async function createInterviewTable()
{
  await sql`
        CREATE TABLE IF NOT EXISTS interviews (
          id UUID DEFAULT uuid_generate_v4()  PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          start_at TIMESTAMP DEFAULT NOW(),
          ended_at TIMESTAMP,
          answers_count INT,
          api_config JSONB,
          system_prompt TEXT,
          interview_done BOOLEAN DEFAULT FALSE

        )
      `;
}

async function createTranscriptTable()
{
  await sql`
      CREATE TABLE IF NOT EXISTS transcript (
        id UUID DEFAULT uuid_generate_v4()  PRIMARY KEY,
        interviews_id UUID REFERENCES interviews(id),
        role VARCHAR(255) NOT NULL,
        CONSTRAINT chk_role  CHECK( role IN('assistant','user')),
        content_text TEXT,
        path_to_sound VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
       
      )
    `;

}


async function initDataBase() {
  
  try {
    //  const { role,content } = await request.json();
  
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    await createInterviewTable()
    await createTranscriptTable()
    
    console.log('Database initialized');
    
  }
  catch(error) {
    console.log(error)
  }
  finally {
    console.log('Closing database connection...');
    await sql.end()
  }
  // return Response.json({ id: interviewTable.id });

}

initDataBase();
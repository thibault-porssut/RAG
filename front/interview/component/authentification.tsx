'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SYSTEM_PROMPT, AVATAR_INTERVIEWER, AVATAR_RESPONDENT,CLOSING_MESSAGES } from '@/app/config/config';



export default function Authentification() {
    const router = useRouter();
    const [texte, setTexte] = useState("");
    const [interviewStatus, setInterviewStatus] = useState(false);

 
    


    const id = useRef<string | null>(null);
    const fetchData = async (username: string, api_config: string, system_prompt: string) => {
        try {
                const payload = {
                    username: username,
                    api_config: api_config,
                    system_prompt: system_prompt,
            };
            const response = await fetch('/api/interview_table', {
                method: 'POST', headers: {
                    'content_type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
                const data = await response.json();
                // id.current = data.id
                return data
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };
    
 
    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
                {(!interviewStatus) && (<>
            <h1 className="text-3xl font-bold mb-6">Prêt pour votre entretien ?</h1>
            <input
            id="monChamp"
            type="text"
            value={texte} // On lie la valeur à notre état
            onChange={(e) => setTexte(e.target.value)} // On met à jour l'état à chaque touche sur le clavier
            placeholder="Tapez votre identifiant.."
            className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
            <button 
            // onClick={() => texte != '' ? setHasStarted(true) : setHasStarted(false)}
                    onClick={async () => {
                        if (texte.trim() != '')
                        {
                            const interview = await fetchData(texte, "", SYSTEM_PROMPT)
                            
                            if (interview) {
                                if (interview.interview_done)
                                {
                    
                                    setInterviewStatus(true)    
                                } 
                                else {
                               
                                    router.push(`/interview/${interview.id}`); 
                                }    
                            }
                            else {
                                alert("initialisation error")
                            }
                          
                            
                            
                        }
                
            }}
        
            className="bg-blue-600 text-white px-8 py-3 rounded-full text-lg hover:bg-blue-700 shadow-lg transition"
            >
            🚀 Commencer l'entretien
            </button>
                <p className="mt-4 text-gray-500 text-sm">Cliquez pour autoriser l'audio et le micro</p></>)}
                
            {(interviewStatus) && (
                <h1 className="text-3xl font-bold mb-6">Vous avez déjà passé l'interview</h1>
        
            )}
        </div>
        </div>
    );
}
    

                

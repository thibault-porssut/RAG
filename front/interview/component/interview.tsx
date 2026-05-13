'use client';
import { useState, useRef } from 'react';

export default function Interview() {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSent, setIsSent] = useState(true);
  const [status, setStatus] = useState('En attente...');
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const voiceidRef = useRef<string>('');
  const lastUserAnswerRef = useRef<string>('');

  // Démarrer l'enregistrement
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: 'audio/webM' });
      processUserAudio(audioBlob);
    };

    mediaRecorder.current.start();

    setIsRecording(true);
    setStatus('Je vous écoute...');
    console.log("ECOUTER");

  };

  // Envoyer l'audio au serveur pour transcription + réponse
  const processUserAudio = async (blob: Blob) => {
    setStatus('Transcription et réflexion...');
    
    // 1. Transcription (Appel à une route /api/transcribe similaire)
    console.log("Transcription");

    const formData = new FormData();
    formData.append('file', blob);
    console.log("FETCH");
    
    try {
      const transRes = await fetch('/api/transcribe', { method: 'POST', body: formData });
      if (!transRes.ok) {
        setStatus("Error Server" + transRes.status)
        return;
      }

      const { text: userAnswer } = await transRes.json();
      lastUserAnswerRef.current=userAnswer
      console.log(lastUserAnswerRef.current);
    

      // 2. Obtenir la réponse de l'IA
      console.log("Obtenir IA answer");
      const updatedMessages = [...messages];

      if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role == 'user') {
        updatedMessages.pop(); 
      }

      const newMessages = [...updatedMessages, { role: 'user', content: lastUserAnswerRef.current }];
      // const newMessages =  userText ;

      setMessages(newMessages);



      // const newMessagesJson = { role: 'assistant', content: newMessages };

      
    } catch (error) {
      console.error("Network connection error")
      setStatus("Error Network"+error)
    }
  };
  const getAnswerfromIA = async () => {

    if (voiceidRef.current == '') {
        setIsSent(true)
        const idRes = await fetch('/api/voice-init', { method: 'POST'});
        if (!idRes.ok) {
          setStatus("Error Server" + idRes.status)
          return;
        }

        const { text: voiceID } = await idRes.json();
        voiceidRef.current=voiceID
      }


      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: lastUserAnswerRef.current, voiceId: voiceidRef.current })
      });
      console.log("Réponse de l'IA");

      const data = await chatRes.json();
    
      // Mettre à jour le chat et lire l'audio
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      // setMessages(prev => [...prev,data.text ]);

      playAudio(data.audio);

  }
  const playAudio = (base64: string) => {
    setStatus('L’interviewer parle...');
    const audioSrc = `data:audio/wav;base64,${base64}`;
    if (audioRef.current) {
      audioRef.current.src = audioSrc;
      audioRef.current.play();
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Interview AI</h1>
      
      <div className="bg-gray-100 p-4 h-96 overflow-y-auto mb-4 rounded shadow-inner">
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-blue-600' : 'text-green-600'}`}>
            <strong>{m.role === 'user' ? 'Vous: ' : 'IA: '}</strong> {m.content}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        <p className="italic text-gray-500">{status}</p>
        <audio ref={audioRef} onEnded={() => setStatus('À vous de répondre')} />
        
        {isRecording&&isSent ? (
          <button
            onClick={() => { mediaRecorder.current?.stop(); setIsSent(false); }}
            className="bg-gray-800 text-white px-6 py-2 rounded-full"
          >
            ⏹️ Arrêter
          </button>) : (
          <div>
            
          </div>
        )}

        {!isRecording ? (
        // CAS : PAS EN TRAIN D'ENREGISTRER
        isSent ? (
          <button 
            onClick={startRecording}
            className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition"
          >
            🎤 Commencer à répondre
          </button>
          ) : (
                <div>
            
          </div>
          
        )
      ) : (
        // CAS : EN TRAIN D'ENREGISTRER
            !isSent ? (
              <div>
              <button 
                onClick={() => { getAnswerfromIA(); setIsRecording(false)}}
                className="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600 transition"
              >
                🚀 Envoyer la réponse
              </button>
              <button 
                  onClick={() => { startRecording(); setIsSent(true);}}
                className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition"
              >
                🔄 Réenregistrer
                </button>
                </div>
              
              
         
            ) : (
            <div>
            
          </div>
          
        )
      )}       
      </div>
    </div>
  );
}



'use client';
import { useState, useRef } from 'react';

export default function Interview() {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('En attente...');
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const voiceidRef = useRef<string>('');

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

      const { text: userText } = await transRes.json();
      console.log(userText);
    

      // 2. Obtenir la réponse de l'IA
      console.log("Obtenir IA answer");

      const newMessages = [...messages, { role: 'user', content: userText }];
      // const newMessages =  userText ;

      setMessages(newMessages);

      // const newMessagesJson = { role: 'assistant', content: newMessages };

      if (voiceidRef.current == '') {
      
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
        body: JSON.stringify({ messages: userText, voiceId: voiceidRef.current })
      });
      console.log("Réponse de l'IA");

      const data = await chatRes.json();
    
      // Mettre à jour le chat et lire l'audio
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      // setMessages(prev => [...prev,data.text ]);

      playAudio(data.audio);
    } catch (error) {
      console.error("Network connection error")
      setStatus("Error Network"+error)
    }
  };

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
        
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition"
          >
            🎤 Commencer à répondre
          </button>
        ) : (
          <button 
            onClick={() => { mediaRecorder.current?.stop(); setIsRecording(false); }}
            className="bg-gray-800 text-white px-6 py-2 rounded-full"
          >
            ⏹️ Arrêter et envoyer
          </button>
        )}
      </div>
    </div>
  );
}
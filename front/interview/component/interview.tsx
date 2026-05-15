'use client';
import { useState, useRef,useEffect } from 'react';

export default function Interview() {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSent, setIsSent] = useState(true);
  const [status, setStatus] = useState('En attente...');
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const voiceidRef = useRef<string>('');
  const lastUserAnswerRef = useRef<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  useEffect(() => {
      const getMicrophones = async () => {
          try {
          // On demande d'abord la permission pour que Chrome nous donne les VRAIS noms des micros (ex: "AirPods de Thibault")
          await navigator.mediaDevices.getUserMedia({ audio: true });
          
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
          
          setDevices(audioInputs);
          
          if (audioInputs.length > 0) {
              setSelectedDeviceId(audioInputs[audioInputs.length-1].deviceId); // Par défaut, le premier
          }
          } catch (err) {
          console.error("Impossible de lister les micros", err);
          }
      };

      getMicrophones();
      }, []);

  // Démarrer l'enregistrement
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined 
    }
  });
    mediaRecorder.current = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.current.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
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
      
      <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Choix du micro :</label>
      <select 
        value={selectedDeviceId} 
        onChange={(e) => setSelectedDeviceId(e.target.value)}
        className="border rounded px-3 py-2 bg-gray text-sm w-full max-w-xs"
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone alternatif (${device.deviceId.slice(0, 5)})`}
          </option>
        ))}
      </select>
    </div>
    </div>


    


  );
}



'use client';
import { useState, useRef, useEffect } from 'react';
import { SYSTEM_PROMPT, AVATAR_INTERVIEWER, AVATAR_RESPONDENT } from '@/app/config/config';
import ReactMarkdown from 'react-markdown';

export default function Interview() {



  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [status, setStatus] = useState('En attente...');
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const voiceidRef = useRef<string>('');
  const lastUserAnswerRef = useRef<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasStarted, setHasStarted] = useState(false);
  const [texte, setTexte] = useState("");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  
  useEffect(() => {
    if (!hasStarted) return;
  const initializeAI = async () => {
    setStatus('Initialisation de l’entretien...');
    if (voiceidRef.current == '') {
        const idRes = await fetch('/api/voice-init', { method: 'POST'});
        if (!idRes.ok) {
          setStatus("Error Server" + idRes.status)
          return;
        }

        const { text: voiceID } = await idRes.json();
        voiceidRef.current=voiceID
      }
    
    try {
      // On envoie juste un tableau avec le system prompt pour "réveiller" l'IA
      const newMessages = [{ role: 'system', content: SYSTEM_PROMPT }];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages:newMessages,
            voiceId: voiceidRef.current 
        })
      });

      // const newMessages =  userText ;

      // setMessages(newMessages);


      const data = await response.json();
      const duration= data.duration*1000

      const newMessagesBis= [...newMessages, { role: 'assistant', content: data.text}];


      
      // On ajoute la réponse de bienvenue de l'IA dans le chat
      // setMessages([
      //   { role: 'system', content: SYSTEM_PROMPT },
      //   { role: 'assistant', content: data.text }
      // ]);
      
      // On joue l'audio de bienvenue
      playAudio(data.audio);
      setStatus('L’interviewer parle...');

      await sleep(duration);
      setMessages(newMessagesBis);

      

    } catch (error) {
      console.error("Erreur d'initialisation", error);
    }
  };

  initializeAI();
}, [hasStarted]);


   
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

    


      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages, voiceId: voiceidRef.current })
      });
      console.log("Réponse de l'IA");

    const data = await chatRes.json();
    const duration= data.duration*1000
    
      // Mettre à jour le chat et lire l'audio
    // setMessages(prev => [...prev,data.text ]);
    playAudio(data.audio);
    
    await sleep(duration);
    setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    

  }
  const playAudio = (base64: string) => {
    setStatus('L’interviewer parle...');
    const audioSrc = `data:audio/wav;base64,${base64}`;
    if (audioRef.current) {
      audioRef.current.src = audioSrc;
      audioRef.current.play();
    }
  };

  if (!hasStarted) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
       
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
          onClick={() => texte!='' ? setHasStarted(true):setHasStarted(false)}
          className="bg-blue-600 text-white px-8 py-3 rounded-full text-lg hover:bg-blue-700 shadow-lg transition"
        >
          🚀 Commencer l'entretien
        </button>
        <p className="mt-4 text-gray-500 text-sm">Cliquez pour autoriser l'audio et le micro</p>
      </div>
    </div>
  );
}

  return (
    
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-4">
      <label className="block text-sm font-medium text-gray-400 mb-1">Choix du micro :</label>
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
      {/* <h1 className="text-2xl font-bold mb-4">Interview AI</h1> */}
      
      <div className=" p-6 h- overflow-y-auto mb-4 flex flex-col gap-4">
        {messages.filter(m => m.role !== 'system').map((m, i) => (

          <div key={i} className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-blue-800 text-white self-end rounded-tr-none' : 'bg-gray-900 text-white-800 self-start rounded-tl-none'}`}>
              
            <div className='flex items-center gap-2 mb-1'>
              <span className='text-xs font-bold uppercase tracking-wider opacity-70'>
                {m.role === 'user' ? `${AVATAR_RESPONDENT} Vous` : `${AVATAR_INTERVIEWER} Interviewer`}
              </span>
            </div>

            <div className="text-sm leading-relaxed prose prose-sm max-w-none">
            <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        
        )
        )}
       {/* <div ref={messagesEndRef} /> */}
      </div>
      <div className="flex flex-col items-center gap-4 h-32">
        <p className="italic text-gray-500">{status}</p>
        
        {/* L'astuce magique ici : on réinitialise les boutons quand l'IA a fini de parler ! */}
        <audio 
          ref={audioRef} 
          onEnded={() => {
            setStatus('À vous de répondre');
            setIsSent(true); 
            setIsRecording(false);
          }} 
        />

        {/* ÉTAPE 1 : Prêt à parler */}
        {!isRecording && isSent && (
          <button 
            onClick={startRecording}
            className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition shadow-lg"
          >
            🎤 Commencer à répondre
          </button>
        )}

        {/* ÉTAPE 2 : En cours d'enregistrement */}
        {isRecording && isSent && (
          <button
            onClick={() => { mediaRecorder.current?.stop(); setIsSent(false); }}
            className="bg-gray-800 text-white px-6 py-2 rounded-full hover:bg-gray-700 transition animate-pulse shadow-lg"
          >
            ⏹️ Arrêter
          </button>
        )}

        {/* ÉTAPE 3 : Enregistrement terminé, choix de l'utilisateur */}
        {isRecording && !isSent && (
          <div className="flex gap-4">
            <button 
              onClick={() => { 
                getAnswerfromIA(); 
                setIsRecording(false); // Fait disparaître les boutons pendant que l'IA réfléchit
              }}
              className="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600 transition shadow-lg"
            >
              🚀 Envoyer la réponse
            </button>
            <button 
              onClick={() => { startRecording(); setIsSent(true); }}
              className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition shadow-lg"
            >
              🔄 Réenregistrer
            </button>
          </div>
        )}

        {/* ÉTAPE 4 : L'IA réfléchit ou parle (aucun bouton affiché) */}
        {!isRecording && !isSent && (
          <div className="text-gray-400">
            {/* Tu pourrais mettre un petit spinner de chargement ici si tu le souhaites */}
          </div>
        )}
        
      </div>

     
      
    </div>


    


  );
}



// {/* ÉTAPE 4 : L'IA réfléchit ou parle (aucun bouton affiché) */}
//   {!isRecording && !isSent && (
//     <div className="flex items-center gap-3 text-blue-600 font-medium animate-pulse py-2">
//       {/* Petit icône de chargement qui tourne (Spinner) */}
//       <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
//         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//       </svg>
//       <span>L'assistant a la parole...</span>
//     </div>
//   )}


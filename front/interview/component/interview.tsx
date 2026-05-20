'use client';
import { useState, useRef, useEffect } from 'react';
import { SYSTEM_PROMPT, AVATAR_INTERVIEWER, AVATAR_RESPONDENT,CLOSING_MESSAGES } from '@/app/config/config';
import ReactMarkdown from 'react-markdown';

export default function Interview() {



  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('En attente...');
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const voiceidRef = useRef<string>('');
  // const isInitializedRef = useRef<bool>(false);
  const lastUserAnswerRef = useRef<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasStarted, setHasStarted] = useState(false);
  const [texte, setTexte] = useState("");
  const statutsBusy = ['Initialisation de l’entretien...', 'L’interviewer parle...', 'Transcription...', 'Réflexion...'];
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const globalStreamRef = useRef<MediaStream | null>(null);


  // const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    const getMicrophones = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        globalStreamRef.current = stream;
          
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
          
        setDevices(audioInputs);
          
        if (audioInputs.length > 0) {
          setSelectedDeviceId(audioInputs[audioInputs.length - 1].deviceId); // Par défaut, le premier
        }
      } catch (err) {
        console.error("Impossible de lister les micros", err);
      }
    };

    getMicrophones();
  }, []);
  
  useEffect(() => {
    if (!hasStarted) return;

    // if (isInitializedRef.current) return;
    // isInitializedRef.current = true; // On verrouille immédiatement

    const initializeAI = async () => {
      setStatus('Initialisation de l’entretien...');
      if (voiceidRef.current == '') {
        const idRes = await fetch('/api/voice-init', { method: 'POST' });
        if (!idRes.ok) {
          setStatus("Error Server" + idRes.status)
          return;
        }

        const { text: voiceID } = await idRes.json();
        voiceidRef.current = voiceID
      }
    
      try {
        const newMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
        setMessages(newMessages)
        getAnswerfromIA(newMessages)
        

      } catch (error) {
        console.error("Erreur d'initialisation", error);
      }
    };

    initializeAI();
  }, [hasStarted]);

  useEffect(() => {
    return () => {
      // Ferme proprement le moteur audio si le composant est détruit
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
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

    mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); }
    mediaRecorder.current.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      processUserAudio(audioBlob);
    };

    mediaRecorder.current.start();

    setStatus('Je vous écoute...');

  };

  // Envoyer l'audio au serveur pour transcription + réponse
  const processUserAudio = async (blob: Blob) => {

    if (blob.size === 0) {
      setStatus("Erreur: Aucun son capté. Veuillez réenregistrer.");
      return; 
    }
    setStatus('Transcription...');
    

    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    
    try {
      const transRes = await fetch('/api/transcribe', { method: 'POST', body: formData });
      if (!transRes.ok) {
        setStatus("Error Server" + transRes.status)
        return;
      }

      const { text: userAnswer } = await transRes.json();
      lastUserAnswerRef.current = userAnswer

      const updatedMessages = [...messages];

      if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role == 'user') {
        updatedMessages.pop();
      }

      const newMessages = [...updatedMessages, { role: 'user', content: lastUserAnswerRef.current }];
  

      setMessages(newMessages);
      setStatus("Attente de votre choix");

      
    } catch (error) {
      console.error("Network connection error")
      setStatus("Error Network" + error)
    }
  };
  const getAnswerfromIA = async(messagesReceived:string) => {

    const messageTemp= messagesReceived ||messages
   

    let chatRes;
    let data;
    let success = false;
    
    // On essaie jusqu'à 3 fois en cas de Timeout (30s)
    for (let i = 0; i < 3; i++) {
      try {
        if (i > 0) setStatus(`L'IA prend du temps, tentative ${i + 1}/3...`);
        
        chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messageTemp })
        });

        if (chatRes.ok) {
          data = await chatRes.json();
          success = true;
          break; // Si ça a marché, on sort de la boucle
        }
      } catch (error) {
        console.error(`Tentative ${i + 1} échouée`, error);
      }
    }

    if (!success) {
      setStatus('L’IA est indisponible, veuillez réessayer.');
      return; // On arrête tout si les 3 essais ont échoué
    }
    
    const code = Object.keys(CLOSING_MESSAGES).find(key =>
      data.text.includes(key)
    );

    const newMessages = CLOSING_MESSAGES[code] || data.text

    const audioRes = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages:newMessages , voiceId: voiceidRef.current })
    });

    const dataAudio = await audioRes.json();

    await playAudio(dataAudio.audio);
    setStatus('À vous de répondre');

    // await sleep(duration);
    setMessages(prev => [...prev, { role: 'assistant', content: newMessages }]);
    

  }
  // const playAudio = (base64: string) => {
    
  //   setStatus('L’interviewer parle...');
  //   // const audioSrc = `data:audio/wav;base64,${base64}`;
    

  //   return new Promise((resolve) => {
  //     if (audioRef.current) {
  //       audioRef.current.pause();
  //       audioRef.current.src = ""; // Vide la mémoire du son précédent
  //     }
      
  //     audioRef.current = new Audio(`data:audio/wav;base64,${base64}`);
  //     if (audioRef.current) {
      
          
  //     audioRef.current.onended = () => resolve(true);
        
  //       audioRef.current.onerror = () => {
  //         console.error("Erreur de lecture audio");
  //         resolve(true);
  //       };

  //       audioRef.current.play().catch(e => {
  //         console.error("Lecture bloquée par le navigateur", e);
  //         resolve(true);
  //       });
  //     } else {
  //       resolve(true);

      
      
  //     }
  //     });
  // };
  const playAudio = async (base64: string) => {
    setStatus('L’interviewer parle...');

    // 1. Initialisation paresseuse de l'AudioContext au premier message
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioCtxRef.current;

    // Si le contexte est en pause (sécurité navigateur), on le réactive
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // 2. Si un son jouait déjà, on le stoppe proprement
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
    }

    // 3. Conversion ultra-rapide du Base64 en tableau de bytes binaires
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 4. Décodage de l'audio sur un thread séparé du processeur
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

    return new Promise((resolve) => {
      // 5. Création du nœud de lecture
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      // On garde une référence pour pouvoir le couper au message suivant
      audioSourceRef.current = source;

      // Quand le son se termine naturellement
      source.onended = () => {
        resolve(true);
      };

      // 6. Lancement immédiat sans latence
      source.start(0);
    });
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
         {/* Petit icône de chargement qui tourne (Spinner) */}
        <div className="flex gap-3">
          {statutsBusy.includes(status)&&<svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>}
        <p className="italic text-gray-500">{status}</p>

        </div>
        

        {/* ÉTAPE 1 : Prêt à parler */}
        {(status=='À vous de répondre') && (
          <button 
            onClick={startRecording}
            className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition shadow-lg"
          >
            🎤 Commencer à répondre
          </button>
        )}

        {/* ÉTAPE 2 : En cours d'enregistrement */}
        {(status=='Je vous écoute...') && (
          <button
            onClick={() => { mediaRecorder.current?.stop(); }}
            className="bg-gray-800 text-white px-6 py-2 rounded-full hover:bg-gray-700 transition animate-pulse shadow-lg"
          >
            ⏹️ Arrêter
          </button>
        )}

        {/* ÉTAPE 3 : Enregistrement terminé, choix de l'utilisateur */}
        {(status=="Attente de votre choix") && (
          <div className="flex gap-4">
            <button 
              onClick={() => {
                setStatus('Réflexion...');
                getAnswerfromIA(); 

              }}
              className="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600 transition shadow-lg"
            >
              🚀 Envoyer la réponse
            </button>
            <button 
              onClick={() => { startRecording(); }}
              className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition shadow-lg"
            >
              🔄 Réenregistrer
            </button>
          </div>
        )}

        {/* ÉTAPE 4 : L'IA réfléchit ou parle (aucun bouton affiché) */}
        {statutsBusy.includes(status) && (
          <div className="text-gray-400">
   
          </div>
        )}
        
      </div>

     
      
    </div>


    


  );
}

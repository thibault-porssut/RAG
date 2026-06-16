'use client';
import { useState, useRef, useEffect } from 'react';
import { SYSTEM_PROMPT, AVATAR_INTERVIEWER, AVATAR_RESPONDENT,CLOSING_MESSAGES } from '@/app/config/config';
import ReactMarkdown from 'react-markdown';
import type RecordRTC from 'recordrtc';

interface InterviewScreenProps {
  interviewId: string;
}


export default function InterviewScreen({interviewId}:InterviewScreenProps) {


  type Message = {
    role: 'system' | 'user' | 'assistant'
    content: string
  }
  type ClosingKey = keyof typeof CLOSING_MESSAGES
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('En attente...');
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorder = useRef<RecordRTC | null>(null);
  const voiceidRef = useRef<string>('');
  // const isInitializedRef = useRef<bool>(false);
  const lastUserAnswerRef = useRef<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [texte, setTexte] = useState("");
  const statutsBusy = ['Initialisation de l’entretien...', 'L’interviewer parle...', 'Transcription...', 'Réflexion...'];
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const globalStreamRef = useRef<MediaStream | null>(null);
  const preloadedAudioRef = useRef<string | null>(null); // Stockera le Base64 de l'audio
  const preloadedMessageRef = useRef<string | null>(null); // Stockera le Base64 de l'audio
  const [isAiAnswer, setAiAnswer] = useState(false); // Version synchrone de ton state hasStarted
  
  

  
  useEffect(() => {
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

        const historyRes = await fetch(`/api/load/${interviewId}`);
        const historyData = await historyRes.json(); // Renvoie un tableau de messages [{role, content}, ...]
        console.log('INIT')

        console.log(historyRes)
        console.log(historyData.userData)

          
        // if (historyData && historyData.length > 0)
      if (historyData.userData && historyData.userData.length > 0)
        {
          console.log("RELOAD")
          setMessages(historyData.userData)
          setStatus('À vous de répondre');

        }
        else {
          console.log("NON RELOAD")
          const newMessages: Message[] = [{ role: 'system', content: SYSTEM_PROMPT }];
          setMessages(newMessages)
          getAnswerfromIA(newMessages)


        }
          
         // await sleep(duration);
        
      } catch (error) {
        console.error("Erreur d'initialisation", error);
      }
    };

    initializeAI();
  }, [interviewId]);

  useEffect(() => {
    return () => {
      // Ferme proprement le moteur audio si le composant est détruit
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  useEffect( () => {
    const run = async () => {
      if (isAiAnswer && preloadedAudioRef.current) {
        try {
          await playAudio(preloadedAudioRef.current);
          setAiAnswer(false);

        } catch (e) { }
      }
    }
    run();

  }, [isAiAnswer]);

  useEffect(() => {
    getMicrophones()
    return () => {
    if (globalStreamRef.current) {
      globalStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };
  }, [interviewId]

  );

   
  const getMicrophones = async () => {
      try {
        
      const constraints = {
      audio: selectedDeviceId 
        ? { deviceId: { exact: selectedDeviceId } } 
        : true // Utilise le micro par défaut du téléphone (souvent le meilleur)
          };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        globalStreamRef.current = stream;
          
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
          
        setDevices(audioInputs);
          
        if (audioInputs.length > 0) {
            setSelectedDeviceId(audioInputs[0].deviceId); // Par défaut, le premier
            sessionStorage.setItem('preferred_mic_id', audioInputs[0].deviceId);
        }
        return true;
      } catch (err: any) {
        console.error("Impossible de lister les micros", err);
        alert(`Erreur micro: ${err.name} - ${err.message}`);
        return false;
      }
    };

// 1. Modifier le démarrage de l'enregistrement
const startRecording = async () => {
  const RecordRTCModule = (await import('recordrtc')).default;
  
  const stream = globalStreamRef.current;
    if (!stream) {
      console.error('No media stream available');
      setStatus('Aucun flux audio disponible');
      return;
    }



    // On instancie RecordRTC et on le stocke dans ta ref
    mediaRecorder.current = new RecordRTCModule(stream, {
      type: 'audio',
      mimeType: 'audio/wav',         // Crée un conteneur WAV
      desiredSampRate: 16000,        // Échantillonnage à 16kHz
      recorderType: RecordRTCModule.StereoAudioRecorder,
      numberOfAudioChannels: 1,      // Mono
    });

    // Avec RecordRTC, on lance simplement la méthode dédiée
    mediaRecorder.current.startRecording();

    setStatus('Je vous écoute...');
  };

  
// 2. Modifier la fin de l'enregistrement (à l'endroit où tu coupes le micro)
  const stopRecording = async () => {
    const recorder = mediaRecorder.current;
    if (!recorder) return;

    setStatus('Transcription en cours...');

    //  callback stopRecording, ou l'on récupère l'audio
    recorder.stopRecording(() => {
      // 1. On récupère le gros Blob WAV généré par RecordRTC
      const wavBlob = recorder.getBlob();
      
      // 2. On retire l'en-tête de 44 octets pour obtenir du PCM linéaire pur (s16le)
      const rawPcmBlob = wavBlob.slice(44, wavBlob.size, 'audio/pcm');
      
      // 3. On envoie le PCM pur à ton API Mistral
      processUserAudio(rawPcmBlob);
    });
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

      const newMessages : Message[] = [...updatedMessages, { role: 'user', content: lastUserAnswerRef.current }];
  

      setMessages(newMessages);
      setStatus("Attente de votre choix");

      
    } catch (error) {
      console.error("Network connection error")
      setStatus("Error Network" + error)
    }
  };
  const getAnswerfromIA = async(messagesReceived?: Message[]) => {

    const messageTemp= messagesReceived ||messages
   

    let chatRes;
    let data: { text: string } | undefined
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

    if (!success|| !data) {
      setStatus('L’IA est indisponible, veuillez réessayer.');
      return; // On arrête tout si les 3 essais ont échoué
    }
    
    const code = Object.keys(CLOSING_MESSAGES).find((key):key is ClosingKey =>
      data.text.includes(key)
    );

    // const newMessages = 
    preloadedMessageRef.current = code ? CLOSING_MESSAGES[code] : data.text

    const audioRes = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages:preloadedMessageRef.current , voiceId: voiceidRef.current })
    });

    const dataAudio = await audioRes.json();
    preloadedAudioRef.current = dataAudio.audio;
    await saveTranscript('assistant', preloadedMessageRef.current ,'',interviewId)

    setAiAnswer(true)


   
    

  }

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
        setMessages(prev  => [...prev, { role: 'assistant', content: preloadedMessageRef.current ?? '' }]);
        setStatus('À vous de répondre');

      };

      // 6. Lancement immédiat sans latence
      source.start(0);
    });
  };

const handleDeviceChange = async (deviceId: string) => {
  setSelectedDeviceId(deviceId);
  // sessionStorage.setItem("preferred_mic_id", deviceId);

  // 1. On coupe proprement l'ancien flux pour éteindre le micro actuel
  if (globalStreamRef.current) {
    globalStreamRef.current.getTracks().forEach(track => track.stop());
  }

  // 2. On ouvre le flux sur le nouveau périphérique sélectionné
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } }
    });
    globalStreamRef.current = stream; // Nouvelle référence pour RecordRTC
  } catch (err) {
    console.error("Error loading microphone", err);
  }
}
  
const saveTranscript = async (role: string, content_text: string, path_to_sound: string, user: string) => {
    try{
      const payload = {
        role: role,
        content_text: content_text,
        path_to_sound: path_to_sound,
        user: user
      }
      await fetch('/api/transcript_table', {
        method: 'POST', headers: {
          'content_type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
    }
     catch (error) {
                console.error('Failed to fetch transcript:', error);
            }
  } 
  return (
    
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-4">
      <label className="block text-sm font-medium text-gray-400 mb-1">Choix du micro :</label>
      <select 
        value={selectedDeviceId} 
        onChange={(e) => handleDeviceChange(e.target.value)}
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

          <div key={i} className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-blue-800 text-white self-end rounded-tr-none' : 'bg-gray-900 text-white self-start rounded-tl-none'}`}>
              
            <div className='flex items-center gap-2 mb-1'>
              <span className='text-xs font-bold uppercase tracking-wider opacity-70'>
                {m.role === 'user' ? `${AVATAR_RESPONDENT} Vous` : `${AVATAR_INTERVIEWER} Interviewer`}
              </span>
            </div>

            <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
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
            onClick={stopRecording}
            className="bg-gray-800 text-white px-6 py-2 rounded-full hover:bg-gray-700 transition animate-pulse shadow-lg"
          >
            ⏹️ Arrêter
          </button>
        )}

        {/* ÉTAPE 3 : Enregistrement terminé, choix de l'utilisateur */}
        {(status=="Attente de votre choix") && (
          <div className="flex gap-4">
            <button 
              onClick={async() => {
                setStatus('Réflexion...');
                await saveTranscript('user', lastUserAnswerRef.current  ,'',interviewId)
                await getAnswerfromIA(); 

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

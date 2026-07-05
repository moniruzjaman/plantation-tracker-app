import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  Camera, 
  MessageSquare, 
  Volume2, 
  VolumeX, 
  Leaf, 
  AlertCircle, 
  Trash2, 
  Loader2, 
  ChevronRight, 
  Globe2, 
  RefreshCw, 
  Smile, 
  FileText,
  BadgeAlert
} from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AIAssistantProps {
  onClose?: () => void;
  inlineMode?: boolean;
  initialTab?: 'chat' | 'diagnose';
  initialPrompt?: string;
}

export default function AIAssistant({ 
  onClose, 
  inlineMode = false, 
  initialTab, 
  initialPrompt 
}: AIAssistantProps) {
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [activeTab, setActiveTab] = useState<'chat' | 'diagnose'>(initialTab || 'chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { 
      role: 'model', 
      text: 'আসসালামু আলাইকুম! আমি আপনার জাতীয় বৃক্ষরোপণ এবং বনায়ন এআই সহকারী। আমি আপনাকে যেকোনো চারার রোগ নির্ণয়, সঠিক সার প্রয়োগ, মাটি পরীক্ষা এবং বৃক্ষরোপণের লক্ষ্য অর্জনে সাহায্য করতে পারি। আপনি কি জানতে চান?' 
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [diagnoseImage, setDiagnoseImage] = useState<string | null>(null);
  const [diagnosePrompt, setDiagnosePrompt] = useState('');
  const [diagnoseResult, setDiagnoseResult] = useState<string | null>(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiScore, setAiScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('ai_consultation_score') || '0', 10);
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Trigger initial prompt action if supplied
  const initialPromptRan = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptRan.current) {
      initialPromptRan.current = true;
      if (activeTab === 'chat') {
        handleSendChat(initialPrompt);
      } else if (activeTab === 'diagnose') {
        setDiagnosePrompt(initialPrompt);
      }
    }
  }, [initialPrompt, activeTab]);

  // Adjust greeting language
  useEffect(() => {
    if (chatMessages.length === 1) {
      if (language === 'en') {
        setChatMessages([
          { 
            role: 'model', 
            text: 'Hello! I am your National Plantation and Forestry AI Co-pilot. I can help you diagnose seedling diseases, suggest ideal soils, recommend organic fertilizers, or calculate carbon credit estimates. Ask me anything!' 
          }
        ]);
      } else {
        setChatMessages([
          { 
            role: 'model', 
            text: 'আসসালামু আলাইকুম! আমি আপনার জাতীয় বৃক্ষরোপণ এবং বনায়ন এআই সহকারী। আমি আপনাকে যেকোনো চারার রোগ নির্ণয়, সঠিক সার প্রয়োগ, মাটি পরীক্ষা এবং বৃক্ষরোপণের লক্ষ্য অর্জনে সাহায্য করতে পারি। আপনি কি জানতে চান?' 
          }
        ]);
      }
    }
  }, [language]);

  // Handle Score Storage
  const increaseScore = (points: number) => {
    const newScore = aiScore + points;
    setAiScore(newScore);
    localStorage.setItem('ai_consultation_score', newScore.toString());
  };

  // Pre-set quick action queries
  const quickPromptsBn = [
    { label: 'চারা দ্রুত বৃদ্ধির উপায় কী?', text: 'চারার দ্রুত বৃদ্ধি এবং স্বাস্থ্যকর পাতার জন্য কী কী সার এবং মাটি পরিচর্যা করতে হবে?' },
    { label: 'পাতা হলুদ হওয়ার প্রতিকার', text: 'গাছের চারা বা পাতার রঙ হলুদ হয়ে যাওয়ার কারণ কী এবং এর প্রতিকার কী?' },
    { label: '১ হেক্টর বনের কার্বন শোষণ ক্ষমতা', text: '১ হেক্টর জায়গায় শাল বা গর্জন বন তৈরি করলে বছরে কতটুকু কার্বন ডাই অক্সাইড শোষিত হতে পারে এবং কার্বন ক্রেডিট হিসাব কেমন?' },
    { label: 'কীটপতঙ্গ দমনের উপায়', text: 'নার্সারিতে চারা গাছের পোকা-মাকড় দমনে ঘরোয়া এবং পরিবেশবান্ধব জৈব কীটনাশক তৈরির উপায় বলুন।' }
  ];

  const quickPromptsEn = [
    { label: 'How to boost seedling growth?', text: 'What organic fertilizers and soil treatments are best to accelerate the growth of fruit and forest seedlings?' },
    { label: 'Yellow leaves treatment', text: 'What causes seedling leaves to turn yellow, and how do we treat it organically?' },
    { label: '1 Hectare Carbon Sequestration', text: 'How much CO2 is sequestered by a 1-hectare mango/timber plantation annually in Bangladesh, and what is its carbon credit potential?' },
    { label: 'Eco-friendly pest control', text: 'What are the best organic recipes to prevent nursery pests and fungal leaf spots?' }
  ];

  const currentQuickPrompts = language === 'bn' ? quickPromptsBn : quickPromptsEn;

  // Handle Text-to-Speech (Bangla or English)
  const handleToggleSpeak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert(language === 'bn' ? 'আপনার ব্রাউজারে স্পিচ সিন্থেসিস সাপোর্ট করে না।' : 'Speech synthesis not supported in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`_\-]/g, ''));
    // Try to find a Bengali voice if language is BN
    if (language === 'bn') {
      utterance.lang = 'bn-BD';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Reset chat history
  const handleResetChat = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (language === 'bn') {
      setChatMessages([
        { 
          role: 'model', 
          text: 'আসসালামু আলাইকুম! আমি আপনার জাতীয় বৃক্ষরোপণ এবং বনায়ন এআই সহকারী। আমি আপনাকে যেকোনো চারার রোগ নির্ণয়, সঠিক সার প্রয়োগ, মাটি পরীক্ষা এবং বৃক্ষরোপণের লক্ষ্য অর্জনে সাহায্য করতে পারি। আপনি কি জানতে চান?' 
        }
      ]);
    } else {
      setChatMessages([
        { 
          role: 'model', 
          text: 'Hello! I am your National Plantation and Forestry AI Co-pilot. I can help you diagnose seedling diseases, suggest ideal soils, recommend organic fertilizers, or calculate carbon credit estimates. Ask me anything!' 
        }
      ]);
    }
  };

  // Submit Text Query
  const handleSendChat = async (textToSend?: string) => {
    const rawText = textToSend || chatInput;
    if (!rawText.trim() || chatLoading) return;

    if (!textToSend) {
      setChatInput('');
    }

    const newMsgs = [...chatMessages, { role: 'user' as const, text: rawText }];
    setChatMessages(newMsgs);
    setChatLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawText,
          history: chatMessages,
          language
        })
      });

      if (!response.ok) {
        throw new Error('Server error');
      }

      const data = await response.json();
      setChatMessages([...newMsgs, { role: 'model', text: data.text }]);
      increaseScore(5); // Reward 5 XP points for consulting AI
    } catch (e: any) {
      console.error(e);
      setChatMessages([...newMsgs, { 
        role: 'model', 
        text: language === 'bn' 
          ? 'দুঃখিত, সংযোগে ত্রুটি হয়েছে। আপনার ডিভাইসের ইন্টারনেট কানেকশন চেক করুন।' 
          : 'Sorry, communication failed. Please check your internet connection and try again.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle Leaf Image Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const rawResult = reader.result as string;
        
        // If Rural Data Saver is active, compress the image locally using Canvas
        const isDataSaver = localStorage.getItem('rural_data_saver_active') === 'true';
        if (isDataSaver) {
          const img = new Image();
          img.src = rawResult;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 450; // High-fidelity but low bandwidth footprint for Rural Bangladesh
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Compress to JPEG with 0.65 quality to save up to 99% cellular data size
              const compressedResult = canvas.toDataURL('image/jpeg', 0.65);
              setDiagnoseImage(compressedResult);
              setDiagnoseResult(null);
            } else {
              setDiagnoseImage(rawResult);
              setDiagnoseResult(null);
            }
          };
        } else {
          setDiagnoseImage(rawResult);
          setDiagnoseResult(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Run AI Image Diagnosis
  const handleRunDiagnosis = async () => {
    if (!diagnoseImage || diagnoseLoading) return;

    setDiagnoseLoading(true);
    setDiagnoseResult(null);

    try {
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: diagnoseImage,
          prompt: diagnosePrompt,
          language
        })
      });

      if (!response.ok) {
        throw new Error('Diagnosis server failed');
      }

      const data = await response.json();
      setDiagnoseResult(data.result);
      increaseScore(25); // Reward 25 XP points for high-precision diagnostic audit
    } catch (e) {
      console.error(e);
      setDiagnoseResult(language === 'bn' 
        ? 'ছবি বিশ্লেষণ করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন এবং নেটওয়ার্ক চেক করুন।' 
        : 'Failed to diagnose. Please verify your internet connection and try again.'
      );
    } finally {
      setDiagnoseLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans rounded-2xl overflow-hidden shadow-2xl border border-slate-200" id="aiAssistantRoot">
      
      {/* Header Panel */}
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500 rounded-lg animate-pulse text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              {language === 'bn' ? 'জাতীয় বৃক্ষরোপণ এআই কো-পাইলট' : 'National Forestry AI Co-pilot'}
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-600 rounded-full font-bold uppercase text-white tracking-widest">GEMINI 3.5</span>
            </h3>
            <p className="text-[10px] text-slate-400">
              {language === 'bn' ? 'রিয়েল-টাইম রোগ নির্ণয় ও চারাগাছ পরিচর্যা সহকারী' : 'Real-time diagnosis & plantation consultant'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* XP Token Score Counter */}
          <div className="bg-slate-800 border border-slate-700/80 rounded-full px-2.5 py-0.5 flex items-center gap-1.5 text-[10.5px]">
            <span className="text-amber-400 font-bold">★</span>
            <span className="text-slate-200 font-black">{aiScore} XP</span>
          </div>

          {/* Lang Selector Toggle */}
          <button
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-1 text-[11px] font-bold px-2.5"
            title="ভাষা পরিবর্তন"
          >
            <Globe2 className="w-3.5 h-3.5" />
            {language === 'bn' ? 'ENG' : 'বাংলা'}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full">
          {/* Tab 1: AI Chat */}
          <button
            onClick={() => {
              setActiveTab('chat');
              window.speechSynthesis.cancel();
              setIsSpeaking(false);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {language === 'bn' ? 'কৃষি পরামর্শ চ্যাট' : 'Forestry Chat'}
          </button>

          {/* Tab 2: Leaf Disease Diagnosis */}
          <button
            onClick={() => {
              setActiveTab('diagnose');
              window.speechSynthesis.cancel();
              setIsSpeaking(false);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'diagnose'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Camera className="w-4 h-4" />
            {language === 'bn' ? 'চারা রোগ নির্ণয় হাব' : 'Leaf Disease Diagnosis'}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        
        {/* TAB 1: CONVERSATION CHAT */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full bg-slate-50/80">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-2.5 max-w-[85%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                  }`}>
                    {msg.role === 'user' ? 'Me' : <Leaf className="w-4 h-4 text-emerald-400" />}
                  </div>

                  <div className={`rounded-2xl p-3 text-xs leading-relaxed shadow-sm relative group ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                  }`}>
                    <div className="whitespace-pre-line prose max-w-none text-xs">
                      {msg.text}
                    </div>

                    {/* Audio read-aloud trigger on assistant replies */}
                    {msg.role === 'model' && (
                      <div className="mt-2 flex items-center justify-end border-t border-slate-100 pt-1.5 gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleSpeak(msg.text)}
                          className="flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-slate-100 text-[10px] font-bold text-slate-600 cursor-pointer"
                        >
                          {isSpeaking ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>{language === 'bn' ? 'থামান' : 'Stop'}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{language === 'bn' ? 'শুনুন' : 'Speak'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-2.5 max-w-[70%] mr-auto items-center">
                  <div className="w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center text-white animate-spin">
                    <Loader2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-500 shadow-sm flex items-center gap-2">
                    <span className="animate-pulse">{language === 'bn' ? 'সহকারী বিশ্লেষণ করছেন...' : 'AI Co-pilot is thinking...'}</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts Carousel */}
            {chatMessages.length < 4 && (
              <div className="px-4 py-2 shrink-0 border-t border-slate-200/60 bg-white">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">
                  {language === 'bn' ? 'দ্রুত পরামর্শ নিন' : 'Suggested Inquiries'}
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {currentQuickPrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendChat(p.text)}
                      className="px-3 py-1.5 rounded-full border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-200 text-[11px] font-bold text-emerald-800 transition-all shrink-0 cursor-pointer active:scale-98"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="bg-white border-t border-slate-200 px-4 py-2.5 flex items-center gap-2 shrink-0">
              <button
                onClick={handleResetChat}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title={language === 'bn' ? 'চ্যাট মুছে ফেলুন' : 'Clear chat history'}
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder={
                  language === 'bn' 
                    ? 'চারাগাছের যত্ন বা সার বিষয়ে কোনো প্রশ্ন লিখুন...' 
                    : 'Ask about seedling diseases, fertilizers, soils...'
                }
                className="flex-1 bg-slate-100 hover:bg-slate-150/50 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs focus:outline-none transition-all"
              />

              <button
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IMAGE ANALYSIS & LEAF DIAGNOSIS */}
        {activeTab === 'diagnose' && (
          <div className="absolute inset-0 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
            
            {/* Upload Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Photo Upload Card */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-emerald-50/20 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />

                {diagnoseImage ? (
                  <div className="relative w-full aspect-video max-h-40 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <img 
                      src={diagnoseImage} 
                      alt="Plant Leaf Draft" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                      {language === 'bn' ? 'নতুন ছবি নির্বাচন করুন' : 'Select New Photo'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full mb-3 group-hover:scale-105 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="font-extrabold text-xs text-slate-700 mb-1">
                      {language === 'bn' ? 'পাতার ছবি তুলুন বা আপলোড করুন' : 'Take or Upload Leaf Photo'}
                    </span>
                    <p className="text-[10px] text-slate-400 max-w-[200px]">
                      {language === 'bn' ? 'রোগ নির্ণয়ের জন্য চারা বা আক্রান্ত পাতার পরিষ্কার ছবি দিন' : 'Clear close-up photo of infected leaf/stem for accurate analysis'}
                    </p>
                  </>
                )}
              </div>

              {/* Input Prompt Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {language === 'bn' ? 'অতিরিক্ত প্রশ্ন (ঐচ্ছিক)' : 'Additional Question (Optional)'}
                </span>

                <textarea
                  value={diagnosePrompt}
                  onChange={(e) => setDiagnosePrompt(e.target.value)}
                  placeholder={
                    language === 'bn' 
                      ? 'উদাহরণ: গাছটিতে কতদিন পর পানি দেব? গাছের পাতা শুকিয়ে যাচ্ছে কেন?' 
                      : 'E.g., How often should I water? Are there signs of fungal infection?'
                  }
                  className="w-full flex-1 min-h-[70px] bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all resize-none"
                />

                <button
                  onClick={handleRunDiagnosis}
                  disabled={!diagnoseImage || diagnoseLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-99"
                >
                  {diagnoseLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === 'bn' ? 'ছবি বিশ্লেষণ করা হচ্ছে...' : 'Analyzing Image...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{language === 'bn' ? 'এআই রোগ নির্ণয় শুরু করুন' : 'Run AI Diagnostic Audit'}</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Results Output Block */}
            <AnimatePresence>
              {diagnoseResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-emerald-50 text-emerald-700 rounded">
                        <Leaf className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-xs text-slate-800">
                        {language === 'bn' ? 'এআই রোগ নির্ণয় ও চারাগাছ রিপোর্ট' : 'AI Diagnostic Report'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleSpeak(diagnoseResult)}
                      className="flex items-center gap-1.5 py-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 rounded text-[10.5px] font-bold text-emerald-800 transition-colors cursor-pointer"
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                          <span>{language === 'bn' ? 'আওয়াজ বন্ধ করুন' : 'Stop Audio'}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'রিপোর্টটি বাংলায় শুনুন' : 'Read Aloud'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-slate-700 text-xs leading-relaxed whitespace-pre-line bg-slate-50/50 p-3 rounded-xl border border-slate-100 prose max-w-none">
                    {diagnoseResult}
                  </div>

                  {/* High Accuracy Badge */}
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-[10px] text-sky-800 flex gap-2">
                    <BadgeAlert className="w-4 h-4 text-sky-500 shrink-0" />
                    <div>
                      <strong>{language === 'bn' ? 'সতর্কতা ও পরিমিতি:' : 'Precautionary Note:'}</strong>{' '}
                      {language === 'bn' 
                        ? 'এই এআই রিপোর্টটি উন্নত জেনারেটিভ মডেল দ্বারা পরিচালিত। তীব্র আক্রান্ত চারার ক্ষেত্রে আপনার স্থানীয় উপ-সহকারী কৃষি কর্মকর্তার সাথে পরামর্শ করুন।'
                        : 'This diagnostic audit is generated via advanced AI computer vision. For widespread seedling mortality, consult your nearest DAE officer.'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}

      </div>

    </div>
  );
}

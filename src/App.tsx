/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Volume2, Plus, Lock, X, Info, Trash2, FileText, Square, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getMosquitoAnswer, textToSpeech } from './services/gemini';

interface Message {
  role: 'user' | 'model';
  text?: string;
  english?: string;
  tamil?: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMPlusModal, setShowMPlusModal] = useState(false);
  const [mPlusPassword, setMPlusPassword] = useState('');
  const [isMPlusAuthenticated, setIsMPlusAuthenticated] = useState(false);
  const [mPlusContent, setMPlusContent] = useState('');
  const [additionalKnowledge, setAdditionalKnowledge] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReadingVoice, setIsReadingVoice] = useState<{ index: number; lang: 'en' | 'ta' } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US'; // Default, can be changed dynamically if needed

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsRecording(false);
        playBeep();
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const playBeep = () => {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.1, context.currentTime);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setIsRecording(true);
      recognitionRef.current?.start();
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.volume = 0.4;
    audio.play().catch(e => console.log("Sound play blocked", e));
  };

  const handleSend = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsProcessing(true);
    setError(null);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.role === 'user' ? m.text : `${m.english}\n${m.tamil}` }]
      }));

      const answer = await getMosquitoAnswer(userMessage, history, additionalKnowledge);
      if (answer) {
        setMessages(prev => [...prev, { 
          role: 'model', 
          english: answer.english, 
          tamil: answer.tamil 
        }]);
        playNotificationSound();
      }
    } catch (err: any) {
      setError("Failed to get answer. Please try again.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceRead = async (text: string, index: number, lang: 'en' | 'ta') => {
    if (isReadingVoice !== null) return;
    
    setIsReadingVoice({ index, lang });
    try {
      const audioUrl = await textToSpeech(text);
      if (audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = audioUrl;
          audioRef.current.onended = () => setIsReadingVoice(null);
          audioRef.current.play().catch(e => {
            console.error("Playback failed", e);
            setIsReadingVoice(null);
          });
        } else {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => setIsReadingVoice(null);
          audio.play().catch(e => {
            console.error("Playback failed", e);
            setIsReadingVoice(null);
          });
        }
      } else {
        setIsReadingVoice(null);
      }
    } catch (err) {
      console.error("TTS failed", err);
      setIsReadingVoice(null);
    }
  };

  const stopVoiceRead = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsReadingVoice(null);
  };

  const handleMPlusAuth = () => {
    if (mPlusPassword === '102') {
      setIsMPlusAuthenticated(true);
      setMPlusPassword('');
    } else {
      alert('Incorrect Password');
    }
  };

  const handleSaveMPlus = () => {
    setAdditionalKnowledge(prev => prev + "\n" + mPlusContent);
    setMPlusContent('');
    setIsMPlusAuthenticated(false);
    setShowMPlusModal(false);
    alert('Knowledge updated successfully!');
  };

  const exportToPDF = async () => {
    if (messages.length === 0) {
      alert("No messages to export.");
      return;
    }

    setIsProcessing(true);
    try {
      // Create a hidden container for PDF rendering to ensure Tamil fonts are rendered correctly
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '0';
      exportContainer.style.width = '800px';
      exportContainer.style.padding = '40px';
      exportContainer.style.backgroundColor = '#F5F2ED';
      exportContainer.style.color = '#1A1A1A';
      exportContainer.style.fontFamily = "'Inter', sans-serif";
      
      // Header in PDF
      const header = document.createElement('div');
      header.style.marginBottom = '30px';
      header.style.borderBottom = '2px solid #2563EB';
      header.style.paddingBottom = '10px';
      header.innerHTML = `
        <h1 style="font-family: 'Cormorant Garamond', serif; font-size: 32px; color: #2563EB; margin: 0;">Zanzara Impariamo</h1>
        <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Mosquito Education Chat History</p>
      `;
      exportContainer.appendChild(header);

      // Messages
      messages.forEach((msg) => {
        const msgWrapper = document.createElement('div');
        msgWrapper.style.marginBottom = '25px';
        msgWrapper.style.padding = '20px';
        msgWrapper.style.borderRadius = '16px';
        msgWrapper.style.backgroundColor = msg.role === 'user' ? '#2563EB' : '#FFFFFF';
        msgWrapper.style.color = msg.role === 'user' ? '#FFFFFF' : '#1A1A1A';
        msgWrapper.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        msgWrapper.style.border = msg.role === 'user' ? 'none' : '1px solid rgba(0,0,0,0.1)';

        const label = document.createElement('div');
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.textTransform = 'uppercase';
        label.style.letterSpacing = '1px';
        label.style.marginBottom = '10px';
        label.style.opacity = '0.8';
        label.innerText = msg.role === 'user' ? 'User / பயனர்' : 'Zanzara Impariamo';
        msgWrapper.appendChild(label);

        const content = document.createElement('div');
        content.style.fontSize = '16px';
        content.style.lineHeight = '1.6';
        content.style.whiteSpace = 'pre-wrap';
        
        if (msg.role === 'user') {
          content.innerText = msg.text || "";
          msgWrapper.appendChild(content);
        } else {
          const englishDiv = document.createElement('div');
          englishDiv.style.color = '#15803d'; // Green-700
          englishDiv.style.marginBottom = '15px';
          englishDiv.style.paddingBottom = '15px';
          englishDiv.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
          englishDiv.innerText = msg.english || "";
          
          const tamilDiv = document.createElement('div');
          tamilDiv.style.color = '#2563EB'; // Blue-600
          tamilDiv.innerText = msg.tamil || "";
          
          msgWrapper.appendChild(englishDiv);
          msgWrapper.appendChild(tamilDiv);
        }

        exportContainer.appendChild(msgWrapper);
      });

      // Footer in PDF
      const pdfFooter = document.createElement('div');
      pdfFooter.style.marginTop = '40px';
      pdfFooter.style.paddingTop = '20px';
      pdfFooter.style.borderTop = '1px solid rgba(0,0,0,0.1)';
      pdfFooter.style.textAlign = 'center';
      pdfFooter.style.fontSize = '12px';
      pdfFooter.style.color = '#666';
      pdfFooter.innerText = 'Powered by iniyan.talkies';
      exportContainer.appendChild(pdfFooter);

      document.body.appendChild(exportContainer);

      // Use html2canvas to capture the container
      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F5F2ED',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add subsequent pages if content is long
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Zanzara_Impariamo_History_${new Date().getTime()}.pdf`);
      
      // Cleanup
      document.body.removeChild(exportContainer);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    stopVoiceRead();
    setInputText('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-black/5 p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <img 
            src="https://img.freepik.com/premium-photo/cute-cartoon-mosquito-isolated-white-background-3d-render_1020697-1025.jpg" 
            alt="Zanzara Mascot" 
            className="w-12 h-12 object-contain"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-xl font-bold tracking-tight serif">Zanzara Impariamo</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              clearChat();
              alert("Chat cleared! / உரையாடல் அழிக்கப்பட்டது!");
            }}
            className="p-2 bg-white border border-black/10 rounded-full hover:bg-black/5 active:scale-95 transition-all flex items-center gap-1"
            title="Clear Chat"
          >
            <Eraser size={20} className="text-black/60" />
            <span className="font-bold text-sm hidden sm:inline">Clear</span>
          </button>
          <button 
            onClick={exportToPDF}
            className="p-2 bg-white border border-black/10 rounded-full hover:bg-black/5 transition-colors flex items-center gap-1"
            title="Export to PDF"
          >
            <FileText size={20} className="text-blue-600" />
            <span className="font-bold text-sm hidden sm:inline">PDF</span>
          </button>
          <button 
            onClick={() => setShowMPlusModal(true)}
            className="p-2 bg-white border border-black/10 rounded-full hover:bg-black/5 transition-colors flex items-center gap-1"
            id="m-plus-button"
          >
            <Plus size={20} />
            <span className="font-bold text-sm">M+</span>
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-20">
            <Info size={48} className="mb-4" />
            <p className="text-lg italic serif">Ask me anything about mosquitoes...</p>
            <p className="text-sm">கொசுக்கள் பற்றி எதையும் கேளுங்கள்...</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-white border border-black/5 rounded-tl-none'
              }`}>
                <div className="markdown-body text-sm leading-relaxed">
                  {msg.role === 'user' ? (
                    <Markdown>{msg.text}</Markdown>
                  ) : (
                    <div className="space-y-4">
                      <div className="pb-4 border-b border-black/5 text-green-700">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-green-600/60 mb-1">English</div>
                        <Markdown>{msg.english}</Markdown>
                      </div>
                      <div className="text-yellow-600">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-600/60 mb-1">Tamil / தமிழ்</div>
                        <Markdown>{msg.tamil}</Markdown>
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'model' && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-black/5">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleVoiceRead(msg.english || "", i, 'en')}
                        disabled={isReadingVoice !== null && (isReadingVoice.index !== i || isReadingVoice.lang !== 'en')}
                        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-opacity ${
                          isReadingVoice?.index === i && isReadingVoice?.lang === 'en' ? 'text-blue-600 animate-pulse' : 'opacity-70 hover:opacity-100'
                        } ${isReadingVoice !== null && (isReadingVoice.index !== i || isReadingVoice.lang !== 'en') ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <Volume2 size={12} />
                        {isReadingVoice?.index === i && isReadingVoice?.lang === 'en' ? 'Reading English...' : 'English Voice'}
                      </button>
                      
                      {isReadingVoice?.index === i && isReadingVoice?.lang === 'en' && (
                        <button 
                          onClick={stopVoiceRead}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          <Square size={10} fill="currentColor" />
                          Stop
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleVoiceRead(msg.tamil || "", i, 'ta')}
                        disabled={isReadingVoice !== null && (isReadingVoice.index !== i || isReadingVoice.lang !== 'ta')}
                        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-opacity ${
                          isReadingVoice?.index === i && isReadingVoice?.lang === 'ta' ? 'text-blue-600 animate-pulse' : 'opacity-70 hover:opacity-100'
                        } ${isReadingVoice !== null && (isReadingVoice.index !== i || isReadingVoice.lang !== 'ta') ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <Volume2 size={12} />
                        {isReadingVoice?.index === i && isReadingVoice?.lang === 'ta' ? 'படிக்கிறது...' : 'Tamil Voice / தமிழ்'}
                      </button>
                      
                      {isReadingVoice?.index === i && isReadingVoice?.lang === 'ta' && (
                        <button 
                          onClick={stopVoiceRead}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          <Square size={10} fill="currentColor" />
                          Stop / நிறுத்து
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-black/5 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-red-600 text-sm p-2 bg-red-50 rounded-lg border border-red-100">
            {error}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-black/5 sticky bottom-0">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type or use mic... / தட்டச்சு செய்யவும்..."
              className="w-full p-4 pr-12 bg-[#F5F2ED] border-none rounded-2xl focus:ring-2 focus:ring-blue-600 outline-none text-sm"
            />
            <button
              onClick={toggleRecording}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all duration-300 ${
                isRecording ? 'bg-yellow-400 text-black scale-110' : 'bg-blue-600 text-white'
              }`}
              id="mic-button"
            >
              <Mic size={20} />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            className="p-4 bg-black text-white rounded-2xl hover:bg-black/80 disabled:opacity-50 transition-colors"
            id="send-button"
          >
            <Send size={20} />
          </button>
        </div>
      </footer>

      {/* M+ Modal */}
      <AnimatePresence>
        {showMPlusModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold serif">Additional Knowledge (M+)</h2>
                <button onClick={() => setShowMPlusModal(false)} className="p-1 hover:bg-black/5 rounded-full">
                  <X size={24} />
                </button>
              </div>

              {!isMPlusAuthenticated ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-black/60 mb-2">
                    <Lock size={16} />
                    <span>Enter password to access admin features</span>
                  </div>
                  <input
                    type="password"
                    value={mPlusPassword}
                    onChange={(e) => setMPlusPassword(e.target.value)}
                    placeholder="Password (102)"
                    className="w-full p-4 bg-[#F5F2ED] rounded-2xl outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <button
                    onClick={handleMPlusAuth}
                    className="w-full p-4 bg-black text-white rounded-2xl font-bold hover:bg-black/80 transition-colors"
                  >
                    Unlock
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-black/60">Add more details about mosquitoes. This will be added to the AI's memory.</p>
                  <textarea
                    value={mPlusContent}
                    onChange={(e) => setMPlusContent(e.target.value)}
                    placeholder="Paste additional mosquito details here..."
                    className="w-full h-40 p-4 bg-[#F5F2ED] rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsMPlusAuthenticated(false)}
                      className="flex-1 p-4 border border-black/10 rounded-2xl font-bold hover:bg-black/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveMPlus}
                      className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors"
                    >
                      Save Knowledge
                    </button>
                  </div>
                  {additionalKnowledge && (
                    <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Current Extra Knowledge</span>
                        <button onClick={() => setAdditionalKnowledge('')} className="text-blue-600 hover:text-blue-800">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-green-800 line-clamp-3 italic">{additionalKnowledge}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-6 text-center border-t border-black/5 bg-white/50 backdrop-blur-sm">
        <p className="text-sm font-medium text-black/40 tracking-wide uppercase">
          Powered by <span className="text-blue-600/60 font-bold">iniyan.talkies</span>
        </p>
      </footer>

      <style>{`
        .serif { font-family: 'Cormorant Garamond', serif; }
        .markdown-body p { margin-bottom: 0.5rem; }
        .markdown-body ul { list-style-type: disc; margin-left: 1.25rem; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
}

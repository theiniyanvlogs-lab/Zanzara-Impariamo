/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Volume2, Plus, Lock, X, Info, Trash2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { getMosquitoAnswer, textToSpeech } from './services/gemini';

interface Message {
  role: 'user' | 'model';
  text: string;
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
        parts: [{ text: m.text }]
      }));

      const answer = await getMosquitoAnswer(userMessage, history, additionalKnowledge);
      if (answer) {
        setMessages(prev => [...prev, { role: 'model', text: answer }]);
      }
    } catch (err: any) {
      setError("Failed to get answer. Please try again.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceRead = async (text: string) => {
    try {
      const audioUrl = await textToSpeech(text);
      if (audioUrl) {
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        } else {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play();
        }
      }
    } catch (err) {
      console.error("TTS failed", err);
    }
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

  const exportToPDF = () => {
    if (messages.length === 0) {
      alert("No messages to export.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(185, 28, 28); // Red-700
    doc.text("Zanzara Impariamo - Chat History", 10, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 10, yPos);
    yPos += 15;

    messages.forEach((msg, index) => {
      // Check for page overflow
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      // Role Label
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(msg.role === 'user' ? 0 : 185, msg.role === 'user' ? 0 : 28, msg.role === 'user' ? 0 : 28);
      const label = msg.role === 'user' ? "User / பயனர்:" : "Zanzara Impariamo:";
      doc.text(label, 10, yPos);
      yPos += 7;

      // Message Content
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50);
      
      // Split text to fit width
      const splitText = doc.splitTextToSize(msg.text, pageWidth - 20);
      doc.text(splitText, 10, yPos);
      yPos += (splitText.length * 5) + 10;
    });

    doc.save("Zanzara_Impariamo_Chat.pdf");
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-black/5 p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xl">Z</div>
          <h1 className="text-xl font-bold tracking-tight serif">Zanzara Impariamo</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToPDF}
            className="p-2 bg-white border border-black/10 rounded-full hover:bg-black/5 transition-colors flex items-center gap-1"
            title="Export to PDF"
          >
            <FileText size={20} className="text-red-600" />
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
                  ? 'bg-red-600 text-white rounded-tr-none' 
                  : 'bg-white border border-black/5 rounded-tl-none'
              }`}>
                <div className="markdown-body text-sm leading-relaxed">
                  <Markdown>{msg.text}</Markdown>
                </div>
                {msg.role === 'model' && (
                  <button 
                    onClick={() => handleVoiceRead(msg.text)}
                    className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <Volume2 size={14} />
                    Listen / கேட்க
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-black/5 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
              <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
              className="w-full p-4 pr-12 bg-[#F5F2ED] border-none rounded-2xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
            />
            <button
              onClick={toggleRecording}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all duration-300 ${
                isRecording ? 'bg-yellow-400 text-black scale-110' : 'bg-red-600 text-white'
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
                    className="w-full h-40 p-4 bg-[#F5F2ED] rounded-2xl outline-none focus:ring-2 focus:ring-red-600 resize-none text-sm"
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
                      className="flex-1 p-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors"
                    >
                      Save Knowledge
                    </button>
                  </div>
                  {additionalKnowledge && (
                    <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Current Extra Knowledge</span>
                        <button onClick={() => setAdditionalKnowledge('')} className="text-red-600 hover:text-red-800">
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

      <style>{`
        .serif { font-family: 'Cormorant Garamond', serif; }
        .markdown-body p { margin-bottom: 0.5rem; }
        .markdown-body ul { list-style-type: disc; margin-left: 1.25rem; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
}

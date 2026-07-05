import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Database, X, Cloud } from 'lucide-react';

interface ToastData {
  id: string;
  count: number;
}

export default function SyncToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Allow messages containing offline post-sync data
      if (event.data && event.data.type === 'offline-synced-success') {
        const count = event.data.count || 1;
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
        
        // Add new toast to queue
        setToasts((prev) => [...prev, { id, count }]);

        // Auto remove toast after 5 seconds
        setTimeout(() => {
          removeToast(id);
        }, 5500);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div 
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col gap-2 w-[90%] max-w-sm font-sans"
      id="syncToastContainer"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            id={`toast-${toast.id}`}
            layout
            initial={{ opacity: 0, y: -25, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
            className="pointer-events-auto flex items-start gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3.5 rounded-2xl shadow-xl border border-emerald-400/30 backdrop-blur-md relative"
          >
            {/* Status Icons Indicator */}
            <div className="bg-white/10 p-2 rounded-xl shrink-0 text-white relative">
              <Cloud className="w-5 h-5 opacity-90" />
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 absolute -bottom-0.5 -right-0.5 bg-emerald-600 rounded-full" />
            </div>

            {/* Info Message Text */}
            <div className="flex-1 min-w-0 pr-4">
              <h4 className="font-bold text-sm tracking-wide text-emerald-50 flex items-center gap-1.5">
                <span>সিঙ্ক্রোনাইজেশন সফল!</span>
                <span className="bg-emerald-500/80 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono border border-emerald-400/20">
                  +{toast.count.toLocaleString('bn-BD')} ডাটা
                </span>
              </h4>
              <p className="text-white/85 text-[11px] mt-1 leading-relaxed">
                আপনার অফলাইনে সংগৃহীত বৃক্ষরোপণ লগ সফলভাবে সরাসরি গুগল ড্রাইভ সার্ভারের সাথে আপডেট ও সিঙ্ক করা হয়েছে।
              </p>
            </div>

            {/* Manual Dismiss */}
            <button
              onClick={() => removeToast(toast.id)}
              className="absolute top-2.5 right-2 text-white/60 hover:text-white hover:bg-white/10 p-1 rounded-full transition cursor-pointer border-none bg-transparent"
              title="বন্ধ করুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

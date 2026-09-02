import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onClear?: () => void;
  language?: 'bn' | 'en';
}

export default function SignaturePad({ onSave, onClear, language = 'bn' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Initialize and resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0f172a'; // Slate-900 for dark ink
      }
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Check if touch event
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Auto-save the signature trace to base64
    const canvas = canvasRef.current;
    if (canvas && !isEmpty) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      if (onClear) onClear();
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl" id="signaturePadContainer">
      <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
        <span className="flex items-center gap-1">
          <PenTool className="w-3.5 h-3.5 text-emerald-600" />
          {language === 'bn' ? 'অফিসার স্বাক্ষর প্যাড (হস্তাক্ষর)' : 'Officer Signature Trace'}
        </span>
        {!isEmpty && (
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black flex items-center gap-1">
            <Check className="w-3 h-3" />
            {language === 'bn' ? 'সংরক্ষিত' : 'Captured'}
          </span>
        )}
      </div>

      <div className="relative border border-slate-300 rounded-lg overflow-hidden bg-white shadow-inner h-28">
        <canvas
          ref={canvasRef}
          width={360}
          height={112}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none"
        />

        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[11px] pointer-events-none font-bold">
            {language === 'bn' ? 'এখানে আপনার স্বাক্ষর আঁকুন' : 'Sign inside this frame'}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty}
          className="flex items-center gap-1 text-[10.5px] font-extrabold text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100/50 hover:border-rose-200 disabled:opacity-40 disabled:hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {language === 'bn' ? 'মুছে ফেলুন' : 'Clear Ink'}
        </button>
      </div>
    </div>
  );
}

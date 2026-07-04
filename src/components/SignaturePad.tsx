import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  value: string; // Base64 data URL
  onChange: (value: string) => void;
  label?: string;
}

export default function SignaturePad({ value, onChange, label = "গ্রাহক / ছাত্রের স্বাক্ষর (Digital Signature)" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b'; // Slate 800
    ctx.lineWidth = 2.5;

    // If we already have a value, draw it on the canvas
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [value]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save the canvas drawing to state
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
    setIsEmpty(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
    setIsEmpty(true);
  };

  return (
    <div className="space-y-1.5 font-sans">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
          <PenTool className="w-3 h-3 text-slate-450" /> {label}
        </label>
        {!isEmpty && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-[10px] text-red-500 font-extrabold flex items-center gap-1 hover:text-red-600 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> স্বাক্ষর মুছুন (Clear)
          </button>
        )}
      </div>

      <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 transition-all">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-28 block cursor-crosshair touch-none"
        />

        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center p-4">
            <p className="text-xs text-slate-400 font-bold">এখানে স্বাক্ষর করুন (Sign Here)</p>
            <p className="text-[9px] text-slate-300 font-medium mt-0.5">মাউস বা স্পর্শ ব্যবহার করে আঁকুন</p>
          </div>
        )}

        {!isEmpty && (
          <div className="absolute bottom-2 right-2 pointer-events-none bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-100">
            <Check className="w-3 h-3" /> স্বাক্ষরিত (Signed)
          </div>
        )}
      </div>
    </div>
  );
}

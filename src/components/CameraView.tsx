import React, { useRef, useEffect, useState, useCallback } from 'react';
import cv from "@techstark/opencv-js";
import Webcam from 'react-webcam';
import { ProcessorParams, processImage } from '../lib/cvProcessor';
import { Upload } from 'lucide-react';

interface CameraViewProps {
  params: ProcessorParams;
  onCountUpdate: (count: number) => void;
}

export default function CameraView({ params, onCountUpdate }: CameraViewProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [mode, setMode] = useState<'camera' | 'image'>('camera');
  const [staticImage, setStaticImage] = useState<HTMLImageElement | null>(null);
  const requestRef = useRef<number>();

  const [isDrawingExclusion, setIsDrawingExclusion] = useState(false);
  const [exclusionZones, setExclusionZones] = useState<{x: number, y: number, w: number, h: number}[]>([]);
  const [exclusionStart, setExclusionStart] = useState<{x: number, y: number} | null>(null);

  const exclusionZonesRef = useRef(exclusionZones);
  const currentExclusionRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    exclusionZonesRef.current = exclusionZones;
  }, [exclusionZones]);

  const drawOverlay = (exclusion: {x: number, y: number, w: number, h: number} | null) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    if (exclusion) {
      const scale = Math.max(1, overlay.width / 1000);
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
      ctx.lineWidth = 3 * scale;
      ctx.strokeRect(exclusion.x, exclusion.y, exclusion.w, exclusion.h);
      ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
      ctx.fillRect(exclusion.x, exclusion.y, exclusion.w, exclusion.h);
    }
  };

  const processStaticImage = useCallback(() => {
    if (mode === 'image' && staticImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const width = staticImage.width;
      const height = staticImage.height;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = width;
          overlayCanvasRef.current.height = height;
        }
      }
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(staticImage, 0, 0, width, height);
        try {
          let src = cv.imread(canvas);
          let dst = new cv.Mat();
          let count = processImage(src, dst, { 
            ...params, 
            exclusionZones 
          });
          onCountUpdate(count);
          cv.imshow(canvas, dst);
          src.delete();
          dst.delete();
        } catch (err) {
          console.error("OpenCV processing error statically:", err);
        }
      }
    }
  }, [mode, staticImage, params, exclusionZones, onCountUpdate]);

  useEffect(() => {
    if (mode === 'image') {
      processStaticImage();
    }
  }, [mode, staticImage, params, exclusionZones, processStaticImage]);

  const lastProcessTime = useRef<number>(0);

  const processFrame = useCallback((timestamp: number) => {
    if (!isRunning || mode === 'image') return;
    
    if (timestamp - lastProcessTime.current < 150) {
      if (isRunning && mode === 'camera') {
        requestRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }
    lastProcessTime.current = timestamp;

    if (
      webcamRef.current &&
      webcamRef.current.video &&
      webcamRef.current.video.readyState === 4 &&
      canvasRef.current
    ) {
      const video = webcamRef.current.video;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const canvas = canvasRef.current;
      
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = width;
          overlayCanvasRef.current.height = height;
        }
      }

      const context = canvas.getContext('2d');
      if (context) {
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, width, height);

        try {
          // Read image from canvas into a cv.Mat
          let src = cv.imread(canvas);
          let dst = new cv.Mat();
          
          let count = processImage(src, dst, {
            ...params,
            exclusionZones: exclusionZonesRef.current
          });
          onCountUpdate(count);
          
          // Draw processed image back to canvas
          cv.imshow(canvas, dst);
          
          src.delete();
          dst.delete();
        } catch (err) {
          console.error("OpenCV processing error:", err);
        }
      }
    }
    
    // Only schedule next frame if still in camera mode and running
    if (isRunning && mode === 'camera') {
      requestRef.current = requestAnimationFrame(processFrame);
    }
  }, [params, isRunning, mode, onCountUpdate]);

  useEffect(() => {
    if (mode === 'camera' && isRunning) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [processFrame, mode, isRunning]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setStaticImage(img);
          setMode('image');
          setIsRunning(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const switchToCamera = () => {
    setMode('camera');
    setStaticImage(null);
    setIsRunning(true);
    setExclusionZones([]);
    setIsDrawingExclusion(false);
  };

  const getPointerCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingExclusion || !canvasRef.current) return;
    const coords = getPointerCoords(e, canvasRef.current);
    setExclusionStart(coords);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingExclusion || !exclusionStart || !canvasRef.current) return;
    const coords = getPointerCoords(e, canvasRef.current);
    const newExclusion = {
      x: Math.min(exclusionStart.x, coords.x),
      y: Math.min(exclusionStart.y, coords.y),
      w: Math.abs(coords.x - exclusionStart.x),
      h: Math.abs(coords.y - exclusionStart.y)
    };
    currentExclusionRef.current = newExclusion;
    drawOverlay(newExclusion);
  };

  const handlePointerUp = () => {
    if (isDrawingExclusion && currentExclusionRef.current) {
      if (currentExclusionRef.current.w > 10 && currentExclusionRef.current.h > 10) {
        setExclusionZones(prev => [...prev, currentExclusionRef.current!]);
      }
    }
    setExclusionStart(null);
    currentExclusionRef.current = null;
    drawOverlay(null);
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full z-10">
      <div 
        className="relative w-full h-full bg-slate-900 border border-slate-700 rounded-sm overflow-hidden flex items-center justify-center shadow-inner"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {/* @ts-ignore - React 19 type mismatch in react-webcam */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          className={`absolute opacity-0 pointer-events-none ${mode === 'image' ? 'hidden' : ''}`}
        />
        <canvas 
          ref={canvasRef} 
          className="object-contain max-w-full max-h-full z-10"
          id="cv-canvas"
        />
        <canvas 
          ref={overlayCanvasRef}
          className="absolute inset-0 object-contain w-full h-full z-20 pointer-events-none"
        />
        
        {/* Scanning Line overlay */}
        {isRunning && mode === 'camera' && <div className="absolute w-full h-px bg-sky-400/30 top-1/2 shadow-[0_0_15px_rgba(56,189,248,0.5)] z-20 pointer-events-none"></div>}
        
        {/* Corner Markers */}
        <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-sky-500/50 z-20 pointer-events-none"></div>
        <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-sky-500/50 z-20 pointer-events-none"></div>
        <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-sky-500/50 z-20 pointer-events-none"></div>
        <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-sky-500/50 z-20 pointer-events-none"></div>
      </div>
      
      <div className="absolute top-4 right-4 lg:top-8 lg:right-8 flex flex-col gap-2 z-30">
        <button 
          onClick={() => setIsDrawingExclusion(!isDrawingExclusion)}
          className={`px-3 py-2 rounded text-[9px] lg:text-[10px] uppercase font-bold border transition-colors shadow ${isDrawingExclusion ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
        >
          {isDrawingExclusion ? 'FINALIZAR ÁREAS' : 'IGNORAR ÁREAS'}
        </button>
        {exclusionZones.length > 0 && (
          <button 
            onClick={() => setExclusionZones([])}
            className="px-3 py-2 bg-red-900/80 hover:bg-red-800 text-red-300 rounded text-[9px] lg:text-[10px] uppercase font-bold border border-red-700 transition-colors shadow"
          >
            LIMPAR {exclusionZones.length} ÁREA(S)
          </button>
        )}
      </div>

      {/* Floating Overlay Tools */}
      <div className="absolute top-4 left-4 lg:top-8 lg:left-8 flex flex-col gap-2 z-30 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-2 py-1 lg:px-3 lg:py-1.5 rounded border border-slate-700 text-[9px] lg:text-[10px] font-mono text-sky-400">
          OPENCV_CORE: {mode === 'camera' && isRunning ? 'ONLINE / LATENCY OPTIMIZED' : (mode === 'image' ? 'STATIC ANALYSIS' : 'PAUSED')}
        </div>
      </div>

      <div className="absolute bottom-4 lg:bottom-10 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 lg:gap-4 z-30 w-[95%] lg:w-auto">
        <label className="px-3 py-2 lg:px-5 lg:py-3 font-bold text-[9px] lg:text-[11px] uppercase tracking-widest rounded shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] flex items-center gap-2 border transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600 cursor-pointer">
          <Upload size={14} className="lg:w-4 lg:h-4" />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          CARREGAR IMAGEM
        </label>

        {mode === 'image' ? (
          <button 
            onClick={switchToCamera}
            className="px-3 py-2 lg:px-5 lg:py-3 font-bold text-[9px] lg:text-[11px] uppercase tracking-widest rounded shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] flex items-center gap-2 border transition-all bg-sky-600 hover:bg-sky-500 text-white border-sky-400"
          >
            VOLTAR PRA CÂMERA
          </button>
        ) : (
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-2 lg:px-5 lg:py-3 font-bold text-[9px] lg:text-[11px] uppercase tracking-widest rounded shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] flex items-center gap-2 border transition-all ${
              isRunning 
                ? 'bg-red-900/80 hover:bg-red-800 text-red-300 border-red-700' 
                : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
            }`}
          >
            {isRunning ? 'PAUSAR CÂMERA' : 'RETOMAR DETECÇÃO'}
          </button>
        )}
      </div>
    </div>
  );
}

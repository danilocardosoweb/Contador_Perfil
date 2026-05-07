import React, { useRef, useEffect, useState, useCallback } from 'react';
import cv from "@techstark/opencv-js";
import Webcam from 'react-webcam';
import { ProcessorParams, processImage } from '../lib/cvProcessor';
import { Upload, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

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

  const [drawingMode, setDrawingMode] = useState<'exclusion' | 'inclusion' | null>(null);
  const [exclusionZones, setExclusionZones] = useState<{x: number, y: number, w: number, h: number}[]>([]);
  const [inclusionZones, setInclusionZones] = useState<{x: number, y: number, w: number, h: number}[]>([]);
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{x: number, y: number} | null>(null);

  const exclusionZonesRef = useRef(exclusionZones);
  const inclusionZonesRef = useRef(inclusionZones);
  const currentDrawRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    exclusionZonesRef.current = exclusionZones;
  }, [exclusionZones]);

  useEffect(() => {
    inclusionZonesRef.current = inclusionZones;
  }, [inclusionZones]);

  const drawOverlay = (currentRect: {x: number, y: number, w: number, h: number} | null) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    if (currentRect && drawingMode) {
      const scale = Math.max(1, overlay.width / 1000);
      ctx.strokeStyle = drawingMode === 'exclusion' ? 'rgba(255, 165, 0, 0.9)' : 'rgba(0, 255, 0, 0.9)';
      ctx.lineWidth = 3 * scale;
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
      ctx.fillStyle = drawingMode === 'exclusion' ? 'rgba(255, 165, 0, 0.2)' : 'rgba(0, 255, 0, 0.2)';
      ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
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
            exclusionZones,
            inclusionZones
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
  }, [mode, staticImage, params, exclusionZones, inclusionZones, onCountUpdate]);

  useEffect(() => {
    if (mode === 'image') {
      processStaticImage();
    }
  }, [mode, staticImage, params, exclusionZones, inclusionZones, processStaticImage]);

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
            exclusionZones: exclusionZonesRef.current,
            inclusionZones: inclusionZonesRef.current
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
          setScale(1);
          setPan({x: 0, y: 0});
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
    setInclusionZones([]);
    setDrawingMode(null);
    setScale(1);
    setPan({x: 0, y: 0});
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setScale(s => Math.min(s + 0.2, 5));
    } else {
      setScale(s => Math.max(s - 0.2, 0.5));
    }
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
    if (!canvasRef.current) return;
    
    if (!drawingMode) {
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      panStartRef.current = { x: clientX - pan.x, y: clientY - pan.y };
      return;
    }

    const coords = getPointerCoords(e, canvasRef.current);
    setDrawStart(coords);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning && panStartRef.current) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setPan({
        x: clientX - panStartRef.current.x,
        y: clientY - panStartRef.current.y
      });
      return;
    }

    if (!drawingMode || !drawStart || !canvasRef.current) return;
    const coords = getPointerCoords(e, canvasRef.current);
    const newRect = {
      x: Math.min(drawStart.x, coords.x),
      y: Math.min(drawStart.y, coords.y),
      w: Math.abs(coords.x - drawStart.x),
      h: Math.abs(coords.y - drawStart.y)
    };
    currentDrawRef.current = newRect;
    drawOverlay(newRect);
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }

    if (drawingMode && currentDrawRef.current) {
      if (currentDrawRef.current.w > 10 && currentDrawRef.current.h > 10) {
        if (drawingMode === 'exclusion') {
          setExclusionZones(prev => [...prev, currentDrawRef.current!]);
        } else {
          setInclusionZones(prev => [...prev, currentDrawRef.current!]);
        }
      }
    }
    setDrawStart(null);
    currentDrawRef.current = null;
    drawOverlay(null);
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3 py-1.5 lg:px-4 lg:py-2 font-bold text-[9px] lg:text-[10px] uppercase tracking-widest rounded flex items-center gap-2 border transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600 cursor-pointer">
            <Upload size={14} className="lg:w-4 lg:h-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            CARREGAR IMAGEM
          </label>

          {mode === 'image' ? (
            <button 
              onClick={switchToCamera}
              className="px-3 py-1.5 lg:px-4 lg:py-2 font-bold text-[9px] lg:text-[10px] uppercase tracking-widest rounded flex items-center gap-2 border transition-all bg-sky-600 hover:bg-sky-500 text-white border-sky-400"
            >
              VOLTAR PRA CÂMERA
            </button>
          ) : (
            <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1.5 lg:px-4 lg:py-2 font-bold text-[9px] lg:text-[10px] uppercase tracking-widest rounded flex items-center gap-2 border transition-all ${
                isRunning 
                  ? 'bg-red-900/80 hover:bg-red-800 text-red-300 border-red-700' 
                  : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
              }`}
            >
              {isRunning ? 'PAUSAR CÂMERA' : 'RETOMAR DETECÇÃO'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded border border-slate-700 mr-2 p-1">
            <button
              onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}
              className="p-1 lg:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
              title="Diminuir Zoom"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-[10px] font-mono w-10 text-center text-slate-400">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(s => Math.min(s + 0.2, 5))}
              className="p-1 lg:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
              title="Aumentar Zoom"
            >
              <ZoomIn size={16} />
            </button>
            {(scale !== 1 || pan.x !== 0 || pan.y !== 0) && (
              <button
                onClick={() => { setScale(1); setPan({x:0, y:0}) }}
                className="p-1 lg:p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition ml-1 border-l border-slate-700"
                title="Resetar Zoom/Pan"
              >
                <Maximize size={16} />
              </button>
            )}
          </div>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'inclusion' ? null : 'inclusion')}
            className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded text-[9px] lg:text-[10px] uppercase font-bold border transition-colors ${drawingMode === 'inclusion' ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
          >
            {drawingMode === 'inclusion' ? 'FINALIZAR ÁREAS' : 'SELECIONAR ÁREAS'}
          </button>
          <button 
            onClick={() => setDrawingMode(drawingMode === 'exclusion' ? null : 'exclusion')}
            className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded text-[9px] lg:text-[10px] uppercase font-bold border transition-colors ${drawingMode === 'exclusion' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
          >
            {drawingMode === 'exclusion' ? 'FINALIZAR ÁREAS' : 'IGNORAR ÁREAS'}
          </button>
          {(exclusionZones.length > 0 || inclusionZones.length > 0) && (
            <button 
              onClick={() => { setExclusionZones([]); setInclusionZones([]); }}
              className="px-3 py-1.5 lg:px-4 lg:py-2 bg-red-900/80 hover:bg-red-800 text-red-300 rounded text-[9px] lg:text-[10px] uppercase font-bold border border-red-700 transition-colors"
            >
              LIMPAR ÁREAS
            </button>
          )}
        </div>
      </div>
      
      <div className="relative flex-1 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
        <div 
          className={`relative w-full h-full flex items-center justify-center ${drawingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onWheel={handleWheel}
        >
          <div 
            className="relative will-change-transform flex items-center justify-center w-full h-full"
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transition: isPanning ? 'none' : 'transform 0.1s ease-out'
            }}
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
          </div>
          
          {/* Scanning Line overlay */}
          {isRunning && mode === 'camera' && <div className="absolute w-full h-px bg-sky-400/30 top-1/2 shadow-[0_0_15px_rgba(56,189,248,0.5)] z-20 pointer-events-none"></div>}
          
          {/* Corner Markers */}
          <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-sky-500/50 z-20 pointer-events-none"></div>
          <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-sky-500/50 z-20 pointer-events-none"></div>
          <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-sky-500/50 z-20 pointer-events-none"></div>
          <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-sky-500/50 z-20 pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}

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

  const processStaticImage = useCallback(() => {
    if (mode === 'image' && staticImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const width = staticImage.width;
      const height = staticImage.height;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(staticImage, 0, 0, width, height);
        try {
          let src = cv.imread(canvas);
          let dst = new cv.Mat();
          let count = processImage(src, dst, params);
          onCountUpdate(count);
          cv.imshow(canvas, dst);
          src.delete();
          dst.delete();
        } catch (err) {
          console.error("OpenCV processing error statically:", err);
        }
      }
    }
  }, [mode, staticImage, params, onCountUpdate]);

  useEffect(() => {
    if (mode === 'image') {
      processStaticImage();
    }
  }, [mode, staticImage, params, processStaticImage]);

  const processFrame = useCallback(() => {
    if (!isRunning || mode === 'image') return;
    
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
      }

      const context = canvas.getContext('2d');
      if (context) {
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, width, height);

        try {
          // Read image from canvas into a cv.Mat
          let src = cv.imread(canvas);
          let dst = new cv.Mat();
          
          let count = processImage(src, dst, params);
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
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full z-10">
      <div className="relative w-full h-full bg-slate-900 border border-slate-700 rounded-sm overflow-hidden flex items-center justify-center shadow-inner">
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
        
        {/* Scanning Line overlay */}
        {isRunning && mode === 'camera' && <div className="absolute w-full h-px bg-sky-400/30 top-1/2 shadow-[0_0_15px_rgba(56,189,248,0.5)] z-20 pointer-events-none"></div>}
        
        {/* Corner Markers */}
        <div className="absolute top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-sky-500/50 z-20 pointer-events-none"></div>
        <div className="absolute top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-sky-500/50 z-20 pointer-events-none"></div>
        <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-sky-500/50 z-20 pointer-events-none"></div>
        <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-sky-500/50 z-20 pointer-events-none"></div>
      </div>
      
      {/* Floating Overlay Tools */}
      <div className="absolute top-8 left-8 flex flex-col gap-2 z-30 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded border border-slate-700 text-[10px] font-mono text-sky-400">
          OPENCV_CORE: {mode === 'camera' && isRunning ? 'ONLINE / LATENCY OPTIMIZED' : (mode === 'image' ? 'STATIC ANALYSIS' : 'PAUSED')}
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-4 z-30">
        <label className="px-5 py-3 font-bold text-[11px] uppercase tracking-widest rounded shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] flex items-center gap-2 border transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600 cursor-pointer">
          <Upload size={16} />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          CARREGAR IMAGEM
        </label>

        {mode === 'image' ? (
          <button 
            onClick={switchToCamera}
            className="px-5 py-3 font-bold text-[11px] uppercase tracking-widest rounded shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] flex items-center gap-2 border transition-all bg-sky-600 hover:bg-sky-500 text-white border-sky-400"
          >
            VOLTAR PRA CÂMERA
          </button>
        ) : (
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`px-5 py-3 font-bold text-[11px] uppercase tracking-widest rounded shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] flex items-center gap-2 border transition-all ${
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

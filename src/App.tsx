/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { useOpenCV } from './hooks/useOpenCV';
import CameraView from './components/CameraView';
import ControlsPanel from './components/ControlsPanel';
import HistoryPanel from './components/HistoryPanel';
import { ProcessorParams, defaultParams } from './lib/cvProcessor';

export default function App() {
  const isCvLoaded = useOpenCV();
  const [params, setParams] = useState<ProcessorParams>(defaultParams);
  const [activeTab, setActiveTab] = useState<'camera' | 'history'>('camera');
  const [lastCount, setLastCount] = useState<number | null>(null);

  if (!isCvLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400 font-mono text-sm">
        <Activity className="animate-spin mr-3 text-sky-500" /> 
        <span>INICIALIZANDO OPENCV CORE...</span>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-300 overflow-hidden font-sans">
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex shrink-0 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center shadow-lg shadow-sky-900/20">
            <Activity size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">
            Conferente <span className="text-sky-400">Tecno</span>
          </h1>
          <span className="bg-slate-800 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded text-slate-400 border border-slate-700 hidden sm:inline-block">
            v2.4.0 (Industrial)
          </span>
        </div>
        <nav className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('camera')}
            className={`px-4 py-1.5 rounded-md text-[11px] uppercase tracking-widest font-bold transition-colors border ${
              activeTab === 'camera' ? 'bg-slate-800 text-sky-400 border-slate-700' : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Câmera
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-md text-[11px] uppercase tracking-widest font-bold transition-colors border ${
              activeTab === 'history' ? 'bg-slate-800 text-sky-400 border-slate-700' : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            Histórico
          </button>
        </nav>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'camera' ? (
          <div className="flex flex-1 flex-col lg:flex-row overflow-hidden min-h-0">
            <div className="relative flex-none h-[45%] lg:h-auto lg:flex-1 bg-black border-b lg:border-b-0 lg:border-r border-slate-800 p-2 lg:p-4 z-10">
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              <CameraView params={params} onCountUpdate={setLastCount} />
            </div>
            <div className="flex-1 lg:w-96 xl:w-[450px] lg:flex-none bg-slate-900 border-l-0 lg:border-l border-slate-800 relative min-h-0">
              <ControlsPanel 
                params={params} 
                onChange={setParams} 
                lastCount={lastCount}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
            <HistoryPanel />
          </div>
        )}
      </main>
    </div>
  );
}


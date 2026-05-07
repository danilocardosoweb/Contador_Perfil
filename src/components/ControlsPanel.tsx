import React, { useState } from 'react';
import { ProcessorParams, presets } from '../lib/cvProcessor';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';

interface ControlsPanelProps {
  params: ProcessorParams;
  onChange: (params: ProcessorParams) => void;
  lastCount: number | null;
}

export default function ControlsPanel({ params, onChange, lastCount }: ControlsPanelProps) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateParam = (key: keyof ProcessorParams, value: number | string) => {
    onChange({ ...params, [key]: value });
  };

  const handleSave = async () => {
    if (lastCount === null) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ count: lastCount, notes })
      });
      if (res.ok) {
        setNotes('');
        alert('Contagem salva com sucesso!');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-y-auto">
      <div className="p-4 lg:p-6 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <h3 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 lg:mb-4">Current Detection Results</h3>
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-5xl lg:text-6xl font-mono font-bold text-white leading-none">
              {lastCount !== null ? lastCount : '--'}
            </span>
            <span className="text-[9px] lg:text-[10px] font-medium text-slate-400 mt-2 uppercase tracking-wide">Profiles Identified</span>
          </div>
        </div>
        
        <div className="mt-4 lg:mt-6 space-y-3">
          <input 
            type="text" 
            placeholder="Lote / Observações (Opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="p-4 lg:p-6 flex-1 shrink-0 space-y-5">
        <h3 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 lg:mb-4">CV Tuning (Hough/Canny)</h3>

        <div className="space-y-5">
          <div>
            <label className="flex justify-between text-[11px] font-mono mb-2 text-slate-400">
              <span>PRESET RÁPIDO</span>
            </label>
            <select
              onChange={(e) => {
                if (presets[e.target.value]) {
                  onChange(presets[e.target.value].params);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">-- Selecione --</option>
              {Object.entries(presets).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-800 pt-5">
            <label className="flex justify-between text-[11px] font-mono mb-2 text-slate-400">
              <span>MÉTODO DE DETECÇÃO</span>
            </label>
            <div className="flex bg-slate-950 border border-slate-800 rounded p-0.5">
              <button 
                onClick={() => updateParam('method', 'hough')}
                className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-1.5 rounded transition-colors ${params.method === 'hough' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-400'}`}
              >
                Círculos
              </button>
              <button 
                onClick={() => updateParam('method', 'contours')}
                className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-1.5 rounded transition-colors ${params.method === 'contours' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-400'}`}
              >
                Contornos
              </button>
            </div>
          </div>

          <ParamSlider 
            label="Desfoque (Blur Size)" 
            value={params.blurSize} 
            min={1} max={21} step={2} 
            onChange={(v) => updateParam('blurSize', v)} 
          />
          
          {params.method === 'contours' && (
            <>
              <ParamSlider 
                label="Canny Thresh 1" 
                value={params.cannyThresh1} 
                min={0} max={255} 
                onChange={(v) => updateParam('cannyThresh1', v)} 
              />
              <ParamSlider 
                label="Canny Thresh 2" 
                value={params.cannyThresh2} 
                min={0} max={255} 
                onChange={(v) => updateParam('cannyThresh2', v)} 
              />
            </>
          )}

          {params.method === 'hough' && (
            <>
              <ParamSlider 
                label="Distância Mín. (minDist)" 
                value={params.minDist} 
                min={5} max={100} 
                onChange={(v) => updateParam('minDist', v)} 
              />
              <ParamSlider 
                label="Sensibilidade Canny (param1)" 
                value={params.param1} 
                min={10} max={200} 
                onChange={(v) => updateParam('param1', v)} 
              />
              <ParamSlider 
                label="Acumulador (param2 - menor = mais)" 
                value={params.param2} 
                min={10} max={100} 
                onChange={(v) => updateParam('param2', v)} 
              />
              <div className="flex space-x-2">
                <div className="flex-1">
                  <ParamSlider 
                    label="Raio Mín." 
                    value={params.minRadius} 
                    min={1} max={50} 
                    onChange={(v) => updateParam('minRadius', v)} 
                  />
                </div>
                <div className="flex-1">
                  <ParamSlider 
                    label="Raio Máx." 
                    value={params.maxRadius} 
                    min={10} max={150} 
                    onChange={(v) => updateParam('maxRadius', v)} 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-400 w-full transition-colors"
                >
                  {showAdvanced ? <ChevronDown size={14} className="mr-2" /> : <ChevronRight size={14} className="mr-2" />}
                  Parâmetros Avançados
                </button>
                
                {showAdvanced && (
                  <div className="mt-5 space-y-5">
                    <ParamSlider 
                      label="Resolução do Acumulador (dp)" 
                      value={params.dp} 
                      min={1} max={5} step={0.1}
                      onChange={(v) => updateParam('dp', v)} 
                    />
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
      
      <div className="sticky bottom-0 p-4 lg:p-6 bg-slate-950/95 backdrop-blur border-t border-slate-800 shrink-0 z-10">
        <button 
          onClick={handleSave}
          disabled={isSaving || lastCount === null}
          className="w-full py-3 lg:py-4 bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold uppercase tracking-widest rounded flex items-center justify-center gap-2 border border-green-500 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {isSaving ? 'SALVANDO...' : 'COMMIT TO DATABASE (SQLITE)'}
        </button>
      </div>
    </div>
  );
}

function ParamSlider({ label, value, min, max, step = 1, onChange }: { label: string, value: number, min: number, max: number, step?: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] font-mono">
        <span className="text-slate-400">{label}</span>
        <span className="text-sky-400">[{value}]</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-800 appearance-none rounded-full cursor-pointer accent-sky-500"
      />
    </div>
  );
}

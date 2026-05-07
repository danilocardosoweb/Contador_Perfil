import React, { useState, useEffect } from 'react';
import { ProcessorParams, presets, objectTypes, defaultParams } from '../lib/cvProcessor';
import { Save, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

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
        <h3 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 lg:mb-4">Estratégia de Análise</h3>

        <div className="space-y-4">
          <div>
            <label className="flex justify-between text-[11px] font-mono mb-2 text-slate-400">
              <span>TIPO DE OBJETO A CONTAR</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(objectTypes).map(([key, config]) => {
                const isActive = params.objectShape === config.params.objectShape && params.method === config.params.method;
                return (
                  <button
                    key={key}
                    onClick={() => {
                        onChange({ ...params, ...config.params } as ProcessorParams);
                    }}
                    className={`p-3 text-left border rounded transition-all flex items-center justify-between ${
                      isActive 
                        ? 'bg-sky-900/30 border-sky-500 text-sky-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest">{config.label}</span>
                    {isActive && <CheckCircle2 size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-5">
           <h3 className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 lg:mb-4">Tunning CV & Presets</h3>
           
           <div className="space-y-5">
            <div>
              <label className="flex justify-between text-[11px] font-mono mb-2 text-slate-400">
                <span>PRESET DE ILUMINAÇÃO/DENSIDADE</span>
              </label>
              <select
                onChange={(e) => {
                  if (presets[e.target.value]) {
                    onChange({ ...params, ...presets[e.target.value].params } as ProcessorParams);
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
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <ParamSlider 
                      label="Área Mín." 
                      value={params.minArea} 
                      min={10} max={5000} step={10}
                      onChange={(v) => updateParam('minArea', v)} 
                    />
                  </div>
                  <div className="flex-1">
                    <ParamSlider 
                      label="Área Máx." 
                      value={params.maxArea} 
                      min={500} max={50000} step={100}
                      onChange={(v) => updateParam('maxArea', v)} 
                    />
                  </div>
                </div>
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

              </>
            )}

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-400 w-full transition-colors"
              >
                {showAdvanced ? <ChevronDown size={14} className="mr-2" /> : <ChevronRight size={14} className="mr-2" />}
                Parâmetros Avançados Industriais
              </button>
              
              {showAdvanced && (
                <div className="mt-5 space-y-4">
                  {params.method === 'hough' && (
                    <ParamSlider 
                      label="Resolução do Acumulador (dp)" 
                      value={params.dp} 
                      min={1} max={5} step={0.1}
                      onChange={(v) => updateParam('dp', v)} 
                    />
                  )}

                  <div className="space-y-2 mt-4">
                     <label className="text-[10px] font-mono text-slate-400 uppercase">Processamento da Imagem</label>
                     <label className="flex items-center space-x-2 text-xs text-slate-300">
                       <input type="checkbox" checked={params.useClahe} onChange={(e) => updateParam('useClahe', e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                       <span>Equilíbrio CLAHE (Sombras/Luzes)</span>
                     </label>
                     <label className="flex items-center space-x-2 text-xs text-slate-300">
                       <input type="checkbox" checked={params.useBilateral} onChange={(e) => updateParam('useBilateral', e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                       <span>Filtro Bilateral (Anti-Ruído, preserva bordas)</span>
                     </label>
                  </div>

                  <div className="space-y-2 mt-4">
                     <label className="text-[10px] font-mono text-slate-400 uppercase">Filtros Físicos (Palletização)</label>
                     <label className="flex items-center space-x-2 text-xs text-slate-300">
                       <input type="checkbox" checked={params.useROI} onChange={(e) => updateParam('useROI', e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                       <span>Auto-ROI (Isolar área útil / Cortar fundo)</span>
                     </label>
                     <label className="flex items-center space-x-2 text-xs text-slate-300">
                       <input type="checkbox" checked={params.geomValidation} onChange={(e) => updateParam('geomValidation', e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                       <span>Validação Geométrica (Evitar contagem dupla)</span>
                     </label>
                     <label className="flex items-center space-x-2 text-xs text-slate-300">
                       <input type="checkbox" checked={params.filterReflections} onChange={(e) => updateParam('filterReflections', e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                       <span>Anti-Reflexo (Bloquear brilhos internos falsos)</span>
                     </label>
                  </div>

                  <div className="mt-4">
                    <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Visualização de Debug</label>
                    <select 
                      value={params.debugView || 'normal'}
                      onChange={(e) => updateParam('debugView', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200"
                    >
                      <option value="normal">Normal (Resultado Final)</option>
                      <option value="roi">Máscara ROI (Área Útil)</option>
                      <option value="thresh">Threshold Adaptativo</option>
                      <option value="edges">Bordas (Canny)</option>
                      <option value="discarded">ITENS DESCARTADOS</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
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
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 150); // 150ms debounce for processing optimization
    return () => clearTimeout(handler);
  }, [localValue, value, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] font-mono">
        <span className="text-slate-400">{label}</span>
        <span className="text-sky-400">[{localValue}]</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step}
        value={localValue} 
        onChange={(e) => setLocalValue(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-800 appearance-none rounded-full cursor-pointer accent-sky-500"
      />
    </div>
  );
}

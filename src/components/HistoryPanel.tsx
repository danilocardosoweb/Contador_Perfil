import React, { useEffect, useState } from 'react';

interface HistoryRecord {
  id: number;
  date: string;
  count: number;
  notes: string;
}

export default function HistoryPanel() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-slate-500 flex items-center justify-center p-8 font-mono text-sm">Carregando histórico...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between px-2">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recent Reading History</h4>
        <button 
          onClick={fetchHistory}
          className="text-[10px] uppercase font-bold text-sky-500 bg-slate-900 border border-slate-700 rounded px-3 py-1 hover:bg-slate-800 transition-colors"
        >
          Atualizar Dados
        </button>
      </div>
      
      {records.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded p-8 text-center text-slate-500 text-xs font-mono">
          Nenhum registro encontrado. Suas contagens salvas aparecerão aqui.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-slate-800 bg-slate-950 flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-[10px] font-bold text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-2 border-r border-slate-800 w-48">Timestamp</th>
                <th className="px-4 py-2 border-r border-slate-800 w-32">Contagem</th>
                <th className="px-4 py-2">Observações / Lote</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-mono text-slate-400">
              {records.map((record, idx) => (
                <tr key={record.id} className={`${idx % 2 === 0 ? 'bg-slate-900/20' : ''} border-t border-slate-800 hover:bg-slate-900/50`}>
                  <td className="px-4 py-2.5 border-r border-slate-800">
                    {new Date(record.date).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 border-r border-slate-800 text-sky-400 font-bold">
                    {record.count}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {record.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

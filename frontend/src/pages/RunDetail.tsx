import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { RunBadge } from '../components/RunBadge';
import { Database, StopCircle, ArrowLeft } from 'lucide-react';

export default function RunDetail() {
    const { id } = useParams<{ id: string }>();
    const [run, setRun]   = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const logsEndRef      = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.get(`/runs/${id}`).then(r => setRun(r.data));

        const es = new EventSource(`/api/runs/${id}/log`);
        es.onmessage = e => {
            const data = JSON.parse(e.data);
            if (data.type === 'done') {
                setRun((r: any) => r ? { ...r, status: data.status } : r);
                es.close();
            } else {
                setLogs(l => [...l, data]);
                setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
        };
        return () => es.close();
    }, [id]);

    const abort = async () => {
        await api.post(`/runs/${id}/abort`);
        setRun((r: any) => r ? { ...r, status: 'ABORTED' } : r);
    };

    if (!run) return <div className="p-8 text-gray-400 text-sm">Loading...</div>;

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/runs" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2">
                        <ArrowLeft size={12} /> Runs
                    </Link>
                    <h1 className="text-xl font-bold text-white">{run.actor_name}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <RunBadge status={run.status} />
                        <span className="text-xs text-gray-500 font-mono">{run.id.slice(0,8)}...</span>
                        {run.started_at && (
                            <span className="text-xs text-gray-500">{new Date(run.started_at).toLocaleString()}</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    {run.output_dataset_id && (
                        <Link to={`/datasets/${run.output_dataset_id}`}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/25 transition-colors">
                            <Database size={13} /> View Dataset
                        </Link>
                    )}
                    {run.status === 'RUNNING' && (
                        <button onClick={abort}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/25 transition-colors">
                            <StopCircle size={13} /> Abort
                        </button>
                    )}
                </div>
            </div>

            {/* Log viewer */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-mono">Run Log</span>
                    <span className="text-xs text-gray-600">{logs.length} lines</span>
                </div>
                <div className="h-[calc(100vh-320px)] overflow-auto p-4 font-mono text-xs space-y-0.5 bg-gray-950">
                    {logs.map((l, i) => (
                        <div key={i} className={`flex gap-3 leading-5 ${l.level === 'ERROR' ? 'text-red-400' : 'text-gray-300'}`}>
                            <span className="text-gray-600 shrink-0 tabular-nums">
                                {new Date(l.ts).toLocaleTimeString()}
                            </span>
                            <span className={`shrink-0 w-12 ${l.level === 'ERROR' ? 'text-red-500' : 'text-gray-600'}`}>
                                [{l.level}]
                            </span>
                            <span className="break-all">{l.message}</span>
                        </div>
                    ))}
                    {!logs.length && (
                        <p className="text-gray-600">Waiting for logs...</p>
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
}

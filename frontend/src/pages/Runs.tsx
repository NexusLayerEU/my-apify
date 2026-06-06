import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { RunBadge } from '../components/RunBadge';
import { RefreshCw } from 'lucide-react';

export default function Runs() {
    const [runs, setRuns]     = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data } = await api.get('/runs');
        setRuns(data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Runs</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{runs.length} run{runs.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-400 rounded-lg text-sm hover:text-white transition-colors disabled:opacity-50">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                        <tr className="text-xs text-gray-400 uppercase tracking-wider">
                            <th className="text-left px-5 py-3">Actor</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-left px-5 py-3">Started</th>
                            <th className="text-left px-5 py-3">Duration</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {runs.map(r => {
                            const dur = r.finished_at && r.started_at
                                ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
                                : r.status === 'RUNNING' ? 'running...' : '—';
                            return (
                                <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-5 py-3 text-white font-medium">{r.actor_name}</td>
                                    <td className="px-5 py-3"><RunBadge status={r.status} /></td>
                                    <td className="px-5 py-3 text-gray-400">
                                        {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-gray-400">{dur}</td>
                                    <td className="px-5 py-3 text-right">
                                        <Link to={`/runs/${r.id}`} className="text-xs text-orange-400 hover:underline">
                                            View →
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {!runs.length && (
                            <tr>
                                <td colSpan={5} className="px-5 py-16 text-center text-gray-500 text-sm">
                                    No runs yet. Go to an actor and click Run.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { StatCard } from '../components/StatCard';
import { RunBadge } from '../components/RunBadge';
import { Plus, RefreshCw } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null);
    const [runs, setRuns]   = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        const [s, r] = await Promise.all([api.get('/stats'), api.get('/runs')]);
        setStats(s.data);
        setRuns(r.data.slice(0, 6));
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Your scraping activity overview</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-400 rounded-lg text-sm hover:text-white transition-colors disabled:opacity-50">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <Link to="/actors/new" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                        <Plus size={15} /> New Actor
                    </Link>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Actors"     value={stats.actors}    color="orange" />
                    <StatCard label="Total Runs" value={stats.runs}      color="blue" />
                    <StatCard label="Datasets"   value={stats.datasets}  color="purple" />
                    <StatCard label="Runs Today" value={stats.todayRuns} color="green" />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Recent Runs</h3>
                    <div className="space-y-2">
                        {runs.map(r => (
                            <Link key={r.id} to={`/runs/${r.id}`}
                                className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors">
                                <div className="min-w-0">
                                    <p className="text-sm text-white font-medium truncate">{r.actor_name}</p>
                                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</p>
                                </div>
                                <RunBadge status={r.status} />
                            </Link>
                        ))}
                        {!runs.length && (
                            <p className="text-sm text-gray-500 py-6 text-center">
                                No runs yet. <Link to="/actors/new" className="text-orange-400 hover:underline">Create an actor</Link> to get started.
                            </p>
                        )}
                    </div>
                </div>

                {stats && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Run Status Breakdown</h3>
                        <div className="space-y-2">
                            {Object.entries(stats.byStatus || {}).map(([status, count]: any) => (
                                <div key={status} className="flex items-center justify-between p-2">
                                    <RunBadge status={status} />
                                    <span className="text-sm text-gray-300 font-medium">{count}</span>
                                </div>
                            ))}
                            {!Object.keys(stats.byStatus || {}).length && (
                                <p className="text-sm text-gray-500 py-4 text-center">No run history yet.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

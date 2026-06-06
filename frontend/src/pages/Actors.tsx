import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { Plus, Play, Edit, Trash2, Code2 } from 'lucide-react';

export default function Actors() {
    const [actors, setActors] = useState<any[]>([]);
    const nav = useNavigate();

    useEffect(() => { api.get('/actors').then(r => setActors(r.data)); }, []);

    const run = async (id: string) => {
        const { data } = await api.post(`/actors/${id}/run`, { input: {} });
        nav(`/runs/${data.id}`);
    };

    const del = async (id: string) => {
        if (!confirm('Delete this actor? All runs and datasets will be removed.')) return;
        await api.delete(`/actors/${id}`);
        setActors(a => a.filter(x => x.id !== id));
    };

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Actors</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{actors.length} actor{actors.length !== 1 ? 's' : ''}</p>
                </div>
                <Link to="/actors/new" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus size={15} /> New Actor
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {actors.map(a => (
                    <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Code2 size={15} className="text-orange-400 shrink-0" />
                                <h3 className="text-sm font-semibold text-white truncate">{a.name}</h3>
                            </div>
                            <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded shrink-0 ml-2">
                                {a.runtime === 'python3' ? 'Python 3' : 'Node 20'}
                            </span>
                        </div>
                        {a.description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.description}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-2">{new Date(a.updated_at).toLocaleDateString()}</p>
                        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
                            <button onClick={() => run(a.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg text-xs hover:bg-orange-500/25 transition-colors">
                                <Play size={11} /> Run
                            </button>
                            <Link to={`/actors/${a.id}`}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors">
                                <Edit size={11} /> Edit
                            </Link>
                            <button onClick={() => del(a.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto">
                                <Trash2 size={11} />
                            </button>
                        </div>
                    </div>
                ))}
                {!actors.length && (
                    <div className="col-span-3 text-center py-20 text-gray-500">
                        <Code2 size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-sm">No actors yet.</p>
                        <Link to="/actors/new" className="inline-block mt-3 text-orange-400 hover:underline text-sm">
                            Create your first actor →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

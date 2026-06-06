import { useEffect, useState } from 'react';
import api from '../api';
import { Database, Plus, Trash2, ChevronRight, Edit3, Check, X } from 'lucide-react';

export default function KVStore() {
    const [stores, setStores]         = useState<any[]>([]);
    const [selected, setSelected]     = useState<any>(null);
    const [keys, setKeys]             = useState<any[]>([]);
    const [newStoreName, setNewStoreName] = useState('');
    const [editing, setEditing]       = useState<string | null>(null);
    const [editVal, setEditVal]       = useState('');
    const [newKey, setNewKey]         = useState('');
    const [newVal, setNewVal]         = useState('');

    useEffect(() => { api.get('/kv').then(r => setStores(r.data)); }, []);

    const selectStore = async (store: any) => {
        setSelected(store);
        const { data } = await api.get(`/kv/${store.id}/keys`);
        setKeys(data);
    };

    const createStore = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data } = await api.post('/kv', { name: newStoreName });
        setStores(s => [data, ...s]);
        setNewStoreName('');
    };

    const deleteStore = async (id: string) => {
        if (!confirm('Delete this store and all its keys?')) return;
        await api.delete(`/kv/${id}`);
        setStores(s => s.filter(x => x.id !== id));
        if (selected?.id === id) { setSelected(null); setKeys([]); }
    };

    const setKeyValue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !newKey) return;
        await api.put(`/kv/${selected.id}/${encodeURIComponent(newKey)}`,
            newVal, { headers: { 'Content-Type': 'text/plain' } });
        const { data } = await api.get(`/kv/${selected.id}/keys`);
        setKeys(data);
        setNewKey(''); setNewVal('');
    };

    const saveEdit = async (key: string) => {
        await api.put(`/kv/${selected.id}/${encodeURIComponent(key)}`,
            editVal, { headers: { 'Content-Type': 'text/plain' } });
        setKeys(k => k.map(x => x.key === key ? { ...x } : x));
        setEditing(null);
    };

    const deleteKey = async (key: string) => {
        await api.delete(`/kv/${selected.id}/${encodeURIComponent(key)}`);
        setKeys(k => k.filter(x => x.key !== key));
    };

    return (
        <div className="p-8 space-y-5">
            <h1 className="text-2xl font-bold text-white">Key-Value Stores</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Store list */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stores</h3>
                    <form onSubmit={createStore} className="flex gap-2">
                        <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)}
                            placeholder="Store name"
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none" />
                        <button type="submit" className="px-2 py-1.5 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 transition-colors">
                            <Plus size={12} />
                        </button>
                    </form>
                    <div className="space-y-1">
                        {stores.map(s => (
                            <div key={s.id} onClick={() => selectStore(s)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected?.id === s.id ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'hover:bg-gray-800 text-gray-300 border border-transparent'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Database size={13} />
                                    <span className="text-sm truncate">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <ChevronRight size={13} className="text-gray-500" />
                                    <button onClick={e => { e.stopPropagation(); deleteStore(s.id); }} className="text-gray-600 hover:text-red-400 transition-colors p-0.5">
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!stores.length && <p className="text-xs text-gray-600 text-center py-4">No stores yet</p>}
                    </div>
                </div>

                {/* Keys */}
                <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                    {selected ? (
                        <>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                {selected.name} — {keys.length} keys
                            </h3>
                            <form onSubmit={setKeyValue} className="flex gap-2">
                                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Key" required
                                    className="w-1/3 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 font-mono focus:outline-none" />
                                <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Value"
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 font-mono focus:outline-none" />
                                <button type="submit" className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 transition-colors">Set</button>
                            </form>
                            <div className="space-y-1 max-h-[calc(100vh-360px)] overflow-auto">
                                {keys.map(k => (
                                    <div key={k.key} className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 group">
                                        <span className="text-xs font-mono text-orange-300 w-1/3 truncate shrink-0">{k.key}</span>
                                        {editing === k.key ? (
                                            <>
                                                <input value={editVal} onChange={e => setEditVal(e.target.value)}
                                                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs font-mono text-gray-200 focus:outline-none"
                                                    autoFocus />
                                                <button onClick={() => saveEdit(k.key)} className="text-green-400 hover:text-green-300"><Check size={13} /></button>
                                                <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-300"><X size={13} /></button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-xs font-mono text-gray-400 truncate">{k.content_type}</span>
                                                <span className="text-xs text-gray-500">{new Date(k.updated_at).toLocaleString()}</span>
                                                <button onClick={() => { setEditing(k.key); setEditVal(''); }}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-all">
                                                    <Edit3 size={13} />
                                                </button>
                                                <button onClick={() => deleteKey(k.key)}
                                                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all">
                                                    <Trash2 size={13} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {!keys.length && <p className="text-xs text-gray-600 text-center py-8">No keys yet. Add one above.</p>}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-gray-600">
                            <div className="text-center">
                                <Database size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Select a store to manage its keys</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

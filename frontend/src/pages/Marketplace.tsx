import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Copy, Search } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
    'Web Scraping':   'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'APIs':           'bg-green-500/20 text-green-300 border-green-500/30',
    'Data Processing':'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Monitoring':     'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'General':        'bg-gray-700 text-gray-300 border-gray-600',
};

export default function Marketplace() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [search, setSearch]       = useState('');
    const [category, setCategory]   = useState('All');
    const [categories, setCategories] = useState<string[]>([]);
    const [cloning, setCloning]     = useState<string | null>(null);
    const nav = useNavigate();

    useEffect(() => {
        api.get('/marketplace').then(r => setTemplates(r.data));
        api.get('/marketplace/categories').then(r => setCategories(['All', ...r.data]));
    }, []);

    const clone = async (id: string) => {
        setCloning(id);
        try {
            const { data } = await api.post(`/marketplace/${id}/clone`);
            nav(`/actors/${data.id}`);
        } finally { setCloning(null); }
    };

    const filtered = templates.filter(t => {
        const matchesCat = category === 'All' || t.category === category;
        const matchesSearch = !search ||
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.description.toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
    });

    return (
        <div className="p-8 space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-white">Marketplace</h1>
                <p className="text-sm text-gray-400 mt-0.5">Ready-to-use actor templates. Clone and customise.</p>
            </div>

            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
                        className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {categories.map(c => (
                        <button key={c} onClick={() => setCategory(c)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                category === c
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
                            }`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(t => (
                    <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{t.icon}</span>
                                <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS.General}`}>
                                {t.category}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 flex-1">{t.description}</p>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
                            <span className={`text-xs px-2 py-0.5 rounded ${t.runtime === 'python3' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                                {t.runtime === 'python3' ? 'Python 3' : 'Node.js 20'}
                            </span>
                            <button onClick={() => clone(t.id)} disabled={cloning === t.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg text-xs hover:bg-orange-500/25 transition-colors disabled:opacity-50">
                                <Copy size={11} />
                                {cloning === t.id ? 'Cloning...' : 'Clone & Edit'}
                            </button>
                        </div>
                    </div>
                ))}
                {!filtered.length && (
                    <p className="col-span-3 text-center py-12 text-gray-500 text-sm">No templates match your search.</p>
                )}
            </div>
        </div>
    );
}

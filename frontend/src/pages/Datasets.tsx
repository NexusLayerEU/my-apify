import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { Download, Database, ArrowLeft } from 'lucide-react';

function DatasetList() {
    const [datasets, setDatasets] = useState<any[]>([]);
    useEffect(() => { api.get('/datasets').then(r => setDatasets(r.data)); }, []);

    return (
        <div className="p-8 space-y-5">
            <h1 className="text-2xl font-bold text-white">Datasets</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {datasets.map(d => (
                    <Link key={d.id} to={`/datasets/${d.id}`}
                        className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                        <div className="flex items-center gap-2 mb-3">
                            <Database size={15} className="text-purple-400" />
                            <h3 className="text-sm font-semibold text-white truncate">{d.name}</h3>
                        </div>
                        <p className="text-3xl font-bold text-purple-400">{d.item_count}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            items · {new Date(d.created_at).toLocaleDateString()}
                        </p>
                    </Link>
                ))}
                {!datasets.length && (
                    <p className="col-span-3 text-center py-16 text-gray-500 text-sm">
                        No datasets yet. Run an actor to generate data.
                    </p>
                )}
            </div>
        </div>
    );
}

function DatasetView({ id }: { id: string }) {
    const [ds, setDs]       = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        api.get(`/datasets/${id}`).then(r => setDs(r.data));
        api.get(`/datasets/${id}/items?limit=200`).then(r => {
            setItems(r.data.items); setTotal(r.data.total);
        });
    }, [id]);

    const exportCSV = () => {
        window.open(`/api/datasets/${id}/items?format=csv&limit=10000`, '_blank');
    };

    if (!ds) return <div className="p-8 text-gray-400 text-sm">Loading...</div>;
    const cols = items.length ? Object.keys(items[0]) : [];

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/datasets" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-2">
                        <ArrowLeft size={12} /> Datasets
                    </Link>
                    <h1 className="text-xl font-bold text-white">{ds.name}</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{total.toLocaleString()} items</p>
                </div>
                <button onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/25 transition-colors">
                    <Download size={13} /> Export CSV
                </button>
            </div>

            {cols.length > 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-260px)]">
                        <table className="w-full text-xs font-mono">
                            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                                <tr>
                                    {cols.map(c => (
                                        <th key={c} className="text-left px-4 py-2.5 text-gray-400 font-medium whitespace-nowrap">
                                            {c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {items.map((item, i) => (
                                    <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                                        {cols.map(c => (
                                            <td key={c} className="px-4 py-2 text-gray-300 max-w-xs truncate">
                                                {typeof item[c] === 'object' ? JSON.stringify(item[c]) : String(item[c] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500 text-sm">
                    No items in this dataset yet.
                </div>
            )}
        </div>
    );
}

export default function Datasets() {
    const { id } = useParams<{ id?: string }>();
    return id ? <DatasetView id={id} /> : <DatasetList />;
}

import { useEffect, useState } from 'react';
import api from '../api';
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function Schedules() {
    const [schedules, setSchedules] = useState<any[]>([]);
    const [actors, setActors]       = useState<any[]>([]);
    const [showForm, setShowForm]   = useState(false);
    const [form, setForm] = useState({ actor_id: '', cron_expr: '0 * * * *', webhook_url: '' });

    useEffect(() => {
        api.get('/schedules').then(r => setSchedules(r.data));
        api.get('/actors').then(r => setActors(r.data));
    }, []);

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data } = await api.post('/schedules', form);
        setSchedules(s => [data, ...s]);
        setShowForm(false);
        setForm({ actor_id: '', cron_expr: '0 * * * *', webhook_url: '' });
    };

    const toggle = async (id: string) => {
        const { data } = await api.patch(`/schedules/${id}/toggle`);
        setSchedules(s => s.map(x => x.id === id ? data : x));
    };

    const del = async (id: string) => {
        if (!confirm('Delete this schedule?')) return;
        await api.delete(`/schedules/${id}`);
        setSchedules(s => s.filter(x => x.id !== id));
    };

    const CRON_PRESETS = [
        { label: 'Every hour',    value: '0 * * * *' },
        { label: 'Every 6 hours', value: '0 */6 * * *' },
        { label: 'Daily 9am',     value: '0 9 * * *' },
        { label: 'Daily midnight',value: '0 0 * * *' },
        { label: 'Weekly Monday', value: '0 9 * * 1' },
        { label: 'Every 30 min',  value: '*/30 * * * *' },
    ];

    return (
        <div className="p-8 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Schedules</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Run actors automatically on a cron schedule</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus size={15} /> New Schedule
                </button>
            </div>

            {showForm && (
                <form onSubmit={create} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white">New Schedule</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Actor</label>
                            <select value={form.actor_id} onChange={e => setForm(f => ({ ...f, actor_id: e.target.value }))} required
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500">
                                <option value="">Select actor...</option>
                                {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Cron Expression</label>
                            <div className="flex gap-2">
                                <input value={form.cron_expr} onChange={e => setForm(f => ({ ...f, cron_expr: e.target.value }))} required
                                    placeholder="0 * * * *"
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none focus:border-orange-500" />
                                <select onChange={e => setForm(f => ({ ...f, cron_expr: e.target.value }))} value=""
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-gray-400 focus:outline-none cursor-pointer">
                                    <option value="">Presets</option>
                                    {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-xs text-gray-400 block mb-1">Webhook URL (optional — called on run completion)</label>
                            <input value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                                placeholder="https://your-app.com/webhook"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-orange-500" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button type="submit" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
                            Create Schedule
                        </button>
                        <button type="button" onClick={() => setShowForm(false)}
                            className="px-4 py-2 bg-gray-800 text-gray-400 text-sm rounded-lg hover:bg-gray-700 transition-colors">
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {schedules.map(s => (
                    <div key={s.id} className={`bg-gray-900 border rounded-xl p-5 flex items-center gap-4 ${s.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
                        <Clock size={18} className={s.enabled ? 'text-orange-400' : 'text-gray-600'} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-white">{s.actor_name}</p>
                                <code className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded font-mono">{s.cron_expr}</code>
                            </div>
                            {s.webhook_url && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">→ {s.webhook_url}</p>
                            )}
                            {s.last_run && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Last run: {new Date(s.last_run).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => toggle(s.id)} className="text-gray-400 hover:text-orange-400 transition-colors" title={s.enabled ? 'Disable' : 'Enable'}>
                                {s.enabled ? <ToggleRight size={22} className="text-orange-400" /> : <ToggleLeft size={22} />}
                            </button>
                            <button onClick={() => del(s.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                ))}
                {!schedules.length && !showForm && (
                    <div className="text-center py-16 text-gray-500">
                        <Clock size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No schedules yet. Create one to run actors automatically.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

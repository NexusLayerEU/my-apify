import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../api';
import { Save, Play, ArrowLeft } from 'lucide-react';

const STARTER: Record<string, string> = {
    python3: `# MyApify Actor — Python
# Available: get_input(), push_data(items), log(message)
from myapify import get_input, push_data, log

def main():
    input_data = get_input()
    log(f"Starting with input: {input_data}")

    # Your scraping logic here
    result = {"hello": "world", "input": input_data}

    push_data(result)
    log("Done!")

main()
`,
    node20: `// MyApify Actor — Node.js
// Available: getInput(), pushData(items)
const { getInput, pushData } = require('myapify');

async function main() {
    const input = getInput();
    console.log('Starting with input:', input);

    // Your scraping logic here
    const result = { hello: 'world', input };

    await pushData(result);
    console.log('Done!');
}

main().catch(console.error);
`,
};

export default function ActorEditor() {
    const { id } = useParams<{ id: string }>();
    const nav = useNavigate();
    const isNew = id === 'new';

    const [name, setName]           = useState('');
    const [desc, setDesc]           = useState('');
    const [runtime, setRuntime]     = useState('python3');
    const [code, setCode]           = useState(STARTER.python3);
    const [reqs, setReqs]           = useState('');
    const [webhook, setWebhook]     = useState('');
    const [saving, setSaving]       = useState(false);
    const [savedId, setSavedId]     = useState<string | null>(null);

    useEffect(() => {
        if (!isNew && id) {
            api.get(`/actors/${id}`).then(r => {
                const a = r.data;
                setName(a.name); setDesc(a.description);
                setRuntime(a.runtime); setCode(a.source_code);
                setReqs(a.requirements); setWebhook(a.webhook_url || '');
                setSavedId(a.id);
            });
        }
    }, [id, isNew]);

    const handleRuntimeChange = (r: string) => {
        setRuntime(r);
        if (!code || code === STARTER.python3 || code === STARTER.node20) {
            setCode(STARTER[r]);
        }
    };

    const save = async (): Promise<string> => {
        setSaving(true);
        try {
            const payload = { name, description: desc, runtime, source_code: code, requirements: reqs, webhook_url: webhook };
            if (isNew && !savedId) {
                const { data } = await api.post('/actors', payload);
                setSavedId(data.id);
                nav(`/actors/${data.id}`, { replace: true });
                return data.id;
            } else {
                const targetId = savedId || id!;
                await api.put(`/actors/${targetId}`, payload);
                return targetId;
            }
        } finally { setSaving(false); }
    };

    const runNow = async () => {
        const actorId = await save();
        const { data } = await api.post(`/actors/${actorId}/run`, { input: {} });
        nav(`/runs/${data.id}`);
    };

    return (
        <div className="h-screen flex flex-col bg-gray-950">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-gray-900">
                <button onClick={() => nav('/actors')} className="text-gray-400 hover:text-white transition-colors p-1">
                    <ArrowLeft size={18} />
                </button>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Actor name"
                    className="flex-1 bg-transparent text-white text-sm font-semibold placeholder-gray-500 focus:outline-none" />
                <select value={runtime} onChange={e => handleRuntimeChange(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer">
                    <option value="python3">Python 3</option>
                    <option value="node20">Node.js 20</option>
                </select>
                <button onClick={save} disabled={saving}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition-colors disabled:opacity-50">
                    <Save size={13} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={runNow} disabled={saving}
                    className="flex items-center gap-2 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    <Play size={13} /> Run
                </button>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    language={runtime === 'python3' ? 'python' : 'javascript'}
                    value={code}
                    onChange={v => setCode(v || '')}
                    theme="vs-dark"
                    options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        padding: { top: 16 },
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                    }}
                />
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-2.5 border-t border-gray-800 bg-gray-900">
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={reqs} onChange={e => setReqs(e.target.value)}
                    placeholder={runtime === 'python3' ? 'requirements.txt (e.g. requests==2.32.0)' : 'npm packages (e.g. axios cheerio)'}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                <input value={webhook} onChange={e => setWebhook(e.target.value)}
                    placeholder="Webhook URL on completion (optional)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-orange-500" />
            </div>
        </div>
    );
}

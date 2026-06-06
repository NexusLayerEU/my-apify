import { useState } from 'react';
import { useAuth } from '../auth';
import api from '../api';
import { Copy, RefreshCw, Check, Key } from 'lucide-react';

export default function Settings() {
    const { user } = useAuth();
    const [apiKey, setApiKey]     = useState(user?.api_key || '');
    const [copied, setCopied]     = useState(false);
    const [rotating, setRotating] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const rotate = async () => {
        if (!confirm('Rotate API key? The current key will stop working immediately.')) return;
        setRotating(true);
        const { data } = await api.post('/auth/rotate-key');
        setApiKey(data.api_key);
        setRotating(false);
    };

    return (
        <div className="p-8 max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>

            {/* Account */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">Account</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="text-sm text-gray-200">{user?.email}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Plan</p>
                        <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded capitalize">
                            {user?.plan}
                        </span>
                    </div>
                </div>
            </div>

            {/* API Key */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Key size={15} className="text-orange-400" />
                    <h3 className="text-sm font-semibold text-white">API Key</h3>
                </div>
                <p className="text-xs text-gray-400">
                    Use this key in the <code className="bg-gray-800 px-1 rounded text-gray-300">x-api-key</code> header to authenticate API requests programmatically.
                </p>
                <div className="flex gap-2">
                    <input readOnly value={apiKey}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none" />
                    <button onClick={copy}
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Copy API key">
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <button onClick={rotate} disabled={rotating}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Rotate API key">
                        <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* API Usage */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-white">API Usage</h3>
                <p className="text-xs text-gray-400">Base URL: <code className="bg-gray-800 px-1 rounded text-gray-300">http://192.168.68.111:4280/api</code></p>
                <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
                    <p className="text-gray-500"># List actors</p>
                    <p>curl -H "x-api-key: {apiKey.slice(0,8)}..." http://192.168.68.111:4280/api/actors</p>
                    <p className="text-gray-500 mt-2"># Trigger a run</p>
                    <p>curl -X POST -H "x-api-key: {apiKey.slice(0,8)}..." http://192.168.68.111:4280/api/actors/ACTOR_ID/run</p>
                </div>
            </div>
        </div>
    );
}

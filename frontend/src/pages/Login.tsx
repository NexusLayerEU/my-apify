import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Zap } from 'lucide-react';

export default function Login() {
    const { login, register } = useAuth();
    const nav = useNavigate();
    const [mode, setMode]       = useState<'login' | 'register'>('login');
    const [email, setEmail]     = useState('');
    const [password, setPass]   = useState('');
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            if (mode === 'login') await login(email, password);
            else await register(email, password);
            nav('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Something went wrong');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-xl shadow-orange-500/20">
                        <Zap size={20} className="text-white" />
                    </div>
                    <span className="text-2xl font-bold text-white">MyApify</span>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                    <h2 className="text-lg font-semibold text-white mb-6">
                        {mode === 'login' ? 'Sign in' : 'Create account'}
                    </h2>
                    {error && (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                            {error}
                        </p>
                    )}
                    <form onSubmit={submit} className="space-y-4">
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPass(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                        <button type="submit" disabled={loading}
                            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                            {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>
                    <p className="text-sm text-gray-500 text-center mt-4">
                        {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                        <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
                            className="text-orange-400 hover:underline">
                            {mode === 'login' ? 'Register' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}

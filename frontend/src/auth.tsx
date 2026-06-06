import axios from 'axios';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from './api';

interface User { id: string; email: string; api_key: string; plan: string; }
interface AuthCtx {
    user: User | null;
    login: (email: string, pass: string) => Promise<void>;
    register: (email: string, pass: string) => Promise<void>;
    logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        if (localStorage.getItem('token')) {
            api.get('/auth/me').then(r => setUser(r.data)).catch(() => {});
        }
    }, []);

    const login = async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        setUser(data.user);
    };

    const register = async (email: string, password: string) => {
        const { data } = await api.post('/auth/register', { email, password });
        localStorage.setItem('token', data.token);
        setUser(data.user);
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        window.location.href = '/login';
    };

    return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

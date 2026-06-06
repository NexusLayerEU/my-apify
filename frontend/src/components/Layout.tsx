import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Code2, Play, Database, Settings, LogOut, Zap, Clock, Key, ShoppingBag } from 'lucide-react';
import { useAuth } from '../auth';

const NAV = [
    { to: '/',           label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/actors',     label: 'Actors',     icon: Code2 },
    { to: '/runs',       label: 'Runs',       icon: Play },
    { to: '/datasets',   label: 'Datasets',   icon: Database },
    { to: '/schedules',  label: 'Schedules',  icon: Clock },
    { to: '/kv',         label: 'KV Store',   icon: Key },
    { to: '/marketplace',label: 'Marketplace',icon: ShoppingBag },
    { to: '/settings',   label: 'Settings',   icon: Settings },
];

export default function Layout() {
    const { user, logout } = useAuth();
    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex">
            <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
                <div className="px-5 py-5 border-b border-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Zap size={16} className="text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-white text-sm block">MyApify</span>
                        <span className="text-xs text-gray-500">Scraping Platform</span>
                    </div>
                </div>
                <nav className="flex-1 py-4 px-2 space-y-0.5">
                    {NAV.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                isActive
                                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                            }`
                        }>
                            <Icon size={16} />{label}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-3 border-t border-gray-800">
                    <div className="text-xs text-gray-500 mb-2 px-1 truncate">{user?.email}</div>
                    <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <LogOut size={14} /> Sign out
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}

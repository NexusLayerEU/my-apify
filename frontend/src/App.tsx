import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout      from './components/Layout';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Actors      from './pages/Actors';
import ActorEditor from './pages/ActorEditor';
import Runs        from './pages/Runs';
import RunDetail   from './pages/RunDetail';
import Datasets    from './pages/Datasets';
import Settings    from './pages/Settings';

function Protected({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<Protected><Layout /></Protected>}>
                        <Route index element={<Dashboard />} />
                        <Route path="actors" element={<Actors />} />
                        <Route path="actors/:id" element={<ActorEditor />} />
                        <Route path="runs" element={<Runs />} />
                        <Route path="runs/:id" element={<RunDetail />} />
                        <Route path="datasets" element={<Datasets />} />
                        <Route path="datasets/:id" element={<Datasets />} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

const COLORS: Record<string, string> = {
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400',
    blue:   'from-blue-500/10   to-blue-500/5   border-blue-500/20   text-blue-400',
    green:  'from-green-500/10  to-green-500/5  border-green-500/20  text-green-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
};

export function StatCard({ label, value, sub, color = 'orange' }: {
    label: string; value: string | number; sub?: string; color?: string;
}) {
    const c = COLORS[color] || COLORS.orange;
    const textColor = c.split(' ').find(x => x.startsWith('text-')) || 'text-orange-400';
    return (
        <div className={`bg-gradient-to-br ${c} border rounded-xl p-5`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${textColor}`}>{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
    );
}

const STYLES: Record<string, string> = {
    QUEUED:    'bg-gray-700 text-gray-300',
    RUNNING:   'bg-blue-500/20 text-blue-300 animate-pulse',
    SUCCEEDED: 'bg-green-500/20 text-green-300',
    FAILED:    'bg-red-500/20 text-red-300',
    ABORTED:   'bg-yellow-500/20 text-yellow-300',
};

export function RunBadge({ status }: { status: string }) {
    return (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STYLES[status] || 'bg-gray-700 text-gray-400'}`}>
            {status}
        </span>
    );
}

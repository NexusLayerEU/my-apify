async function fireWebhook(url, payload) {
    if (!url) return;
    try {
        const { default: fetch } = await import('node-fetch');
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeout: 10000,
        });
        console.log(`[Webhook] POST ${url} → ${res.status}`);
    } catch (err) {
        console.warn(`[Webhook] Failed to POST ${url}: ${err.message}`);
    }
}

module.exports = { fireWebhook };

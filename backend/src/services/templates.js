const { pool } = require('../db');

const TEMPLATES = [
    {
        name: 'Web Scraper (Python)',
        description: 'Scrape any URL and extract title, text content, and all links using requests and BeautifulSoup.',
        category: 'Web Scraping',
        runtime: 'python3',
        icon: '🕷️',
        requirements: 'requests\nbeautifulsoup4',
        source_code: `from myapify import get_input, push_data, log
import requests
from bs4 import BeautifulSoup

def main():
    input_data = get_input()
    url = input_data.get('url', 'https://example.com')
    log(f"Scraping: {url}")

    resp = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, 'html.parser')
    title = soup.title.string.strip() if soup.title else ''
    text  = ' '.join(soup.get_text().split())[:2000]
    links = [a['href'] for a in soup.find_all('a', href=True)][:50]

    push_data({'url': url, 'title': title, 'text': text, 'links': links})
    log(f"Done — found {len(links)} links")

main()
`,
    },
    {
        name: 'JSON API Fetcher',
        description: 'Fetch data from any JSON REST API endpoint and store the results.',
        category: 'APIs',
        runtime: 'python3',
        icon: '🔌',
        requirements: 'requests',
        source_code: `from myapify import get_input, push_data, log
import requests

def main():
    input_data = get_input()
    url     = input_data.get('url', 'https://jsonplaceholder.typicode.com/posts')
    headers = input_data.get('headers', {})
    params  = input_data.get('params', {})

    log(f"Fetching: {url}")
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    resp.raise_for_status()

    data = resp.json()
    items = data if isinstance(data, list) else [data]
    push_data(items)
    log(f"Fetched {len(items)} items")

main()
`,
    },
    {
        name: 'RSS Feed Reader',
        description: 'Parse any RSS or Atom feed and extract articles with title, link, and published date.',
        category: 'Web Scraping',
        runtime: 'python3',
        icon: '📰',
        requirements: 'requests\nfeedparser',
        source_code: `from myapify import get_input, push_data, log
import feedparser

def main():
    input_data = get_input()
    url   = input_data.get('url', 'https://news.ycombinator.com/rss')
    limit = input_data.get('limit', 20)

    log(f"Parsing RSS: {url}")
    feed    = feedparser.parse(url)
    entries = feed.entries[:limit]

    results = []
    for e in entries:
        results.append({
            'title':     e.get('title', ''),
            'link':      e.get('link', ''),
            'published': e.get('published', ''),
            'summary':   e.get('summary', '')[:500],
        })

    push_data(results)
    log(f"Done — {len(results)} articles")

main()
`,
    },
    {
        name: 'CSV Downloader',
        description: 'Download a CSV file from a URL, parse it, and push each row as a dataset item.',
        category: 'Data Processing',
        runtime: 'python3',
        icon: '📊',
        requirements: 'requests',
        source_code: `from myapify import get_input, push_data, log
import requests, csv, io

def main():
    input_data = get_input()
    url   = input_data.get('url', '')
    limit = input_data.get('limit', 1000)

    if not url:
        log("ERROR: provide a 'url' in input", 'ERROR')
        return

    log(f"Downloading CSV: {url}")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()

    reader  = csv.DictReader(io.StringIO(resp.text))
    rows    = [row for i, row in enumerate(reader) if i < limit]

    push_data(rows)
    log(f"Done — {len(rows)} rows")

main()
`,
    },
    {
        name: 'Web Scraper (Node.js)',
        description: 'Scrape a webpage using axios and cheerio, extracting title, headings, and links.',
        category: 'Web Scraping',
        runtime: 'node20',
        icon: '🔍',
        requirements: '{"dependencies":{"axios":"^1.6.0","cheerio":"^1.0.0"}}',
        source_code: `const { getInput, pushData } = require('myapify');

async function main() {
    const input = getInput();
    const url   = input.url || 'https://example.com';

    console.log(\`Scraping: \${url}\`);

    // Simple fetch without external deps first
    const https = url.startsWith('https') ? require('https') : require('http');
    const html  = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\\/title>/i);
    const title      = titleMatch ? titleMatch[1].trim() : '';
    const links      = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 50);
    const h1s        = [...html.matchAll(/<h1[^>]*>([^<]*)<\\/h1>/gi)].map(m => m[1].trim());

    await pushData({ url, title, h1s, links });
    console.log(\`Done — title: "\${title}", \${links.length} links\`);
}

main().catch(console.error);
`,
    },
    {
        name: 'GitHub Repo Stats',
        description: 'Fetch public stats for any GitHub repository using the GitHub API.',
        category: 'APIs',
        runtime: 'python3',
        icon: '⭐',
        requirements: 'requests',
        source_code: `from myapify import get_input, push_data, log
import requests

def main():
    input_data = get_input()
    repos = input_data.get('repos', ['torvalds/linux', 'microsoft/vscode'])

    results = []
    for repo in repos:
        log(f"Fetching: {repo}")
        resp = requests.get(
            f"https://api.github.com/repos/{repo}",
            headers={'Accept': 'application/vnd.github.v3+json'},
            timeout=10
        )
        if resp.status_code == 200:
            d = resp.json()
            results.append({
                'repo':        d['full_name'],
                'stars':       d['stargazers_count'],
                'forks':       d['forks_count'],
                'watchers':    d['watchers_count'],
                'open_issues': d['open_issues_count'],
                'language':    d['language'],
                'description': d['description'],
            })

    push_data(results)
    log(f"Done — {len(results)} repos")

main()
`,
    },
    {
        name: 'URL Health Checker',
        description: 'Check the HTTP status of a list of URLs and report response times.',
        category: 'Monitoring',
        runtime: 'python3',
        icon: '🏥',
        requirements: 'requests',
        source_code: `from myapify import get_input, push_data, log
import requests, time

def main():
    input_data = get_input()
    urls = input_data.get('urls', ['https://example.com', 'https://google.com'])

    results = []
    for url in urls:
        log(f"Checking: {url}")
        start = time.time()
        try:
            resp    = requests.get(url, timeout=10, allow_redirects=True)
            elapsed = round((time.time() - start) * 1000)
            results.append({
                'url':           url,
                'status':        resp.status_code,
                'ok':            resp.ok,
                'response_ms':   elapsed,
                'final_url':     resp.url,
            })
        except Exception as e:
            results.append({'url': url, 'status': 0, 'ok': False, 'error': str(e)})

    push_data(results)
    log(f"Done — checked {len(urls)} URLs")

main()
`,
    },
    {
        name: 'HackerNews Top Stories',
        description: 'Fetch the top N stories from Hacker News via the official Firebase API.',
        category: 'APIs',
        runtime: 'python3',
        icon: '🔶',
        requirements: 'requests',
        source_code: `from myapify import get_input, push_data, log
import requests

BASE = 'https://hacker-news.firebaseio.com/v0'

def main():
    input_data = get_input()
    limit = input_data.get('limit', 10)

    log("Fetching top story IDs...")
    ids = requests.get(f"{BASE}/topstories.json", timeout=10).json()[:limit]

    stories = []
    for i, story_id in enumerate(ids):
        item = requests.get(f"{BASE}/item/{story_id}.json", timeout=10).json()
        stories.append({
            'rank':    i + 1,
            'id':      item.get('id'),
            'title':   item.get('title'),
            'url':     item.get('url', f"https://news.ycombinator.com/item?id={item.get('id')}"),
            'score':   item.get('score'),
            'by':      item.get('by'),
            'comments':item.get('descendants', 0),
        })
        log(f"[{i+1}/{limit}] {item.get('title', '')[:60]}")

    push_data(stories)
    log(f"Done — {len(stories)} stories")

main()
`,
    },
];

async function seedTemplates() {
    const { rows } = await pool.query('SELECT COUNT(*) FROM templates');
    if (parseInt(rows[0].count) > 0) return; // Already seeded

    for (const tpl of TEMPLATES) {
        await pool.query(
            `INSERT INTO templates (name, description, category, runtime, icon, source_code, requirements)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [tpl.name, tpl.description, tpl.category, tpl.runtime, tpl.icon, tpl.source_code, tpl.requirements || '']
        );
    }
    console.log(`[Templates] Seeded ${TEMPLATES.length} templates`);
}

module.exports = { seedTemplates };

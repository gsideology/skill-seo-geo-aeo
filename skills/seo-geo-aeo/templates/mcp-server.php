<?php
// Remote MCP server (Streamable HTTP, https://modelcontextprotocol.io) for a website's catalog of
// pages/tools. People add its URL (e.g. https://example.com/mcp) to Claude, ChatGPT or another MCP
// client as a custom connector; the assistant searches the catalog and gives the user links.
// Stateless, no dependencies, PHP >= 8.1. It never stores queries.
//
// Data (generate both at build time from the site's registry, so only published pages appear):
//   MCP_DATA_DIR/site.json            {"id":"example","name":"Example Tools","url":"https://example.com","count":42,
//                                      "categories":[{"id":"pdf","name":"PDF"}],"examples":["merge pdf","json to yaml"]}
//   MCP_DATA_DIR/tools.<locale>.json  [{"slug":"merge-pdf","name":"Merge PDF","description":"…","category":"pdf",
//                                      "url":"/merge-pdf","agentTools":["merge_pdfs"],"keywords":["merge pdf","combine pdf"]}]
//                                     url is the page path in that locale (e.g. "/it/unire-pdf"); localized indexes
//                                     should also carry the default-language keywords.
//   MCP_DATA_DIR/server-card.json     optional MCP Server Card (templates/server-card.example.json), served at /mcp/server-card
// Routing (Apache/LiteSpeed .htaccess, before other rewrites): RewriteRule ^mcp(/server-card)?$ /path/to/mcp-server.php [L]
// Test: node scripts/mcp_smoke_test.mjs https://example.com/mcp

declare(strict_types=1);

const MCP_DATA_DIR = __DIR__ . '/agent';
/** First = default language. Must match the tools.<locale>.json files. */
const MCP_LOCALES = ['en', 'it', 'es', 'fr', 'de'];
const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MCP_MAX_BODY = 65536;
const MCP_MAX_RESULTS = 8;
/**
 * Words that don't say which tool, per language: articles, prepositions and request words
 * ("find a tool to…"). Keep identical to any other implementation of the search (parity test).
 * Never list a word that is meaningful in tool names (e.g. "ai").
 */
const MCP_STOPWORDS = [
    'to a an the of for and or in on with my me from into online free find search need want how can tool tools please some',
    'di da per con il la le un una uno lo gli dei delle degli del della al alla mi io che come trova trovami cerca serve voglio posso strumento strumenti',
    'de del el en para los las unos unas yo mis que como cómo encuentra busca necesito quiero puedo herramienta herramientas',
    'les des du une pour avec au aux je mes comment trouve cherche veux peux besoin outil outils',
    'zu und mit für der die das ein eine einen einem einer den dem des ich kann mein meine meinen wie finde suche brauche möchte bitte werkzeug',
];
const MCP_NO_MATCH = 'No tool matches. Try other words; a format missing from every tool is probably not supported.';
const MCP_PARTIAL = 'No tool matches every word: these share only some of them. Check that one fits before suggesting it.';

/** Thrown for bad tool arguments: becomes a tool result with isError, which the model can read. */
final class ToolInputError extends RuntimeException {}

/**
 * Optional usage counting hook: called with fixed names only (method/tool, language, result kind,
 * client name), never with queries or slugs. Collect here and write after the reply (mcp_send).
 */
function mcp_count(string $kind, string $key): void
{
}

function mcp_send(int $status, ?array $body = null): never
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    // No credentials or cookies are involved, so any web client may call it.
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Expose-Headers: Mcp-Session-Id');
    if ($body !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

function mcp_data(string $file): array
{
    $path = MCP_DATA_DIR . '/' . $file;
    $json = is_file($path) ? file_get_contents($path) : false;
    if ($json === false) throw new RuntimeException("Missing $file");
    return json_decode($json, true, 64, JSON_THROW_ON_ERROR);
}

function mcp_site(): array
{
    static $site = null;
    return $site ??= mcp_data('site.json');
}

function mcp_index(string $locale): array
{
    static $cache = [];
    return $cache[$locale] ??= mcp_data("tools.$locale.json");
}

/**
 * Name matches weigh most, then keywords, then the description, weighted by IDF; tools matching
 * every word or at least two; with no good match, the tools sharing at least one word (partial);
 * at equal matched words, the tool whose name or keyword is the query as written comes first.
 * @return array{results: list<array>, partial: bool, best: ?array{matched: int, score: float}}
 */
function mcp_search(array $all, string $query): array
{
    static $stop = null;
    $stop ??= array_flip(explode(' ', implode(' ', MCP_STOPWORDS)));
    $q = trim(mb_strtolower($query, 'UTF-8'));
    $words = array_values(array_filter(
        // Apostrophes split too: "l'interesse", "d'une photo".
        preg_split("/[\\s,;\\/'’]+/u", $q) ?: [],
        fn(string $w) => mb_strlen($w, 'UTF-8') > 1 && !isset($stop[$w]),
    ));
    if (!$words) return ['results' => [], 'partial' => false, 'best' => null];
    $has = fn(string $hay, string $w) => preg_match('/(^|[^\p{L}\p{N}])' . preg_quote($w, '/') . '/u', $hay) === 1;
    $docs = array_map(fn(array $t) => [
        't' => $t,
        'name' => mb_strtolower($t['name'] . ' ' . str_replace('-', ' ', $t['slug']), 'UTF-8'),
        'keywords' => mb_strtolower(implode(' | ', $t['keywords'] ?? []), 'UTF-8'),
        'description' => mb_strtolower($t['description'], 'UTF-8'),
    ], $all);
    $idf = [];
    foreach ($words as $w) {
        $n = count(array_filter($docs, fn($d) => $has("{$d['name']} {$d['keywords']} {$d['description']}", $w)));
        $idf[$w] = log((count($docs) + 1) / ($n + 1)) + 1;
    }
    $scored = [];
    foreach ($docs as $d) {
        $score = 0.0;
        $matched = 0;
        foreach ($words as $w) {
            $s = ($has($d['name'], $w) ? 3 : 0) + ($has($d['keywords'], $w) ? 2 : 0) + ($has($d['description'], $w) ? 1 : 0);
            if ($s) $matched++;
            $score += $s * $idf[$w];
        }
        // "jpg to pdf" is Image to PDF, not PDF to JPG, although both have the same two words.
        $exact = mb_strtolower($d['t']['name'], 'UTF-8') === $q;
        foreach ($d['t']['keywords'] ?? [] as $k) if (mb_strtolower($k, 'UTF-8') === $q) $exact = true;
        $phrase = $exact ? 2 : (str_contains($d['name'], $q) || str_contains($d['keywords'], $q) ? 1 : 0);
        if ($exact) $score += 6;
        elseif (str_contains($d['keywords'], $q)) $score += 3;
        $scored[] = ['t' => $d['t'], 'score' => $score, 'matched' => $matched, 'phrase' => $phrase];
    }
    $strict = array_values(array_filter($scored, fn($x) => $x['matched'] === count($words) || $x['matched'] >= 2));
    $partial = !$strict;
    $ranked = $partial ? array_values(array_filter($scored, fn($x) => $x['matched'] > 0)) : $strict;
    usort($ranked, fn($a, $b) => $b['matched'] <=> $a['matched'] ?: $b['phrase'] <=> $a['phrase'] ?: $b['score'] <=> $a['score']);
    return [
        'results' => array_map(fn($x) => $x['t'], $ranked),
        'partial' => $partial && $ranked !== [],
        'best' => $ranked ? ['matched' => $ranked[0]['matched'], 'score' => $ranked[0]['score']] : null,
    ];
}

/** The language whose index the query fits best: whole matches, then more matched words (never scores); ties go to the default. */
function mcp_search_any_language(string $query): array
{
    $pick = null;
    $rank = fn(array $s) => $s['best'] ? ($s['partial'] ? 1000 : 2000) + $s['best']['matched'] : 0;
    foreach (MCP_LOCALES as $l) {
        $s = mcp_search(mcp_index($l), $query) + ['language' => $l];
        if ($pick === null || $rank($s) > $rank($pick)) $pick = $s;
    }
    return $pick;
}

/** The slug of the tool an agent means: slug in any case, a localized slug or a page URL; default-language slugs win. */
function mcp_find_tool(string $input): ?string
{
    $s = rtrim(preg_replace('/[?#].*$/s', '', strtolower(trim($input))), '/');
    $s = substr($s, (int) strrpos('/' . $s, '/'));
    foreach (MCP_LOCALES as $l) {
        foreach (mcp_index($l) as $t) {
            if ($t['slug'] === $s || substr($t['url'], (int) strrpos($t['url'], '/') + 1) === $s) return $t['slug'];
        }
    }
    return null;
}

function mcp_arg_string(array $args, string $key, int $max, bool $required = true): ?string
{
    $v = $args[$key] ?? null;
    if ($v === null && !$required) return null;
    if (!is_string($v) || trim($v) === '') throw new ToolInputError("\"$key\" must be a non-empty string");
    if (mb_strlen($v, 'UTF-8') > $max) throw new ToolInputError("\"$key\" is longer than $max characters");
    return $v;
}

function mcp_arg_locale(array $args): string
{
    $l = $args['language'] ?? MCP_LOCALES[0];
    if (!in_array($l, MCP_LOCALES, true)) throw new ToolInputError('"language" must be one of ' . implode(', ', MCP_LOCALES));
    return $l;
}

function mcp_entry(array $t): array
{
    return [
        'slug' => $t['slug'],
        'name' => $t['name'],
        'description' => $t['description'],
        'category' => $t['category'],
        'url' => mcp_site()['url'] . $t['url'],
        'agentTools' => $t['agentTools'] ?? [],
    ];
}

function mcp_tools(): array
{
    $site = mcp_site();
    $langs = implode(', ', MCP_LOCALES);
    $language = ['type' => 'string', 'enum' => MCP_LOCALES, 'description' => "Language of the names, descriptions and pages: $langs (default " . MCP_LOCALES[0] . "). Use the user's language."];
    $readOnly = ['readOnlyHint' => true, 'idempotentHint' => true, 'openWorldHint' => false];
    $examples = isset($site['examples']) ? ', e.g. "' . implode('", "', $site['examples']) . '"' : '';
    $local = "Give the user the link; they open the page and work there.";
    return [
        [
            'name' => 'find_tools',
            'title' => 'Find a tool',
            'description' => "Search the {$site['count']} tools of {$site['name']} by task$examples. Returns up to " . MCP_MAX_RESULTS . " tools, best first, with their page URL; when no tool matches well, the closest ones with partial: true. $local",
            'inputSchema' => [
                'type' => 'object',
                'properties' => [
                    'query' => ['type' => 'string', 'description' => 'What the user wants to do, in a few words'],
                    'language' => ['type' => 'string', 'enum' => MCP_LOCALES, 'description' => "Language of the names, descriptions and pages: $langs. Default: the language the query is written in, else " . MCP_LOCALES[0] . ". Use the user's language."],
                ],
                'required' => ['query'],
                'additionalProperties' => false,
            ],
            'annotations' => $readOnly,
        ],
        [
            'name' => 'list_tools',
            'title' => 'List the tools',
            'description' => "List every tool of {$site['name']}, or the tools of one category, with their page URL. $local",
            'inputSchema' => [
                'type' => 'object',
                'properties' => [
                    'category' => ['type' => 'string', 'enum' => array_column($site['categories'], 'id'), 'description' => 'Only this category: ' . implode(', ', array_map(fn($c) => "{$c['id']} ({$c['name']})", $site['categories']))],
                    'language' => $language,
                ],
                'additionalProperties' => false,
            ],
            'annotations' => $readOnly,
        ],
        [
            'name' => 'get_tool',
            'title' => 'Get a tool',
            'description' => "Details of one tool by its slug (from find_tools or list_tools): name, description, page URL in every language, and the in-page agent tools (WebMCP) a browser agent can call once the page is open. $local",
            'inputSchema' => [
                'type' => 'object',
                'properties' => [
                    'slug' => ['type' => 'string', 'description' => 'The tool slug; a localized slug or a page URL works too'],
                    'language' => $language,
                ],
                'required' => ['slug'],
                'additionalProperties' => false,
            ],
            'annotations' => $readOnly,
        ],
    ];
}

function mcp_call(string $name, array $args): array
{
    switch ($name) {
        case 'find_tools':
            $query = mcp_arg_string($args, 'query', 200);
            $found = isset($args['language']) ? mcp_search(mcp_index(mcp_arg_locale($args)), $query) + ['language' => $args['language']] : mcp_search_any_language($query);
            $results = array_map('mcp_entry', array_slice($found['results'], 0, MCP_MAX_RESULTS));
            $out = ['results' => $results, 'total' => count(mcp_index($found['language'])), 'language' => $found['language']];
            if (!$results) $out['hint'] = MCP_NO_MATCH;
            elseif ($found['partial']) $out += ['partial' => true, 'hint' => MCP_PARTIAL];
            mcp_count('mcplang', $found['language']);
            mcp_count('mcpresult', !$results ? 'none' : ($found['partial'] ? 'partial' : 'results'));
            return $out;
        case 'list_tools':
            $category = mcp_arg_string($args, 'category', 40, false);
            $known = array_column(mcp_site()['categories'], 'id');
            if ($category !== null && !in_array($category, $known, true)) throw new ToolInputError('"category" must be one of ' . implode(', ', $known));
            $tools = array_values(array_filter(mcp_index(mcp_arg_locale($args)), fn($t) => $category === null || $t['category'] === $category));
            return ['tools' => array_map(fn($t) => ['slug' => $t['slug'], 'name' => $t['name'], 'category' => $t['category'], 'url' => mcp_site()['url'] . $t['url']], $tools), 'total' => count($tools)];
        case 'get_tool':
            $asked = mcp_arg_string($args, 'slug', 300);
            $locale = mcp_arg_locale($args);
            $slug = mcp_find_tool($asked) ?? $asked;
            $found = null;
            foreach (mcp_index($locale) as $t) if ($t['slug'] === $slug) $found = $t;
            if ($found === null) throw new ToolInputError("Unknown tool \"$asked\"; use find_tools or list_tools first");
            $out = mcp_entry($found);
            $out['languages'] = [];
            foreach (MCP_LOCALES as $l) {
                foreach (mcp_index($l) as $t) if ($t['slug'] === $slug) $out['languages'][$l] = mcp_site()['url'] . $t['url'];
            }
            return $out;
    }
    throw new InvalidArgumentException("Unknown tool: $name");
}

/** Handles one JSON-RPC message; null for notifications and responses, which get no reply. */
function mcp_handle(mixed $msg): ?array
{
    if (!is_array($msg) || array_is_list($msg) || ($msg['jsonrpc'] ?? null) !== '2.0') {
        return ['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32600, 'message' => 'Invalid Request']];
    }
    $id = $msg['id'] ?? null;
    $method = $msg['method'] ?? null;
    if (!array_key_exists('id', $msg) || !is_string($method)) return null;
    if (!is_string($id) && !is_int($id)) return ['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32600, 'message' => 'Invalid Request']];
    $params = is_array($msg['params'] ?? null) ? $msg['params'] : [];
    $ok = fn($result) => ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result];
    $error = fn(int $code, string $message) => ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $message]];
    try {
        switch ($method) {
            case 'initialize':
                $asked = $params['protocolVersion'] ?? null;
                $client = $params['clientInfo']['name'] ?? null;
                $client = is_string($client) ? strtolower(trim($client)) : '';
                mcp_count('mcp', 'initialize');
                mcp_count('mcpclient', preg_match('/^[a-z0-9._ -]{1,40}$/', $client) ? $client : '?');
                $site = mcp_site();
                return $ok([
                    'protocolVersion' => in_array($asked, MCP_VERSIONS, true) ? $asked : MCP_VERSIONS[0],
                    'capabilities' => ['tools' => ['listChanged' => false]],
                    'serverInfo' => ['name' => $site['id'] ?? 'site-catalog', 'title' => $site['name'], 'version' => '1.0.0'],
                    'instructions' => "{$site['name']} ({$site['url']}) has {$site['count']} tools. Use find_tools to pick the right one and give the user its link; the user opens it and works there. This server only returns names, descriptions and links.",
                ]);
            case 'ping':
                return $ok(new stdClass());
            case 'tools/list':
                mcp_count('mcp', 'tools/list');
                return $ok(['tools' => mcp_tools()]);
            case 'tools/call':
                $name = $params['name'] ?? null;
                $args = $params['arguments'] ?? [];
                $tool = is_string($name) ? (array_column(mcp_tools(), null, 'name')[$name] ?? null) : null;
                if ($tool === null) return $error(-32602, 'Unknown tool: ' . (is_string($name) ? $name : '(none)'));
                mcp_count('mcp', $tool['name']);
                if (!is_array($args) || ($args !== [] && array_is_list($args))) return $error(-32602, '"arguments" must be an object');
                try {
                    // The schemas say additionalProperties: false.
                    $allowed = array_keys($tool['inputSchema']['properties']);
                    foreach (array_keys($args) as $k) {
                        if (!in_array($k, $allowed, true)) throw new ToolInputError("Unknown parameter \"$k\"; $name takes " . implode(', ', $allowed));
                    }
                    $data = mcp_call($name, $args);
                    return $ok(['content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)]], 'structuredContent' => $data]);
                } catch (ToolInputError $e) {
                    return $ok(['content' => [['type' => 'text', 'text' => $e->getMessage()]], 'isError' => true]);
                }
            default:
                return $error(-32601, "Method not found: $method");
        }
    } catch (Throwable $e) {
        error_log('mcp: ' . $e->getMessage());
        return $error(-32603, 'Internal error');
    }
}

/**
 * A plain GET (a browser, or an assistant's web-fetch tool) gets a page that says what this address
 * is and how to use it: a bare 405 looks like a broken link to a model reading the web. MCP clients
 * open a GET only to ask for an event stream (Accept: text/event-stream) and still get 405 below.
 */
function mcp_describe(bool $html): never
{
    $site = mcp_site();
    $url = $site['url'];
    $mcp = "$url/mcp";
    $sections = [
        ['What this is', ["This address is the remote MCP server (Model Context Protocol, Streamable HTTP) of {$site['name']}. AI assistants call it with JSON-RPC POST requests to find the right one of the site's {$site['count']} tools and give the user its link. Opening it in a browser shows this page."]],
        ['Connect it (no sign-in)', [
            "Claude (web and desktop app): add a custom connector with this URL, Authentication: No sign in.",
            "ChatGPT (web): add a custom MCP server with this URL, No authentication.",
            "Claude Code: claude mcp add --transport http " . ($site['id'] ?? 'site') . " $mcp",
            "Any other client that supports remote MCP servers over Streamable HTTP: this URL, no authentication.",
            "Step-by-step guide: $url/ai-assistants",
        ]],
        ['Tools', array_map(fn($t) => "{$t['name']}(" . implode(', ', array_map(fn($p) => in_array($p, $t['inputSchema']['required'] ?? [], true) ? $p : "$p?", array_keys($t['inputSchema']['properties']))) . "): {$t['title']}", mcp_tools())],
        ['What it receives', ["Only the words searched and the tool or category asked about, never files. The words are used to answer and never stored. Privacy policy: $url/privacy"]],
        ['More for agents', ["Guide for AI agents: $url/agents.md", "Site map for LLMs: $url/llms.txt", "MCP server card: $mcp/server-card", "AI catalog: $url/.well-known/ai-catalog.json"]],
    ];
    http_response_code(200);
    header('Cache-Control: public, max-age=300');
    header('X-Robots-Tag: noindex');
    header('Access-Control-Allow-Origin: *');
    header("Link: <$url/agents.md>; rel=\"describedby\"; type=\"text/markdown\", <$mcp/server-card>; rel=\"describedby\"; type=\"application/mcp-server-card+json\", <$url/.well-known/ai-catalog.json>; rel=\"ai-catalog\"");
    $title = "{$site['name']} — MCP server";
    if ($html) {
        header('Content-Type: text/html; charset=utf-8');
        $e = fn(string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $link = fn(string $s) => preg_replace('#(https?://[^\s<]+[^\s<.,;)])#', '<a href="$1">$1</a>', $e($s));
        echo "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{$e($title)}</title>";
        echo '<style>body{font:16px/1.55 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem}code{background:#eee;padding:.1em .3em;border-radius:4px}@media(prefers-color-scheme:dark){body{color:#eee;background:#111}code{background:#262626}a{color:#9ab}}</style></head><body>';
        echo "<h1>{$e($title)}</h1><p><code>{$e($mcp)}</code></p>";
        foreach ($sections as [$h, $items]) {
            echo "<h2>{$e($h)}</h2>" . (count($items) === 1 ? "<p>{$link($items[0])}</p>" : '<ul><li>' . implode('</li><li>', array_map($link, $items)) . '</li></ul>');
        }
        echo '</body></html>';
    } else {
        header('Content-Type: text/markdown; charset=utf-8');
        echo "# $title\n\n`$mcp`\n";
        foreach ($sections as [$h, $items]) echo "\n## $h\n\n" . (count($items) === 1 ? $items[0] : '- ' . implode("\n- ", $items)) . "\n";
    }
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));

// MCP Server Card at the recommended <endpoint>/server-card (SEP-2127), from MCP_DATA_DIR/server-card.json.
// Reached through PATH_INFO (/mcp.php/server-card) or a rewrite (RewriteRule ^mcp/server-card$ … [L]).
$path = (string) ($_SERVER['PATH_INFO'] ?? parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH));
if (($method === 'GET' || $method === 'HEAD') && str_ends_with(rtrim($path, '/'), '/server-card')) {
    $card = is_file(MCP_DATA_DIR . '/server-card.json') ? file_get_contents(MCP_DATA_DIR . '/server-card.json') : false;
    if ($card === false) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo "No server card configured.\n";
        exit;
    }
    $etag = '"' . md5($card) . '"';
    header('Content-Type: application/mcp-server-card+json');
    header('Cache-Control: public, max-age=300');
    header('Access-Control-Allow-Origin: *');
    header("ETag: $etag");
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        exit;
    }
    if ($method === 'GET') echo $card;
    exit;
}
if (($method === 'GET' || $method === 'HEAD') && !str_contains($accept, 'text/event-stream')) {
    try {
        mcp_describe(str_contains($accept, 'text/html'));
    } catch (Throwable $e) {
        // Missing data files: fall through to the plain 405.
    }
}
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
    header('Access-Control-Max-Age: 86400');
    mcp_send(204);
}
if ($method !== 'POST') {
    // No server-sent event stream: the specification allows 405 for GET.
    header('Allow: POST, OPTIONS');
    http_response_code(405);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    echo "This is an MCP server (Streamable HTTP). Add this address to an AI assistant as a custom connector (remote MCP server).\n";
    exit;
}

$raw = file_get_contents('php://input', false, null, 0, MCP_MAX_BODY + 1);
if ($raw === false || strlen($raw) > MCP_MAX_BODY) mcp_send(413, ['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32600, 'message' => 'Request too large']]);
try {
    $msg = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    mcp_send(400, ['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32700, 'message' => 'Parse error']]);
}

// A batch (protocol 2025-03-26) gets an array of replies.
if (is_array($msg) && array_is_list($msg) && $msg !== []) {
    $replies = array_values(array_filter(array_map('mcp_handle', array_slice($msg, 0, 20))));
    $replies ? mcp_send(200, $replies) : mcp_send(202);
}
$reply = mcp_handle($msg);
$reply === null ? mcp_send(202) : mcp_send(200, $reply);

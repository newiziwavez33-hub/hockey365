<?php
// Optional PHP bridge for KHL schedule/score metadata only, never video URLs.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

function fail(int $status, string $message): never {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    fail(405, 'GET required');
}
if (isset($_GET['health'])) {
    if (!function_exists('curl_init')) fail(503, 'PHP cURL required');
    echo json_encode(['hockey365KhlProxy' => true]);
    exit;
}
$path = $_GET['path'] ?? '';
if (!is_string($path)) fail(400, 'Unsupported KHL endpoint');
$parts = explode('?', $path, 2);
if (!in_array($parts[0], ['data.json', 'events_v2.json', 'teams_v2.json'], true)) fail(400, 'Unsupported KHL endpoint');
$query = [];
if (isset($parts[1])) parse_str($parts[1], $query);
$allowed = ['stage_id', 'page', 'order_direction', 'q'];
foreach ($query as $key => $value) {
    if (!in_array($key, $allowed, true)) fail(400, 'Unsupported KHL parameter');
    if ($key === 'q') {
        if (!is_array($value)) fail(400, 'Invalid KHL filters');
        foreach ($value as $filter => $number) {
            if (!in_array($filter, ['start_at_gt_time_from_unixtime', 'start_at_lt_time_from_unixtime'], true) &&
                !($parts[0] === 'events_v2.json' && $filter === 'id_eq')) fail(400, 'Invalid KHL filters');
            if (!is_scalar($number) || !preg_match('/^\d{1,12}$/D', (string) $number)) fail(400, 'Invalid KHL filters');
        }
    } elseif ($key === 'order_direction') {
        if ($value !== 'asc') fail(400, 'Invalid KHL order');
    } elseif (!is_scalar($value) || !preg_match('/^\d{1,10}$/D', (string) $value)) {
        fail(400, 'Invalid KHL identifier');
    }
}
if (!function_exists('curl_init')) fail(503, 'PHP cURL required');
$url = 'https://khl.api.webcaster.pro/api/khl_mobile/' . $parts[0];
if ($query) $url .= '?' . http_build_query($query);
$body = '';
$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 8,
    CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: Hockey365/1.8.2'],
    CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
        if (strlen($body) + strlen($chunk) > 4 * 1024 * 1024) return 0;
        $body .= $chunk;
        return strlen($chunk);
    }
]);
$ok = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
if ($ok === false || $status !== 200) fail(502, 'KHL source unavailable');
try { $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR); }
catch (JsonException $error) { fail(502, 'Invalid KHL response'); }

function fields($value, array $keys): array {
    return is_array($value) ? array_intersect_key($value, array_flip($keys)) : [];
}
function team($value): array {
    return fields($value, ['id', 'khl_id', 'name', 'image', 'location', 'conference', 'division']);
}
// Only the public identity/schedule fields used by Hockey365 are forwarded.
// In particular, remove video, iframe, tickets, remote_ip and telemetry data.
if ($parts[0] === 'data.json') {
    if (!is_array($data) || !isset($data['current_stage_id'], $data['teams'])) fail(502, 'Invalid KHL metadata');
    $result = ['current_stage_id' => $data['current_stage_id'],
        'stages_v2' => array_map(static fn($stage) => fields($stage, ['id', 'season', 'type', 'title']), $data['stages_v2'] ?? []),
        'teams' => array_map('team', $data['teams'])];
} else {
    if (!is_array($data) || !array_is_list($data)) fail(502, 'Invalid KHL list');
    $result = array_map(static function ($row) use ($parts) {
        if ($parts[0] === 'teams_v2.json') return ['team' => team($row['team'] ?? null)];
        $event = $row['event'] ?? null;
        $clean = fields($event, ['id', 'match_id', 'khl_id', 'stage_id', 'type_id', 'game_state_key',
            'start_at', 'period', 'score', 'scores', 'stage_name']);
        $clean['team_a'] = team($event['team_a'] ?? null);
        $clean['team_b'] = team($event['team_b'] ?? null);
        return ['event' => $clean];
    }, $data);
}
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

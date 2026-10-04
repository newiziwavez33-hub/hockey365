<?php
// Optional PHP 8+ NHL bridge. No credentials, Node, database or build required.
// Only fixed official endpoints are accepted: never an arbitrary URL proxy.
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
    if (!function_exists('curl_init')) fail(503, 'PHP cURL extension required');
    echo json_encode(['hockey365NhlProxy' => true]);
    exit;
}

$path = $_GET['path'] ?? '';
if (!is_string($path) || !preg_match(
    '~^(schedule/(now|\d{4}-\d{2}-\d{2})|gamecenter/\d{10}/(boxscore|play-by-play)|player/\d{7}/landing)$~D',
    $path
)) {
    fail(400, 'Unsupported NHL endpoint');
}
if (!function_exists('curl_init')) fail(503, 'PHP cURL extension required');

$body = '';
$curl = curl_init('https://api-web.nhle.com/v1/' . $path);
curl_setopt_array($curl, [
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: Hockey365/1.8.1'],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
        if (strlen($body) + strlen($chunk) > 4 * 1024 * 1024) return 0;
        $body .= $chunk;
        return strlen($chunk);
    },
]);
$ok = curl_exec($curl);
$status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
curl_close($curl);
if ($ok === false || $status !== 200) fail(502, 'Official NHL source unavailable');
try {
    json_decode($body, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $error) {
    fail(502, 'Invalid official NHL response');
}
echo $body;

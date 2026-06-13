<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tablero de tests · Secretos</title>
    <style>
        :root {
            --bg: #f4f4f5; --card: #ffffff; --text: #18181b; --muted: #71717a;
            --border: #e4e4e7; --green: #16a34a; --red: #dc2626; --amber: #d97706;
            --green-bg: #dcfce7; --red-bg: #fee2e2; --track: #e4e4e7;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #09090b; --card: #18181b; --text: #fafafa; --muted: #a1a1aa;
                --border: #27272a; --green: #4ade80; --red: #f87171; --amber: #fbbf24;
                --green-bg: #052e16; --red-bg: #450a0a; --track: #27272a;
            }
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
        header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        h1 { font-size: 1.3rem; margin: 0; display: flex; align-items: center; gap: 8px; }
        .badge { font-weight: 700; padding: 4px 12px; border-radius: 999px; font-size: .85rem; }
        .badge.ok { background: var(--green-bg); color: var(--green); }
        .badge.fail { background: var(--red-bg); color: var(--red); }
        .meta { color: var(--muted); font-size: .85rem; margin: 2px 0 20px; }
        .meta code { background: var(--track); padding: 1px 6px; border-radius: 4px; }
        a.btn { margin-left: auto; text-decoration: none; color: var(--muted); border: 1px solid var(--border);
            padding: 6px 12px; border-radius: 8px; font-size: .85rem; }
        a.btn:hover { color: var(--text); }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
        .card h2 { font-size: .95rem; margin: 0 0 10px; }
        .big { font-size: 2rem; font-weight: 800; line-height: 1; }
        .big small { font-size: 1rem; color: var(--muted); font-weight: 500; }
        .stats { display: flex; gap: 14px; margin-top: 10px; font-size: .85rem; color: var(--muted); flex-wrap: wrap; }
        .stats b { color: var(--text); }
        .bar { height: 8px; border-radius: 999px; background: var(--track); overflow: hidden; margin-top: 12px; }
        .bar > span { display: block; height: 100%; }
        .section-title { font-size: 1rem; margin: 28px 0 10px; }
        details { background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; }
        summary { cursor: pointer; padding: 10px 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        summary .count { margin-left: auto; color: var(--muted); font-weight: 500; font-size: .85rem; }
        .test { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 32px; font-size: .85rem;
            border-top: 1px solid var(--border); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .test .dur { margin-left: auto; color: var(--muted); }
        .ico { width: 16px; text-align: center; font-weight: 700; }
        .pass { color: var(--green); } .failc { color: var(--red); } .skip { color: var(--muted); }
        .fail-item { background: var(--card); border: 1px solid var(--border); border-left: 3px solid var(--red);
            border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
        .fail-item .name { font-weight: 600; }
        .fail-item .msg { color: var(--muted); font-size: .82rem; margin-top: 4px;
            font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; }
        .empty { text-align: center; color: var(--muted); padding: 48px 16px; }
        .empty code { background: var(--track); padding: 2px 8px; border-radius: 6px; }
    </style>
</head>
<body>
<div class="wrap">
    <header>
        <h1>🧪 Tablero de tests</h1>
        @if ($hasReports)
            <span class="badge {{ $ok ? 'ok' : 'fail' }}">{{ $ok ? 'TODO VERDE' : 'HAY FALLOS' }}</span>
        @endif
        <a class="btn" href="">↻ Recargar</a>
    </header>

    @if ($generatedAt)
        <p class="meta">
            Generado: {{ \Illuminate\Support\Carbon::parse($generatedAt)->timezone(config('app.timezone'))->format('d/m/Y H:i:s') }}
            ({{ \Illuminate\Support\Carbon::parse($generatedAt)->diffForHumans() }}).
            Regenerar con <code>npm run test:report</code>.
        </p>
    @endif

    @if (! $hasReports)
        <div class="empty">
            <p>No hay reportes todavía.</p>
            <p>Generalos con <code>npm run test:report</code> y recargá esta página.</p>
        </div>
    @else
        @php
            $failures = [];
            foreach ($suites as $s) {
                foreach ($s['groups'] as $g) {
                    foreach ($g['tests'] as $t) {
                        if (in_array($t['status'], ['failed', 'error'], true)) {
                            $failures[] = ['suite' => $s['label'], 'group' => $g['name']] + $t;
                        }
                    }
                }
            }
        @endphp

        <div class="cards">
            @foreach ($suites as $s)
                @php $rate = $s['total'] ? round(100 * $s['passed'] / $s['total']) : 100; @endphp
                <div class="card">
                    <h2>{{ $s['label'] }}</h2>
                    <div class="big" style="color: {{ $s['failed'] + $s['errors'] === 0 ? 'var(--green)' : 'var(--red)' }}">
                        {{ $s['passed'] }}<small>/{{ $s['total'] }}</small>
                    </div>
                    <div class="stats">
                        <span><b>{{ $rate }}%</b> ok</span>
                        @if ($s['failed'] + $s['errors'] > 0)<span class="failc"><b>{{ $s['failed'] + $s['errors'] }}</b> fallos</span>@endif
                        @if ($s['skipped'] > 0)<span><b>{{ $s['skipped'] }}</b> omitidos</span>@endif
                        @if ($s['duration'] !== null)<span><b>{{ $s['duration'] }}</b>{{ str_contains($s['label'], 'PHPUnit') ? 's' : '' }}</span>@endif
                    </div>
                    <div class="bar">
                        <span style="width: {{ $rate }}%; background: {{ $s['failed'] + $s['errors'] === 0 ? 'var(--green)' : 'var(--amber)' }}"></span>
                    </div>
                </div>
            @endforeach
        </div>

        @if (count($failures))
            <h2 class="section-title" style="color: var(--red)">Fallos ({{ count($failures) }})</h2>
            @foreach ($failures as $f)
                <div class="fail-item">
                    <div class="name">{{ $f['suite'] }} · {{ $f['group'] }} › {{ $f['title'] }}</div>
                    @if (! empty($f['message']))<div class="msg">{{ $f['message'] }}</div>@endif
                </div>
            @endforeach
        @endif

        <h2 class="section-title">Detalle por archivo</h2>
        @foreach ($suites as $s)
            @foreach ($s['groups'] as $g)
                @php
                    $gFailed = collect($g['tests'])->filter(fn ($t) => in_array($t['status'], ['failed', 'error'], true))->count();
                @endphp
                <details @if ($gFailed) open @endif>
                    <summary>
                        <span class="ico {{ $gFailed ? 'failc' : 'pass' }}">{{ $gFailed ? '✗' : '✓' }}</span>
                        {{ $g['name'] }}
                        <span class="count">{{ count($g['tests']) }} tests</span>
                    </summary>
                    @foreach ($g['tests'] as $t)
                        <div class="test">
                            @if (in_array($t['status'], ['failed', 'error'], true))
                                <span class="ico failc">✗</span>
                            @elseif (in_array($t['status'], ['skipped', 'pending'], true))
                                <span class="ico skip">○</span>
                            @else
                                <span class="ico pass">✓</span>
                            @endif
                            <span>{{ $t['title'] }}</span>
                            @if ($t['duration'] !== null)<span class="dur">{{ $t['duration'] }} ms</span>@endif
                        </div>
                    @endforeach
                </details>
            @endforeach
        @endforeach
    @endif
</div>
</body>
</html>

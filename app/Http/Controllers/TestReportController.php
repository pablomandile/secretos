<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\File;

/**
 * Tablero de control (solo en local) que interpreta los reportes JSON generados
 * por `npm run test:report` (reports/summary.json, vitest.json, phpunit.json).
 * No forma parte del SPA: es una vista server-rendered aparte.
 */
class TestReportController extends Controller
{
    public function show(): View
    {
        abort_unless(app()->environment('local'), 404);

        $summary = $this->readJson('summary.json');
        $vitest = $this->readJson('vitest.json');
        $phpunit = $this->readJson('phpunit.json');

        $suites = [];
        if ($vitest) {
            $suites[] = $this->normalizeVitest($vitest);
        }
        if ($phpunit) {
            $suites[] = $this->normalizePhpunit($phpunit);
        }

        return view('test-report', [
            'hasReports' => $summary !== null || ! empty($suites),
            'generatedAt' => $summary['generatedAt'] ?? null,
            'ok' => collect($suites)->every(fn ($s) => $s['failed'] === 0 && $s['errors'] === 0),
            'suites' => $suites,
        ]);
    }

    private function readJson(string $file): ?array
    {
        $path = base_path("reports/{$file}");

        return File::exists($path) ? json_decode(File::get($path), true) : null;
    }

    private function normalizeVitest(array $json): array
    {
        $groups = collect($json['testResults'] ?? [])->map(fn ($file) => [
            'name' => basename($file['name'] ?? '—'),
            'tests' => collect($file['assertionResults'] ?? [])->map(fn ($a) => [
                'title' => trim(implode(' › ', array_filter([...($a['ancestorTitles'] ?? []), $a['title'] ?? '']))),
                'status' => $a['status'] ?? 'unknown',
                'duration' => isset($a['duration']) ? round($a['duration']) : null,
                'message' => null,
            ])->all(),
        ])->all();

        return [
            'label' => 'Vitest · frontend / crypto',
            'total' => $json['numTotalTests'] ?? 0,
            'passed' => $json['numPassedTests'] ?? 0,
            'failed' => $json['numFailedTests'] ?? 0,
            'errors' => 0,
            'skipped' => $json['numPendingTests'] ?? 0,
            'duration' => null,
            'groups' => $groups,
        ];
    }

    private function normalizePhpunit(array $json): array
    {
        $summary = $json['summary'] ?? [];
        $groups = collect($json['tests'] ?? [])
            ->groupBy(fn ($t) => $t['class'] ?? '—')
            ->map(fn ($tests, $class) => [
                'name' => class_basename($class),
                'tests' => collect($tests)->map(fn ($t) => [
                    'title' => $t['name'] ?? '',
                    'status' => $t['status'] ?? 'unknown',
                    'duration' => isset($t['time']) ? round($t['time'] * 1000) : null,
                    'message' => $t['message'] ?? null,
                ])->all(),
            ])->values()->all();

        return [
            'label' => 'PHPUnit · backend',
            'total' => $summary['total'] ?? 0,
            'passed' => $summary['passed'] ?? 0,
            'failed' => $summary['failed'] ?? 0,
            'errors' => $summary['errors'] ?? 0,
            'skipped' => $summary['skipped'] ?? 0,
            'duration' => isset($summary['time']) ? round($summary['time'], 2) : null,
            'groups' => $groups,
        ];
    }
}

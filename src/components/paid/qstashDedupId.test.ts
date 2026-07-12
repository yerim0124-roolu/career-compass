// qstashDedupId.test.ts — 실행: node --experimental-strip-types <file>
// QStash DeduplicationId 계약 가드: ':'가 들어가면 QStash가 400
// ("DeduplicationId cannot contain ':'")으로 publish를 거부한다(2026-07-13 production 장애).
// api/paid-job.ts의 deduplicationId가 `paid-analysis-<jobId>` 형식(콜론 없음)인지 소스 레벨로 고정한다.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '../../../api/paid-job.ts'), 'utf8');

let passed = 0;
const ok = (label: string, cond: boolean) => { assert.ok(cond, label); passed++; };

// 1) deduplicationId 지정이 존재하고, 정확히 `paid-analysis-${jobId}` 템플릿이다.
const assigns = [...src.matchAll(/deduplicationId:\s*(`[^`]*`|'[^']*'|"[^"]*")/g)].map((m) => m[1]);
ok('paid-job.ts에 deduplicationId 지정이 1개 존재', assigns.length === 1);
ok('deduplicationId 템플릿이 `paid-analysis-${jobId}`', assigns[0] === '`paid-analysis-${jobId}`');

// 2) 값 어디에도 콜론이 없다(접두사·구분자 포함).
ok("deduplicationId 값에 ':' 없음", !assigns[0].includes(':'));

// 3) 실제 jobId(uuid)로 전개한 값이 QStash가 거부하지 않는 문자만 포함한다.
const sample = `paid-analysis-${'18caccdc-c2ca-45f4-bbaa-0883ba512a69'}`;
ok('전개 값이 paid-analysis-<uuid> 형식', /^paid-analysis-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sample));
ok("전개 값에 ':' 없음", !sample.includes(':'));

console.log(`✓ qstashDedupId: ${passed} checks passed`);

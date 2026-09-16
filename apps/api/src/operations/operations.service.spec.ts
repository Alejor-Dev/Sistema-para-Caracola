import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OperationsService } from './operations.service';

let directory = '';
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); delete process.env.BACKUP_STATUS_FILE; directory = ''; });

describe('OperationsService', () => {
  it('reports never when no status exists', async () => {
    process.env.BACKUP_STATUS_FILE = join(tmpdir(), `missing-backup-${Date.now()}.json`);
    expect((await new OperationsService().backupStatus()).status).toBe('never');
  });

  it('marks a recent successful backup as healthy', async () => {
    directory = await mkdtemp(join(tmpdir(), 'crm-backup-'));
    process.env.BACKUP_STATUS_FILE = join(directory, 'status.json');
    await writeFile(process.env.BACKUP_STATUS_FILE, JSON.stringify({ status: 'ok', lastSuccessAt: new Date().toISOString(), snapshotId: 'abc123' }));
    const status = await new OperationsService().backupStatus();
    expect(status.status).toBe('ok');
    expect(status.snapshotId).toBe('abc123');
    expect(status.ageHours).toBeLessThan(1);
  });
});

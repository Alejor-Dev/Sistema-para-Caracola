import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';

export interface BackupStatus {
  status: 'ok' | 'warning' | 'failed' | 'never';
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  snapshotId: string | null;
  repository: string | null;
  ageHours: number | null;
  message: string;
}

@Injectable()
export class OperationsService {
  private readonly statusFile = process.env.BACKUP_STATUS_FILE ?? 'C:\\ProgramData\\CRM-LocalDeRopa\\state\\backup-status.json';

  async backupStatus(): Promise<BackupStatus> {
    try {
      const raw = JSON.parse(await readFile(this.statusFile, 'utf8')) as Partial<BackupStatus>;
      const lastSuccessAt = typeof raw.lastSuccessAt === 'string' ? raw.lastSuccessAt : null;
      const ageHours = lastSuccessAt ? Math.max(0, (Date.now() - new Date(lastSuccessAt).getTime()) / 3_600_000) : null;
      const stale = ageHours === null || ageHours > 26;
      return {
        status: raw.status === 'failed' ? 'failed' : stale ? 'warning' : 'ok',
        lastSuccessAt,
        lastAttemptAt: typeof raw.lastAttemptAt === 'string' ? raw.lastAttemptAt : null,
        snapshotId: typeof raw.snapshotId === 'string' ? raw.snapshotId : null,
        repository: typeof raw.repository === 'string' ? raw.repository : null,
        ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
        message: raw.status === 'failed' ? (raw.message ?? 'El último backup falló.') : stale ? 'No hay un backup reciente en las últimas 26 horas.' : 'Backup actualizado.',
      };
    } catch {
      return { status: 'never', lastSuccessAt: null, lastAttemptAt: null, snapshotId: null, repository: null, ageHours: null, message: 'Todavía no se registró ningún backup.' };
    }
  }
}

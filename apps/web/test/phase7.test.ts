import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 7 operations', () => {
  it('shows protected backup health in the dashboard', () => {
    const dashboard = read('../app/dashboard/page.tsx');
    expect(dashboard).toContain("session.permissions.includes('backups.manage')");
    expect(dashboard).toContain('/operations/backup-status');
    expect(dashboard).toContain('PROTECCIÓN DE DATOS');
  });

  it('keeps destructive restore explicitly opt-in and targets a new database', () => {
    const restore = read('../../../infrastructure/windows/backup/Restore-Crm.ps1');
    expect(restore).toContain('[switch]$Execute');
    expect(restore).toContain("if ($TargetDatabase -eq $config.database.name)");
    expect(restore).toContain('if (-not $Execute)');
  });

  it('preserves application data during default uninstall', () => {
    const uninstall = read('../../../infrastructure/windows/installer/Uninstall-Crm.ps1');
    expect(uninstall).toContain('[switch]$RemoveData');
    expect(uninstall).toContain('Data and backups were preserved');
  });

  it('requires checksums before install and update', () => {
    const install = read('../../../infrastructure/windows/installer/Install-Crm.ps1');
    const update = read('../../../infrastructure/windows/update/Update-Crm.ps1');
    expect(install).toContain('Test-CrmFileHash');
    expect(update).toContain('Test-CrmFileHash');
    expect(update).toContain('Update rolled back');
  });
});

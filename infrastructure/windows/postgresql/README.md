# PostgreSQL nativo para Windows

## Decisión

Producción utiliza PostgreSQL 17 x64 instalado directamente como servicio de Windows. No se usa Docker, WSL ni una máquina virtual. Esto reduce memoria, procesos en segundo plano, tiempo de arranque y puntos de fallo.

El instalador oficial de Windows permite instalación gráfica o silenciosa e incluye una opción específica para integrar PostgreSQL dentro de otro instalador. El paquete final del CRM instalará solamente:

- servidor PostgreSQL;
- herramientas de línea de comandos;
- runtime requerido.

No instalará pgAdmin ni StackBuilder en la PC del cliente.

## Seguridad de red

- `listen_addresses = '127.0.0.1'`.
- PostgreSQL no se publica en el firewall ni en Cloudflare Tunnel.
- `pg_hba.conf` permite solo loopback con `scram-sha-256`.
- El backend usa un rol propio sin `SUPERUSER`, `CREATEDB`, `CREATEROLE` ni `REPLICATION`.
- La contraseña se genera durante la instalación, se protege con ACL/DPAPI y nunca se escribe en logs.

## Flujo del instalador final

1. Verificar Windows x64, RAM, CPU, disco y permisos.
2. Verificar la firma y el hash del instalador oficial de PostgreSQL.
3. Instalar silenciosamente servidor y command-line tools.
4. Inicializar el rol `crm_app` y la base `crm_localderopa`.
5. Restringir escucha y autenticación a loopback/SCRAM.
6. Ejecutar `Optimize-Postgres.ps1` según el hardware real.
7. Aplicar migraciones con `prisma migrate deploy`.
8. Registrar backend y tareas de backup como servicios.
9. Ejecutar health checks antes de habilitar el acceso al usuario.

## Perfiles de recursos

El optimizador no intenta usar toda la PC. Reserva memoria para Windows, el frontend, el backend y el antivirus.

| RAM del equipo | `shared_buffers` | `effective_cache_size` | `work_mem` | Conexiones |
|---:|---:|---:|---:|---:|
| 4 GB | 512 MB | 1536 MB | 4 MB | 20 |
| 8 GB | 1024 MB | 4096 MB | 8 MB | 30 |
| 16 GB o más | 2048 MB | 8192 MB | 12 MB | 40 |

Son límites conservadores para una única sucursal. El pool del backend se mantendrá por debajo del límite de PostgreSQL.

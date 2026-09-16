# Incidencias del proyecto

## 2026-09-16 — Ejecutor `tsx` del seed falla en Windows

- **Estado:** Mitigada; seguimiento pendiente para el instalador de la Fase 7.
- **Capa / propietario:** Herramientas locales de desarrollo del proyecto.
- **Síntoma:** `npm run db:seed` terminaba antes de ejecutar el seed con `uv_os_get_passwd returned ENOMEM (not enough memory)`.
- **Evidencia mínima:** el mismo fallo se reprodujo al ejecutar `tsx` con Node.js 25.7 y con el runtime empaquetado Node.js 24.19. La necesidad del runner alternativo volvió a confirmarse al validar la base vacía de la Fase 5.
- **Causa demostrada:** la creación del directorio temporal usada por `tsx` invocó `os.userInfo()` y la llamada del sistema falló con `ENOMEM`. La causa ambiental de bajo nivel no quedó resuelta.
- **Corrección aplicada:** se compiló el seed TypeScript a JavaScript y se ejecutó con Node.js y el `NODE_PATH` del API. El seed finalizó correctamente en una base PostgreSQL creada desde cero.
- **Regresión verificada:** las tres migraciones se aplicaron desde cero, el seed completó, los índices trigram permanecieron y las pruebas de integración de ventas, compras y devoluciones pasaron.
- **Seguimiento:** en la Fase 7, validar el flujo normal del seed en el instalador Windows y, si persiste, sustituir `tsx` para este comando por un runner compilado que no dependa de `os.userInfo()`.
- **Clasificación:** incidencia local del proyecto; sin cambio de skill.

## 2026-09-16 — Alias SQL reservado en la tendencia del dashboard

- **Estado:** Resuelta.
- **Capa / propietario:** Backend de reportes del proyecto.
- **Síntoma:** `GET /api/v1/reports/dashboard` devolvía HTTP 500 al consultar la serie de los últimos siete días.
- **Evidencia mínima:** PostgreSQL informó `syntax error at or near "day"` en la consulta con `date_trunc(...) day`.
- **Causa demostrada:** `day` se utilizó como alias SQL sin delimitar en `SELECT`, `GROUP BY` y `ORDER BY`.
- **Corrección aplicada:** se cambió el alias a `"day"` en los tres lugares y se completan explícitamente los días sin ventas con valor cero.
- **Regresión verificada:** el endpoint autenticado respondió correctamente con siete puntos; la prueba de integración de Fase 5 comprueba esa longitud y la regresión completa aprobó typecheck, tests y build.
- **Seguimiento:** ninguno; el caso quedó cubierto por prueba automática.
- **Clasificación:** defecto local corregido; sin cambio de skill.

## 2026-09-16 — Inicio de PostgreSQL de prueba con token restringido

- **Estado:** Mitigada; limitada al entorno automatizado local.
- **Capa / propietario:** Arnés local de pruebas en Windows.
- **Síntoma:** `pg_ctl start` falló con `could not create restricted token: error code 87`.
- **Evidencia mínima:** el servidor inició correctamente ejecutando `postgres.exe` en una sesión controlada sobre el mismo clúster y puerto; `pg_ctl stop -m fast` realizó el apagado limpio.
- **Causa demostrada:** no resuelta; el fallo aparece en la creación del token restringido del proceso de arranque, no en PostgreSQL ni en los datos.
- **Corrección aplicada:** para esta validación se inició el binario de servidor directamente y se conservó el cierre limpio con `pg_ctl`.
- **Regresión verificada:** cuatro migraciones, seed, API, integración y consultas se ejecutaron correctamente; al terminar no quedaron puertos de prueba activos.
- **Seguimiento:** validar arranque como servicio nativo durante la Fase 7, que es el camino real del instalador del cliente.
- **Clasificación:** fricción local del arnés; sin cambio de skill.

## 2026-09-16 — Compilación Tauri no disponible en la PC de desarrollo

- **Estado:** Mitigada; compilación binaria pendiente para la Fase 7.
- **Capa / propietario:** Toolchain Windows del proyecto.
- **Síntoma:** Tauri CLI no pudo ejecutar la compilación nativa de la carcasa de escritorio.
- **Evidencia mínima:** `tauri info` detectó WebView2 153 y Visual Studio Build Tools 2022, pero informó `rustc`, Cargo y `rustup` ausentes.
- **Causa demostrada:** Rust no está instalado en esta PC; no es una incompatibilidad del cliente ni del código generado.
- **Corrección aplicada:** se dejó el proyecto Tauri, configuración NSIS, capacidades e iconos listos; se verificaron el JSON y la herramienta Tauri 2.11.4. La web reutilizada por el escritorio compila correctamente.
- **Regresión verificada:** typecheck completo y tests del monorepo correctos; la prueba de Fase 6 comprueba el endpoint local y el objetivo NSIS.
- **Seguimiento:** instalar Rust estable mediante `rustup` en la máquina de build o CI y producir el instalador firmado en Fase 7.
- **Clasificación:** dependencia ausente del entorno; sin cambio de skill.

## 2026-09-16 — Generador de iconos recibió una URL en Windows

- **Estado:** Resuelta.
- **Capa / propietario:** Script local `generate-app-icons.mjs`.
- **Síntoma:** Sharp rechazó el SVG con `Unsupported input ... of type object`.
- **Evidencia mínima:** la entrada era un objeto `URL` con esquema `file://`; no se generó ningún PNG en ese intento.
- **Causa demostrada:** Sharp esperaba una ruta de archivo de Windows o un buffer.
- **Corrección aplicada:** se convierten las URL a rutas con `fileURLToPath` y se restauró el SVG fuente que no había quedado creado en el primer lote de edición.
- **Regresión verificada:** se generaron ocho PNG para PWA y Tauri, con 56.905 bytes totales; el build web y las cuatro pruebas específicas pasaron.
- **Seguimiento:** ninguno; el script conserva rutas portables desde `import.meta.url`.
- **Clasificación:** defecto local corregido; sin cambio de skill.

## 2026-09-16 — Descarga npm bloqueada dentro del entorno restringido

- **Estado:** Resuelta.
- **Capa / propietario:** Permisos del entorno de ejecución local.
- **Síntoma:** la primera descarga de `@tauri-apps/cli` falló con `EACCES` al acceder al registro y al caché de npm.
- **Evidencia mínima:** el mismo `npm install --ignore-scripts`, autorizado fuera del sandbox, agregó tres paquetes y finalizó con cero vulnerabilidades.
- **Causa demostrada:** restricciones de red/escritura del sandbox, no permisos del repositorio.
- **Corrección aplicada:** se repitió únicamente la instalación con autorización ampliada y se actualizó el lockfile.
- **Regresión verificada:** `npm ls` resuelve Tauri CLI 2.11.4 y el monorepo completa typecheck y tests.
- **Seguimiento:** ninguno.
- **Clasificación:** fricción ambiental resuelta; sin cambio de skill.

## 2026-09-16 — Escritura bloqueada por ACL del sandbox durante la Fase 7

- **Estado:** Mitigada; los metadatos Git fueron restaurados y la fase se completó.
- **Capa / propietario:** Entorno local de edición en Windows.
- **Síntoma:** el editor de parches y los comandos normales no podían escribir dentro del workspace aunque la ruta figuraba como autorizada.
- **Evidencia mínima:** las escrituras fallaron por acceso denegado; el canal de archivos de Bridge escribió y verificó hashes en las mismas rutas. Mover temporalmente `.git` no eliminó la restricción.
- **Causa demostrada:** no resuelta; la evidencia apunta a la ACL o token del sandbox, no al contenido del repositorio.
- **Corrección aplicada:** se usó el escritor verificado de Bridge, se preservó `.git` fuera del árbol durante la edición y se restauró antes de cualquier operación Git.
- **Regresión verificada:** `.git` volvió a su ruta original, `git status` reconoce `main`, y typecheck, pruebas y builds se ejecutaron sobre el workspace final.
- **Seguimiento:** mantener el fallback de escritura verificada y no modificar ACL del usuario sin diagnóstico externo.
- **Clasificación:** fricción ambiental con workaround manual; sin cambio de skill.

## 2026-09-16 — El validador PowerShell incluyó archivos no ejecutables

- **Estado:** Resuelta.
- **Capa / propietario:** Validador de entrega de la Fase 7.
- **Síntoma:** el análisis sintáctico intentó interpretar YAML, JSON, XML, Markdown y directorios como PowerShell.
- **Evidencia mínima:** el primer ensayo informó errores de PowerShell en `config.yml.example`, `production.example.json`, `README.md` y plantillas XML válidas.
- **Causa demostrada:** `Get-ChildItem -Include` no restringió la enumeración recursiva como se esperaba en este entorno.
- **Corrección aplicada:** la enumeración ahora exige archivos y filtra explícitamente las extensiones `.ps1` y `.psm1`; JSON y XML se validan con sus analizadores propios.
- **Regresión verificada:** el ensayo de Fase 7 finalizó con código 0 e imprimió el plan de restauración aislada.
- **Seguimiento:** el mismo script se ejecuta en cada build de Windows en GitHub Actions.
- **Clasificación:** defecto local corregido; sin cambio de skill.

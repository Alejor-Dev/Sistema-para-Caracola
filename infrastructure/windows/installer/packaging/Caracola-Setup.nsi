Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!define PRODUCT_NAME "Caracola"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Caracola"
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\Caracola"
RequestExecutionLevel admin
SetCompressor lzma
SetCompressorDictSize 8
ShowInstDetails show
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Caracola.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar Caracola"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Caracola requiere Windows de 64 bits." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  SetRegView 64
  SetShellVarContext all
  ${DisableX64FSRedirection}
  StrCpy $INSTDIR "$PROGRAMFILES64\Caracola"
  ${If} ${FileExists} "$APPDATA\Caracola\config\production.json"
    MessageBox MB_OK|MB_ICONSTOP "Ya hay una configuracion de Caracola. Se conservan sus datos. Use el procedimiento de actualizacion." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
FunctionEnd

Section "Caracola completa"
  CreateDirectory "$APPDATA\Caracola"
  FileOpen $0 "$APPDATA\Caracola\install-progress.log" w
  FileWrite $0 "Inicio de instalacion ${PRODUCT_VERSION}$\r$\n"
  FileClose $0
  Delete "$APPDATA\Caracola\install-error.log"
  DetailPrint "Instalando archivos de Caracola..."
  SetOutPath "$INSTDIR\versions\${PRODUCT_VERSION}"
  File /r "${PAYLOAD}\*"
  ${IfNot} ${FileExists} "$INSTDIR\versions\${PRODUCT_VERSION}\release-manifest.json"
    MessageBox MB_OK|MB_ICONSTOP "El paquete de Caracola esta incompleto." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  File /oname=Caracola.exe "${DESKTOPEXE}"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  SetCompress off
  File /oname=postgresql.exe "${PGINSTALLER}"
  SetCompress auto
  DetailPrint "Configurando PostgreSQL y Caracola. Espere unos minutos..."
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\versions\${PRODUCT_VERSION}\infrastructure\windows\installer\Invoke-CaracolaSetup.ps1" -ReleasePath "$INSTDIR\versions\${PRODUCT_VERSION}" -PostgresInstaller "$PLUGINSDIR\postgresql.exe"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "No se completo la instalacion. El motivo esta en C:\ProgramData\Caracola\install-error.log y setup.log." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  SetOutPath "$INSTDIR"
  CreateShortCut "$SMPROGRAMS\Caracola.lnk" "$INSTDIR\Caracola.exe"
  CreateShortCut "$DESKTOP\Caracola.lnk" "$INSTDIR\Caracola.exe"
  WriteUninstaller "$INSTDIR\Uninstall-Caracola.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "Caracola"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\Caracola.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall-Caracola.exe$\""
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1
  DetailPrint "Caracola instalada y lista."
SectionEnd

Section "Uninstall"
  SetRegView 64
  SetShellVarContext all
  ${DisableX64FSRedirection}
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\current\infrastructure\windows\installer\Uninstall-Crm.ps1" -Unattended'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "No se pudieron desinstalar los servicios. Los datos se conservaron." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  Delete "$DESKTOP\Caracola.lnk"
  Delete "$SMPROGRAMS\Caracola.lnk"
  Delete "$INSTDIR\Uninstall-Caracola.exe"
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  RMDir "$INSTDIR"
SectionEnd

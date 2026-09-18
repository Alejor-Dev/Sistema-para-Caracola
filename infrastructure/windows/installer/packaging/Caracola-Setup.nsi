Unicode true

!include "MUI2.nsh"
!include "LogicLib.nsh"

!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.2.0"
!endif
!ifndef COMPANY_NAME
  !define COMPANY_NAME "Caracola"
!endif
!ifndef CRMPAYLOADZIP_BASENAME
  !define CRMPAYLOADZIP_BASENAME "payload.zip"
!endif
!ifndef BOOTSTRAP_DIR
  !define BOOTSTRAP_DIR "bootstrap"
!endif

!define PRODUCT_NAME "Caracola"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Caracola"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel admin

SetCompressor lzma

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Caracola.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar Caracola"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

Section "Caracola" SEC_APP
  SetOutPath "$INSTDIR"

  SetCompress auto
  File /oname=Caracola.exe "${DESKTOPEXE}"
  SetCompress off
  File /oname=payload.zip "${CRMPAYLOADZIP}"
  SetCompress auto

  CreateShortCut "$SMPROGRAMS\Caracola.lnk" "$INSTDIR\Caracola.exe"
  CreateShortCut "$DESKTOP\Caracola.lnk" "$INSTDIR\Caracola.exe"

  WriteUninstaller "$INSTDIR\Uninstall-Caracola.exe"

  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "${COMPANY_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\Caracola.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall-Caracola.exe$\""
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Servidor (PostgreSQL + Caracola)" SEC_SERVER
  IfFileExists "$INSTDIR\${CRMPAYLOADZIP_BASENAME}" 0 +2
  Goto +3
  MessageBox MB_OK|MB_ICONSTOP "Falta el paquete de datos del servidor. Reinstale el programa."
  Abort

  DetailPrint "Extrayendo paquete del servidor..."
  CreateDirectory "$INSTDIR\${BOOTSTRAP_DIR}"
  nsisunz::Unzip "$INSTDIR\${CRMPAYLOADZIP_BASENAME}" "$INSTDIR\${BOOTSTRAP_DIR}"
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "No se pudo extraer el paquete del servidor. Error $0."
    Abort
  ${EndIf}

  IfFileExists "$INSTDIR\${BOOTSTRAP_DIR}\release-manifest.json" 0 +2
  Goto +3
  MessageBox MB_OK|MB_ICONSTOP "El paquete del servidor está incompleto o dañado."
  Abort

  DetailPrint "Instalando PostgreSQL y Caracola (puede tardar varios minutos)..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\${BOOTSTRAP_DIR}\infrastructure\windows\installer\Complete-CrmInstall.ps1" -ReleasePath "$INSTDIR\${BOOTSTRAP_DIR}"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "La instalación del servidor no se completó. Revise los logs en C:\ProgramData\Caracola\logs."
    Abort
  ${EndIf}

  DetailPrint "Finalizando instalación..."
  Delete "$INSTDIR\${CRMPAYLOADZIP_BASENAME}"
  RMDir /r "$INSTDIR\${BOOTSTRAP_DIR}"
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\Caracola.exe"
  Delete "$INSTDIR\Uninstall-Caracola.exe"
  Delete "$SMPROGRAMS\Caracola.lnk"
  Delete "$DESKTOP\Caracola.lnk"
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  RMDir "$INSTDIR"
SectionEnd
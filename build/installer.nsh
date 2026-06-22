; Script NSIS custom para el instalador de VyM Scheduler.
;
; Agrega una pagina con el checkbox "Crear acceso directo en el escritorio"
; (marcado por defecto) entre la seleccion de carpeta y la instalacion.
; El acceso directo del Menu Inicio lo maneja electron-builder
; (createStartMenuShortcut: true). El de escritorio queda en manos del usuario:
; con createDesktopShortcut: false, electron-builder define
; DO_NOT_CREATE_DESKTOP_SHORTCUT y NO crea ninguno, asi que lo creamos aca
; segun el checkbox, reutilizando $appExe y $newDesktopLink de electron-builder.
;
; Todo va dentro de !ifndef BUILD_UNINSTALLER: electron-builder compila el
; instalador y el desinstalador en pasadas separadas e incluye este archivo en
; ambas. La pagina custom solo existe en el instalador (la inserta
; assistedInstaller.nsh dentro de su propio !ifndef BUILD_UNINSTALLER), asi que
; sin esta guarda las Function quedarian sin referencia en la pasada del
; desinstalador y makensis trata ese warning como error.

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER

Var CreateDesktopShortcutState
Var DesktopShortcutCheckbox

; Pagina custom insertada despues de elegir carpeta y antes de instalar.
!macro customPageAfterChangeDir
  Page custom DesktopShortcutPageCreate DesktopShortcutPageLeave
!macroend

Function DesktopShortcutPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 24u "Opciones de instalacion"
  Pop $0
  ${NSD_CreateCheckbox} 0 32u 100% 12u "Crear acceso directo en el escritorio"
  Pop $DesktopShortcutCheckbox
  ${NSD_Check} $DesktopShortcutCheckbox  ; marcado por defecto
  nsDialogs::Show
FunctionEnd

Function DesktopShortcutPageLeave
  ${NSD_GetState} $DesktopShortcutCheckbox $CreateDesktopShortcutState
FunctionEnd

; Corre dentro de la seccion de instalacion (despues de extraer los archivos).
!macro customInstall
  ${If} $CreateDesktopShortcutState == 1
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${EndIf}
!macroend

!endif

; Custom NSIS installer script for ash
; This script adds the installation directory to PATH during installation
; For Electron Forge with @felixrieseberg/electron-forge-maker-nsis

; ======== String find (returns index or "") ========
Function StrStr
  Exch $R1            ; needle
  Exch
  Exch $R2            ; haystack
  Push $R3
  Push $R4
  Push $R5
  StrLen $R3 $R1      ; len(needle)
  StrLen $R4 $R2      ; len(haystack)
  StrCpy $R5 0        ; index = 0
  loop:
    StrCmp $R5 $R4 not_found   ; Reached end, not found
    StrCpy $0 $R2 $R3 $R5      ; haystack[index .. index+len(needle)]
    StrCmp $0 $R1 found        ; Match found
    IntOp $R5 $R5 + 1
    Goto loop
  found:
    StrCpy $R1 $R5             ; Return index
    Goto done
  not_found:
    StrCpy $R1 ""              ; Return empty string if not found
  done:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Exch $R1
FunctionEnd

Function un.StrStr
  Exch $R1
  Exch
  Exch $R2
  Push $R3
  Push $R4
  Push $R5
  StrLen $R3 $R1
  StrLen $R4 $R2
  StrCpy $R5 0
  loop:
    StrCmp $R5 $R4 not_found
    StrCpy $0 $R2 $R3 $R5
    StrCmp $0 $R1 found
    IntOp $R5 $R5 + 1
    Goto loop
  found:
    StrCpy $R1 $R5
    Goto done
  not_found:
    StrCpy $R1 ""
  done:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Exch $R1
FunctionEnd

; ======== AddToPath ========
Function AddToPath
  Exch $0        ; $0 = new path entry (e.g., $INSTDIR)
  Push $1
  Push $2
  ReadRegStr $1 HKCU "Environment" "Path"
  
  ; If PATH is empty, add it directly
  StrCmp $1 "" 0 +3
    StrCpy $1 "$0"
    Goto write_path
  
  ; Add ; on both sides to prevent partial matches
  StrCpy $2 ";$1;"
  Push "$2"
  Push ";$0;"
  Call StrStr
  Pop $2
  StrCmp $2 "" 0 done      ; If already exists, done
  
  ; Otherwise, add it
  StrCpy $1 "$1;$0"
  
write_path:
  WriteRegExpandStr HKCU "Environment" "Path" "$1"
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=3000
  
done:
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; ======== RemoveFromPath ========
Function un.RemoveFromPath
  Exch $0        ; $0 = entry to remove ($INSTDIR)
  Push $1
  Push $2
  Push $3        ; Temporary variable
  ReadRegStr $1 HKCU "Environment" "Path"
  StrCmp $1 "" done
  
  ; Add ; on both sides to remove as ";path;" unit
  StrCpy $2 ";$1;"
  Push "$2"
  Push ";$0;"
  Call un.StrStr
  Pop $1
  StrCmp $1 "" done   ; If not found, done
  
  ; Rejoin front and back parts
  ; $1 = index of ";$0;"
  StrLen $3 ";$0;"    ; Store pattern length in $3 (preserve original $0 value)
  StrCpy $2 "$2" $1   ; Front part
  IntOp $1 $1 + $3    ; Index + pattern length
  StrCpy $3 "$2" "" $1  ; Store back part in $3
  StrCpy $1 "$2$3"    ; Front + back parts
  
  ; Remove leading/trailing semicolons
  StrCpy $2 "$1" 1
  StrCmp $2 ";" 0 +2
    StrCpy $1 "$1" "" 1
  StrCpy $2 "$1" "" -1
  StrCmp $2 ";" 0 +2
    StrCpy $1 "$1" -1
  
  WriteRegExpandStr HKCU "Environment" "Path" "$1"
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=3000
  
done:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; Add installation directory to PATH
; This section runs after files are installed
Section -Post
  Push $INSTDIR
  Call AddToPath
SectionEnd

; Remove installation directory from PATH
; This section runs during uninstallation
Section Uninstall
  Push $INSTDIR
  Call un.RemoveFromPath
SectionEnd


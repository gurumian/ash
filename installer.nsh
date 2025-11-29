; Custom NSIS installer script for ash
; This script adds the installation directory to PATH during installation

; Function to add to PATH
Function AddToPath
  Exch $0
  Push $1
  Push $2
  Push $3
  
  ; Read the current user PATH
  ReadRegStr $1 HKCU "Environment" "Path"
  
  ; Check if already in PATH
  Push "$1;"
  Push "$0;"
  Call StrStr
  Pop $2
  StrCmp $2 "" 0 AddToPath_done
  
  Push "$1;"
  Push "$0\;"
  Call StrStr
  Pop $2
  StrCmp $2 "" 0 AddToPath_done
  
  ; Add to PATH
  StrCpy $2 "$1;$0"
  WriteRegExpandStr HKCU "Environment" "Path" "$2"
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  
  AddToPath_done:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
FunctionEnd

; Function to find a string in another string
Function StrStr
  Exch $R1 ; st=haystack,old$R1, $R2=needle
  Exch    ; st=old$R1,haystack, $R2=needle
  Exch $R2 ; st=old$R1,old$R2, $R2=haystack, need=old$R1
  Push $R3
  Push $R4
  Push $R5
  StrLen $R3 $R1
  StrCpy $R4 0
  loop:
    StrCpy $R5 $R2 $R3 $R4
    StrCmp $R5 $R1 done
    StrCmp $R3 $R4 done
    IntOp $R4 $R4 + 1
    Goto loop
  done:
    StrCpy $R1 $R4
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Exch $R1
FunctionEnd

; Add installation directory to PATH
Section -Post
  ; Get installation directory
  Push $INSTDIR
  Call AddToPath
SectionEnd


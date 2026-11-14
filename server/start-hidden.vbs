Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
' Keep the scheduled Node gateway aligned with the Named Tunnel service URL.
shell.Environment("PROCESS")("PORT") = "8788"
shell.Run """node.exe"" """ & scriptDir & "\home-proxy.mjs""", 0, False

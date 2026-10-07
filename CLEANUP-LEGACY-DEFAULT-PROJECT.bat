@echo off
setlocal
del /Q "src\lib\default-project\override-default-project.sb3" 2>nul
del /Q "src\lib\default-project\02engine.svg" 2>nul
echo Legacy 02Engine starter project files removed.
endlocal

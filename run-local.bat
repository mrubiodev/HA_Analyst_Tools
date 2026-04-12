@echo off
echo Instalando dependencias...
call npm install

if %ERRORLEVEL% neq 0 (
    echo Error al instalar dependencias.
    pause
    exit /b 1
)

echo Levantando servicio en modo desarrollo...
call npm run dev

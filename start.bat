@echo off
echo ========================================
echo   FRNMINES - Запуск сервера
echo   Создано @fronzgg
echo ========================================
echo.

echo Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Node.js не установлен!
    echo Скачайте с https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js найден!
echo.

if not exist "node_modules" (
    echo Установка зависимостей...
    call npm install
    echo.
)

echo Запуск сервера...
echo.
echo Сервер будет доступен по адресу: http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo.

node server.js

pause

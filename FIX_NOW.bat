@echo off
echo ========================================
echo ИСПРАВЛЕНИЕ ТРАНЗАКЦИЙ
echo ========================================
echo.
echo Останавливаем сервер...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Создаем таблицу и настраиваем пользователя...
node create_transactions_table.js
echo.
echo ========================================
echo Теперь запусти сервер: node server.js
echo ========================================
pause

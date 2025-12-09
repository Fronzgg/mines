@echo off
echo Тестируем API...
echo.
echo 1. Проверяем сервер:
curl http://localhost:3000/api/users
echo.
echo.
echo 2. Проверяем транзакции для user 12345:
curl http://localhost:3000/api/transactions/12345
echo.
echo.
echo 3. Проверяем транзакции для user 1908053913 (Fronz):
curl http://localhost:3000/api/transactions/1908053913
echo.
pause

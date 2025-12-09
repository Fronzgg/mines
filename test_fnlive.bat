@echo off
echo ========================================
echo FN-Live Test Script
echo ========================================
echo.
echo Checking test user (ID: 12345)...
node fix_test_user.js
echo.
echo ========================================
echo Instructions:
echo 1. Start server: start.bat
echo 2. Login as ID 12345
echo 3. Play games and check server console
echo 4. Should see FN-Live ban messages
echo ========================================
pause

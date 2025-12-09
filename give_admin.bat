@echo off
echo Даем админку и баланс тестовому пользователю...
sqlite3 frnmines.db "UPDATE users SET balance = 100000, is_founder = 1, verified = 1 WHERE telegram_id = 12345;"
echo.
echo Проверяем результат:
sqlite3 frnmines.db "SELECT telegram_id, username, balance, is_founder, verified FROM users WHERE telegram_id = 12345;"
echo.
echo Готово! Перезагрузи страницу.
pause

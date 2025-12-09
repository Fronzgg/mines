@echo off
echo ========================================
echo НАСТРОЙКА ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ
echo ========================================
echo.

echo [1/4] Создаем таблицу transactions...
sqlite3 frnmines.db "CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, amount INTEGER, status TEXT DEFAULT 'completed', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
echo ✅ Таблица создана
echo.

echo [2/4] Даем админку и баланс пользователю 12345...
sqlite3 frnmines.db "UPDATE users SET balance = 100000, is_founder = 1, verified = 1 WHERE telegram_id = 12345;"
echo ✅ Админка и баланс выданы
echo.

echo [3/4] Добавляем тестовые транзакции...
sqlite3 frnmines.db "INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'deposit', 10000, 'completed');"
sqlite3 frnmines.db "INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'withdrawal', 5000, 'pending');"
sqlite3 frnmines.db "INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'deposit', 25000, 'completed');"
echo ✅ Тестовые транзакции добавлены
echo.

echo [4/4] Проверяем результат...
echo.
echo === ПОЛЬЗОВАТЕЛЬ ===
sqlite3 frnmines.db "SELECT telegram_id, username, balance, is_founder, verified FROM users WHERE telegram_id = 12345;"
echo.
echo === ТРАНЗАКЦИИ ===
sqlite3 frnmines.db "SELECT id, type, amount, status, created_at FROM transactions WHERE user_id = 12345;"
echo.

echo ========================================
echo ✅ ВСЕ ГОТОВО!
echo ========================================
echo.
echo Теперь:
echo 1. Перезапусти сервер (Ctrl+C, потом: node server.js)
echo 2. Перезагрузи страницу в браузере
echo 3. У тебя будет админка и транзакции!
echo.
pause

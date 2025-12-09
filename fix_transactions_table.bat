@echo off
echo Проверяем и создаем таблицу transactions...
echo.

echo 1. Проверяем существует ли таблица:
sqlite3 frnmines.db "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions';"
echo.

echo 2. Создаем таблицу если не существует:
sqlite3 frnmines.db "CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, amount INTEGER, status TEXT DEFAULT 'completed', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);"
echo.

echo 3. Проверяем структуру таблицы:
sqlite3 frnmines.db "PRAGMA table_info(transactions);"
echo.

echo 4. Добавляем тестовую транзакцию для user 12345:
sqlite3 frnmines.db "INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'deposit', 10000, 'completed');"
echo.

echo 5. Проверяем транзакции:
sqlite3 frnmines.db "SELECT * FROM transactions WHERE user_id = 12345;"
echo.

echo Готово! Перезапусти сервер.
pause

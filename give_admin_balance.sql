-- Дать админку и баланс тестовому пользователю (ID: 12345)

-- 1. Дать 100,000 баланса
UPDATE users SET balance = 100000 WHERE telegram_id = 12345;

-- 2. Сделать основателем (админка)
UPDATE users SET is_founder = 1 WHERE telegram_id = 12345;

-- 3. Верифицировать
UPDATE users SET verified = 1 WHERE telegram_id = 12345;

-- Проверить результат
SELECT telegram_id, username, balance, is_founder, verified FROM users WHERE telegram_id = 12345;

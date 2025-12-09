const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./frnmines.db');

console.log('🔧 Создаем таблицу transactions...\n');

db.serialize(() => {
    // Создаем таблицу transactions
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        amount INTEGER,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(telegram_id)
    )`, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы:', err);
        } else {
            console.log('✅ Таблица transactions создана');
        }
    });
    
    // Даем админку и баланс тестовому пользователю
    db.run(`UPDATE users SET balance = 100000, is_founder = 1, verified = 1 WHERE telegram_id = 12345`, (err) => {
        if (err) {
            console.error('❌ Ошибка обновления пользователя:', err);
        } else {
            console.log('✅ Админка и баланс выданы пользователю 12345');
        }
    });
    
    // Добавляем тестовые транзакции
    db.run(`INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'deposit', 10000, 'completed')`, (err) => {
        if (err && err.code !== 'SQLITE_CONSTRAINT') {
            console.error('❌ Ошибка добавления транзакции 1:', err);
        } else {
            console.log('✅ Транзакция 1 добавлена');
        }
    });
    
    db.run(`INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'withdrawal', 5000, 'pending')`, (err) => {
        if (err && err.code !== 'SQLITE_CONSTRAINT') {
            console.error('❌ Ошибка добавления транзакции 2:', err);
        } else {
            console.log('✅ Транзакция 2 добавлена');
        }
    });
    
    db.run(`INSERT INTO transactions (user_id, type, amount, status) VALUES (12345, 'deposit', 25000, 'completed')`, (err) => {
        if (err && err.code !== 'SQLITE_CONSTRAINT') {
            console.error('❌ Ошибка добавления транзакции 3:', err);
        } else {
            console.log('✅ Транзакция 3 добавлена');
        }
    });
    
    // Проверяем результат
    setTimeout(() => {
        console.log('\n📊 Проверяем результат:\n');
        
        db.get('SELECT telegram_id, username, balance, is_founder, verified FROM users WHERE telegram_id = 12345', (err, user) => {
            if (err) {
                console.error('❌ Ошибка:', err);
            } else if (user) {
                console.log('👤 Пользователь:', user);
            }
        });
        
        db.all('SELECT * FROM transactions WHERE user_id = 12345', (err, transactions) => {
            if (err) {
                console.error('❌ Ошибка:', err);
            } else {
                console.log('💰 Транзакции:', transactions);
            }
            
            console.log('\n✅ Готово! Перезапусти сервер (node server.js)\n');
            db.close();
        });
    }, 1000);
});

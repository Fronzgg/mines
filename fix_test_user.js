const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./frnmines.db');

console.log('🔧 Исправление тестового пользователя...');

// Убираем флаг is_founder с ID 12345
db.run(`UPDATE users SET is_founder = 0 WHERE telegram_id = 12345`, (err) => {
    if (err) {
        console.error('❌ Ошибка:', err);
    } else {
        console.log('✅ Флаг is_founder убран с ID 12345');
    }
    
    // Проверяем результат
    db.all(`SELECT telegram_id, username, is_founder, balance FROM users WHERE telegram_id IN (12345, 1908053913)`, (err, rows) => {
        if (err) {
            console.error('❌ Ошибка:', err);
        } else {
            console.log('\n📊 Пользователи:');
            rows.forEach(row => {
                console.log(`  ID: ${row.telegram_id}, Username: ${row.username}, Founder: ${row.is_founder}, Balance: ${row.balance}`);
            });
        }
        
        db.close();
    });
});

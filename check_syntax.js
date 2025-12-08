// Простая проверка синтаксиса
try {
    require('./server.js');
    console.log('✅ Синтаксис корректен!');
} catch (err) {
    console.error('❌ Ошибка синтаксиса:');
    console.error(err.message);
    console.error('\nСтрока:', err.stack.split('\n')[0]);
}

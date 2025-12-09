const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// База данных SQLite
const db = new sqlite3.Database('./frnmines.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err);
        process.exit(1);
    } else {
        console.log('✅ База данных подключена');
        console.log('📂 Путь к БД:', path.resolve('./frnmines.db'));
        
        // Проверяем существование таблиц
        checkTablesExist((exist) => {
            if (exist) {
                console.log('✅ Все таблицы уже существуют');
                loadSystemSettings();
            } else {
                console.log('⚙️ Инициализация таблиц...');
                initDatabase();
                setTimeout(loadSystemSettings, 1000);
            }
        });
    }
});

// Загрузка системных настроек
function loadSystemSettings() {
    db.all('SELECT key, value FROM system_settings', (err, rows) => {
        if (err) {
            console.error('Ошибка загрузки настроек:', err);
            return;
        }
        
        rows.forEach(row => {
            if (row.key === 'maintenance_mode') {
                systemSettings.maintenanceMode = row.value === 'true';
            } else if (row.key === 'fn_live_active') {
                systemSettings.fnLiveActive = row.value === 'true';
            }
        });
        
        console.log('✅ Настройки загружены:', systemSettings);
    });
}

// Проверка существования таблиц
function checkTablesExist(callback) {
    db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('users', 'promocodes', 'badges', 'game_history')", (err, result) => {
        if (err) {
            console.error('Ошибка проверки таблиц:', err);
            callback(false);
            return;
        }
        callback(result.count === 4);
    });
}

// Инициализация таблиц
function initDatabase() {
    // Создаем таблицы последовательно
    db.serialize(() => {
        // Таблица пользователей
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            photo_url TEXT,
            balance INTEGER DEFAULT 10000,
            verified INTEGER DEFAULT 0,
            is_founder INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы users:', err);
            } else {
                console.log('✅ Таблица users создана');
                
                // Добавляем основателя @Fronz
                db.run(`INSERT OR IGNORE INTO users (telegram_id, username, first_name, balance, verified, is_founder) 
                        VALUES (?, ?, ?, ?, ?, ?)`, 
                        [1908053913, 'Fronz', 'Fronz', 50000, 1, 1], (err) => {
                    if (err) {
                        console.error('Ошибка добавления основателя:', err);
                    } else {
                        console.log('✅ Основатель @Fronz добавлен');
                    }
                });
            }
        });

        // Таблица транзакций (пополнения и выводы)
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT, -- 'deposit' или 'withdrawal'
            amount INTEGER,
            method TEXT,
            wallet TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы transactions:', err);
            } else {
                console.log('✅ Таблица transactions создана');
            }
        });

        // Таблица промокодов
        db.run(`CREATE TABLE IF NOT EXISTS promocodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            amount INTEGER,
            used_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (used_by) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы promocodes:', err);
            } else {
                console.log('✅ Таблица promocodes создана');
                
                // Добавляем стандартные промокоды
                const defaultPromos = [
                    ['WELCOME500', 500],
                    ['MINES1000', 1000],
                    ['BONUS2024', 1500],
                    ['FRONZGG', 5000]
                ];

                defaultPromos.forEach(([code, amount]) => {
                    db.run(`INSERT OR IGNORE INTO promocodes (code, amount) VALUES (?, ?)`, [code, amount], (err) => {
                        if (err) {
                            console.error(`Ошибка добавления промокода ${code}:`, err);
                        }
                    });
                });
                
                console.log('✅ Промокоды добавлены');
            }
        });

        // Таблица бейджей
        db.run(`CREATE TABLE IF NOT EXISTS badges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            badge_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы badges:', err);
            } else {
                console.log('✅ Таблица badges создана');
            }
        });

        // Таблица истории игр
        db.run(`CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            game_type TEXT,
            bet_amount INTEGER,
            win_amount INTEGER,
            multiplier REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы game_history:', err);
            } else {
                console.log('✅ Таблица game_history создана');
            }
        });

        // Таблица FN-Live блокировок
        db.run(`CREATE TABLE IF NOT EXISTS fn_live_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            reason TEXT,
            blocked_until DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы fn_live_blocks:', err);
            } else {
                console.log('✅ Таблица fn_live_blocks создана');
            }
        });

        // Таблица настроек системы
        db.run(`CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы system_settings:', err);
            } else {
                console.log('✅ Таблица system_settings создана');
                
                // Добавляем начальные настройки
                db.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('maintenance_mode', 'false')`);
                db.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('fn_live_active', 'true')`);
            }
        });

        // Таблица ежедневных бонусов
        db.run(`CREATE TABLE IF NOT EXISTS daily_bonuses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            amount INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы daily_bonuses:', err);
            } else {
                console.log('✅ Таблица daily_bonuses создана');
            }
        });

        // Таблицы для онлайн ракеты
        db.run(`CREATE TABLE IF NOT EXISTS rocket_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            multiplier REAL DEFAULT 1.0,
            crash_point REAL,
            status TEXT DEFAULT 'betting',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            started_at DATETIME,
            crashed_at DATETIME
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы rocket_games:', err);
            } else {
                console.log('✅ Таблица rocket_games создана');
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS rocket_bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            user_id INTEGER,
            bet_amount INTEGER,
            cashout_multiplier REAL,
            win_amount INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES rocket_games(id),
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы rocket_bets:', err);
            } else {
                console.log('✅ Таблица rocket_bets создана');
            }
        });

        // Таблицы для онлайн рулетки
        db.run(`CREATE TABLE IF NOT EXISTS roulette_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            result_number INTEGER,
            status TEXT DEFAULT 'betting',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            started_at DATETIME,
            finished_at DATETIME
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы roulette_games:', err);
            } else {
                console.log('✅ Таблица roulette_games создана');
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS roulette_bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            user_id INTEGER,
            bet_type TEXT,
            bet_value TEXT,
            bet_amount INTEGER,
            win_amount INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES roulette_games(id),
            FOREIGN KEY (user_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы roulette_bets:', err);
            } else {
                console.log('✅ Таблица roulette_bets создана');
            }
        });
    });
}

// Хранилище активных WebSocket соединений
const clients = new Map(); // telegram_id -> ws

// Системные настройки (кэш)
let systemSettings = {
    maintenanceMode: false,
    fnLiveActive: true
};

// Текущие онлайн игры
let currentRocketGame = null;
let currentRouletteGame = null;

// WebSocket соединение
wss.on('connection', (ws) => {
    console.log('🔌 Новое WebSocket соединение');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(ws, data);
        } catch (err) {
            console.error('Ошибка обработки сообщения:', err);
        }
    });

    ws.on('close', () => {
        // Удаляем клиента из списка активных
        for (const [userId, client] of clients.entries()) {
            if (client === ws) {
                clients.delete(userId);
                console.log(`👋 Пользователь ${userId} отключился`);
                broadcastOnlineCount();
                break;
            }
        }
    });
});

// Обработка WebSocket сообщений
function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'auth':
            handleAuth(ws, data);
            break;
        case 'update_balance':
            handleUpdateBalance(ws, data);
            break;
        case 'game_result':
            handleGameResult(ws, data);
            break;
        case 'use_promo':
            handleUsePromo(ws, data);
            break;
        case 'get_transactions':
            handleGetTransactions(ws, data);
            break;
        default:
            console.log('Неизвестный тип сообщения:', data.type);
    }
}

// Авторизация пользователя
function handleAuth(ws, data) {
    const { telegram_id, username, first_name, last_name, photo_url } = data;

    // Проверяем, что таблица существует
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, table) => {
        if (err || !table) {
            console.error('Таблица users не существует, инициализируем БД...');
            initDatabase();
            setTimeout(() => handleAuth(ws, data), 1000);
            return;
        }

        db.get('SELECT * FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
            if (err) {
                console.error('Ошибка получения пользователя:', err);
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка БД' }));
                return;
            }

            if (user) {
                // Проверяем блокировку FN-Live
                db.get(`SELECT * FROM fn_live_blocks 
                        WHERE user_id = ? AND blocked_until > datetime('now') 
                        ORDER BY created_at DESC LIMIT 1`, 
                    [telegram_id], (err, block) => {
                    
                    const blockInfo = block ? {
                        blocked: true,
                        reason: block.reason,
                        blockedUntil: block.blocked_until
                    } : {
                        blocked: false
                    };
                    // Обновляем время последней активности
                    db.run('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?', [telegram_id]);
                    
                    // Получаем бейджи пользователя
                    db.all('SELECT badge_type FROM badges WHERE user_id = ?', [telegram_id], (err, badges) => {
                        const badgeTypes = badges ? badges.map(b => b.badge_type) : [];
                        
                        clients.set(telegram_id, ws);
                        ws.userId = telegram_id;
                        
                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            user: {
                                ...user,
                                badges: badgeTypes,
                                fnLiveBlock: blockInfo
                            },
                            systemSettings: systemSettings
                        }));

                        broadcastOnlineCount();
                        broadcastSystemStatus();
                        console.log(`✅ Пользователь ${username} (${telegram_id}) авторизован`);
                    });
                });
            } else {
                // Создаем нового пользователя
                db.run(`INSERT INTO users (telegram_id, username, first_name, last_name, photo_url) 
                        VALUES (?, ?, ?, ?, ?)`,
                    [telegram_id, username, first_name, last_name, photo_url],
                    function(err) {
                        if (err) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Ошибка создания пользователя' }));
                            return;
                        }

                        // Выдаем базовый бейдж
                        db.run('INSERT INTO badges (user_id, badge_type) VALUES (?, ?)', [telegram_id, 'player']);

                        clients.set(telegram_id, ws);
                        ws.userId = telegram_id;

                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            user: {
                                telegram_id,
                                username,
                                first_name,
                                last_name,
                                photo_url,
                                balance: 10000,
                                verified: 0,
                                is_founder: 0,
                                badges: ['player'],
                                fnLiveBlock: { blocked: false }
                            },
                            systemSettings: systemSettings
                        }));

                        broadcastOnlineCount();
                        broadcastSystemStatus();
                        console.log(`🆕 Новый пользователь ${username} (${telegram_id}) зарегистрирован`);
                    }
                );
            }
        });
    });
}

// Обновление баланса
function handleUpdateBalance(ws, data) {
    const { telegram_id, balance } = data;

    db.run('UPDATE users SET balance = ? WHERE telegram_id = ?', [balance, telegram_id], (err) => {
        if (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Ошибка обновления баланса' }));
            return;
        }

        ws.send(JSON.stringify({ type: 'balance_updated', balance }));
    });
}

// Получение транзакций пользователя
function handleGetTransactions(ws, data) {
    const { telegram_id } = data;

    db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, 
        [telegram_id], (err, transactions) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: 'Ошибка получения транзакций' }));
                return;
            }

            ws.send(JSON.stringify({
                type: 'transactions_list',
                transactions: transactions
            }));
        }
    );
}

// Сохранение результата игры
function handleGameResult(ws, data) {
    const { telegram_id, game_type, bet_amount, win_amount, multiplier } = data;

    db.run(`INSERT INTO game_history (user_id, game_type, bet_amount, win_amount, multiplier) 
            VALUES (?, ?, ?, ?, ?)`,
        [telegram_id, game_type, bet_amount, win_amount, multiplier],
        (err) => {
            if (err) {
                console.error('Ошибка сохранения истории игры:', err);
            }
        }
    );
}

// Использование промокода
function handleUsePromo(ws, data) {
    const { telegram_id, code } = data;

    db.get('SELECT * FROM promocodes WHERE code = ?', [code.toUpperCase()], (err, promo) => {
        if (err || !promo) {
            ws.send(JSON.stringify({ type: 'promo_error', message: 'Промокод не найден' }));
            return;
        }

        if (promo.used_by) {
            ws.send(JSON.stringify({ type: 'promo_error', message: 'Промокод уже использован' }));
            return;
        }

        // Обновляем промокод и баланс
        db.run('UPDATE promocodes SET used_by = ? WHERE code = ?', [telegram_id, code.toUpperCase()]);
        db.run('UPDATE users SET balance = balance + ? WHERE telegram_id = ?', [promo.amount, telegram_id], (err) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'promo_error', message: 'Ошибка активации' }));
                return;
            }

            db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
                ws.send(JSON.stringify({
                    type: 'promo_success',
                    amount: promo.amount,
                    new_balance: user.balance
                }));
            });
        });
    });
}

// Отправка количества онлайн пользователей
function broadcastOnlineCount() {
    const count = clients.size;
    broadcast({ type: 'online_count', count });
}

// Отправка системного статуса всем
function broadcastSystemStatus() {
    broadcast({ 
        type: 'system_status', 
        settings: systemSettings 
    });
}

// Broadcast сообщение всем подключенным клиентам
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// REST API endpoints

// Получить всех пользователей (для админ-панели)
app.get('/api/users', (req, res) => {
    db.all(`SELECT u.*, GROUP_CONCAT(b.badge_type) as badges 
            FROM users u 
            LEFT JOIN badges b ON u.telegram_id = b.user_id 
            GROUP BY u.telegram_id 
            ORDER BY u.last_active DESC`, 
        (err, users) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка БД' });
                return;
            }
            res.json(users.map(u => ({
                ...u,
                badges: u.badges ? u.badges.split(',') : []
            })));
        }
    );
});

// Получить транзакции пользователя
app.get('/api/transactions/:telegram_id', (req, res) => {
    const telegram_id = parseInt(req.params.telegram_id);
    
    db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, 
        [telegram_id], (err, transactions) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка БД' });
                return;
            }
            res.json(transactions);
        }
    );
});

// Админ: Отправить сообщение всем
app.post('/api/admin/broadcast', (req, res) => {
    const { admin_id, message } = req.body;

    // Проверяем, что это основатель
    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        broadcast({
            type: 'admin_message',
            message
        });

        res.json({ success: true });
    });
});

// Админ: Выдать бейдж
app.post('/api/admin/give-badge', (req, res) => {
    const { admin_id, user_id, badge_type } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        db.run('INSERT INTO badges (user_id, badge_type) VALUES (?, ?)', [user_id, badge_type], (err) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка выдачи бейджа' });
                return;
            }

            // Уведомляем пользователя
            const userWs = clients.get(user_id);
            if (userWs) {
                userWs.send(JSON.stringify({
                    type: 'badge_received',
                    badge_type
                }));
            }

            res.json({ success: true });
        });
    });
});

// Админ: Изменить баланс
app.post('/api/admin/change-balance', (req, res) => {
    const { admin_id, user_id, amount } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        db.run('UPDATE users SET balance = balance + ? WHERE telegram_id = ?', [amount, user_id], (err) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка изменения баланса' });
                return;
            }

            db.get('SELECT balance FROM users WHERE telegram_id = ?', [user_id], (err, updatedUser) => {
                // Уведомляем пользователя
                const userWs = clients.get(user_id);
                if (userWs) {
                    userWs.send(JSON.stringify({
                        type: 'balance_changed',
                        new_balance: updatedUser.balance,
                        change: amount
                    }));
                }

                res.json({ success: true, new_balance: updatedUser.balance });
            });
        });
    });
});

// Админ: Добавить промокод
app.post('/api/admin/add-promo', (req, res) => {
    const { admin_id, code, amount } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        db.run('INSERT INTO promocodes (code, amount) VALUES (?, ?)', [code.toUpperCase(), amount], (err) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка добавления промокода' });
                return;
            }

            res.json({ success: true });
        });
    });
});

// Админ: FN-LIVE система (блокировка игры с таймером)
app.post('/api/admin/fn-live-block', (req, res) => {
    const { admin_id, user_id, reason, duration } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // Рассчитываем время блокировки
        const durationMinutes = duration || 10;
        const blockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

        // Сохраняем блокировку в БД
        db.run(`INSERT INTO fn_live_blocks (user_id, reason, blocked_until) VALUES (?, ?, ?)`,
            [user_id, reason || 'Система FN-Live посчитала ваши действия необычными', blockedUntil],
            (err) => {
                if (err) {
                    res.status(500).json({ error: 'Ошибка сохранения блокировки' });
                    return;
                }

                // Отправляем блокировку пользователю
                const userWs = clients.get(user_id);
                if (userWs) {
                    userWs.send(JSON.stringify({
                        type: 'fn_live_block',
                        reason: reason || 'Система FN-Live посчитала ваши действия необычными',
                        blockedUntil: blockedUntil,
                        duration: durationMinutes
                    }));
                }

                res.json({ 
                    success: true, 
                    message: `Блокировка на ${durationMinutes} минут установлена`,
                    blockedUntil: blockedUntil
                });
            }
        );
    });
});

// Админ: Снять FN-Live блокировку
app.post('/api/admin/fn-live-unblock', (req, res) => {
    const { admin_id, user_id } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // Удаляем все блокировки пользователя
        db.run(`DELETE FROM fn_live_blocks WHERE user_id = ?`, [user_id], (err) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка снятия блокировки' });
                return;
            }

            // Уведомляем пользователя
            const userWs = clients.get(user_id);
            if (userWs) {
                userWs.send(JSON.stringify({
                    type: 'fn_live_unblock'
                }));
            }

            res.json({ success: true, message: 'Блокировка снята' });
        });
    });
});

// Админ: Технический перерыв (отключение всех игр)
app.post('/api/admin/maintenance', (req, res) => {
    const { admin_id, enabled, message } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        systemSettings.maintenanceMode = enabled;

        // Сохраняем в БД
        db.run(`UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'maintenance_mode'`,
            [enabled ? 'true' : 'false'],
            (err) => {
                if (err) {
                    res.status(500).json({ error: 'Ошибка сохранения настроек' });
                    return;
                }

                // Уведомляем всех пользователей
                broadcast({
                    type: 'maintenance_mode',
                    enabled: enabled,
                    message: message || (enabled ? 'Технический перерыв. Игры временно недоступны.' : 'Технический перерыв завершен!')
                });

                broadcastSystemStatus();

                res.json({ 
                    success: true, 
                    message: enabled ? 'Технический перерыв включен' : 'Технический перерыв выключен'
                });
            }
        );
    });
});

// Админ: Добавить транзакцию пользователю
app.post('/api/admin/add-transaction', (req, res) => {
    const { admin_id, user_id, type, amount, method, wallet } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // Добавляем транзакцию
        db.run(`INSERT INTO transactions (user_id, type, amount, method, wallet, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, type, amount, method, wallet, 'completed'], (err) => {
                if (err) {
                    res.status(500).json({ error: 'Ошибка добавления транзакции' });
                    return;
                }

                // Обновляем баланс пользователя
                const balanceChange = type === 'deposit' ? amount : -amount;
                db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                    [balanceChange, user_id], (err) => {
                        if (err) {
                            res.status(500).json({ error: 'Ошибка обновления баланса' });
                            return;
                        }

                        // Уведомляем пользователя
                        const userWs = clients.get(user_id);
                        if (userWs) {
                            userWs.send(JSON.stringify({
                                type: 'balance_changed',
                                new_balance: user.balance + balanceChange,
                                change: balanceChange
                            }));
                        }

                        res.json({ success: true });
                    }
                );
            }
        );
    });
});

// Ежедневный бонус
app.post('/api/daily-bonus', (req, res) => {
    const { telegram_id } = req.body;

    // Проверяем последний бонус
    db.get(`SELECT * FROM daily_bonuses WHERE user_id = ? ORDER BY claimed_at DESC LIMIT 1`,
        [telegram_id], (err, lastBonus) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка БД' });
                return;
            }

            // Проверяем прошло ли 24 часа
            if (lastBonus) {
                const lastClaimed = new Date(lastBonus.claimed_at);
                const now = new Date();
                const hoursPassed = (now - lastClaimed) / (1000 * 60 * 60);

                if (hoursPassed < 24) {
                    const hoursLeft = 24 - hoursPassed;
                    res.json({
                        success: false,
                        message: 'Бонус уже получен',
                        nextBonusIn: hoursLeft * 60 * 60 * 1000
                    });
                    return;
                }
            }

            // Выдаем бонус
            const bonusAmount = 150;
            
            db.run(`INSERT INTO daily_bonuses (user_id, amount) VALUES (?, ?)`,
                [telegram_id, bonusAmount], (err) => {
                    if (err) {
                        res.status(500).json({ error: 'Ошибка сохранения бонуса' });
                        return;
                    }

                    // Обновляем баланс
                    db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                        [bonusAmount, telegram_id], (err) => {
                            if (err) {
                                res.status(500).json({ error: 'Ошибка обновления баланса' });
                                return;
                            }

                            // Получаем новый баланс
                            db.get(`SELECT balance FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
                                // Уведомляем пользователя через WebSocket
                                const userWs = clients.get(telegram_id);
                                if (userWs) {
                                    userWs.send(JSON.stringify({
                                        type: 'daily_bonus_claimed',
                                        amount: bonusAmount,
                                        new_balance: user.balance
                                    }));
                                }

                                res.json({
                                    success: true,
                                    amount: bonusAmount,
                                    new_balance: user.balance,
                                    nextBonusIn: 24 * 60 * 60 * 1000
                                });
                            });
                        }
                    );
                }
            );
        }
    );
});

// Проверка доступности бонуса
app.get('/api/daily-bonus/check/:telegram_id', (req, res) => {
    const telegram_id = parseInt(req.params.telegram_id);

    db.get(`SELECT * FROM daily_bonuses WHERE user_id = ? ORDER BY claimed_at DESC LIMIT 1`,
        [telegram_id], (err, lastBonus) => {
            if (err) {
                res.status(500).json({ error: 'Ошибка БД' });
                return;
            }

            if (!lastBonus) {
                res.json({ available: true, nextBonusIn: 0 });
                return;
            }

            const lastClaimed = new Date(lastBonus.claimed_at);
            const now = new Date();
            const hoursPassed = (now - lastClaimed) / (1000 * 60 * 60);

            if (hoursPassed >= 24) {
                res.json({ available: true, nextBonusIn: 0 });
            } else {
                const hoursLeft = 24 - hoursPassed;
                res.json({
                    available: false,
                    nextBonusIn: hoursLeft * 60 * 60 * 1000
                });
            }
        }
    );
});

// Админ: Переключение FN-Live системы
app.post('/api/admin/fn-live-toggle', (req, res) => {
    const { admin_id, enabled } = req.body;

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        systemSettings.fnLiveActive = enabled;

        // Сохраняем в БД
        db.run(`UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'fn_live_active'`,
            [enabled ? 'true' : 'false'],
            (err) => {
                if (err) {
                    res.status(500).json({ error: 'Ошибка сохранения настроек' });
                    return;
                }

                broadcastSystemStatus();

                res.json({ 
                    success: true, 
                    message: enabled ? 'FN-Live система включена' : 'FN-Live система выключена'
                });
            }
        );
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Откройте http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Остановка сервера...');
    
    // Закрываем все WebSocket соединения
    clients.forEach((ws) => {
        ws.close();
    });
    
    // Закрываем базу данных
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия БД:', err);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Остановка сервера...');
    
    clients.forEach((ws) => {
        ws.close();
    });
    
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия БД:', err);
        }
        process.exit(0);
    });
});
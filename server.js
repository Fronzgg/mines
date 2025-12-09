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
        
        // Таблица реферальной системы
        db.run(`CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER,
            referred_id INTEGER,
            referrer_ip TEXT,
            referred_ip TEXT,
            reward_given INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users(telegram_id),
            FOREIGN KEY (referred_id) REFERENCES users(telegram_id)
        )`, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы referrals:', err);
            } else {
                console.log('✅ Таблица referrals создана');
            }
        });

        // Таблица транзакций (пополнения/выводы)
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
                console.error('Ошибка создания таблицы transactions:', err);
            } else {
                console.log('✅ Таблица transactions создана');
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
let rocketGameInterval = null;
let rouletteGameInterval = null;

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
    console.log(`📨 WebSocket сообщение: type=${data.type}, user=${data.telegram_id || 'unknown'}`);
    
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

// Сохранение результата игры
function handleGameResult(ws, data) {
    const { telegram_id, game_type, bet_amount, win_amount, multiplier } = data;
    console.log(`🎮 Результат игры: user=${telegram_id}, game=${game_type}, bet=${bet_amount}, win=${win_amount}, mult=${multiplier}`);

    db.run(`INSERT INTO game_history (user_id, game_type, bet_amount, win_amount, multiplier) 
            VALUES (?, ?, ?, ?, ?)`,
        [telegram_id, game_type, bet_amount, win_amount, multiplier],
        (err) => {
            if (err) {
                console.error('❌ Ошибка сохранения истории игры:', err);
            } else {
                console.log(`✅ История игры сохранена, запускаем FN-Live проверку...`);
                // Проверяем FN-Live после каждой игры
                checkFNLiveViolations(telegram_id, win_amount);
            }
        }
    );
}

// FN-Live автоматические проверки
function checkFNLiveViolations(telegram_id, lastWinAmount) {
    console.log(`🛡️ FN-Live проверка: user=${telegram_id}, lastWin=${lastWinAmount}`);
    
    // Проверяем баланс пользователя
    db.get('SELECT balance, is_founder FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
        if (err || !user) {
            console.log(`❌ Пользователь не найден: ${telegram_id}`);
            return;
        }
        
        // Пропускаем проверки ТОЛЬКО для основателя @Fronz (ID: 1908053913)
        // ID 12345 (тестовый) будет проверяться!
        if (user.is_founder && telegram_id === 1908053913) {
            console.log(`👑 Основатель @Fronz (${telegram_id}) - пропускаем проверки`);
            return;
        }
        
        console.log(`💰 Баланс пользователя ${telegram_id}: ${user.balance}`);
        
        // ═══════════════════════════════════════════════════════════
        // ПРОВЕРКА 1: Баланс > 100,000 (МГНОВЕННЫЙ БАН)
        // ═══════════════════════════════════════════════════════════
        if (user.balance > 100000) {
            console.log(`🚨 НАРУШЕНИЕ: Баланс ${user.balance} > 100,000`);
            autoBlockUser(telegram_id, 'Баланс превысил 100,000 FCOINS - подозрение на эксплоит', 600);
            return;
        }
        
        // ═══════════════════════════════════════════════════════════
        // ПРОВЕРКА 4: Подозрительный винрейт (последние 10 игр)
        // ═══════════════════════════════════════════════════════════
        db.all(`SELECT win_amount, bet_amount, multiplier
                FROM game_history 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10`,
            [telegram_id], (err, games) => {
                if (err || !games || games.length < 5) return;
                
                const wins = games.filter(g => g.win_amount > g.bet_amount).length;
                const winRate = (wins / games.length) * 100;
                const totalProfit = games.reduce((sum, g) => sum + (g.win_amount - g.bet_amount), 0);
                
                console.log(`🎲 Последние ${games.length} игр: ${wins} побед (${winRate.toFixed(0)}% винрейт), прибыль: ${totalProfit}`);
                
                // Если 8+ побед из 10 игр = БАН
                if (games.length >= 10 && wins >= 8) {
                    console.log(`🚨 НАРУШЕНИЕ: ${wins}/10 побед (${winRate.toFixed(0)}% винрейт)`);
                    autoBlockUser(telegram_id, 'Аномальный винрейт - подозрение на читы', 600);
                    return;
                }
                
                // Если 5+ побед подряд с ОГРОМНЫМИ ставками = БАН
                const recentGames = games.slice(0, 5);
                const allRecentWins = recentGames.every(g => g.win_amount > g.bet_amount);
                const avgBet = recentGames.reduce((sum, g) => sum + g.bet_amount, 0) / recentGames.length;
                
                if (allRecentWins && avgBet > 5000) {
                    console.log(`🚨 НАРУШЕНИЕ: 5 побед подряд с огромными ставками (средняя ставка: ${avgBet.toFixed(0)})`);
                    autoBlockUser(telegram_id, 'Подозрительная серия побед с огромными ставками', 600);
                    return;
                }
            }
        );
        
        // ═══════════════════════════════════════════════════════════
        // ПРОВЕРКА 5: Огромные ставки с идеальным угадыванием (Мины)
        // ═══════════════════════════════════════════════════════════
        db.all(`SELECT bet_amount, win_amount, multiplier, game_type
                FROM game_history 
                WHERE user_id = ? AND game_type = 'mines'
                ORDER BY created_at DESC 
                LIMIT 5`,
            [telegram_id], (err, minesGames) => {
                if (err || !minesGames || minesGames.length < 3) return;
                
                const allWins = minesGames.every(g => g.win_amount > g.bet_amount);
                const avgMultiplier = minesGames.reduce((sum, g) => sum + g.multiplier, 0) / minesGames.length;
                const avgBet = minesGames.reduce((sum, g) => sum + g.bet_amount, 0) / minesGames.length;
                
                console.log(`💣 Последние ${minesGames.length} игр в Мины: все победы=${allWins}, средний множитель=${avgMultiplier.toFixed(2)}x, средняя ставка=${avgBet.toFixed(0)}`);
                
                // Если все выигрывает в Мины с большими ставками и высокими множителями = БАН
                if (allWins && avgMultiplier > 3 && avgBet > 500) {
                    console.log(`🚨 НАРУШЕНИЕ: Идеальное угадывание в Минах (${avgMultiplier.toFixed(2)}x средний множитель)`);
                    autoBlockUser(telegram_id, 'Невозможное угадывание мин - подозрение на эксплоит', 600);
                    return;
                }
            }
        );
    });
}

// Автоматическая блокировка пользователя
function autoBlockUser(telegram_id, reason, durationMinutes) {
    const blockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    
    // Проверяем что пользователь не основатель
    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
        if (err || !user || user.is_founder) return; // Не блокируем основателя
        
        // Сохраняем блокировку
        db.run(`INSERT INTO fn_live_blocks (user_id, reason, blocked_until) VALUES (?, ?, ?)`,
            [telegram_id, reason, blockedUntil], (err) => {
                if (err) {
                    console.error('Ошибка автоблокировки:', err);
                    return;
                }
                
                console.log(`🛡️ FN-Live автоблокировка: user=${telegram_id}, reason="${reason}"`);
                
                // Отправляем блокировку пользователю
                const userWs = clients.get(telegram_id);
                if (userWs) {
                    userWs.send(JSON.stringify({
                        type: 'fn_live_block',
                        reason: reason,
                        blockedUntil: blockedUntil,
                        duration: durationMinutes
                    }));
                }
            }
        );
    });
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

// Получить промокоды
app.get('/api/promocodes', (req, res) => {
    db.all('SELECT * FROM promocodes ORDER BY created_at DESC', (err, promos) => {
        if (err) {
            res.status(500).json({ error: 'Ошибка БД' });
            return;
        }
        res.json(promos);
    });
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
    const { admin_id, user_id, reason, duration } = req.body; // duration в минутах

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // Рассчитываем время блокировки
        const durationMinutes = duration || 10; // По умолчанию 10 минут
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

// Админ: Заморозить баланс пользователя
app.post('/api/admin/freeze-balance', (req, res) => {
    const { admin_id, user_id } = req.body;
    console.log(`❄️ Запрос заморозки баланса: admin=${admin_id}, user=${user_id}`);

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            console.error('❌ Доступ запрещен:', err || 'не основатель');
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // Блокируем пользователя на 10 часов (600 минут)
        const blockedUntil = new Date(Date.now() + 600 * 60 * 1000).toISOString();
        
        db.run(`INSERT INTO fn_live_blocks (user_id, reason, blocked_until) VALUES (?, ?, ?)`,
            [user_id, 'Баланс заморожен администратором', blockedUntil],
            (err) => {
                if (err) {
                    console.error('❌ Ошибка заморозки:', err);
                    res.status(500).json({ error: 'Ошибка заморозки баланса' });
                    return;
                }

                console.log(`✅ Баланс заморожен для user=${user_id}`);

                // Уведомляем пользователя
                const userWs = clients.get(user_id);
                if (userWs) {
                    userWs.send(JSON.stringify({
                        type: 'balance_frozen'
                    }));
                }

                res.json({ success: true, message: 'Баланс заморожен' });
            }
        );
    });
});

// Админ: Разморозить баланс пользователя
app.post('/api/admin/unfreeze-balance', (req, res) => {
    const { admin_id, user_id } = req.body;
    console.log(`🔥 Запрос разморозки баланса: admin=${admin_id}, user=${user_id}`);

    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            console.error('❌ Доступ запрещен:', err || 'не основатель');
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        // Удаляем все блокировки пользователя
        db.run(`DELETE FROM fn_live_blocks WHERE user_id = ?`, [user_id], (err) => {
            if (err) {
                console.error('❌ Ошибка разморозки:', err);
                res.status(500).json({ error: 'Ошибка разморозки баланса' });
                return;
            }

            console.log(`✅ Баланс разморожен для user=${user_id}`);

            // Уведомляем пользователя
            const userWs = clients.get(user_id);
            if (userWs) {
                userWs.send(JSON.stringify({
                    type: 'balance_unfrozen'
                }));
            }

            res.json({ success: true, message: 'Баланс разморожен' });
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
                        nextBonusIn: hoursLeft * 60 * 60 * 1000 // в миллисекундах
                    });
                    return;
                }
            }

            // Выдаем бонус
            const bonusAmount = 100;
            
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

// Генерация уникального реферального кода
function generateReferralCode(telegram_id) {
    // Создаем код из telegram_id + случайные символы
    const base = telegram_id.toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return (base + random).substring(0, 8);
}

// API: Получить реферальный код пользователя
app.get('/api/referral/code/:telegram_id', (req, res) => {
    const telegram_id = parseInt(req.params.telegram_id);
    console.log(`🔗 Запрос реферального кода для user=${telegram_id}`);
    
    db.get('SELECT username FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
        if (err || !user) {
            res.status(404).json({ error: 'Пользователь не найден' });
            return;
        }
        
        // Генерируем код на основе telegram_id (всегда одинаковый для пользователя)
        const code = generateReferralCode(telegram_id);
        console.log(`✅ Реферальный код: ${code}`);
        
        res.json({ code: code });
    });
});

// API: Получить статистику рефералов
app.get('/api/referral/stats/:telegram_id', (req, res) => {
    const telegram_id = parseInt(req.params.telegram_id);
    console.log(`📊 Запрос статистики рефералов для user=${telegram_id}`);
    
    db.get(`SELECT COUNT(*) as count, SUM(reward_given) as earnings 
            FROM referrals 
            WHERE referrer_id = ?`,
        [telegram_id], (err, stats) => {
            if (err) {
                console.error('❌ Ошибка получения статистики:', err);
                res.status(500).json({ error: 'Ошибка БД' });
                return;
            }
            
            console.log(`✅ Рефералов: ${stats.count}, заработано: ${stats.earnings || 0}`);
            res.json({
                count: stats.count || 0,
                earnings: stats.earnings || 0
            });
        }
    );
});

// API: Применить реферальный код
app.post('/api/referral/apply', (req, res) => {
    const { telegram_id, code, ip } = req.body;
    console.log(`🎁 Применение реф-кода: user=${telegram_id}, code=${code}, ip=${ip}`);
    
    // Проверяем, не использовал ли пользователь уже реф-код
    db.get('SELECT * FROM referrals WHERE referred_id = ?', [telegram_id], (err, existing) => {
        if (err) {
            console.error('❌ Ошибка проверки:', err);
            res.status(500).json({ error: 'Ошибка БД' });
            return;
        }
        
        if (existing) {
            console.log('❌ Пользователь уже использовал реф-код');
            res.json({ success: false, error: 'Вы уже использовали реферальный код!' });
            return;
        }
        
        // Проверяем IP (защита от абуза)
        db.get('SELECT * FROM referrals WHERE referred_ip = ?', [ip], (err, ipCheck) => {
            if (err) {
                console.error('❌ Ошибка проверки IP:', err);
                res.status(500).json({ error: 'Ошибка БД' });
                return;
            }
            
            if (ipCheck) {
                console.log('❌ IP уже использовался');
                res.json({ success: false, error: 'С этого IP уже использовали реферальный код!' });
                return;
            }
            
            // Находим владельца кода
            db.all('SELECT telegram_id FROM users', (err, users) => {
                if (err) {
                    console.error('❌ Ошибка получения пользователей:', err);
                    res.status(500).json({ error: 'Ошибка БД' });
                    return;
                }
                
                let referrerId = null;
                for (const user of users) {
                    if (generateReferralCode(user.telegram_id) === code.toUpperCase()) {
                        referrerId = user.telegram_id;
                        break;
                    }
                }
                
                if (!referrerId) {
                    console.log('❌ Неверный реферальный код');
                    res.json({ success: false, error: 'Неверный реферальный код!' });
                    return;
                }
                
                if (referrerId === telegram_id) {
                    console.log('❌ Нельзя использовать свой код');
                    res.json({ success: false, error: 'Нельзя использовать свой реферальный код!' });
                    return;
                }
                
                console.log(`✅ Найден реферер: ${referrerId}`);
                
                // Начисляем бонусы
                db.run('UPDATE users SET balance = balance + 50 WHERE telegram_id = ?', [telegram_id], (err) => {
                    if (err) {
                        console.error('❌ Ошибка начисления бонуса рефералу:', err);
                        res.status(500).json({ error: 'Ошибка начисления' });
                        return;
                    }
                    
                    db.run('UPDATE users SET balance = balance + 100 WHERE telegram_id = ?', [referrerId], (err) => {
                        if (err) {
                            console.error('❌ Ошибка начисления бонуса рефереру:', err);
                            res.status(500).json({ error: 'Ошибка начисления' });
                            return;
                        }
                        
                        // Сохраняем реферала
                        db.run(`INSERT INTO referrals (referrer_id, referred_id, referrer_ip, referred_ip, reward_given) 
                                VALUES (?, ?, ?, ?, 100)`,
                            [referrerId, telegram_id, ip, ip], (err) => {
                                if (err) {
                                    console.error('❌ Ошибка сохранения реферала:', err);
                                    res.status(500).json({ error: 'Ошибка сохранения' });
                                    return;
                                }
                                
                                console.log(`✅ Реферал добавлен! Реферер: ${referrerId}, Реферал: ${telegram_id}`);
                                
                                // Уведомляем обоих пользователей
                                const referredWs = clients.get(telegram_id);
                                if (referredWs) {
                                    db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
                                        if (!err && user) {
                                            referredWs.send(JSON.stringify({
                                                type: 'balance_changed',
                                                new_balance: user.balance,
                                                change: 50
                                            }));
                                        }
                                    });
                                }
                                
                                const referrerWs = clients.get(referrerId);
                                if (referrerWs) {
                                    db.get('SELECT balance FROM users WHERE telegram_id = ?', [referrerId], (err, user) => {
                                        if (!err && user) {
                                            referrerWs.send(JSON.stringify({
                                                type: 'balance_changed',
                                                new_balance: user.balance,
                                                change: 100
                                            }));
                                            referrerWs.send(JSON.stringify({
                                                type: 'notification',
                                                message: 'Новый реферал! Вы получили +100 FCOINS'
                                            }));
                                        }
                                    });
                                }
                                
                                res.json({ 
                                    success: true, 
                                    message: 'Реферальный код применен! Вы получили +50 FCOINS',
                                    newBalance: 0 // Будет обновлено через WebSocket
                                });
                            }
                        );
                    });
                });
            });
        });
    });
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

// ═══════════════════════════════════════════════════════════════
// ОНЛАЙН РАКЕТА (Lucky Jet стиль)
// ═══════════════════════════════════════════════════════════════

// Создание нового раунда ракеты
function createRocketGame() {
    // Генерируем crashPoint с весами: чаще маленькие, редко большие
    let crashPoint;
    const rand = Math.random();
    
    if (rand < 0.5) {
        // 50% - от 1.0x до 2.0x
        crashPoint = 1.0 + Math.random() * 1.0;
    } else if (rand < 0.8) {
        // 30% - от 2.0x до 4.0x
        crashPoint = 2.0 + Math.random() * 2.0;
    } else if (rand < 0.95) {
        // 15% - от 4.0x до 10.0x
        crashPoint = 4.0 + Math.random() * 6.0;
    } else {
        // 5% - от 10.0x до 50.0x (редкие большие иксы)
        crashPoint = 10.0 + Math.random() * 40.0;
    }
    
    db.run(`INSERT INTO rocket_games (crash_point, status) VALUES (?, 'betting')`,
        [crashPoint], function(err) {
            if (err) {
                console.error('Ошибка создания игры ракеты:', err);
                return;
            }

            currentRocketGame = {
                id: this.lastID,
                crashPoint: crashPoint,
                status: 'betting',
                multiplier: 1.0,
                bets: []
            };

            // Уведомляем всех о новом раунде
            broadcast({
                type: 'rocket_new_round',
                gameId: currentRocketGame.id,
                bettingTime: 10000 // 10 секунд на ставки
            });

            console.log(`🚀 Новый раунд ракеты #${currentRocketGame.id}, краш на ${crashPoint.toFixed(2)}x`);

            // Через 10 секунд запускаем ракету
            setTimeout(startRocketFlight, 10000);
        }
    );
}

// Запуск полета ракеты
function startRocketFlight() {
    if (!currentRocketGame) return;

    currentRocketGame.status = 'flying';
    
    db.run(`UPDATE rocket_games SET status = 'flying', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [currentRocketGame.id]);

    broadcast({
        type: 'rocket_started',
        gameId: currentRocketGame.id
    });

    console.log(`🚀 Ракета #${currentRocketGame.id} взлетела!`);

    // Обновляем множитель каждые 50мс (быстрее)
    const flightInterval = setInterval(() => {
        if (!currentRocketGame || currentRocketGame.status !== 'flying') {
            clearInterval(flightInterval);
            return;
        }

        // Скорость роста зависит от текущего множителя
        let increment;
        if (currentRocketGame.multiplier < 2.0) {
            increment = 0.01; // Медленно в начале
        } else if (currentRocketGame.multiplier < 5.0) {
            increment = 0.02; // Быстрее
        } else if (currentRocketGame.multiplier < 10.0) {
            increment = 0.05; // Еще быстрее
        } else {
            increment = 0.1; // Очень быстро на больших иксах
        }
        
        currentRocketGame.multiplier += increment;

        // Отправляем обновление множителя всем
        broadcast({
            type: 'rocket_multiplier_update',
            gameId: currentRocketGame.id,
            multiplier: currentRocketGame.multiplier
        });

        // Проверяем краш
        if (currentRocketGame.multiplier >= currentRocketGame.crashPoint) {
            clearInterval(flightInterval);
            crashRocket();
        }
    }, 50); // Обновление каждые 50мс для более плавной анимации
}

// Краш ракеты
function crashRocket() {
    if (!currentRocketGame) return;

    currentRocketGame.status = 'crashed';
    
    db.run(`UPDATE rocket_games SET status = 'crashed', crashed_at = CURRENT_TIMESTAMP, multiplier = ? WHERE id = ?`,
        [currentRocketGame.multiplier, currentRocketGame.id]);

    broadcast({
        type: 'rocket_crashed',
        gameId: currentRocketGame.id,
        crashPoint: currentRocketGame.crashPoint
    });

    console.log(`💥 Ракета #${currentRocketGame.id} разбилась на ${currentRocketGame.crashPoint.toFixed(2)}x`);

    // Рассчитываем выигрыши
    calculateRocketWinnings();

    // Через 5 секунд новый раунд
    setTimeout(createRocketGame, 5000);
}

// Расчет выигрышей ракеты
function calculateRocketWinnings() {
    if (!currentRocketGame) return;

    db.all(`SELECT * FROM rocket_bets WHERE game_id = ? AND cashout_multiplier IS NOT NULL`,
        [currentRocketGame.id], (err, bets) => {
            if (err) {
                console.error('Ошибка получения ставок:', err);
                return;
            }

            bets.forEach(bet => {
                const winAmount = Math.floor(bet.bet_amount * bet.cashout_multiplier);
                
                // Обновляем выигрыш
                db.run(`UPDATE rocket_bets SET win_amount = ? WHERE id = ?`, [winAmount, bet.id]);
                
                // Начисляем баланс
                db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                    [winAmount, bet.user_id], (err) => {
                        if (!err) {
                            // Уведомляем пользователя
                            const userWs = clients.get(bet.user_id);
                            if (userWs) {
                                userWs.send(JSON.stringify({
                                    type: 'rocket_win',
                                    amount: winAmount,
                                    multiplier: bet.cashout_multiplier
                                }));
                            }
                        }
                    }
                );
            });
        }
    );
}

// API: Ставка на ракету
app.post('/api/rocket/bet', (req, res) => {
    const { telegram_id, bet_amount } = req.body;

    if (!currentRocketGame || currentRocketGame.status !== 'betting') {
        res.json({ success: false, message: 'Ставки закрыты' });
        return;
    }

    // Проверяем баланс
    db.get(`SELECT balance FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
        if (err || !user || user.balance < bet_amount) {
            res.json({ success: false, message: 'Недостаточно средств' });
            return;
        }

        // Списываем баланс
        db.run(`UPDATE users SET balance = balance - ? WHERE telegram_id = ?`,
            [bet_amount, telegram_id], (err) => {
                if (err) {
                    res.json({ success: false, message: 'Ошибка списания' });
                    return;
                }

                // Сохраняем ставку
                db.run(`INSERT INTO rocket_bets (game_id, user_id, bet_amount) VALUES (?, ?, ?)`,
                    [currentRocketGame.id, telegram_id, bet_amount], function(err) {
                        if (err) {
                            res.json({ success: false, message: 'Ошибка сохранения ставки' });
                            return;
                        }

                        // Уведомляем всех о новой ставке
                        broadcast({
                            type: 'rocket_new_bet',
                            gameId: currentRocketGame.id,
                            userId: telegram_id,
                            betAmount: bet_amount
                        });

                        res.json({ 
                            success: true, 
                            betId: this.lastID,
                            newBalance: user.balance - bet_amount
                        });
                    }
                );
            }
        );
    });
});

// API: Забрать выигрыш ракеты
app.post('/api/rocket/cashout', (req, res) => {
    const { telegram_id } = req.body;

    if (!currentRocketGame || currentRocketGame.status !== 'flying') {
        res.json({ success: false, message: 'Нельзя забрать сейчас' });
        return;
    }

    // Находим ставку
    db.get(`SELECT * FROM rocket_bets WHERE game_id = ? AND user_id = ? AND cashout_multiplier IS NULL`,
        [currentRocketGame.id, telegram_id], (err, bet) => {
            if (err || !bet) {
                res.json({ success: false, message: 'Ставка не найдена' });
                return;
            }

            const cashoutMultiplier = currentRocketGame.multiplier;
            const winAmount = Math.floor(bet.bet_amount * cashoutMultiplier);

            // Обновляем ставку
            db.run(`UPDATE rocket_bets SET cashout_multiplier = ?, win_amount = ? WHERE id = ?`,
                [cashoutMultiplier, winAmount, bet.id], (err) => {
                    if (err) {
                        res.json({ success: false, message: 'Ошибка сохранения' });
                        return;
                    }

                    // Начисляем баланс
                    db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                        [winAmount, telegram_id], (err) => {
                            if (err) {
                                res.json({ success: false, message: 'Ошибка начисления' });
                                return;
                            }

                            // Уведомляем пользователя
                            const userWs = clients.get(telegram_id);
                            if (userWs) {
                                userWs.send(JSON.stringify({
                                    type: 'rocket_cashout_success',
                                    amount: winAmount,
                                    multiplier: cashoutMultiplier
                                }));
                            }

                            // Уведомляем всех
                            broadcast({
                                type: 'rocket_player_cashout',
                                userId: telegram_id,
                                multiplier: cashoutMultiplier
                            });

                            res.json({ 
                                success: true, 
                                winAmount: winAmount,
                                multiplier: cashoutMultiplier
                            });
                        }
                    );
                }
            );
        }
    );
});

// ═══════════════════════════════════════════════════════════════
// ОНЛАЙН РУЛЕТКА
// ═══════════════════════════════════════════════════════════════

// Создание нового спина рулетки
function createRouletteGame() {
    const resultNumber = Math.floor(Math.random() * 37); // 0-36
    
    db.run(`INSERT INTO roulette_games (result_number, status) VALUES (?, 'betting')`,
        [resultNumber], function(err) {
            if (err) {
                console.error('Ошибка создания игры рулетки:', err);
                return;
            }

            currentRouletteGame = {
                id: this.lastID,
                resultNumber: resultNumber,
                status: 'betting',
                bets: []
            };

            // Уведомляем всех о новом спине
            broadcast({
                type: 'roulette_new_round',
                gameId: currentRouletteGame.id,
                bettingTime: 30000 // 30 секунд на ставки
            });

            console.log(`🎰 Новый спин рулетки #${currentRouletteGame.id}, выпадет ${resultNumber}`);

            // Через 30 секунд запускаем вращение
            setTimeout(startRouletteSpin, 30000);
        }
    );
}

// Запуск вращения рулетки
function startRouletteSpin() {
    if (!currentRouletteGame) return;

    currentRouletteGame.status = 'spinning';
    
    db.run(`UPDATE roulette_games SET status = 'spinning', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [currentRouletteGame.id]);

    broadcast({
        type: 'roulette_started',
        gameId: currentRouletteGame.id
    });

    console.log(`🎰 Рулетка #${currentRouletteGame.id} крутится!`);

    // Через 10 секунд показываем результат
    setTimeout(finishRouletteSpin, 10000);
}

// Завершение вращения рулетки
function finishRouletteSpin() {
    if (!currentRouletteGame) return;

    currentRouletteGame.status = 'finished';
    
    db.run(`UPDATE roulette_games SET status = 'finished', finished_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [currentRouletteGame.id]);

    broadcast({
        type: 'roulette_result',
        gameId: currentRouletteGame.id,
        resultNumber: currentRouletteGame.resultNumber
    });

    console.log(`🎰 Рулетка #${currentRouletteGame.id} остановилась на ${currentRouletteGame.resultNumber}`);

    // Рассчитываем выигрыши
    calculateRouletteWinnings();

    // Через 10 секунд новый спин
    setTimeout(createRouletteGame, 10000);
}

// Расчет выигрышей рулетки
function calculateRouletteWinnings() {
    if (!currentRouletteGame) return;

    const resultNumber = currentRouletteGame.resultNumber;
    const isRed = resultNumber !== 0 && [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(resultNumber);
    const isBlack = resultNumber !== 0 && !isRed;

    db.all(`SELECT * FROM roulette_bets WHERE game_id = ?`, [currentRouletteGame.id], (err, bets) => {
        if (err) {
            console.error('Ошибка получения ставок рулетки:', err);
            return;
        }

        bets.forEach(bet => {
            let winMultiplier = 0;

            if (bet.bet_type === 'red' && isRed) winMultiplier = 2;
            if (bet.bet_type === 'black' && isBlack) winMultiplier = 2;
            if (bet.bet_type === 'green' && resultNumber === 0) winMultiplier = 14;
            if (bet.bet_type === 'number' && parseInt(bet.bet_value) === resultNumber) winMultiplier = 36;

            if (winMultiplier > 0) {
                const winAmount = bet.bet_amount * winMultiplier;
                
                // Обновляем выигрыш
                db.run(`UPDATE roulette_bets SET win_amount = ? WHERE id = ?`, [winAmount, bet.id]);
                
                // Начисляем баланс
                db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                    [winAmount, bet.user_id], (err) => {
                        if (!err) {
                            // Уведомляем пользователя
                            const userWs = clients.get(bet.user_id);
                            if (userWs) {
                                userWs.send(JSON.stringify({
                                    type: 'roulette_win',
                                    amount: winAmount,
                                    multiplier: winMultiplier
                                }));
                            }
                        }
                    }
                );
            }
        });
    });
}

// API: Ставка на рулетку
app.post('/api/roulette/bet', (req, res) => {
    const { telegram_id, bet_type, bet_value, bet_amount } = req.body;

    if (!currentRouletteGame || currentRouletteGame.status !== 'betting') {
        res.json({ success: false, message: 'Ставки закрыты' });
        return;
    }

    // Проверяем баланс
    db.get(`SELECT balance FROM users WHERE telegram_id = ?`, [telegram_id], (err, user) => {
        if (err || !user || user.balance < bet_amount) {
            res.json({ success: false, message: 'Недостаточно средств' });
            return;
        }

        // Списываем баланс
        db.run(`UPDATE users SET balance = balance - ? WHERE telegram_id = ?`,
            [bet_amount, telegram_id], (err) => {
                if (err) {
                    res.json({ success: false, message: 'Ошибка списания' });
                    return;
                }

                // Сохраняем ставку
                db.run(`INSERT INTO roulette_bets (game_id, user_id, bet_type, bet_value, bet_amount) VALUES (?, ?, ?, ?, ?)`,
                    [currentRouletteGame.id, telegram_id, bet_type, bet_value, bet_amount], function(err) {
                        if (err) {
                            res.json({ success: false, message: 'Ошибка сохранения ставки' });
                            return;
                        }

                        // Уведомляем всех о новой ставке
                        broadcast({
                            type: 'roulette_new_bet',
                            gameId: currentRouletteGame.id,
                            userId: telegram_id,
                            betType: bet_type,
                            betAmount: bet_amount
                        });

                        res.json({ 
                            success: true, 
                            betId: this.lastID,
                            newBalance: user.balance - bet_amount
                        });
                    }
                );
            }
        );
    });
});

// API: Получить историю транзакций пользователя
app.get('/api/transactions/:telegram_id', (req, res) => {
    const telegram_id = parseInt(req.params.telegram_id);
    console.log(`📊 Запрос транзакций для пользователя ${telegram_id}`);
    
    db.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [telegram_id], (err, transactions) => {
            if (err) {
                console.error('❌ Ошибка получения транзакций:', err);
                res.status(500).json({ error: 'Ошибка БД', details: err.message });
                return;
            }
            console.log(`✅ Найдено транзакций: ${transactions.length}`);
            res.json(transactions);
        }
    );
});

// Админ: Добавить транзакцию пользователю
app.post('/api/admin/add-transaction', (req, res) => {
    const { admin_id, user_id, type, amount } = req.body;
    console.log(`💰 Запрос добавления транзакции: admin=${admin_id}, user=${user_id}, type=${type}, amount=${amount}`);
    
    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            console.error('❌ Доступ запрещен:', err || 'не основатель');
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }
        
        console.log('✅ Права проверены, добавляем транзакцию...');
        
        // Если пополнение - начисляем баланс
        if (type === 'deposit') {
            db.run(`UPDATE users SET balance = balance + ? WHERE telegram_id = ?`, [amount, user_id], (err) => {
                if (err) {
                    console.error('❌ Ошибка начисления баланса:', err);
                    res.status(500).json({ error: 'Ошибка начисления баланса', details: err.message });
                    return;
                }
                
                console.log(`✅ Баланс начислен: +${amount}`);
                
                // Добавляем транзакцию
                db.run(`INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, 'completed')`,
                    [user_id, type, amount], function(err) {
                        if (err) {
                            console.error('❌ Ошибка добавления транзакции:', err);
                            res.status(500).json({ error: 'Ошибка добавления транзакции', details: err.message });
                            return;
                        }
                        
                        console.log(`✅ Транзакция добавлена, ID: ${this.lastID}`);
                        
                        // Уведомляем пользователя через WebSocket
                        const userWs = clients.get(user_id);
                        if (userWs) {
                            db.get('SELECT balance FROM users WHERE telegram_id = ?', [user_id], (err, updatedUser) => {
                                if (!err && updatedUser) {
                                    userWs.send(JSON.stringify({
                                        type: 'balance_changed',
                                        new_balance: updatedUser.balance,
                                        change: amount
                                    }));
                                }
                            });
                        }
                        
                        res.json({ success: true, transactionId: this.lastID });
                    }
                );
            });
        } else {
            // Если вывод - просто добавляем в историю (баланс уже списан при заявке)
            db.run(`INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, 'completed')`,
                [user_id, type, amount], function(err) {
                    if (err) {
                        console.error('❌ Ошибка добавления транзакции:', err);
                        res.status(500).json({ error: 'Ошибка добавления транзакции', details: err.message });
                        return;
                    }
                    
                    console.log(`✅ Транзакция добавлена, ID: ${this.lastID}`);
                    res.json({ success: true, transactionId: this.lastID });
                }
            );
        }
    });
});

// API: Заявка на вывод средств
app.post('/api/withdraw-request', (req, res) => {
    const { telegram_id, amount } = req.body;
    console.log(`💸 Запрос вывода: user=${telegram_id}, amount=${amount}`);
    
    // Проверяем баланс
    db.get('SELECT balance FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
        if (err || !user) {
            console.error('❌ Пользователь не найден:', telegram_id);
            res.status(404).json({ error: 'Пользователь не найден' });
            return;
        }
        
        console.log(`💰 Баланс пользователя: ${user.balance}`);
        
        // Проверяем минимальную сумму вывода
        if (amount < 3000) {
            console.log('❌ Минимальная сумма вывода: 3000 FCOINS');
            res.json({ success: false, error: 'Минимальная сумма вывода: 3000 FCOINS' });
            return;
        }
        
        if (user.balance < amount) {
            console.log('❌ Недостаточно средств');
            res.json({ success: false, error: 'Недостаточно средств' });
            return;
        }
        
        // Списываем баланс
        db.run('UPDATE users SET balance = balance - ? WHERE telegram_id = ?', [amount, telegram_id], (err) => {
            if (err) {
                console.error('❌ Ошибка списания:', err);
                res.status(500).json({ error: 'Ошибка списания средств' });
                return;
            }
            
            console.log('✅ Баланс списан');
            
            // Добавляем транзакцию со статусом "pending"
            db.run(`INSERT INTO transactions (user_id, type, amount, status) VALUES (?, 'withdrawal', ?, 'pending')`,
                [telegram_id, amount], function(err) {
                    if (err) {
                        console.error('❌ Ошибка создания транзакции:', err);
                        res.status(500).json({ error: 'Ошибка создания заявки', details: err.message });
                        return;
                    }
                    
                    console.log(`✅ Транзакция создана, ID: ${this.lastID}`);
                    
                    // Уведомляем пользователя
                    const userWs = clients.get(telegram_id);
                    if (userWs) {
                        userWs.send(JSON.stringify({
                            type: 'withdraw_request',
                            amount: amount,
                            new_balance: user.balance - amount
                        }));
                    }
                    
                    res.json({ 
                        success: true, 
                        transactionId: this.lastID,
                        newBalance: user.balance - amount
                    });
                }
            );
        });
    });
});

// Админ: Изменить статус транзакции
app.post('/api/admin/update-transaction-status', (req, res) => {
    const { admin_id, transaction_id, status } = req.body;
    
    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }
        
        // Обновляем статус транзакции
        db.run(`UPDATE transactions SET status = ? WHERE id = ?`, [status, transaction_id], function(err) {
            if (err) {
                res.status(500).json({ error: 'Ошибка обновления статуса' });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ error: 'Транзакция не найдена' });
                return;
            }
            
            // Получаем информацию о транзакции для уведомления пользователя
            db.get('SELECT * FROM transactions WHERE id = ?', [transaction_id], (err, transaction) => {
                if (!err && transaction) {
                    const userWs = clients.get(transaction.user_id);
                    if (userWs) {
                        userWs.send(JSON.stringify({
                            type: 'transaction_status_updated',
                            transaction_id: transaction_id,
                            status: status
                        }));
                    }
                }
            });
            
            res.json({ success: true, message: 'Статус обновлен' });
        });
    });
});

// Админ: Отправить уведомление об обновлении всем
app.post('/api/admin/notify-update', (req, res) => {
    const { admin_id } = req.body;
    
    db.get('SELECT is_founder FROM users WHERE telegram_id = ?', [admin_id], (err, user) => {
        if (err || !user || !user.is_founder) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }
        
        // Отправляем уведомление всем подключенным пользователям
        broadcast({
            type: 'update_available'
        });
        
        res.json({ success: true, message: 'Уведомление отправлено всем пользователям' });
    });
});

// Главная страница (должна быть в конце после всех API роутов)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Откройте http://localhost:${PORT}`);
    
    // Запускаем онлайн игры через 5 секунд после старта
    setTimeout(() => {
        console.log('🎮 Запуск онлайн игр...');
        createRocketGame();
        createRouletteGame();
    }, 5000);
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

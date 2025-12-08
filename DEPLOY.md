# 🚀 Деплой FRNMINES

## Локальный запуск (для разработки)

```bash
npm install
npm start
```

Откройте http://localhost:3000

---

## 🌐 Деплой на сервер

### Вариант 1: VPS/Dedicated сервер

#### 1. Подключитесь к серверу
```bash
ssh user@your-server.com
```

#### 2. Установите Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 3. Клонируйте проект
```bash
git clone your-repo-url
cd frnmines
```

#### 4. Установите зависимости
```bash
npm install
```

#### 5. Установите PM2 (для автозапуска)
```bash
sudo npm install -g pm2
```

#### 6. Запустите приложение
```bash
pm2 start server.js --name frnmines
pm2 save
pm2 startup
```

#### 7. Настройте Nginx (опционально)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 8. Настройте SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### Вариант 2: Heroku

#### 1. Создайте Procfile
```
web: node server.js
```

#### 2. Добавьте в package.json
```json
{
  "engines": {
    "node": "18.x"
  }
}
```

#### 3. Деплой
```bash
heroku login
heroku create frnmines
git push heroku main
```

---

### Вариант 3: Railway.app

1. Зарегистрируйтесь на https://railway.app
2. Создайте новый проект
3. Подключите GitHub репозиторий
4. Railway автоматически определит Node.js проект
5. Деплой произойдет автоматически

---

### Вариант 4: Vercel (только для статики)

⚠️ **Внимание**: Vercel не поддерживает WebSocket напрямую. Нужен отдельный сервер для WebSocket.

---

## 🔧 Переменные окружения

Создайте файл `.env`:

```env
PORT=3000
NODE_ENV=production
```

Обновите `server.js`:
```javascript
require('dotenv').config();
const PORT = process.env.PORT || 3000;
```

---

## 🔐 Настройка основателя

В `server.js` найдите:

```javascript
db.run(`INSERT OR IGNORE INTO users (telegram_id, username, first_name, balance, verified, is_founder) 
        VALUES (?, ?, ?, ?, ?, ?)`, 
        [0, 'fronzgg', 'Founder', 50000, 1, 1]);
```

Замените:
- `0` на ваш Telegram ID
- `'fronzgg'` на ваш username
- `'Founder'` на ваше имя

---

## 📱 Интеграция с Telegram Bot

### 1. Создайте бота

Напишите @BotFather в Telegram:
```
/newbot
```

### 2. Получите токен

Сохраните токен, который даст BotFather

### 3. Настройте Web App

```
/newapp
```

Выберите вашего бота и укажите URL вашего сервера

### 4. Добавьте кнопку в бота

Используйте Telegram Bot API:

```javascript
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot('YOUR_BOT_TOKEN', {polling: true});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Добро пожаловать в FRNMINES!', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎮 Играть',
                    web_app: { url: 'https://your-domain.com' }
                }
            ]]
        }
    });
});
```

---

## 🔍 Мониторинг

### PM2 команды

```bash
pm2 status              # Статус приложения
pm2 logs frnmines       # Логи
pm2 restart frnmines    # Перезапуск
pm2 stop frnmines       # Остановка
pm2 delete frnmines     # Удаление
```

### Логи

```bash
pm2 logs frnmines --lines 100
```

---

## 🔄 Обновление

```bash
git pull
npm install
pm2 restart frnmines
```

---

## 🗄️ Бэкап базы данных

### Создание бэкапа
```bash
cp frnmines.db frnmines_backup_$(date +%Y%m%d).db
```

### Автоматический бэкап (cron)
```bash
crontab -e
```

Добавьте:
```
0 2 * * * cd /path/to/frnmines && cp frnmines.db backups/frnmines_$(date +\%Y\%m\%d).db
```

---

## 🐛 Отладка

### Проверка портов
```bash
netstat -tulpn | grep 3000
```

### Проверка логов
```bash
pm2 logs frnmines
```

### Проверка WebSocket
Откройте консоль браузера (F12) и проверьте:
```
WebSocket connection to 'ws://your-domain.com' failed
```

---

## 📊 Производительность

### Рекомендуемые характеристики сервера

- **Минимум**: 1 CPU, 512MB RAM
- **Рекомендуется**: 2 CPU, 1GB RAM
- **Для 1000+ пользователей**: 4 CPU, 4GB RAM

### Оптимизация

1. Используйте Redis для сессий
2. Настройте кэширование
3. Используйте CDN для статики
4. Включите gzip сжатие

---

## 🔒 Безопасность

### 1. Firewall
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Обновления
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Fail2ban
```bash
sudo apt install fail2ban
```

---

## ✅ Чеклист перед деплоем

- [ ] Изменен Telegram ID основателя
- [ ] Настроены переменные окружения
- [ ] Настроен домен
- [ ] Настроен SSL сертификат
- [ ] Настроен автозапуск (PM2)
- [ ] Настроен бэкап БД
- [ ] Проверена работа WebSocket
- [ ] Проверена интеграция с Telegram
- [ ] Настроен мониторинг

---

**Готово! Ваше казино работает в продакшене! 🎉**

Создано by @fronzgg

// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor('bg_color');
}

// --- Элементы DOM ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const coinsSpan = document.getElementById('coinsCount');
const shopCoinsSpan = document.getElementById('shopCoins');
const playerGreeting = document.getElementById('playerGreeting');
const instructionOverlay = document.getElementById('instructionOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const shopOverlay = document.getElementById('shopOverlay');
const finalScoreSpan = document.getElementById('finalScore');
const finalHighScoreSpan = document.getElementById('finalHighScore');
const earnedCoinsSpan = document.getElementById('earnedCoins');
const startGameBtn = document.getElementById('startGameBtn');
const restartGameBtn = document.getElementById('restartGameBtn');
const shopBtn = document.getElementById('shopBtn');
const closeShopBtn = document.getElementById('closeShopBtn');
const upgradeItemsContainer = document.getElementById('upgradeItems');

// --- Система валюты и улучшений ---
let playerCurrency = parseInt(localStorage.getItem('slimeRunCurrency')) || 0;
let sessionEarnedCoins = 0; // Монеты, заработанные за текущую сессию

let upgrades = {
    jumpPower: {
        level: parseInt(localStorage.getItem('upgrade_jumpPower')) || 1,
        maxLevel: 5,
        baseCost: 100,
        getValue: function() { return 10 + (this.level * 2); },
        getCost: function() { return this.baseCost * this.level; }
    },
    speed: {
        level: parseInt(localStorage.getItem('upgrade_speed')) || 1,
        maxLevel: 5,
        baseCost: 150,
        getValue: function() { return 5 + (this.level * 0.5); },
        getCost: function() { return this.baseCost * this.level; }
    },
    gravity: {
        level: parseInt(localStorage.getItem('upgrade_gravity')) || 1,
        maxLevel: 3,
        baseCost: 200,
        getValue: function() { return 0.5 - (this.level * 0.05); },
        getCost: function() { return this.baseCost * this.level; }
    },
    coinMagnet: {
        level: parseInt(localStorage.getItem('upgrade_magnet')) || 0,
        maxLevel: 1,
        baseCost: 300,
        active: false,
        getCost: function() { return this.baseCost; }
    },
    shield: {
        level: parseInt(localStorage.getItem('upgrade_shield')) || 0,
        maxLevel: 1,
        baseCost: 500,
        active: false,
        getCost: function() { return this.baseCost; }
    }
};

// Скины
let skins = {
    classic: {
        owned: true,
        equipped: true,
        color: '#7cc46b',
        price: 0,
        eyes: 'default'
    },
    gold: {
        owned: parseInt(localStorage.getItem('skin_gold')) === 1,
        equipped: parseInt(localStorage.getItem('skin_gold_equipped')) === 1,
        color: '#ffd700',
        price: 200,
        eyes: 'cool'
    },
    fire: {
        owned: parseInt(localStorage.getItem('skin_fire')) === 1,
        equipped: parseInt(localStorage.getItem('skin_fire_equipped')) === 1,
        color: '#ff6b6b',
        price: 300,
        eyes: 'angry'
    },
    ghost: {
        owned: parseInt(localStorage.getItem('skin_ghost')) === 1,
        equipped: parseInt(localStorage.getItem('skin_ghost_equipped')) === 1,
        color: '#b19cd9',
        price: 400,
        eyes: 'scared'
    },
    rainbow: {
        owned: parseInt(localStorage.getItem('skin_rainbow')) === 1,
        equipped: parseInt(localStorage.getItem('skin_rainbow_equipped')) === 1,
        color: 'rainbow',
        price: 600,
        eyes: 'happy'
    }
};

// Текущий активный скин
let currentSkin = 'classic';
for (let [key, skin] of Object.entries(skins)) {
    if (skin.equipped) {
        currentSkin = key;
        break;
    }
}

// --- Переменные игры ---
let gameState = 'idle';
let animationFrameId = null;

// Рекорд
let highScore = localStorage.getItem('slimeRunHighScore') ? parseInt(localStorage.getItem('slimeRunHighScore')) : 0;
highScoreSpan.textContent = highScore;

// Игрок
let player = {
    x: 80,
    y: 0,
    width: 30,
    height: 30,
    vy: 0,
    gravity: upgrades.gravity.getValue(),
    jumpPower: -upgrades.jumpPower.getValue(),
    grounded: true,
    isJumping: false,
    jumpStartTime: 0,
    jumpPressTime: 0,
    maxJumpMultiplier: 1.8,
    hasShield: false,
    shieldTimer: 0
};

// Препятствия и бонусы
let obstacles = [];
let coins = [];
let frame = 0;
let score = 0;

// Параметры уровня
let gameSpeed = upgrades.speed.getValue();
let spawnCounter = 0;
const SPAWN_RATE = 70;

// Магнит для монет
let magnetTimer = 0;

// --- Ежедневные награды ---
function checkDailyReward() {
    const lastLogin = localStorage.getItem('lastLogin');
    const today = new Date().toDateString();
    
    if (lastLogin !== today) {
        const dailyBonus = 50;
        playerCurrency += dailyBonus;
        localStorage.setItem('slimeRunCurrency', playerCurrency);
        localStorage.setItem('lastLogin', today);
        updateCurrencyDisplay();
        
        if (tg) {
            tg.showPopup({
                title: 'Ежедневная награда!',
                message: `Вы получили ${dailyBonus} 🪙 за вход!`,
                buttons: [{type: 'ok'}]
            });
        }
    }
}

// --- Обновление отображения валюты ---
function updateCurrencyDisplay() {
    coinsSpan.textContent = playerCurrency;
    if (shopCoinsSpan) shopCoinsSpan.textContent = playerCurrency;
}

// --- Приветствие игрока ---
if (tg && tg.initDataUnsafe?.user) {
    const user = tg.initDataUnsafe.user;
    playerGreeting.textContent = `Привет, ${user.first_name || 'Слизень'}!`;
} else {
    playerGreeting.textContent = `Привет, Слизень!`;
}

// --- Утилиты ---
function vibrate(ms = 20) {
    if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// --- Физика и обновление ---
function resetGame() {
    score = 0;
    sessionEarnedCoins = 0;
    gameSpeed = upgrades.speed.getValue();
    player.gravity = upgrades.gravity.getValue();
    player.jumpPower = -upgrades.jumpPower.getValue();
    obstacles = [];
    coins = [];
    player.y = canvas.height - 100;
    player.vy = 0;
    player.grounded = true;
    player.isJumping = false;
    player.hasShield = false;
    player.shieldTimer = 0;
    magnetTimer = 0;
    frame = 0;
    spawnCounter = 0;
    updateScore();
}

function jump(pressDuration = 1.0) {
    if (!player.grounded || gameState !== 'playing') return;

    vibrate();

    const powerMultiplier = Math.min(1.0 + (pressDuration * 0.8), player.maxJumpMultiplier);
    player.vy = player.jumpPower * powerMultiplier;
    player.grounded = false;
    player.isJumping = true;
}

function spawnObstacle() {
    const rand = Math.random();
    let type;
    if (rand < 0.6) type = 'rock';
    else type = 'spike';

    obstacles.push({
        x: canvas.width,
        y: canvas.height - 70,
        width: type === 'rock' ? 25 : 30,
        height: type === 'rock' ? 25 : 20,
        type: type,
        passed: false
    });
}

function spawnCoin() {
    if (Math.random() < 0.4) {
        coins.push({
            x: canvas.width,
            y: canvas.height - 120 + (Math.random() * 50 - 25),
            width: 15,
            height: 15,
            collected: false,
            value: 5 + Math.floor(Math.random() * 6) // 5-10 монет
        });
    }
}

function applyMagnetEffect() {
    if (magnetTimer > 0 || upgrades.coinMagnet.level > 0) {
        for (let coin of coins) {
            if (coin.x > player.x) {
                coin.x -= 2;
            }
        }
        if (magnetTimer > 0) magnetTimer--;
    }
}

function updateGame() {
    if (gameState !== 'playing') return;

    // Обновление таймеров способностей
    if (player.hasShield && player.shieldTimer > 0) {
        player.shieldTimer--;
    } else {
        player.hasShield = false;
    }

    // Гравитация
    player.vy += player.gravity;
    player.y += player.vy;

    const groundY = canvas.height - 100;
    if (player.y >= groundY) {
        player.y = groundY;
        player.vy = 0;
        player.grounded = true;
        player.isJumping = false;
    } else {
        player.grounded = false;
    }

    // Движение препятствий
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= gameSpeed;

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }

        if (!obs.passed && obs.x + obs.width < player.x) {
            obs.passed = true;
            score++;
            updateScore();
        }
    }

    // Движение монет
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.x -= gameSpeed;

        if (coin.x + coin.width < 0) {
            coins.splice(i, 1);
        }
    }

    // Эффект магнита
    applyMagnetEffect();

    // Коллизия с препятствиями
    for (let obs of obstacles) {
        if (detectCollision(player, obs)) {
            if (player.hasShield) {
                player.hasShield = false;
                player.shieldTimer = 0;
                obstacles.splice(obstacles.indexOf(obs), 1);
                vibrate();
            } else {
                gameOver();
                return;
            }
        }
    }

    // Сбор монет
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        if (detectCollision(player, coin)) {
            coins.splice(i, 1);
            playerCurrency += coin.value;
            sessionEarnedCoins += coin.value;
            score += 1;
            localStorage.setItem('slimeRunCurrency', playerCurrency);
            updateCurrencyDisplay();
            vibrate();
            updateScore();
        }
    }

    // Спавн объектов
    frame++;
    if (frame % Math.max(40, 80 - Math.floor(gameSpeed * 2)) === 0) {
        spawnObstacle();
        spawnCoin();
    }

    // Увеличение сложности
    if (frame % 300 === 0) {
        gameSpeed += 0.5;
    }
}

function detectCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function updateScore() {
    scoreSpan.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('slimeRunHighScore', highScore);
        highScoreSpan.textContent = highScore;
    }
}

function gameOver() {
    gameState = 'gameOver';
    finalScoreSpan.textContent = score;
    finalHighScoreSpan.textContent = highScore;
    earnedCoinsSpan.textContent = sessionEarnedCoins;
    gameOverOverlay.classList.remove('hidden');

    if (tg) {
        tg.HapticFeedback.notificationOccurred('error');
    }
}

// --- Отрисовка ---
function drawSlime(x, y, width, height) {
    const isSad = gameState === 'gameOver';
    const jumpCompress = player.isJumping ? 0.8 : 1.0;
    const skin = skins[currentSkin];

    ctx.save();
    ctx.translate(x + width/2, y + height/2);
    ctx.scale(1, jumpCompress);
    ctx.translate(-(x + width/2), -(y + height/2));

    // Тело
    if (skin.color === 'rainbow') {
        const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.2, '#ff8800');
        gradient.addColorStop(0.4, '#ffff00');
        gradient.addColorStop(0.6, '#00ff00');
        gradient.addColorStop(0.8, '#0088ff');
        gradient.addColorStop(1, '#ff00ff');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = skin.color;
    }
    
    ctx.beginPath();
    ctx.ellipse(x + width/2, y + height/2, width/2, height/2, 0, 0, Math.PI * 2);
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.fill();

    // Щит
    if (player.hasShield) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x + width/2, y + height/2, width/2 + 5, height/2 + 5, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Глаза
    if (skin.eyes === 'cool') {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.rect(x + width * 0.5, y + height * 0.25, width * 0.3, height * 0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(x + width * 0.2, y + height * 0.25, width * 0.3, height * 0.2);
        ctx.fill();
    } else if (skin.eyes === 'angry') {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x + width * 0.65, y + height * 0.35, width * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width * 0.35, y + height * 0.35, width * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(x + width * 0.65, y + height * 0.32, width * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width * 0.35, y + height * 0.32, width * 0.08, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x + width * 0.65, y + height * 0.35, width * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width * 0.35, y + height * 0.35, width * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2d2d2d';
        ctx.beginPath();
        ctx.arc(x + width * 0.65, y + height * 0.32, width * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width * 0.35, y + height * 0.32, width * 0.08, 0, Math.PI * 2);
        ctx.fill();
    }

    // Рот
    ctx.beginPath();
    ctx.strokeStyle = '#4a2e1e';
    ctx.lineWidth = 2;
    if (isSad) {
        ctx.arc(x + width/2, y + height * 0.7, width * 0.2, 0, Math.PI, false);
    } else {
        ctx.arc(x + width/2, y + height * 0.65, width * 0.15, 0, Math.PI, true);
    }
    ctx.stroke();

    ctx.restore();
}

function drawObstacle(obs) {
    if (obs.type === 'rock') {
        ctx.fillStyle = '#8a8a8a';
        ctx.beginPath();
        ctx.rect(obs.x, obs.y, obs.width, obs.height);
        ctx.fill();
        ctx.fillStyle = '#6a6a6a';
        ctx.beginPath();
        ctx.rect(obs.x + 5, obs.y + 5, 5, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(obs.x + 15, obs.y + 12, 5, 5);
        ctx.fill();
    } else if (obs.type === 'spike') {
        ctx.fillStyle = '#b84a3a';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width/2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
    }
}

function drawCoin(coin) {
    ctx.fillStyle = '#f5d742';
    ctx.shadowColor = '#f0b400';
    ctx.shadowBlur = 10;
    ctx.font = '20px Arial';
    ctx.fillText('🪙', coin.x, coin.y + 15);
    ctx.shadowBlur = 0;
    
    ctx.font = '10px Arial';
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'black';
    ctx.fillText(coin.value, coin.x + 10, coin.y);
}

function drawGround() {
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(0, canvas.height - 70, canvas.width, 10);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'var(--tg-theme-secondary-bg-color, #e0f2fe)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGround();

    for (let coin of coins) {
        drawCoin(coin);
    }

    for (let obs of obstacles) {
        drawObstacle(obs);
    }

    drawSlime(player.x, player.y, player.width, player.height);
}

// --- Магазин ---
function renderShop() {
    upgradeItemsContainer.innerHTML = '';
    
    // Улучшения характеристик
    for (let [key, upgrade] of Object.entries(upgrades)) {
        const item = document.createElement('div');
        item.className = 'shop-item';
        
        let description = '';
        let currentValue = '';
        
        switch(key) {
            case 'jumpPower':
                description = 'Сила прыжка';
                currentValue = `Текущая: ${upgrade.getValue().toFixed(1)}`;
                break;
            case 'speed':
                description = 'Скорость бега';
                currentValue = `Текущая: ${upgrade.getValue().toFixed(1)}`;
                break;
            case 'gravity':
                description = 'Легкость (меньше гравитация)';
                currentValue = `Текущая: ${upgrade.getValue().toFixed(2)}`;
                break;
            case 'coinMagnet':
                description = 'Магнит для монет';
                currentValue = upgrade.level > 0 ? 'Куплено (активно)' : 'Не куплено';
                break;
            case 'shield':
                description = 'Щит (спасение 1 раз)';
                currentValue = upgrade.level > 0 ? 'Куплено (активно)' : 'Не куплено';
                break;
        }
        
        item.innerHTML = `
            <div class="shop-item-info">
                <strong>${description}</strong>
                <span>Уровень: ${upgrade.level}/${upgrade.maxLevel}</span>
                <small>${currentValue}</small>
            </div>
            <div class="shop-item-price">
                ${upgrade.level < upgrade.maxLevel ? `${upgrade.getCost()} 🪙` : 'MAX'}
            </div>
        `;
        
        if (upgrade.level < upgrade.maxLevel) {
            item.addEventListener('click', () => purchaseUpgrade(key));
        } else {
            item.classList.add('max-level');
        }
        
        upgradeItemsContainer.appendChild(item);
    }
    
    // Скины
    const skinsDiv = document.createElement('div');
    skinsDiv.className = 'shop-section';
    skinsDiv.innerHTML = '<h3>Скины</h3>';
    
    for (let [key, skin] of Object.entries(skins)) {
        const skinItem = document.createElement('div');
        skinItem.className = 'shop-item skin-item';
        if (skin.equipped) skinItem.classList.add('equipped');
        
        const skinName = {
            classic: 'Классический',
            gold: 'Золотой',
            fire: 'Огненный',
            ghost: 'Призрачный',
            rainbow: 'Радужный'
        }[key];
        
        skinItem.innerHTML = `
            <div class="shop-item-info">
                <strong>${skinName}</strong>
                <span style="color: ${skin.color === 'rainbow' ? '#ffd700' : skin.color}; font-size: 20px;">⬤</span>
            </div>
            <div class="shop-item-price">
                ${!skin.owned ? `${skin.price} 🪙` : (skin.equipped ? '✓' : 'Надеть')}
            </div>
        `;
        
        skinItem.addEventListener('click', () => {
            if (!skin.owned) {
                purchaseSkin(key);
            } else if (!skin.equipped) {
                equipSkin(key);
            }
        });
        
        skinsDiv.appendChild(skinItem);
    }
    
    upgradeItemsContainer.appendChild(skinsDiv);
}

function purchaseUpgrade(upgradeKey) {
    const upgrade = upgrades[upgradeKey];
    if (upgrade.level >= upgrade.maxLevel) return;
    
    const cost = upgrade.getCost();
    if (playerCurrency >= cost) {
        playerCurrency -= cost;
        upgrade.level++;
        
        localStorage.setItem(`upgrade_${upgradeKey}`, upgrade.level);
        localStorage.setItem('slimeRunCurrency', playerCurrency);
        
        // Обновляем значения игрока
        if (upgradeKey === 'jumpPower') player.jumpPower = -upgrade.getValue();
        if (upgradeKey === 'gravity') player.gravity = upgrade.getValue();
        if (upgradeKey === 'speed') gameSpeed = upgrade.getValue();
        if (upgradeKey === 'coinMagnet') upgrade.active = true;
        if (upgradeKey === 'shield') upgrade.active = true;
        
        updateCurrencyDisplay();
        renderShop();
        
        vibrate();
        
        if (tg) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    } else {
        if (tg) {
            tg.HapticFeedback.notificationOccurred('error');
            tg.showPopup({
                title: 'Недостаточно монет',
                message: 'Играй и собирай больше 🪙!',
                buttons: [{type: 'ok'}]
            });
        }
    }
}

function purchaseSkin(skinKey) {
    const skin = skins[skinKey];
    if (playerCurrency >= skin.price) {
        playerCurrency -= skin.price;
        skin.owned = true;
        
        localStorage.setItem(`skin_${skinKey}`, 1);
        localStorage.setItem('slimeRunCurrency', playerCurrency);
        
        equipSkin(skinKey);
        
        updateCurrencyDisplay();
        renderShop();
        
        vibrate();
    }
}

function equipSkin(skinKey) {
    for (let [key, skin] of Object.entries(skins)) {
        skin.equipped = false;
        localStorage.setItem(`skin_${key}_equipped`, 0);
    }
    
    skins[skinKey].equipped = true;
    currentSkin = skinKey;
    localStorage.setItem(`skin_${skinKey}_equipped`, 1);
    
    renderShop();
}

// --- Игровой цикл ---
function gameLoop() {
    if (gameState === 'playing') {
        updateGame();
    }
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Обработчики событий ---
let touchStartTime = 0;
let touchEndTime = 0;

function handleStart(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;
    touchStartTime = Date.now();
}

function handleEnd(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;
    touchEndTime = Date.now();
    const pressDuration = (touchEndTime - touchStartTime) / 200;
    jump(Math.min(pressDuration, 1.2));
}

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchend', handleEnd, { passive: false });
canvas.addEventListener('touchcancel', handleEnd, { passive: false });
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mouseup', handleEnd);

// --- Кнопки ---
startGameBtn.addEventListener('click', () => {
    instructionOverlay.classList.add('hidden');
    gameState = 'playing';
    resetGame();
    
    if (tg) {
        tg.MainButton.text = 'Прыгнуть';
        tg.MainButton.show();
        tg.onEvent('mainButtonClicked', () => {
            if (gameState === 'playing') {
                jump(1.0);
            }
        });
    }
});

restartGameBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    gameState = 'playing';
    resetGame();
});

shopBtn.addEventListener('click', () => {
    gameState = 'shop';
    shopOverlay.classList.remove('hidden');
    renderShop();
    shopCoinsSpan.textContent = playerCurrency;
});

closeShopBtn.addEventListener('click', () => {
    shopOverlay.classList.add('hidden');
    gameState = 'idle';
});

// --- Инициализация ---
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight - 60;
    resetGame();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Проверка ежедневной награды
checkDailyReward();

// Показ инструкции при первом запуске
if (!localStorage.getItem('slimeRunTutorialShown')) {
    instructionOverlay.classList.remove('hidden');
    localStorage.setItem('slimeRunTutorialShown', 'true');
} else {
    instructionOverlay.classList.remove('hidden');
}

// Обновление отображения валюты
updateCurrencyDisplay();

// Запуск игрового цикла
gameLoop();
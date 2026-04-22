// ── Telegram Web App ──
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.enableClosingConfirmation();
}

// ── DOM элементы ──
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
const maxComboSpan = document.getElementById('maxCombo');
const newRecordBadge = document.getElementById('newRecordBadge');
const startGameBtn = document.getElementById('startGameBtn');
const restartGameBtn = document.getElementById('restartGameBtn');
const shopBtn = document.getElementById('shopBtn');
const menuShopBtn = document.getElementById('menuShopBtn');
const closeShopBtn = document.getElementById('closeShopBtn');
const upgradeItemsContainer = document.getElementById('upgradeItems');
const skinItemsContainer = document.getElementById('skinItems');
const comboIndicator = document.getElementById('comboIndicator');
const comboMultSpan = document.getElementById('comboMult');

// ── Валюта ──
let playerCurrency = parseInt(localStorage.getItem('slimeRunCurrency')) || 0;
let sessionEarnedCoins = 0;

// ── Улучшения ──
let upgrades = {
    jumpPower: { level: parseInt(localStorage.getItem('upgrade_jumpPower')) || 1, maxLevel: 5, baseCost: 100, getValue() { return 10 + this.level * 2; }, getCost() { return this.baseCost * this.level; } },
    speed: { level: parseInt(localStorage.getItem('upgrade_speed')) || 1, maxLevel: 5, baseCost: 150, getValue() { return 5 + this.level * 0.5; }, getCost() { return this.baseCost * this.level; } },
    gravity: { level: parseInt(localStorage.getItem('upgrade_gravity')) || 1, maxLevel: 3, baseCost: 200, getValue() { return 0.5 - this.level * 0.05; }, getCost() { return this.baseCost * this.level; } },
    coinMagnet: { level: parseInt(localStorage.getItem('upgrade_magnet')) || 0, maxLevel: 1, baseCost: 300, getCost() { return this.baseCost; } },
    shield: { level: parseInt(localStorage.getItem('upgrade_shield')) || 0, maxLevel: 1, baseCost: 500, getCost() { return this.baseCost; } },
    doubleJump: { level: parseInt(localStorage.getItem('upgrade_doubleJump')) || 0, maxLevel: 1, baseCost: 400, getCost() { return this.baseCost; } }
};

// ── Скины ──
const SKINS = {
    classic: { label: 'Классический', owned: true, equipped: true, color: '#7cc46b', eyeStyle: 'default', price: 0 },
    gold: { label: 'Золотой', owned: localStorage.getItem('skin_gold') === '1', equipped: localStorage.getItem('skin_gold_equipped') === '1', color: '#ffd700', eyeStyle: 'cool', price: 200 },
    fire: { label: 'Огненный', owned: localStorage.getItem('skin_fire') === '1', equipped: localStorage.getItem('skin_fire_equipped') === '1', color: '#ff6b35', eyeStyle: 'angry', price: 300 },
    ghost: { label: 'Призрак', owned: localStorage.getItem('skin_ghost') === '1', equipped: localStorage.getItem('skin_ghost_equipped') === '1', color: '#b19cd9', eyeStyle: 'scared', price: 400 },
    rainbow: { label: 'Радужный', owned: localStorage.getItem('skin_rainbow') === '1', equipped: localStorage.getItem('skin_rainbow_equipped') === '1', color: 'rainbow', eyeStyle: 'happy', price: 600 },
    dark: { label: 'Тёмный', owned: localStorage.getItem('skin_dark') === '1', equipped: localStorage.getItem('skin_dark_equipped') === '1', color: '#2d2d5e', eyeStyle: 'cool', price: 350 }
};

let currentSkin = 'classic';
for (let [key, skin] of Object.entries(SKINS)) {
    if (skin.equipped) { currentSkin = key; break; }
}

// ── Состояние игры ──
let gameState = 'idle';
let highScore = parseInt(localStorage.getItem('slimeRunHighScore')) || 0;
highScoreSpan.textContent = highScore;

// ── Игрок ──
let player = {
    x: 80, y: 0, width: 34, height: 34,
    vy: 0, grounded: true, jumpCount: 0,
    hasShield: false, shieldTimer: 0, squash: 1
};

// ── Игровые объекты ──
let obstacles = [];
let coins = [];
let particles = [];
let floatTexts = [];
let frame = 0;
let score = 0;
let gameSpeed = 5;
let combo = 0;
let comboMultiplier = 1;
let comboTimer = 0;
let maxComboThisRun = 1;
let magnetTimer = 0;

// ── Вспомогательные функции ──
function groundY() { return canvas.height - 90; }
function vibrate() { if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); }

function updateCurrencyDisplay() {
    coinsSpan.textContent = playerCurrency;
    if (shopCoinsSpan) shopCoinsSpan.textContent = playerCurrency;
}

function updateScore() {
    scoreSpan.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('slimeRunHighScore', highScore);
        highScoreSpan.textContent = highScore;
    }
}

function updateComboDisplay() {
    if (comboMultiplier > 1) {
        comboIndicator.classList.remove('hidden');
        comboMultSpan.textContent = comboMultiplier;
    } else {
        comboIndicator.classList.add('hidden');
    }
}

// ── Отрисовка ──
function drawGround() {
    const gY = groundY();
    ctx.fillStyle = '#3d2010';
    ctx.fillRect(0, gY + 20, canvas.width, canvas.height - gY - 20);
    ctx.fillStyle = '#4a8c2a';
    ctx.fillRect(0, gY + 10, canvas.width, 15);
}

function drawSlime() {
    const skin = SKINS[currentSkin];
    const cx = player.x + player.width/2;
    const cy = player.y + player.height/2;
    const rx = player.width/2;
    const ry = (player.height/2) * player.squash;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    if (skin.color === 'rainbow') {
        const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
        g.addColorStop(0, '#ff4444'); g.addColorStop(0.5, '#44ff44'); g.addColorStop(1, '#4444ff');
        ctx.fillStyle = g;
    } else {
        ctx.fillStyle = skin.color;
    }
    
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (player.hasShield) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx + 7, ry + 7, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Глаза
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-rx*0.3, -ry*0.15, rx*0.18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx*0.3, -ry*0.15, rx*0.18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-rx*0.3, -ry*0.1, rx*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx*0.3, -ry*0.1, rx*0.09, 0, Math.PI*2); ctx.fill();
    
    // Рот
    ctx.beginPath();
    ctx.arc(0, ry*0.25, rx*0.22, 0, Math.PI, true);
    ctx.stroke();
    
    ctx.restore();
}

function drawObstacle(obs) {
    if (obs.type === 'rock') {
        ctx.fillStyle = '#8a8a8a';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    } else if (obs.type === 'spike') {
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width/2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.fill();
    }
}

function drawCoin(coin) {
    ctx.fillStyle = '#f5d742';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(coin.x + 8, coin.y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c8a800';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('$', coin.x + 8, coin.y + 11);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0d0d2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGround();
    
    for (let coin of coins) drawCoin(coin);
    for (let obs of obstacles) drawObstacle(obs);
    drawSlime();
    
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    
    for (let t of floatTexts) {
        ctx.globalAlpha = t.life;
        ctx.fillStyle = t.color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
}

// ── Игровая логика ──
function spawnObstacle() {
    const type = Math.random() < 0.6 ? 'rock' : 'spike';
    const gY = groundY();
    obstacles.push({
        x: canvas.width,
        y: gY - 22,
        width: 26,
        height: 24,
        type: type,
        passed: false
    });
}

function spawnCoin() {
    if (Math.random() > 0.4) return;
    const gY = groundY();
    coins.push({
        x: canvas.width,
        y: gY - 60 - Math.random() * 40,
        width: 16, height: 16,
        value: 5 + Math.floor(Math.random() * 6)
    });
}

function jump(pressDuration = 1.0) {
    if (gameState !== 'playing') return;
    const canJump = player.grounded || (upgrades.doubleJump.level > 0 && player.jumpCount < 2);
    if (!canJump) return;
    
    vibrate();
    const power = upgrades.jumpPower.getValue();
    const multiplier = Math.min(1.0 + pressDuration * 0.8, 1.8);
    player.vy = -(power * multiplier);
    player.grounded = false;
    player.jumpCount++;
    player.squash = 0.7;
}

function addCombo() {
    combo++;
    comboTimer = 60;
    comboMultiplier = 1 + Math.floor(combo / 3);
    if (comboMultiplier > maxComboThisRun) maxComboThisRun = comboMultiplier;
    updateComboDisplay();
}

function resetCombo() {
    combo = 0;
    comboMultiplier = 1;
    comboTimer = 0;
    updateComboDisplay();
}

function updateGame() {
    if (gameState !== 'playing') return;
    
    // Обновление щита
    if (player.hasShield && player.shieldTimer > 0) {
        player.shieldTimer--;
    } else {
        player.hasShield = false;
    }
    
    // Комбо таймер
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) resetCombo();
    }
    
    // Гравитация
    player.vy += upgrades.gravity.getValue();
    player.y += player.vy;
    player.squash += (player.grounded ? (1 - player.squash) * 0.3 : (1 - player.squash) * 0.15);
    
    const gY = groundY();
    if (player.y + player.height >= gY + 15) {
        player.y = gY + 15 - player.height;
        player.vy = 0;
        player.grounded = true;
        player.jumpCount = 0;
        player.squash = 0.85;
    } else {
        player.grounded = false;
    }
    
    // Скорость игры
    const speed = upgrades.speed.getValue() + Math.min(frame / 600, 3);
    gameSpeed = speed;
    
    // Движение препятствий
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= speed;
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            continue;
        }
        if (!obs.passed && obs.x + obs.width < player.x) {
            obs.passed = true;
            score += 1 * comboMultiplier;
            addCombo();
            updateScore();
        }
    }
    
    // Движение монет
    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].x -= speed;
        if (coins[i].x + coins[i].width < 0) {
            coins.splice(i, 1);
        }
    }
    
    // Магнит
    if (upgrades.coinMagnet.level > 0 || magnetTimer > 0) {
        for (let coin of coins) {
            const dx = player.x - coin.x;
            const dy = player.y - coin.y;
            if (Math.sqrt(dx*dx + dy*dy) < 150) {
                coin.x += dx * 0.1;
                coin.y += dy * 0.1;
            }
        }
        if (magnetTimer > 0) magnetTimer--;
    }
    
    // Коллизии с препятствиями
    const playerBox = { x: player.x + 5, y: player.y + 5, width: 24, height: 24 };
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        const obsBox = { x: obs.x + 5, y: obs.y + 5, width: obs.width - 10, height: obs.height - 10 };
        if (playerBox.x < obsBox.x + obsBox.width &&
            playerBox.x + playerBox.width > obsBox.x &&
            playerBox.y < obsBox.y + obsBox.height &&
            playerBox.y + playerBox.height > obsBox.y) {
            if (player.hasShield) {
                player.hasShield = false;
                obstacles.splice(i, 1);
            } else {
                gameOver();
                return;
            }
        }
    }
    
    // Сбор монет
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        if (playerBox.x < coin.x + 16 && playerBox.x + 24 > coin.x &&
            playerBox.y < coin.y + 16 && playerBox.y + 24 > coin.y) {
            const earned = coin.value * comboMultiplier;
            playerCurrency += earned;
            sessionEarnedCoins += earned;
            score += 1;
            localStorage.setItem('slimeRunCurrency', playerCurrency);
            updateCurrencyDisplay();
            updateScore();
            coins.splice(i, 1);
            floatTexts.push({ x: coin.x + 8, y: coin.y, text: `+${earned}`, color: '#f5d742', life: 1, vy: -1.5 });
            vibrate();
        }
    }
    
    // Анимация текста
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        floatTexts[i].y += floatTexts[i].vy;
        floatTexts[i].life -= 0.03;
        if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
    }
    
    // Частицы
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].vy += 0.2;
        particles[i].life -= 0.03;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    // Спавн
    frame++;
    if (frame % Math.max(40, 70 - Math.floor(speed * 2)) === 0) {
        spawnObstacle();
        spawnCoin();
    }
}

function resetGame() {
    score = 0;
    sessionEarnedCoins = 0;
    frame = 0;
    maxComboThisRun = 1;
    combo = 0;
    comboMultiplier = 1;
    comboTimer = 0;
    obstacles = [];
    coins = [];
    particles = [];
    floatTexts = [];
    magnetTimer = 0;
    
    const gY = groundY();
    player.y = gY + 15 - player.height;
    player.vy = 0;
    player.grounded = true;
    player.jumpCount = 0;
    player.squash = 1;
    player.hasShield = upgrades.shield.level > 0;
    player.shieldTimer = player.hasShield ? 9999 : 0;
    
    updateScore();
    updateCurrencyDisplay();
    updateComboDisplay();
}

function gameOver() {
    gameState = 'gameOver';
    finalScoreSpan.textContent = score;
    finalHighScoreSpan.textContent = highScore;
    earnedCoinsSpan.textContent = sessionEarnedCoins;
    maxComboSpan.textContent = maxComboThisRun;
    
    const isNew = score >= highScore && score > 0;
    newRecordBadge.classList.toggle('hidden', !isNew);
    gameOverOverlay.classList.remove('hidden');
    
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
}

// ── Магазин ──
function renderShop() {
    upgradeItemsContainer.innerHTML = '';
    for (let [key, up] of Object.entries(upgrades)) {
        const isMax = up.level >= up.maxLevel;
        const item = document.createElement('div');
        item.className = 'shop-item' + (isMax ? ' max-level' : '');
        item.innerHTML = `
            <div class="shop-item-info"><strong>${key === 'jumpPower' ? 'Сила прыжка' : key === 'speed' ? 'Скорость' : key === 'gravity' ? 'Лёгкость' : key === 'coinMagnet' ? 'Магнит' : key === 'shield' ? 'Щит' : 'Двойной прыжок'}</strong><span>Ур. ${up.level}/${up.maxLevel}</span></div>
            <div class="shop-item-price">${isMax ? 'MAX' : up.getCost() + ' 🪙'}</div>
        `;
        if (!isMax) item.addEventListener('click', () => purchaseUpgrade(key));
        upgradeItemsContainer.appendChild(item);
    }
    
    skinItemsContainer.innerHTML = '';
    for (let [key, skin] of Object.entries(SKINS)) {
        const item = document.createElement('div');
        item.className = 'shop-item' + (skin.equipped ? ' equipped' : '');
        item.innerHTML = `
            <div style="width:30px;height:30px;background:${skin.color === 'rainbow' ? 'linear-gradient(45deg,red,orange,yellow,green,blue,indigo,violet)' : skin.color};border-radius:50%;"></div>
            <div class="shop-item-info"><strong>${skin.label}</strong></div>
            <div class="shop-item-price">${!skin.owned ? skin.price + ' 🪙' : (skin.equipped ? '✓' : 'Надеть')}</div>
        `;
        item.addEventListener('click', () => {
            if (!skin.owned) purchaseSkin(key);
            else if (!skin.equipped) equipSkin(key);
        });
        skinItemsContainer.appendChild(item);
    }
}

function purchaseUpgrade(key) {
    const up = upgrades[key];
    if (up.level >= up.maxLevel || playerCurrency < up.getCost()) return;
    playerCurrency -= up.getCost();
    up.level++;
    localStorage.setItem(`upgrade_${key}`, up.level);
    localStorage.setItem('slimeRunCurrency', playerCurrency);
    updateCurrencyDisplay();
    renderShop();
    vibrate();
}

function purchaseSkin(key) {
    const skin = SKINS[key];
    if (playerCurrency < skin.price) return;
    playerCurrency -= skin.price;
    skin.owned = true;
    localStorage.setItem(`skin_${key}`, '1');
    localStorage.setItem('slimeRunCurrency', playerCurrency);
    equipSkin(key);
    updateCurrencyDisplay();
    renderShop();
}

function equipSkin(key) {
    for (let [k, s] of Object.entries(SKINS)) {
        s.equipped = false;
        localStorage.setItem(`skin_${k}_equipped`, '0');
    }
    SKINS[key].equipped = true;
    currentSkin = key;
    localStorage.setItem(`skin_${key}_equipped`, '1');
    renderShop();
}

// ── Ежедневная награда ──
function checkDailyReward() {
    const lastLogin = localStorage.getItem('lastLogin');
    const today = new Date().toDateString();
    if (lastLogin !== today) {
        playerCurrency += 50;
        localStorage.setItem('slimeRunCurrency', playerCurrency);
        localStorage.setItem('lastLogin', today);
        updateCurrencyDisplay();
    }
}

// ── Обработчики касаний ──
let touchStartTime = 0;
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameState === 'playing') touchStartTime = Date.now(); });
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState === 'playing') {
        const duration = (Date.now() - touchStartTime) / 200;
        jump(Math.min(duration, 1.2));
    }
});
canvas.addEventListener('mousedown', () => { if (gameState === 'playing') touchStartTime = Date.now(); });
canvas.addEventListener('mouseup', () => { if (gameState === 'playing') jump(1.0); });

// ── Кнопки ──
startGameBtn.addEventListener('click', () => {
    instructionOverlay.classList.add('hidden');
    gameState = 'playing';
    resetGame();
});

restartGameBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    gameState = 'playing';
    resetGame();
});

menuShopBtn.addEventListener('click', () => {
    instructionOverlay.classList.add('hidden');
    shopOverlay.classList.remove('hidden');
    renderShop();
    updateCurrencyDisplay();
});

shopBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    shopOverlay.classList.remove('hidden');
    renderShop();
    updateCurrencyDisplay();
});

closeShopBtn.addEventListener('click', () => {
    shopOverlay.classList.add('hidden');
});

// ── Кнопка выхода ──
const exitBtn = document.getElementById('exitBtn');
if (exitBtn) {
    exitBtn.addEventListener('click', () => {
        if (tg) tg.close();
        else window.close();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (tg) tg.close();
        else window.close();
    }
});

// ── Инициализация ──
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight - 50;
    resetGame();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
checkDailyReward();
updateCurrencyDisplay();
highScoreSpan.textContent = highScore;

if (tg?.initDataUnsafe?.user) {
    playerGreeting.textContent = `Привет, ${tg.initDataUnsafe.user.first_name}!`;
}

// Запуск игры
gameLoop();

function gameLoop() {
    if (gameState === 'playing') updateGame();
    draw();
    requestAnimationFrame(gameLoop);
}

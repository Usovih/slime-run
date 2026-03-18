// ── Telegram Web App ──
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor('bg_color');
}

// ── DOM ──
const canvas      = document.getElementById('gameCanvas');
const ctx         = canvas.getContext('2d');
const scoreSpan   = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const coinsSpan   = document.getElementById('coinsCount');
const shopCoinsSpan = document.getElementById('shopCoins');
const playerGreeting = document.getElementById('playerGreeting');
const instructionOverlay = document.getElementById('instructionOverlay');
const gameOverOverlay    = document.getElementById('gameOverOverlay');
const shopOverlay        = document.getElementById('shopOverlay');
const finalScoreSpan     = document.getElementById('finalScore');
const finalHighScoreSpan = document.getElementById('finalHighScore');
const earnedCoinsSpan    = document.getElementById('earnedCoins');
const maxComboSpan       = document.getElementById('maxCombo');
const newRecordBadge     = document.getElementById('newRecordBadge');
const startGameBtn       = document.getElementById('startGameBtn');
const restartGameBtn     = document.getElementById('restartGameBtn');
const shopBtn            = document.getElementById('shopBtn');
const menuShopBtn        = document.getElementById('menuShopBtn');
const closeShopBtn       = document.getElementById('closeShopBtn');
const upgradeItemsContainer = document.getElementById('upgradeItems');
const skinItemsContainer    = document.getElementById('skinItems');
const comboIndicator        = document.getElementById('comboIndicator');
const comboMultSpan         = document.getElementById('comboMult');
const skinPreviewCanvas     = document.getElementById('skinPreviewCanvas');
const skinPreviewCtx        = skinPreviewCanvas.getContext('2d');

// ── Валюта и прогресс ──
let playerCurrency   = parseInt(localStorage.getItem('slimeRunCurrency')) || 0;
let sessionEarnedCoins = 0;

// ── Улучшения ──
let upgrades = {
    jumpPower: {
        label: 'Сила прыжка', icon: '🦘',
        level: parseInt(localStorage.getItem('upgrade_jumpPower')) || 1,
        maxLevel: 5, baseCost: 100,
        getValue() { return 10 + this.level * 2; },
        getCost()  { return this.baseCost * this.level; }
    },
    speed: {
        label: 'Скорость', icon: '💨',
        level: parseInt(localStorage.getItem('upgrade_speed')) || 1,
        maxLevel: 5, baseCost: 150,
        getValue() { return 5 + this.level * 0.5; },
        getCost()  { return this.baseCost * this.level; }
    },
    gravity: {
        label: 'Лёгкость', icon: '🪁',
        level: parseInt(localStorage.getItem('upgrade_gravity')) || 1,
        maxLevel: 3, baseCost: 200,
        getValue() { return 0.5 - this.level * 0.05; },
        getCost()  { return this.baseCost * this.level; }
    },
    coinMagnet: {
        label: 'Магнит монет', icon: '🧲',
        level: parseInt(localStorage.getItem('upgrade_magnet')) || 0,
        maxLevel: 1, baseCost: 300,
        getCost() { return this.baseCost; }
    },
    shield: {
        label: 'Щит', icon: '🛡️',
        level: parseInt(localStorage.getItem('upgrade_shield')) || 0,
        maxLevel: 1, baseCost: 500,
        getCost() { return this.baseCost; }
    },
    doubleJump: {
        label: 'Двойной прыжок', icon: '✌️',
        level: parseInt(localStorage.getItem('upgrade_doubleJump')) || 0,
        maxLevel: 1, baseCost: 400,
        getCost() { return this.baseCost; }
    }
};

// ── Скины ──
const SKINS = {
    classic: { label: 'Классический', owned: true,  equipped: true,  color: '#7cc46b', eyeStyle: 'default', price: 0   },
    gold:    { label: 'Золотой',       owned: false, equipped: false, color: '#ffd700', eyeStyle: 'cool',    price: 200 },
    fire:    { label: 'Огненный',      owned: false, equipped: false, color: '#ff6b35', eyeStyle: 'angry',   price: 300 },
    ghost:   { label: 'Призрак',       owned: false, equipped: false, color: '#b19cd9', eyeStyle: 'scared',  price: 400 },
    rainbow: { label: 'Радужный',      owned: false, equipped: false, color: 'rainbow', eyeStyle: 'happy',   price: 600 },
    dark:    { label: 'Тёмный',        owned: false, equipped: false, color: '#2d2d5e', eyeStyle: 'cool',    price: 350 },
};

// Загружаем состояние скинов
for (let [key] of Object.entries(SKINS)) {
    if (key === 'classic') continue;
    SKINS[key].owned    = localStorage.getItem(`skin_${key}`) === '1';
    SKINS[key].equipped = localStorage.getItem(`skin_${key}_equipped`) === '1';
}

let currentSkin = 'classic';
for (let [key, skin] of Object.entries(SKINS)) {
    if (skin.equipped) { currentSkin = key; break; }
}

// ── Состояние игры ──
let gameState = 'idle';
let animationFrameId = null;
let highScore = parseInt(localStorage.getItem('slimeRunHighScore')) || 0;
highScoreSpan.textContent = highScore;

// ── Игрок ──
let player = {
    x: 80, y: 0,
    width: 34, height: 34,
    vy: 0,
    gravity: 0.55,
    jumpPower: -12,
    grounded: true,
    jumpCount: 0,
    maxJumps: 1,
    isJumping: false,
    hasShield: false,
    shieldTimer: 0,
    squash: 1,      // визуальный squash
    squashVy: 0,
};

// ── Игровые объекты ──
let obstacles = [];
let coins = [];
let particles = [];
let bgLayers = [];

// ── Прогресс сессии ──
let frame = 0;
let score = 0;
let gameSpeed = 5;
let spawnCounter = 0;

// ── Комбо ──
let combo = 0;
let comboMultiplier = 1;
let comboTimer = 0;
let maxComboThisRun = 1;
const COMBO_TIMEOUT = 120;

// ── Магнит ──
let magnetTimer = 0;

// ── Фон (параллакс) ──
function initBg() {
    bgLayers = [
        { items: [], speed: 0.2, y: 0.35, color: 'rgba(255,255,255,0.04)', size: 60, type: 'mountain' },
        { items: [], speed: 0.5, y: 0.25, color: 'rgba(255,255,255,0.06)', size: 35, type: 'cloud' },
        { items: [], speed: 1.2, y: 0.18, color: 'rgba(255,255,255,0.04)', size: 18, type: 'cloud' },
    ];

    for (let layer of bgLayers) {
        for (let i = 0; i < 6; i++) {
            layer.items.push({
                x: Math.random() * (canvas.width * 1.5),
                size: layer.size * (0.7 + Math.random() * 0.6),
                opacity: 0.5 + Math.random() * 0.5
            });
        }
    }
}

function drawBg() {
    // Небо — градиент
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0,   '#0d0d2b');
    skyGrad.addColorStop(0.6, '#1a1a40');
    skyGrad.addColorStop(1,   '#2a1a10');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Звёзды (только верхняя часть)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    // Используем frame как seed для стабильных позиций
    const starSeed = 42;
    for (let i = 0; i < 40; i++) {
        const sx = ((i * 137 + starSeed) % canvas.width);
        const sy = ((i * 97  + starSeed) % (canvas.height * 0.45));
        const blink = Math.sin(frame * 0.02 + i) * 0.5 + 0.5;
        ctx.globalAlpha = blink * 0.7;
        ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // Слои параллакса
    for (let layer of bgLayers) {
        const baseY = canvas.height * layer.y;
        for (let item of layer.items) {
            ctx.globalAlpha = item.opacity * 0.4;
            ctx.fillStyle = layer.color;
            if (layer.type === 'mountain') {
                ctx.beginPath();
                ctx.moveTo(item.x, baseY + 10);
                ctx.lineTo(item.x + item.size * 0.5, baseY - item.size * 0.7);
                ctx.lineTo(item.x + item.size, baseY + 10);
                ctx.closePath();
                ctx.fill();
            } else {
                // облако
                ctx.beginPath();
                ctx.ellipse(item.x, baseY, item.size, item.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(item.x - item.size * 0.4, baseY + 4, item.size * 0.6, item.size * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(item.x + item.size * 0.4, baseY + 4, item.size * 0.6, item.size * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.globalAlpha = 1;
}

function updateBg() {
    for (let layer of bgLayers) {
        for (let item of layer.items) {
            item.x -= layer.speed * (gameSpeed / 5);
            if (item.x + layer.size < 0) {
                item.x = canvas.width + layer.size;
            }
        }
    }
}

// ── Земля ──
function drawGround() {
    const gY = groundY();
    // Земля
    const groundGrad = ctx.createLinearGradient(0, gY + 20, 0, canvas.height);
    groundGrad.addColorStop(0, '#3d2010');
    groundGrad.addColorStop(1, '#1a0a05');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, gY + 20, canvas.width, canvas.height - gY - 20);

    // Трава
    const grassGrad = ctx.createLinearGradient(0, gY + 10, 0, gY + 25);
    grassGrad.addColorStop(0, '#4a8c2a');
    grassGrad.addColorStop(1, '#2d5c18');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, gY + 10, canvas.width, 15);

    // Линия
    ctx.strokeStyle = '#6ab83a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gY + 10);
    ctx.lineTo(canvas.width, gY + 10);
    ctx.stroke();
}

function groundY() {
    return canvas.height - 90;
}

// ── Слизень ──
function drawSlime(x, y, w, h, opts = {}) {
    const { isSad = false, eyeStyle = 'default', color = '#7cc46b', hasShield = false, squash = 1 } = opts;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = (h / 2) * squash;

    ctx.save();
    ctx.translate(cx, cy);

    // Тело
    if (color === 'rainbow') {
        const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
        g.addColorStop(0,   '#ff4444');
        g.addColorStop(0.2, '#ff8800');
        g.addColorStop(0.4, '#ffee00');
        g.addColorStop(0.6, '#44ff44');
        g.addColorStop(0.8, '#4488ff');
        g.addColorStop(1,   '#ff44ff');
        ctx.fillStyle = g;
    } else {
        ctx.fillStyle = color;
    }

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Блик
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.2, -ry * 0.3, rx * 0.35, ry * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Щит
    if (hasShield) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx + 7, ry + 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Глаза
    const eyeOffX = rx * 0.3;
    const eyeOffY = -ry * 0.15;
    const eyeR    = rx * 0.18;

    if (eyeStyle === 'cool') {
        // очки-слоты
        ctx.fillStyle = '#111';
        ctx.fillRect(-rx * 0.55, eyeOffY - eyeR * 0.6, rx * 0.38, eyeR * 1.2);
        ctx.fillRect(rx * 0.15,  eyeOffY - eyeR * 0.6, rx * 0.38, eyeR * 1.2);
    } else {
        // белки
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(-eyeOffX, eyeOffY, eyeR, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeOffX, eyeOffY, eyeR, 0, Math.PI*2); ctx.fill();

        // зрачки
        const pupilColor = eyeStyle === 'angry' ? '#c00' : (eyeStyle === 'scared' ? '#44f' : '#222');
        const pupilOff   = isSad ? 0 : eyeR * 0.15;
        ctx.fillStyle = pupilColor;
        ctx.beginPath(); ctx.arc(-eyeOffX, eyeOffY + pupilOff, eyeR * 0.55, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeOffX, eyeOffY + pupilOff, eyeR * 0.55, 0, Math.PI*2); ctx.fill();

        // сердитые брови
        if (eyeStyle === 'angry') {
            ctx.strokeStyle = '#700'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-eyeOffX - eyeR, eyeOffY - eyeR * 1.4);
            ctx.lineTo(-eyeOffX + eyeR, eyeOffY - eyeR * 0.8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo( eyeOffX - eyeR, eyeOffY - eyeR * 0.8);
            ctx.lineTo( eyeOffX + eyeR, eyeOffY - eyeR * 1.4);
            ctx.stroke();
        }
    }

    // Рот
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (isSad) {
        ctx.arc(0, ry * 0.35, rx * 0.25, 0, Math.PI, false);
    } else {
        ctx.arc(0, ry * 0.25, rx * 0.22, 0, Math.PI, true);
    }
    ctx.stroke();

    ctx.restore();
}

// ── Препятствия ──
const OBS_TYPES = ['rock', 'spike', 'cactus', 'flying'];

function spawnObstacle() {
    const difficulty = Math.min(frame / 1000, 1);
    const rand = Math.random();

    let type;
    if (rand < 0.45) type = 'rock';
    else if (rand < 0.75) type = 'spike';
    else if (rand < 0.90) type = 'cactus';
    else type = 'flying';

    const gY = groundY();

    let obs = { x: canvas.width, type, passed: false };

    switch (type) {
        case 'rock':
            obs.y = gY - 18;
            obs.width = 26 + Math.random() * 12;
            obs.height = 22 + Math.random() * 10;
            break;
        case 'spike':
            obs.y = gY - 22;
            obs.width = 22;
            obs.height = 26;
            break;
        case 'cactus':
            obs.y = gY - 38;
            obs.width = 18;
            obs.height = 42;
            break;
        case 'flying':
            obs.y = gY - 80 - Math.random() * 40;
            obs.width = 30;
            obs.height = 18;
            obs.floatOffset = Math.random() * Math.PI * 2;
            break;
    }

    obstacles.push(obs);
}

function drawObstacle(obs) {
    const gY = groundY();

    switch (obs.type) {
        case 'rock': {
            const g = ctx.createRadialGradient(obs.x + obs.width*0.4, obs.y + obs.height*0.35, 2, obs.x+obs.width/2, obs.y+obs.height/2, obs.width*0.6);
            g.addColorStop(0, '#aaa');
            g.addColorStop(1, '#555');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 6);
            ctx.fill();
            // трещины
            ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.width*0.3, obs.y + 4);
            ctx.lineTo(obs.x + obs.width*0.5, obs.y + obs.height*0.6);
            ctx.stroke();
            break;
        }
        case 'spike': {
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.moveTo(obs.x,              obs.y + obs.height);
            ctx.lineTo(obs.x + obs.width/2, obs.y);
            ctx.lineTo(obs.x + obs.width,  obs.y + obs.height);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.width*0.2, obs.y + obs.height);
            ctx.lineTo(obs.x + obs.width*0.5, obs.y + 8);
            ctx.lineTo(obs.x + obs.width*0.8, obs.y + obs.height);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'cactus': {
            ctx.fillStyle = '#27ae60';
            // ствол
            ctx.fillRect(obs.x + obs.width*0.35, obs.y, obs.width*0.3, obs.height);
            // ветки
            ctx.fillRect(obs.x, obs.y + obs.height*0.35, obs.width*0.4, obs.height*0.12);
            ctx.fillRect(obs.x + obs.width*0.6, obs.y + obs.height*0.5, obs.width*0.4, obs.height*0.12);
            // шипы
            ctx.fillStyle = '#1e8449';
            ctx.fillRect(obs.x + obs.width*0.3, obs.y + 2, obs.width*0.4, 6);
            break;
        }
        case 'flying': {
            const floatY = obs.y + Math.sin(frame * 0.08 + obs.floatOffset) * 6;
            ctx.fillStyle = '#8e44ad';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            // UFO-ок
            ctx.ellipse(obs.x + obs.width/2, floatY + obs.height/2, obs.width/2, obs.height/2, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(180,100,255,0.5)';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width/2, floatY + obs.height*0.3, obs.width*0.3, obs.height*0.25, 0, 0, Math.PI*2);
            ctx.fill();
            // сохраняем реальный y для коллизий
            obs._floatY = floatY;
            break;
        }
    }
}

function getObsHitbox(obs) {
    const margin = 5;
    if (obs.type === 'flying') {
        return { x: obs.x + margin, y: (obs._floatY || obs.y) + margin, width: obs.width - margin*2, height: obs.height - margin*2 };
    }
    if (obs.type === 'spike') {
        return { x: obs.x + margin*2, y: obs.y + margin, width: obs.width - margin*4, height: obs.height - margin };
    }
    return { x: obs.x + margin, y: obs.y + margin, width: obs.width - margin*2, height: obs.height - margin*2 };
}

// ── Монеты ──
function spawnCoin() {
    if (Math.random() > 0.45) return;
    const gY = groundY();
    const inCluster = Math.random() < 0.3;
    const count = inCluster ? 3 : 1;
    for (let i = 0; i < count; i++) {
        coins.push({
            x: canvas.width + i * 28,
            y: gY - 60 - Math.random() * 50,
            width: 16, height: 16,
            value: 3 + Math.floor(Math.random() * 5),
            wobble: Math.random() * Math.PI * 2
        });
    }
}

function drawCoin(coin) {
    const wobbleY = Math.sin(frame * 0.1 + coin.wobble) * 3;
    const cx = coin.x + coin.width / 2;
    const cy = coin.y + coin.height / 2 + wobbleY;
    const r  = coin.width / 2;

    ctx.fillStyle = '#f5d742';
    ctx.shadowColor = '#f0b400';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#c8a800';
    ctx.font = `bold ${r * 1.2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

// ── Частицы ──
function spawnParticles(x, y, color, count = 8, type = 'burst') {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
        const speed = 2 + Math.random() * 4;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (type === 'jump' ? 2 : 0),
            life: 1,
            decay: 0.04 + Math.random() * 0.03,
            size: 4 + Math.random() * 4,
            color,
            type
        });
    }
}

function spawnJumpDust(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x + Math.random() * 30,
            y,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 1.5,
            life: 1,
            decay: 0.06,
            size: 6 + Math.random() * 6,
            color: '#9a7040',
            type: 'dust'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (p.type === 'dust') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(p.x, p.y, p.size * p.life, p.size * p.life);
        }
    }
    ctx.globalAlpha = 1;
}

// ── Текст "+N" при сборе монеты ──
let floatTexts = [];

function spawnFloatText(x, y, text, color = '#f5d742') {
    floatTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
}

function updateFloatTexts() {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        const t = floatTexts[i];
        t.y  += t.vy;
        t.life -= 0.03;
        if (t.life <= 0) floatTexts.splice(i, 1);
    }
}

function drawFloatTexts() {
    for (let t of floatTexts) {
        ctx.globalAlpha = t.life;
        ctx.fillStyle = t.color;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
}

// ── Коллизии ──
function detectCollision(a, b) {
    return a.x < b.x + b.width  &&
           a.x + a.width > b.x  &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function getPlayerHitbox() {
    const margin = 5;
    return {
        x: player.x + margin,
        y: player.y + margin,
        width:  player.width  - margin * 2,
        height: player.height - margin * 2
    };
}

// ── Физика ──
function jump(pressDuration = 1.0) {
    if (gameState !== 'playing') return;
    const canJump = player.grounded || (upgrades.doubleJump.level > 0 && player.jumpCount < 2);
    if (!canJump) return;

    vibrate();

    const power    = upgrades.jumpPower.getValue();
    const multiplier = Math.min(1.0 + pressDuration * 0.8, 1.8);
    player.vy       = -(power * multiplier);
    player.grounded = false;
    player.isJumping = true;
    player.jumpCount++;
    player.squash   = 0.7;

    spawnJumpDust(player.x, player.y + player.height);

    if (player.jumpCount === 2) {
        spawnParticles(player.x + player.width / 2, player.y + player.height, '#80d0ff', 6, 'jump');
    }
}

// ── Комбо ──
function addCombo() {
    combo++;
    comboTimer = COMBO_TIMEOUT;
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

function updateComboDisplay() {
    if (comboMultiplier > 1) {
        comboIndicator.classList.remove('hidden');
        comboMultSpan.textContent = comboMultiplier;
        comboIndicator.style.animation = 'none';
        void comboIndicator.offsetWidth;
        comboIndicator.style.animation = 'comboPulse 0.3s ease';
    } else {
        comboIndicator.classList.add('hidden');
    }
}

// ── Магнит ──
function applyMagnet() {
    const hasMagnet = upgrades.coinMagnet.level > 0 || magnetTimer > 0;
    if (!hasMagnet) return;
    for (let coin of coins) {
        const dx = player.x - coin.x;
        const dy = player.y - coin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
            coin.x += dx * 0.08;
            coin.y += dy * 0.08;
        }
    }
    if (magnetTimer > 0) magnetTimer--;
}

// ── Обновление игры ──
function updateGame() {
    if (gameState !== 'playing') return;

    // Щит
    if (player.hasShield && player.shieldTimer > 0) {
        player.shieldTimer--;
    } else if (player.shieldTimer <= 0) {
        player.hasShield = false;
    }

    // Комбо таймер
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) resetCombo();
    }

    // Гравитация
    const grav = upgrades.gravity.getValue();
    player.vy += grav;
    player.y  += player.vy;

    // Squash & stretch
    if (!player.grounded) {
        player.squash += (1 - player.squash) * 0.15;
        if (player.vy < 0) player.squash = Math.max(0.75, player.squash);
        else player.squash = Math.min(1.1, player.squash);
    } else {
        player.squash += (1 - player.squash) * 0.3;
    }

    const gY = groundY();
    if (player.y + player.height >= gY + 15) {
        player.y       = gY + 15 - player.height;
        player.vy      = 0;
        player.grounded = true;
        player.isJumping = false;
        player.jumpCount = 0;
        if (player.squash < 0.9) {
            spawnJumpDust(player.x, player.y + player.height);
        }
        player.squash = 0.85;
    } else {
        player.grounded = false;
    }

    // Препятствия
    const speed = upgrades.speed.getValue() + Math.min(frame / 600, 3);
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= speed;
        if (obs.x + obs.width < 0) { obstacles.splice(i, 1); continue; }

        if (!obs.passed && obs.x + obs.width < player.x) {
            obs.passed = true;
            score += 1 * comboMultiplier;
            addCombo();
            updateScore();
        }
    }

    // Монеты
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.x -= speed;
        if (coin.x + coin.width < 0) { coins.splice(i, 1); continue; }
    }

    applyMagnet();
    updateBg();

    // Коллизии с препятствиями
    const ph = getPlayerHitbox();
    for (let obs of obstacles) {
        const oh = getObsHitbox(obs);
        if (detectCollision(ph, oh)) {
            if (player.hasShield) {
                player.hasShield = false;
                player.shieldTimer = 0;
                obstacles.splice(obstacles.indexOf(obs), 1);
                spawnParticles(obs.x + obs.width/2, obs.y, '#00d4ff', 12);
                vibrate(50);
            } else {
                gameOver();
                return;
            }
        }
    }

    // Сбор монет
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        if (detectCollision(ph, { x: coin.x, y: coin.y, width: coin.width, height: coin.height })) {
            coins.splice(i, 1);
            const earned = coin.value * comboMultiplier;
            playerCurrency   += earned;
            sessionEarnedCoins += earned;
            localStorage.setItem('slimeRunCurrency', playerCurrency);
            updateCurrencyDisplay();
            spawnParticles(coin.x, coin.y, '#f5d742', 6);
            spawnFloatText(coin.x + 8, coin.y, `+${earned}`, '#f5d742');
            vibrate(10);
        }
    }

    // Спавн
    frame++;
    const spawnInterval = Math.max(38, 80 - Math.floor(speed * 3));
    if (frame % spawnInterval === 0) {
        spawnObstacle();
        spawnCoin();
    }

    updateParticles();
    updateFloatTexts();
}

// ── Отрисовка ──
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBg();
    drawGround();

    for (let coin of coins) drawCoin(coin);
    for (let obs  of obstacles) drawObstacle(obs);

    drawParticles();

    const skin = SKINS[currentSkin];
    drawSlime(player.x, player.y, player.width, player.height, {
        isSad:     gameState === 'gameOver',
        eyeStyle:  skin.eyeStyle,
        color:     skin.color,
        hasShield: player.hasShield,
        squash:    player.squash
    });

    drawFloatTexts();
}

// ── Игровой цикл ──
function gameLoop() {
    if (gameState === 'playing') updateGame();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// ── Сброс ──
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
    player.y         = gY + 15 - player.height;
    player.vy        = 0;
    player.grounded  = true;
    player.isJumping = false;
    player.jumpCount = 0;
    player.squash    = 1;
    player.hasShield = upgrades.shield.level > 0;
    player.shieldTimer = player.hasShield ? 9999 : 0;

    updateScore();
    updateCurrencyDisplay();
    updateComboDisplay();
    initBg();
}

function updateScore() {
    scoreSpan.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('slimeRunHighScore', highScore);
        highScoreSpan.textContent = highScore;
    }
}

function updateCurrencyDisplay() {
    coinsSpan.textContent = playerCurrency;
    if (shopCoinsSpan) shopCoinsSpan.textContent = playerCurrency;
}

function gameOver() {
    gameState = 'gameOver';
    finalScoreSpan.textContent   = score;
    finalHighScoreSpan.textContent = highScore;
    earnedCoinsSpan.textContent  = sessionEarnedCoins;
    maxComboSpan.textContent     = maxComboThisRun;

    const isNew = score >= highScore && score > 0;
    newRecordBadge.classList.toggle('hidden', !isNew);

    const emojis = ['💀', '😵', '🥺', '😱', '☠️'];
    document.getElementById('gameOverEmoji').textContent = emojis[Math.floor(Math.random() * emojis.length)];

    gameOverOverlay.classList.remove('hidden');

    if (tg) tg.HapticFeedback.notificationOccurred('error');

    spawnParticles(player.x + player.width/2, player.y, SKINS[currentSkin].color === 'rainbow' ? '#ff4' : SKINS[currentSkin].color, 20);
}

// ── Магазин ──
function renderShop() {
    // Улучшения
    upgradeItemsContainer.innerHTML = '';
    for (let [key, up] of Object.entries(upgrades)) {
        const isMax = up.level >= up.maxLevel;
        const cost  = up.getCost();
        const canBuy = playerCurrency >= cost && !isMax;

        const item = document.createElement('div');
        item.className = 'shop-item' + (isMax ? ' max-level' : '') + (!canBuy && !isMax ? ' cant-afford' : '');

        let levelBar = '';
        if (up.maxLevel > 1) {
            const pct = (up.level / up.maxLevel) * 100;
            levelBar = `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;
        }

        let valueInfo = '';
        if (key === 'jumpPower') valueInfo = `Сила: ${up.getValue().toFixed(1)}`;
        else if (key === 'speed') valueInfo = `Скорость: ${up.getValue().toFixed(1)}`;
        else if (key === 'gravity') valueInfo = `Лёгкость: ${up.getValue().toFixed(2)}`;
        else if (key === 'coinMagnet') valueInfo = up.level > 0 ? '✅ Активен каждую игру' : 'Притягивает монеты';
        else if (key === 'shield') valueInfo = up.level > 0 ? '✅ Защита каждую игру' : 'Защита от 1 удара';
        else if (key === 'doubleJump') valueInfo = up.level > 0 ? '✅ Можно прыгнуть дважды' : 'Прыжок в воздухе';

        item.innerHTML = `
            <div class="shop-item-icon">${up.icon}</div>
            <div class="shop-item-info">
                <strong>${up.label}</strong>
                <span>${valueInfo}</span>
                <span>Ур. ${up.level}/${up.maxLevel}</span>
                ${levelBar}
            </div>
            <div class="shop-item-right">
                <div class="shop-item-price ${isMax ? 'maxed' : ''}">${isMax ? 'MAX' : cost + ' 🪙'}</div>
            </div>
        `;

        if (!isMax) {
            item.addEventListener('click', () => purchaseUpgrade(key));
        }
        upgradeItemsContainer.appendChild(item);
    }

    // Скины
    skinItemsContainer.innerHTML = '';
    for (let [key, skin] of Object.entries(SKINS)) {
        const item = document.createElement('div');
        item.className = 'shop-item' + (skin.equipped ? ' equipped' : '');

        const priceText = !skin.owned
            ? `${skin.price} 🪙`
            : (skin.equipped ? '✓ Надет' : 'Надеть');
        const priceClass = skin.price === 0 || skin.owned ? 'free' : '';

        item.innerHTML = `
            <div class="shop-item-icon" style="width:36px;height:36px;position:relative;">
                <canvas class="skin-mini-canvas" width="36" height="36" data-skin="${key}"></canvas>
            </div>
            <div class="shop-item-info">
                <strong>${skin.label}</strong>
                <span>${skin.owned ? 'Есть' : skin.price + ' монет'}</span>
            </div>
            <div class="shop-item-right">
                <div class="shop-item-price ${priceClass}">${priceText}</div>
            </div>
        `;

        item.addEventListener('click', () => {
            if (!skin.owned) purchaseSkin(key);
            else if (!skin.equipped) equipSkin(key);
            drawSkinPreview(key);
        });

        item.addEventListener('mouseenter', () => drawSkinPreview(key));
        item.addEventListener('touchstart', () => drawSkinPreview(key), { passive: true });

        skinItemsContainer.appendChild(item);
    }

    // Рисуем мини-превью для каждого скина
    requestAnimationFrame(() => {
        for (let [key] of Object.entries(SKINS)) {
            const c = document.querySelector(`.skin-mini-canvas[data-skin="${key}"]`);
            if (!c) continue;
            const sctx = c.getContext('2d');
            sctx.clearRect(0, 0, 36, 36);
            const s = SKINS[key];
            drawSlimeOnCtx(sctx, 1, 1, 34, 34, { eyeStyle: s.eyeStyle, color: s.color });
        }
    });

    // Превью текущего/выбранного
    drawSkinPreview(currentSkin);
}

function drawSlimeOnCtx(targetCtx, x, y, w, h, opts = {}) {
    const { eyeStyle = 'default', color = '#7cc46b' } = opts;
    const cx = x + w/2, cy = y + h/2, rx = w/2, ry = h/2;

    targetCtx.save();
    targetCtx.translate(cx, cy);

    if (color === 'rainbow') {
        const g = targetCtx.createLinearGradient(-rx, -ry, rx, ry);
        g.addColorStop(0, '#ff4'); g.addColorStop(0.5, '#4f4'); g.addColorStop(1, '#44f');
        targetCtx.fillStyle = g;
    } else {
        targetCtx.fillStyle = color;
    }

    targetCtx.beginPath();
    targetCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2);
    targetCtx.fill();

    // Глаза
    targetCtx.fillStyle = 'white';
    targetCtx.beginPath(); targetCtx.arc(-rx*0.3, -ry*0.15, rx*0.18, 0, Math.PI*2); targetCtx.fill();
    targetCtx.beginPath(); targetCtx.arc( rx*0.3, -ry*0.15, rx*0.18, 0, Math.PI*2); targetCtx.fill();
    targetCtx.fillStyle = '#222';
    targetCtx.beginPath(); targetCtx.arc(-rx*0.3, -ry*0.1, rx*0.09, 0, Math.PI*2); targetCtx.fill();
    targetCtx.beginPath(); targetCtx.arc( rx*0.3, -ry*0.1, rx*0.09, 0, Math.PI*2); targetCtx.fill();

    targetCtx.restore();
}

function drawSkinPreview(skinKey) {
    const s = SKINS[skinKey];
    skinPreviewCtx.clearRect(0, 0, 80, 80);
    drawSlimeOnCtx(skinPreviewCtx, 5, 5, 70, 70, { eyeStyle: s.eyeStyle, color: s.color });
}

function purchaseUpgrade(key) {
    const up = upgrades[key];
    if (up.level >= up.maxLevel) return;
    const cost = up.getCost();
    if (playerCurrency < cost) {
        if (tg) tg.HapticFeedback.notificationOccurred('error');
        return;
    }
    playerCurrency -= cost;
    up.level++;
    localStorage.setItem(`upgrade_${key}`, up.level);
    localStorage.setItem('slimeRunCurrency', playerCurrency);
    updateCurrencyDisplay();
    renderShop();
    vibrate();
    if (tg) tg.HapticFeedback.notificationOccurred('success');
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
    vibrate();
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
    if (lastLogin === today) return;

    const bonus = 50;
    playerCurrency += bonus;
    localStorage.setItem('slimeRunCurrency', playerCurrency);
    localStorage.setItem('lastLogin', today);
    updateCurrencyDisplay();

    if (tg) {
        tg.showPopup({
            title: '🎁 Ежедневная награда!',
            message: `+${bonus} 🪙 за вход! Возвращайся завтра.`,
            buttons: [{ type: 'ok' }]
        });
    }
}

// ── Вибрация ──
function vibrate(ms = 20) {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// ── Тач-обработчики ──
let touchStartTime = 0;

function handleStart(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;
    touchStartTime = Date.now();
}

function handleEnd(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;
    const duration = (Date.now() - touchStartTime) / 200;
    jump(Math.min(duration, 1.2));
}

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchend',   handleEnd,   { passive: false });
canvas.addEventListener('touchcancel',handleEnd,   { passive: false });
canvas.addEventListener('mousedown',  handleStart);
canvas.addEventListener('mouseup',    handleEnd);

// ── Табы магазина ──
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('upgradesTab').classList.toggle('hidden', tab !== 'upgrades');
        document.getElementById('skinsTab').classList.toggle('hidden', tab !== 'skins');
    });
});

// ── Кнопки ──
function openShop() {
    shopOverlay.classList.remove('hidden');
    renderShop();
    updateCurrencyDisplay();
}

function closeShop() {
    shopOverlay.classList.add('hidden');
}

startGameBtn.addEventListener('click', () => {
    instructionOverlay.classList.add('hidden');
    gameState = 'playing';
    resetGame();
});

menuShopBtn.addEventListener('click', () => {
    instructionOverlay.classList.add('hidden');
    openShop();
});

restartGameBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    gameState = 'playing';
    resetGame();
});

shopBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    openShop();
});

closeShopBtn.addEventListener('click', () => {
    closeShop();
    // Если пришли из game-over — показываем его снова
    // (ничего, пусть просто закроется)
});

// ── Превью слизня в меню ──
function drawMenuSlime() {
    const c = document.createElement('canvas');
    c.width = 80; c.height = 80;
    const skin = SKINS[currentSkin];
    const sctx = c.getContext('2d');
    drawSlimeOnCtx(sctx, 5, 5, 70, 70, { eyeStyle: skin.eyeStyle, color: skin.color });
    document.getElementById('menuSlime').appendChild(c);
}

// ── Resize ──
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width    = container.clientWidth;
    canvas.height   = container.clientHeight - document.querySelector('.game-header').offsetHeight;
    resetGame();
}

window.addEventListener('resize', resizeCanvas);

// ── Приветствие ──
if (tg?.initDataUnsafe?.user) {
    playerGreeting.textContent = `Привет, ${tg.initDataUnsafe.user.first_name}!`;
} else {
    playerGreeting.textContent = 'Привет, Слизень!';
}

// ── Инициализация ──
resizeCanvas();
checkDailyReward();
updateCurrencyDisplay();
highScoreSpan.textContent = highScore;
drawMenuSlime();

instructionOverlay.classList.remove('hidden');

gameLoop();
// КНОПКА ВЫХОДА - ИСПРАВЛЕННАЯ ВЕРСИЯ
const exitBtn = document.getElementById("exitBtn");

// Функция выхода
function exitGame() {
    // если игра в Telegram WebApp
    if (window.Telegram && Telegram.WebApp) {
        Telegram.WebApp.close();
    } 
    else {
        // обычный браузер
        // Пробуем закрыть окно (может не сработать из-за политик браузера)
        window.close();
        // Показываем сообщение как запасной вариант
        alert('Игра закрыта. Вы можете закрыть вкладку.');
    }
}

// клик по кнопке
if (exitBtn) {
    exitBtn.addEventListener("click", exitGame);
}

// выход по Esc
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        exitGame();
    }
});

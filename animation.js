// Canvas setup
const animationBackground = document.getElementById('animation-background');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
animationBackground.appendChild(canvas);

// Performance settings
const performance = {
    high: {
        particleCount: 100,
        connectionDistance: 150,
        floatingElements: 15
    },
    medium: {
        particleCount: 60,
        connectionDistance: 120,
        floatingElements: 10
    },
    low: {
        particleCount: 30,
        connectionDistance: 100,
        floatingElements: 5
    }
};

// Detect device performance
const isLowEndDevice = () => {
    return window.navigator.hardwareConcurrency <= 4 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Select performance profile
const currentPerformance = isLowEndDevice() ? performance.low : performance.medium;

// Animation parameters
const config = {
    particleCount: currentPerformance.particleCount,
    connectionDistance: currentPerformance.connectionDistance,
    particleSize: 3,
    particleMinSpeed: 0.2,
    particleMaxSpeed: 0.8,
    mainColor: '#8A2BE2', // --primary-color
    secondaryColor: '#00BFFF', // --secondary-color
    accentColor: '#FF4500', // --accent-color
    connectionOpacity: 0.15
};

// Utility functions
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

// Particle class
class Particle {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.vx = randomBetween(-config.particleMaxSpeed, config.particleMaxSpeed);
        this.vy = randomBetween(-config.particleMaxSpeed, config.particleMaxSpeed);
        this.radius = randomBetween(1, config.particleSize);
        this.originalRadius = this.radius;
        
        // Assign a random color from our palette
        const colors = [config.mainColor, config.secondaryColor, config.accentColor];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        
        // For pulsating effect
        this.pulseSpeed = randomBetween(0.01, 0.05);
        this.pulsePhase = Math.random() * Math.PI * 2;
    }
    
    update() {
        // Move the particle
        this.x += this.vx;
        this.y += this.vy;
        
        // Bounce at edges
        if (this.x < 0 || this.x > canvas.width) {
            this.vx = -this.vx;
        }
        if (this.y < 0 || this.y > canvas.height) {
            this.vy = -this.vy;
        }
        
        // Pulsate size
        this.pulsePhase += this.pulseSpeed;
        this.radius = this.originalRadius + Math.sin(this.pulsePhase) * (this.originalRadius * 0.3);
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
    }
}

// Draw connections between particles
function drawConnections(particles) {
    // Only check connections for visible particles
    const visibleParticles = particles.filter(p => 
        p.x >= -config.connectionDistance && 
        p.x <= canvas.width + config.connectionDistance &&
        p.y >= -config.connectionDistance && 
        p.y <= canvas.height + config.connectionDistance
    );

    for (let i = 0; i < visibleParticles.length; i++) {
        for (let j = i + 1; j < visibleParticles.length; j++) {
            const dx = visibleParticles[i].x - visibleParticles[j].x;
            const dy = visibleParticles[i].y - visibleParticles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < config.connectionDistance) {
                const opacity = (1 - distance / config.connectionDistance) * config.connectionOpacity;
                
                ctx.beginPath();
                ctx.moveTo(visibleParticles[i].x, visibleParticles[i].y);
                ctx.lineTo(visibleParticles[j].x, visibleParticles[j].y);
                ctx.strokeStyle = `rgba(138, 43, 226, ${opacity})`; // Simplified color
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }
}

// Mouse interaction
let mouseX, mouseY;
let mouseRadius = 100;

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

canvas.addEventListener('mouseleave', () => {
    mouseX = undefined;
    mouseY = undefined;
});

// Create mouse particle that follows cursor
let mouseParticle = null;

function handleMouseInteraction(particles) {
    if (mouseX && mouseY) {
        // Create mouse particle if it doesn't exist
        if (!mouseParticle) {
            mouseParticle = new Particle(mouseX, mouseY);
            mouseParticle.radius = 0; // Make it invisible
        }
        
        // Update mouse particle position
        mouseParticle.x = mouseX;
        mouseParticle.y = mouseY;
        
        // Repel nearby particles
        particles.forEach(particle => {
            const dx = particle.x - mouseX;
            const dy = particle.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mouseRadius) {
                // Calculate repulsion force (stronger as it gets closer)
                const force = (mouseRadius - distance) / mouseRadius;
                
                // Apply force to particle velocity
                particle.vx += dx / distance * force * 0.5;
                particle.vy += dy / distance * force * 0.5;
                
                // Cap velocity
                const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                if (speed > config.particleMaxSpeed * 2) {
                    particle.vx = (particle.vx / speed) * config.particleMaxSpeed * 2;
                    particle.vy = (particle.vy / speed) * config.particleMaxSpeed * 2;
                }
            }
        });
        
        // Include mouse particle in connections
        return [...particles, mouseParticle];
    }
    
    mouseParticle = null;
    return particles;
}

// Initialize particles
let particles = [];
for (let i = 0; i < config.particleCount; i++) {
    particles.push(new Particle());
}

// Create floating game-related elements in the background
class FloatingElement {
    constructor() {
        // Random position
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        
        // Random velocity (slower than particles)
        this.vx = randomBetween(-0.2, 0.2);
        this.vy = randomBetween(-0.2, 0.2);
        
        // Random rotation
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = randomBetween(-0.01, 0.01);
        
        // Random size
        this.size = randomBetween(20, 40);
        
        // Random opacity
        this.opacity = randomBetween(0.03, 0.07);
        
        // Choose random shape type
        this.type = Math.floor(Math.random() * 5);
    }
    
    update() {
        // Move the element
        this.x += this.vx;
        this.y += this.vy;
        
        // Wrap around edges
        if (this.x < -this.size) this.x = canvas.width + this.size;
        if (this.x > canvas.width + this.size) this.x = -this.size;
        if (this.y < -this.size) this.y = canvas.height + this.size;
        if (this.y > canvas.height + this.size) this.y = -this.size;
        
        // Rotate
        this.rotation += this.rotationSpeed;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.opacity;
        
        const colors = [config.mainColor, config.secondaryColor, config.accentColor];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        switch(this.type) {
            case 0: // Controller
                this.drawGameController(color);
                break;
            case 1: // Pixel art
                this.drawPixelArt(color);
                break;
            case 2: // Trophy
                this.drawTrophy(color);
                break;
            case 3: // Code bracket
                this.drawCodeBracket(color);
                break;
            case 4: // Tournament bracket
                this.drawTournamentBracket(color);
                break;
        }
        
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    
    drawGameController(color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Base of controller
        ctx.beginPath();
        ctx.roundRect(-this.size/2, -this.size/3, this.size, this.size*2/3, this.size/5);
        ctx.stroke();
        
        // Left analog stick
        ctx.beginPath();
        ctx.arc(-this.size/4, 0, this.size/10, 0, Math.PI * 2);
        ctx.stroke();
        
        // Right analog stick
        ctx.beginPath();
        ctx.arc(this.size/4, 0, this.size/10, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    drawPixelArt(color) {
        ctx.fillStyle = color;
        const pixelSize = this.size / 8;
        
        // Draw a simple pixel art
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (Math.random() > 0.7) {
                    ctx.fillRect(
                        -this.size/2 + i * pixelSize, 
                        -this.size/2 + j * pixelSize, 
                        pixelSize, 
                        pixelSize
                    );
                }
            }
        }
    }
    
    drawTrophy(color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Cup
        ctx.beginPath();
        ctx.moveTo(-this.size/3, -this.size/2);
        ctx.lineTo(this.size/3, -this.size/2);
        ctx.bezierCurveTo(
            this.size/2, -this.size/2,
            this.size/2, -this.size/5,
            this.size/3, this.size/5
        );
        ctx.lineTo(-this.size/3, this.size/5);
        ctx.bezierCurveTo(
            -this.size/2, -this.size/5,
            -this.size/2, -this.size/2,
            -this.size/3, -this.size/2
        );
        ctx.stroke();
        
        // Base
        ctx.beginPath();
        ctx.moveTo(-this.size/4, this.size/5);
        ctx.lineTo(-this.size/4, this.size/2);
        ctx.lineTo(this.size/4, this.size/2);
        ctx.lineTo(this.size/4, this.size/5);
        ctx.stroke();
    }
    
    drawCodeBracket(color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Draw < > brackets
        ctx.beginPath();
        ctx.moveTo(-this.size/3, 0);
        ctx.lineTo(-this.size/6, -this.size/2);
        ctx.lineTo(this.size/6, -this.size/2);
        ctx.lineTo(this.size/3, 0);
        ctx.lineTo(this.size/6, this.size/2);
        ctx.lineTo(-this.size/6, this.size/2);
        ctx.lineTo(-this.size/3, 0);
        ctx.stroke();
    }
    
    drawTournamentBracket(color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Simple tournament bracket
        ctx.beginPath();
        // Left side matches
        ctx.moveTo(-this.size/2, -this.size/2);
        ctx.lineTo(-this.size/4, -this.size/2);
        ctx.lineTo(-this.size/4, -this.size/6);
        ctx.moveTo(-this.size/2, this.size/2);
        ctx.lineTo(-this.size/4, this.size/2);
        ctx.lineTo(-this.size/4, this.size/6);
        // Connecting line
        ctx.moveTo(-this.size/4, 0);
        ctx.lineTo(0, 0);
        // Right side matches
        ctx.moveTo(this.size/2, -this.size/2);
        ctx.lineTo(this.size/4, -this.size/2);
        ctx.lineTo(this.size/4, -this.size/6);
        ctx.moveTo(this.size/2, this.size/2);
        ctx.lineTo(this.size/4, this.size/2);
        ctx.lineTo(this.size/4, this.size/6);
        // Center lines
        ctx.moveTo(0, -this.size/6);
        ctx.lineTo(0, this.size/6);
        ctx.stroke();
    }
}

// Initialize floating elements
const floatingElements = [];
for (let i = 0; i < currentPerformance.floatingElements; i++) {
    floatingElements.push(new FloatingElement());
}

// Optimize window resize with throttling
let resizeTimeout;
window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }, 250);
});

// Optimize animation loop with requestAnimationFrame throttling
let lastTime = 0;
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;

function animate(currentTime) {
    if (currentTime - lastTime < frameInterval) {
        requestAnimationFrame(animate);
        return;
    }
    lastTime = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw floating elements (reduced frequency)
    if (currentTime % 2 === 0) {
        floatingElements.forEach(element => {
            element.update();
            element.draw();
        });
    }
    
    // Update particles
    particles.forEach(particle => particle.update());
    
    // Handle mouse interaction
    const allParticles = handleMouseInteraction(particles);
    
    // Draw connections
    drawConnections(allParticles);
    
    // Draw particles
    allParticles.forEach(particle => particle.draw());
    
    requestAnimationFrame(animate);
}

// Start animation
animate(0); 
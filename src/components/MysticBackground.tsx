import { useEffect, useRef } from "react";

// DENSE tapestry - a proper web of fate threads
const NODE_COUNT = 210; // Keeping optimization
const RUNE_COUNT = 80; // Keeping optimization
const MAX_DIST = 170;
const SPEED = 0.2;
const REPULSE_STRENGTH = 1.0;
const MOUSE_RADIUS = 250;
const GRID_SIZE = 250;

// Authentic Elder Futhark + Extras
const RUNE_CHARS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛇᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᚪᚫᚣᛡᛠ";

class Node {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseSize: number;
    size: number;
    width: number;
    height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * SPEED;
        this.vy = (Math.random() - 0.5) * SPEED;
        this.baseSize = Math.random() * 2 + 0.5;
        this.size = this.baseSize;
    }

    update(mouseX: number | null, mouseY: number | null) {
        this.x += this.vx;
        this.y += this.vy;

        if (mouseX !== null && mouseY !== null) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < MOUSE_RADIUS) {
                const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
                const directionX = (dx / distance) * force * REPULSE_STRENGTH;
                const directionY = (dy / distance) * force * REPULSE_STRENGTH;
                this.x -= directionX;
                this.y -= directionY;
                this.size = this.baseSize * 1.5;
            } else {
                if (this.size > this.baseSize) this.size -= 0.05;
            }
        }

        if (this.x < 0) this.x = this.width;
        else if (this.x > this.width) this.x = 0;
        if (this.y < 0) this.y = this.height;
        else if (this.y > this.height) this.y = 0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
    }
}

class Rune {
    x: number;
    y: number;
    size: number;
    char: string;
    vy: number;
    opacity: number;
    fadeState: 'in' | 'out';
    fadeSpeed: number;
    width: number;
    height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 12 + 8;
        this.char = RUNE_CHARS[Math.floor(Math.random() * RUNE_CHARS.length)];
        this.vy = Math.random() * 0.3 + 0.1;
        this.opacity = 0;
        this.fadeState = 'in';
        this.fadeSpeed = Math.random() * 0.002 + 0.001;
    }

    update() {
        this.y -= this.vy;
        if (this.fadeState === 'in') {
            this.opacity += this.fadeSpeed;
            if (this.opacity >= 0.5) this.fadeState = 'out';
        } else {
            this.opacity -= this.fadeSpeed;
            if (this.opacity <= 0) this.reset();
        }
    }

    reset() {
        this.opacity = 0;
        this.fadeState = 'in';
        this.y = this.height + 20;
        this.x = Math.random() * this.width;
        this.char = RUNE_CHARS[Math.floor(Math.random() * RUNE_CHARS.length)];
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(0, 194, 255, ${this.opacity * 0.8})`;
        ctx.fillStyle = `rgba(0, 194, 255, ${this.opacity})`;
        ctx.font = `${this.size}px serif`;
        ctx.fillText(this.char, this.x, this.y);
        ctx.shadowBlur = 0;
    }
}

function getGridCell(x: number, y: number, gridSize: number): string {
    return `${Math.floor(x / gridSize)},${Math.floor(y / gridSize)}`;
}

function getNearbyCells(x: number, y: number, gridSize: number): string[] {
    const cellX = Math.floor(x / gridSize);
    const cellY = Math.floor(y / gridSize);
    const cells: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            cells.push(`${cellX + dx},${cellY + dy}`);
        }
    }
    return cells;
}

export function MysticBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const isVisibleRef = useRef(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        let nodes: Node[] = [];
        let runes: Rune[] = [];
        let mouseX: number | null = null;
        let mouseY: number | null = null;

        function init() {
            const area = width * height;
            const nodeDensity = 0.00012;
            const calculatedNodes = Math.floor(area * nodeDensity);
            const activeNodeCount = Math.max(40, Math.min(NODE_COUNT, calculatedNodes));

            const runeDensity = 0.00004;
            const calculatedRunes = Math.floor(area * runeDensity);
            const activeRuneCount = Math.max(15, Math.min(RUNE_COUNT, calculatedRunes));

            nodes = [];
            runes = [];
            for (let i = 0; i < activeNodeCount; i++) nodes.push(new Node(width, height));
            for (let i = 0; i < activeRuneCount; i++) runes.push(new Rune(width, height));
        }

        function animate() {
            if (!isVisibleRef.current) {
                animationRef.current = requestAnimationFrame(animate);
                return;
            }
            if (!ctx || !canvas) return;

            ctx.clearRect(0, 0, width, height);

            // Background Nebula Effect
            const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
            grad.addColorStop(0, '#0a0f25');
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = "rgba(0, 194, 255, 0.1)";
            for (let rune of runes) {
                rune.update();
                rune.draw(ctx);
            }

            for (let node of nodes) node.update(mouseX, mouseY);

            const grid: Map<string, Node[]> = new Map();
            for (const node of nodes) {
                const cell = getGridCell(node.x, node.y, GRID_SIZE);
                if (!grid.has(cell)) grid.set(cell, []);
                grid.get(cell)!.push(node);
            }

            ctx.globalCompositeOperation = 'lighter';
            const drawnPairs = new Set<string>();

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const nearbyCells = getNearbyCells(node.x, node.y, GRID_SIZE);

                for (const cellKey of nearbyCells) {
                    const cellNodes = grid.get(cellKey);
                    if (!cellNodes) continue;

                    for (const other of cellNodes) {
                        if (other === node) continue;

                        const pairKey = node.x < other.x ? `${node.x},${node.y}-${other.x},${other.y}` : `${other.x},${other.y}-${node.x},${node.y}`;
                        if (drawnPairs.has(pairKey)) continue;

                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < MAX_DIST) {
                            drawnPairs.add(pairKey);
                            const alpha = 1 - dist / MAX_DIST;

                            ctx.beginPath();
                            ctx.moveTo(node.x, node.y);
                            ctx.lineTo(other.x, other.y);

                            ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.15})`;
                            ctx.lineWidth = 3;
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.moveTo(node.x, node.y);
                            ctx.lineTo(other.x, other.y);
                            ctx.strokeStyle = `rgba(255, 230, 100, ${alpha * 0.6})`;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }
                nodes[i].draw(ctx);
            }
            ctx.globalCompositeOperation = 'source-over';

            animationRef.current = requestAnimationFrame(animate);
        }

        function handleResize() {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            init();
        }

        function handleMouseMove(event: MouseEvent) {
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            mouseX = event.clientX - rect.left;
            mouseY = event.clientY - rect.top;
        }

        function handleMouseLeave() {
            mouseX = null;
            mouseY = null;
        }

        function handleVisibilityChange() {
            isVisibleRef.current = !document.hidden;
        }

        window.addEventListener('resize', handleResize);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        init();
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-auto"
            style={{ background: '#000' }}
        />
    );
}

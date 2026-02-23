import { useEffect, useRef } from "react";
import { Crown } from "lucide-react";
import { Button } from "./ui/button";

interface Player {
  id: string;
  username: string;
  avatar?: string;
  score: number;
  avgTime?: number;
}

interface AscensionProps {
  players: Player[];
  onPlayAgain?: () => void;
  isHost: boolean;
}

// EPIC tapestry for the leaderboard - the grand finale
const NODE_COUNT = 350;  // Massive dense web of fate
const RUNE_COUNT = 100;  // Tons of floating runes
const MAX_DIST = 250;    // Very long connections for full interconnection
const SPEED = 0.2;
const REPULSE_STRENGTH = 4;
const MOUSE_RADIUS = 300;
const GRID_SIZE = 280;

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
        this.x -= (dx / distance) * force * REPULSE_STRENGTH;
        this.y -= (dy / distance) * force * REPULSE_STRENGTH;
        this.size = this.baseSize * 1.5;
      } else if (this.size > this.baseSize) {
        this.size -= 0.05;
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
    this.fadeSpeed = Math.random() * 0.002 + 0.001; // Slower fade = reach higher
  }

  update() {
    this.y -= this.vy;
    if (this.fadeState === 'in') {
      this.opacity += this.fadeSpeed;
      if (this.opacity >= 0.5) this.fadeState = 'out'; // Higher max opacity
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
    ctx.shadowColor = `rgba(0, 194, 255, ${this.opacity * 0.8})`; // Shine effect
    ctx.fillStyle = `rgba(0, 194, 255, ${this.opacity})`;
    ctx.font = `${this.size}px serif`;
    ctx.fillText(this.char, this.x, this.y);
    ctx.shadowBlur = 0; // Reset
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

export function Ascension({ players, onPlayAgain, isHost }: AscensionProps) {
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
      // Mobile Optimization for Ascension
      // Scale nodes based on screen real estate
      const area = width * height;
      // Higher density for Ascension than MysticBackground (it's the finale)
      const nodeDensity = 0.00016;
      const calculatedNodes = Math.floor(area * nodeDensity);
      const activeNodeCount = Math.max(60, Math.min(NODE_COUNT, calculatedNodes));

      const runeDensity = 0.00005;
      const calculatedRunes = Math.floor(area * runeDensity);
      const activeRuneCount = Math.max(20, Math.min(RUNE_COUNT, calculatedRunes));

      nodes = [];
      runes = [];
      for (let i = 0; i < activeNodeCount; i++) nodes.push(new Node(width, height));
      for (let i = 0; i < activeRuneCount; i++) runes.push(new Rune(width, height));
    }

    function animate() {
      if (!isVisibleRef.current || !ctx) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Dark background nebula
      const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
      grad.addColorStop(0, '#0a0f25');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw Runes
      for (let rune of runes) {
        rune.update();
        rune.draw(ctx);
      }

      // Update Nodes
      for (let node of nodes) node.update(mouseX, mouseY);

      // Build spatial grid
      const grid: Map<string, Node[]> = new Map();
      for (const node of nodes) {
        const cell = getGridCell(node.x, node.y, GRID_SIZE);
        if (!grid.has(cell)) grid.set(cell, []);
        grid.get(cell)!.push(node);
      }

      // Draw Connections
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

              // Optimized "Glow" using layered strokes instead of expensive shadowBlur
              const alpha = 1 - dist / MAX_DIST;

              ctx.beginPath();
              ctx.moveTo(node.x, node.y);
              ctx.lineTo(other.x, other.y);

              // 1. Outer subtle glow (wider, lower opacity)
              ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.15})`;
              ctx.lineWidth = 3;
              ctx.stroke();

              // 2. Inner bright core (thinner, higher opacity)
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

  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topThree = sortedPlayers.slice(0, 3);
  const restOfPlayers = sortedPlayers.slice(3);

  const getRankTitle = (rank: number) => {
    if (rank === 0) return "Sovereign";
    if (rank === 1) return "Saint";
    if (rank === 2) return "Master";
    return "Sleeper";
  };

  return (
    <div className="min-h-screen relative overflow-y-auto overflow-x-hidden" style={{ background: '#000' }}>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-auto"
        style={{ background: '#000' }}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center p-4 py-8">
        {/* Title - Compact */}
        <div className="text-center title-container pointer-events-none flex-shrink-0 z-20" style={{ animation: 'fadeIn 1s ease-out' }}>
          <p className="text-[#00C2FF] uppercase font-mono system-msg-text" style={{ opacity: 0.8, marginBottom: '0.75rem', textShadow: '0 0 8px rgba(0,194,255,0.4)' }}>
            [System Message: Scenario Conquered]
          </p>
          <div className="relative inline-block pointer-events-none">
            {/* Ambient Title Glow */}
            <div className="absolute inset-0 bg-[#FFD700] rounded-full pointer-events-none" style={{ filter: 'blur(25px)', opacity: 0.3, animation: 'glowPulseSoft 3s ease-in-out infinite' }} />

            <h2 className="text-[#FFD700] uppercase font-serif relative z-10 title-text" style={{
              fontWeight: 900,
              textShadow: '0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2)',
              WebkitTextStroke: '1px rgba(255, 215, 0, 0.5)'
            }}>
              Ascension
            </h2>
            {/* Horizontal Divider Line */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[150%] h-[2px]" style={{ background: 'linear-gradient(to right, transparent, rgba(255,215,0,0.6), transparent)' }} />
          </div>
        </div>

        {/* Custom Styles for guaranteed layout since Tailwind JIT is disabled */}
        <style>{`
          .title-container { margin-bottom: 2rem; }
          .system-msg-text { font-size: 0.7rem; letter-spacing: 2px; }
          
          .podium-wrapper { display: flex; justify-content: center; width: 100%; margin: 2rem 0 3rem 0; z-index: 10; padding: 0 0.5rem; overflow-x: auto; scrollbar-width: none; }
          .podium-wrapper::-webkit-scrollbar { display: none; }
          .podium-container { display: flex; flex-direction: row; align-items: flex-end; justify-content: center; gap: 0.5rem; width: 100%; max-width: 1000px; min-width: 310px; }
          
          /* Base Mobile Card Styles */
          .podium-card { width: 100%; border-radius: 1rem; position: relative; display: flex; flex-direction: column; align-items: center; padding: 1.5rem 0.25rem 0.75rem 0.25rem; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(24px); }
          .podium-card:hover { transform: translateY(-8px); }
          .rank-badge { position: absolute; top: -1rem; left: 50%; transform: translateX(-50%); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #050505; z-index: 20; color: #000; font-weight: 900; font-family: serif; font-size: 1rem; width: 2rem; height: 2rem; }
          
          /* Glassmorphic Row Styles */
          .sleeper-row { display: flex; align-items: center; background-color: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); transition: all 0.3s ease; padding: 0.75rem; gap: 0.75rem; border-radius: 0.75rem; border: 1px solid; }
          .sleeper-row:hover { background-color: rgba(0, 194, 255, 0.05); border-color: rgba(0, 194, 255, 0.3); transform: translateX(4px); }
          
          /* Responsive Variables for Mobile */
          .sleeper-num { width: 24px; font-size: 1rem; }
          .sleeper-avatar { width: 32px; height: 32px; flex-shrink: 0; }
          .sleeper-name { font-size: 0.9rem; }
          .sleeper-score { font-size: 1.2rem; }
          .title-text { font-size: clamp(2.5rem, 8vw, 5rem); letter-spacing: clamp(4px, 3vw, 12px); }

          /* Mobile Side-by-Side Podium Constraints */
          .card-saint { order: 1; flex: 1 1 30%; max-width: 105px; height: 200px; margin-bottom: 10px; }
          .card-sovereign { order: 2; flex: 1 1 40%; max-width: 140px; height: 240px; z-index: 30; }
          .card-master { order: 3; flex: 1 1 30%; max-width: 105px; height: 200px; margin-bottom: 10px; }
          
          /* Micro Typography for Mobile Podium */
          .podium-name { font-size: 0.7rem; }
          .podium-score { font-size: 1.25rem; }
          .podium-crown { width: 24px; height: 24px; margin-bottom: 4px; }
          .avatar-sm { width: 40px; height: 40px; }
          .avatar-lg { width: 60px; height: 60px; border-width: 2px !important; }

          @media (min-width: 768px) {
            .title-container { margin-bottom: 4rem; }
            .system-msg-text { font-size: 0.9rem; letter-spacing: 6px; }
            .podium-wrapper { padding: 0 1rem; overflow-x: visible; }
            .podium-container { gap: 2rem; }
            .podium-card { padding: 2.5rem 1.5rem; border-radius: 1.5rem; }
            .podium-card:hover { transform: translateY(-12px); }
            
            /* Restore Desktop Sizing */
            .card-saint { margin-bottom: 20px; height: 340px; max-width: 280px; flex: 1 1 240px; }
            .card-sovereign { height: 440px; max-width: 340px; flex: 1 1 300px; }
            .card-master { margin-bottom: 20px; height: 340px; max-width: 280px; flex: 1 1 240px; }
            
            .rank-badge { border-width: 4px; }
            .rank-badge-sm { width: 3.5rem !important; height: 3.5rem !important; font-size: 1.5rem !important; top: -1.75rem !important; }
            .rank-badge-lg { width: 4.5rem !important; height: 4.5rem !important; font-size: 1.875rem !important; top: auto !important; }
            
            .podium-name { font-size: 1.25rem; }
            .name-sovereign { font-size: 1.75rem; }
            
            .podium-score { font-size: 2.5rem; }
            .score-sovereign { font-size: 4rem; letter-spacing: -2px; }
            
            .podium-crown { width: 48px; height: 48px; margin-bottom: 8px; }
            .avatar-sm { width: 80px; height: 80px; }
            .avatar-lg { width: 120px; height: 120px; border-width: 3px !important; }
            
            /* Lists */
            .sleeper-row { padding: 1rem; gap: 1.5rem; border-radius: 0.75rem; }
            .sleeper-num { width: 40px; font-size: 1.125rem; }
            .sleeper-avatar { width: 40px; height: 40px; }
            .sleeper-name { font-size: 1rem; }
            .sleeper-score { font-size: 1.25rem; }
          }
          
          /* Custom Animations to prevent Opacity Flashbacks & keep glows tight */
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes glowPulseSoft { 0%, 100% { opacity: 0.3; filter: blur(25px); } 50% { opacity: 0.15; filter: blur(20px); } }
          @keyframes glowPulseMedium { 0%, 100% { opacity: 0.4; filter: blur(20px); } 50% { opacity: 0.2; filter: blur(15px); } }
          @keyframes cardGlow { 
            0%, 100% { box-shadow: 0 30px 60px rgba(0,0,0,0.9), 0 0 50px rgba(255,215,0,0.3), inset 0 2px 0 rgba(255,215,0,0.3); } 
            50% { box-shadow: 0 30px 60px rgba(0,0,0,0.9), 0 0 20px rgba(255,215,0,0.1), inset 0 2px 0 rgba(255,215,0,0.1); } 
          }
          @keyframes crownPulse { 
            0%, 100% { filter: drop-shadow(0 0 15px rgba(255,215,0,0.9)); transform: scale(1); } 
            50% { filter: drop-shadow(0 0 5px rgba(255,215,0,0.4)); transform: scale(0.95); } 
          }
          @keyframes avatarPulse {
            0%, 100% { box-shadow: 0 0 40px rgba(255,215,0,0.5); }
            50% { box-shadow: 0 0 15px rgba(255,215,0,0.2); }
          }
        `}</style>

        {/* Podium - Top 3 (Responsive Layout) */}
        <div className="podium-wrapper flex-shrink-0">
          <div className="podium-container">

            {/* 2nd place - SAINT */}
            {topThree[1] && (
              <div className="group card-saint">
                {/* Outer Glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(229,228,226,0.2), transparent)', filter: 'blur(20px)' }} />

                {/* Card Body */}
                <div
                  className="podium-card"
                  style={{
                    height: '100%',
                    background: 'linear-gradient(145deg, #161616, #080808)',
                    border: '1px solid rgba(229,228,226,0.15)',
                    boxShadow: '0 15px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(229,228,226,0.1)'
                  }}
                >
                  <div className="rank-badge rank-badge-sm" style={{ background: 'linear-gradient(135deg, #FFF, #C0C0C0, #808080)', boxShadow: '0 0 20px rgba(229,228,226,0.4)', borderColor: '#080808' }}>
                    2
                  </div>

                  <div className="mt-4 md:mt-8 mb-2 md:mb-4 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#E5E4E2] rounded-full" style={{ filter: 'blur(25px)', opacity: 0.15 }} />
                    {topThree[1].avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${topThree[1].id}/${topThree[1].avatar}.png`}
                        alt={topThree[1].username}
                        className="relative rounded-full border border-[#E5E4E2]/50 shadow-lg object-cover avatar-sm"
                      />
                    ) : (
                      <div className="relative rounded-full border border-[#E5E4E2]/50 flex items-center justify-center shadow-lg avatar-sm" style={{ background: 'linear-gradient(135deg, rgba(229,228,226,0.15), rgba(0,0,0,1))' }}>
                        <span className="text-white font-serif" style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
                          {topThree[1].username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-[#E5E4E2] uppercase font-mono font-bold" style={{ fontSize: '0.5rem', letterSpacing: '4px', opacity: 0.6, marginBottom: '0.25rem' }}>Saint</div>
                  <div className="text-white font-bold text-center px-1 w-full truncate podium-name">{topThree[1].username}</div>

                  <div className="w-full text-center" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(229,228,226,0.05)' }}>
                    <div className="font-mono text-[#E5E4E2] podium-score" style={{ fontWeight: 900, textShadow: '0 2px 10px rgba(229,228,226,0.2)' }}>{topThree[1].score}</div>
                    <div className="text-white uppercase font-semibold" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', opacity: 0.3, marginTop: '0.25rem' }}>Essence</div>
                  </div>
                </div>
              </div>
            )}

            {/* 1st place - Primary Focus - SOVEREIGN */}
            {topThree[0] && (
              <div className="group card-sovereign relative">
                {/* Card Body - Now with animated box-shadow instead of a massive blurry div behind it */}
                <div
                  className="podium-card relative z-10"
                  style={{
                    height: '100%',
                    background: 'linear-gradient(145deg, #1c1500, #0a0800)',
                    border: '1px solid rgba(255,215,0,0.6)',
                    borderRadius: '1.75rem',
                    animation: 'cardGlow 4s ease-in-out infinite'
                  }}
                >
                  <div className="absolute left-1/2 flex flex-col items-center justify-end" style={{ top: '-4.5rem', transform: 'translateX(-50%)', width: '100px', zIndex: 30 }}>
                    <Crown className="text-[#FFD700] podium-crown" style={{ animation: 'crownPulse 3s ease-in-out infinite' }} />
                    <div className="rank-badge rank-badge-lg" style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none', background: 'linear-gradient(135deg, #FFF9C4, #FFD700, #B8860B)', border: '4px solid #0a0800', animation: 'avatarPulse 3s ease-in-out infinite' }}>
                      1
                    </div>
                  </div>

                  <div className="mt-4 md:mt-10 mb-2 md:mb-6 relative flex items-center justify-center">
                    {/* The aura explicitly scoped to exactly 120px to match avatar, absolutely centered */}
                    <div className="absolute bg-[#FFD700] rounded-full top-1/2 left-1/2 pointer-events-none avatar-lg" style={{ transform: 'translate(-50%, -50%)', filter: 'blur(15px)', opacity: 0.3, animation: 'glowPulseSoft 3s ease-in-out infinite' }} />
                    {topThree[0].avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${topThree[0].id}/${topThree[0].avatar}.png`}
                        alt={topThree[0].username}
                        className="relative rounded-full object-cover z-20 avatar-lg border-[#FFD700]/80"
                        style={{ borderStyle: 'solid', animation: 'avatarPulse 3s ease-in-out infinite' }}
                      />
                    ) : (
                      <div className="relative rounded-full flex items-center justify-center z-20 avatar-lg border-[#FFD700]/80" style={{ borderStyle: 'solid', background: 'linear-gradient(135deg, rgba(255,215,0,0.2), #000)', animation: 'avatarPulse 3s ease-in-out infinite' }}>
                        <span className="text-[#FFD700] font-serif" style={{ fontSize: '2em', fontWeight: 'bold' }}>
                          {topThree[0].username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-[#FFD700] uppercase font-mono font-bold" style={{ fontSize: '0.6rem', letterSpacing: '4px', marginBottom: '0.25rem', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>Sovereign</div>
                  <div className="text-white font-extrabold text-center px-1 w-full truncate podium-name name-sovereign" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{topThree[0].username}</div>

                  <div className="w-full text-center" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,215,0,0.2)' }}>
                    <div className="font-mono text-[#FFD700] podium-score score-sovereign" style={{ fontWeight: 900, lineHeight: 1, textShadow: '0 0 30px rgba(255,215,0,0.4)' }}>{topThree[0].score}</div>
                    <div className="text-[#FFD700] uppercase font-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.3em', opacity: 0.7, marginTop: '0.25rem' }}>Essence</div>
                  </div>
                </div>
              </div>
            )}

            {/* 3rd place - MASTER */}
            {topThree[2] && (
              <div className="group card-master">
                {/* Outer Glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(205,127,50,0.2), transparent)', filter: 'blur(20px)' }} />

                {/* Card Body */}
                <div
                  className="podium-card"
                  style={{
                    height: '100%',
                    background: 'linear-gradient(145deg, #16110d, #050300)',
                    border: '1px solid rgba(205,127,50,0.15)',
                    boxShadow: '0 15px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(205,127,50,0.1)'
                  }}
                >
                  <div className="rank-badge rank-badge-sm" style={{ background: 'linear-gradient(135deg, #FFB870, #CD7F32, #8B5A2B)', boxShadow: '0 0 20px rgba(205,127,50,0.4)', borderColor: '#050300' }}>
                    3
                  </div>

                  <div className="mt-4 md:mt-8 mb-2 md:mb-4 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#CD7F32] rounded-full" style={{ filter: 'blur(25px)', opacity: 0.15 }} />
                    {topThree[2].avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${topThree[2].id}/${topThree[2].avatar}.png`}
                        alt={topThree[2].username}
                        className="relative rounded-full border border-[#CD7F32]/50 object-cover shadow-lg avatar-sm"
                      />
                    ) : (
                      <div className="relative rounded-full border border-[#CD7F32]/50 flex items-center justify-center shadow-lg avatar-sm" style={{ background: 'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(0,0,0,1))' }}>
                        <span className="text-[#ffbd80] font-serif" style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
                          {topThree[2].username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-[#CD7F32] uppercase font-mono font-bold" style={{ fontSize: '0.5rem', letterSpacing: '4px', opacity: 0.6, marginBottom: '0.25rem' }}>Master</div>
                  <div className="text-white font-bold text-center px-1 w-full truncate podium-name">{topThree[2].username}</div>

                  <div className="w-full text-center" style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(205,127,50,0.05)' }}>
                    <div className="font-mono text-[#CD7F32] podium-score" style={{ fontWeight: 900, textShadow: '0 2px 10px rgba(205,127,50,0.2)' }}>{topThree[2].score}</div>
                    <div className="text-white uppercase font-semibold" style={{ fontSize: '0.55rem', letterSpacing: '0.2em', opacity: 0.3, marginTop: '0.25rem' }}>Essence</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rest of the rankings - Flex Grow Area */}
        {/* Rest of the rankings - Glassmorphic List */}
        <div className="w-full max-w-4xl pointer-events-auto z-10 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-1000">
          {restOfPlayers.length > 0 && (
            <div className="backdrop-blur-xl border rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <h3 className="text-[#00C2FF] text-left mb-6 font-mono tracking-[4px] uppercase text-sm font-bold flex items-center gap-3">
                <span className="w-8 h-[1px] bg-[#00C2FF]/50" />
                Honorable Sleepers
                <span className="flex-1 h-[1px] bg-gradient-to-r from-[#00C2FF]/50 to-transparent" />
              </h3>

              <div
                className="space-y-3 overflow-y-auto pr-4 custom-scrollbar"
                style={{ maxHeight: '40vh' }}
              >
                {restOfPlayers.map((player, index) => {
                  const rank = index + 3;
                  return (
                    <div
                      key={player.id}
                      className="group sleeper-row overflow-hidden"
                    >
                      {/* Rank Number */}
                      <div className="text-center flex-shrink-0 sleeper-num">
                        <span className="text-white/40 font-mono font-bold group-hover:text-[#00C2FF] transition-colors">{rank + 1}</span>
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0 sleeper-avatar flex items-center justify-center">
                        {player.avatar ? (
                          <img
                            src={`https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`}
                            alt={player.username}
                            className="rounded-full border border-white/20 group-hover:border-[#00C2FF]/50 transition-colors w-full h-full object-cover"
                          />
                        ) : (
                          <div className="rounded-full bg-white/5 border border-white/20 flex items-center justify-center group-hover:border-[#00C2FF]/50 transition-colors w-full h-full">
                            <span className="text-white/80 font-serif" style={{ fontSize: '1em' }}>{player.username.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </div>

                      {/* Name & Title */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-white font-semibold truncate group-hover:text-[#00C2FF] transition-colors sleeper-name">{player.username}</p>
                        <p className="text-white/40 text-[10px] tracking-[0.15em] md:tracking-widest font-mono uppercase">{getRankTitle(rank)}</p>
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0 flex flex-col items-end justify-center">
                        <p className="text-[#FFD700] font-mono font-bold tracking-tight sleeper-score">{player.score}</p>
                        <p className="text-white/30 text-[9px] tracking-[0.2em] uppercase">Essence</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Final Actions */}
        <div className="w-full mx-auto pb-16 z-10 flex flex-col items-center">
          {isHost && onPlayAgain ? (
            <div style={{ width: '100%', maxWidth: '300px' }}>
              <Button
                onClick={onPlayAgain}
                className="w-full bg-gradient-to-r from-[#FFD700] to-[#E6B800] hover:from-[#FFF07F] hover:to-[#FFD700] text-black transition-all duration-300 hover:scale-[1.05]"
                style={{
                  padding: '1.75rem 2rem',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '4px',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(255,215,0,0.4), inset 0 2px 0 rgba(255,255,255,0.5)'
                }}
              >
                Begin New Trial
              </Button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '300px' }}>
              <Button
                onClick={() => window.location.reload()}
                className="w-full text-[#00C2FF] transition-all duration-300 hover:scale-[1.05]"
                style={{
                  padding: '1.75rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '3px',
                  backgroundColor: 'rgba(10,10,10,0.8)',
                  border: '1px solid rgba(0,194,255,0.5)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                Return to Soul Sea
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
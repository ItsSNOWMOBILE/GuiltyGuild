import { useEffect, useState } from "react";
import { Users, Crown, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { MysticBackground } from "./MysticBackground";
import { GuildCards } from "./GuildCards";

interface Player {
    id: string;
    username: string;
    avatar?: string;
    score: number;
}

interface SoulSeaProps {
    players: Player[];
    isHost: boolean;
    onStartGame: () => void;
    isLoading: boolean;
    isAllowedHost: boolean;
    onForceReset?: () => void;
    onLogout?: () => void;
    onEditGame?: () => void;
}

export function SoulSea({ players, isHost, onStartGame, isLoading, isAllowedHost, onForceReset, onLogout, onEditGame }: SoulSeaProps) {
    const [floatingPositions, setFloatingPositions] = useState<{ x: number; y: number; delay: number }[]>([]);

    useEffect(() => {
        // Generate random positions for floating soul lights
        const positions = players.map(() => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            delay: Math.random() * 5,
        }));
        setFloatingPositions(positions);
    }, [players.length]);

    return (
        <div className="min-h-screen relative overflow-hidden font-[Cinzel,serif]">
            <MysticBackground />

            {/* Top Bar for controls */}
            <div className="absolute top-4 right-4 z-50 flex gap-4">
                {onLogout && (
                    <Button
                        onClick={onLogout}
                        variant="ghost"
                        className="text-[#FFD700]/60 hover:text-[#FFD700] hover:bg-[#FFD700]/10 border border-[#FFD700]/20 font-mono text-xs uppercase tracking-[2px]"
                    >
                        Disconnect Soul
                    </Button>
                )}
            </div>

            {/* Main content */}
            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
                <div className="max-w-4xl w-full">
                    {/* Title */}
                    <div className="text-center mb-12 pointer-events-none">
                        <p className="text-[#00C2FF] tracking-[3px] uppercase text-xs opacity-70 mb-3 font-mono">
                            [ System Message: Awakening Sleepers ]
                        </p>
                        <h1 className="text-[#FFD700] tracking-[8px] uppercase mb-2 animate-pulse" style={{
                            fontSize: '3.5rem',
                            textShadow: '0 0 30px rgba(255, 215, 0, 0.5), 0 0 10px rgba(255, 215, 0, 0.8)',
                            fontFamily: 'serif'
                        }}>
                            The Soul Sea
                        </h1>
                        <p className="text-[#00C2FF] text-sm tracking-[3px] uppercase opacity-80 font-mono">
                            Sleepers Gathering Before The Trial
                        </p>
                    </div>

                    {/* New Interactive Guild Cards */}
                    <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <GuildCards />
                    </div>

                    {/* Players panel */}
                    <div className="bg-black/40 backdrop-blur-xl border border-[#FFD700]/30 rounded-lg p-8 shadow-2xl shadow-[#FFD700]/5 mb-8 animate-in fade-in zoom-in duration-500">
                        {/* Runic corners - refined */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-[#FFD700] opacity-50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#FFD700] opacity-50" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#FFD700] opacity-50" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-[#FFD700] opacity-50" />

                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#FFD700]/10">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#FFD700]" />
                                <span className="text-[#e2e8f0] font-serif tracking-wide">
                                    Awakened Souls
                                </span>
                            </div>
                            <span className="text-[#FFD700] font-bold font-mono text-lg">
                                {players.length}
                            </span>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {players.map((player) => (
                                <div
                                    key={player.id}
                                    className="flex items-center gap-4 bg-white/5 p-3 rounded-md border border-white/5 hover:border-[#FFD700]/30 transition-all duration-300 group"
                                >
                                    {/* Avatar */}
                                    {player.avatar ? (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`}
                                            alt={player.username}
                                            className="w-10 h-10 rounded-full border border-[#FFD700]/30 group-hover:border-[#FFD700] transition-colors"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center group-hover:border-[#FFD700] transition-colors">
                                            <span className="text-[#FFD700] font-bold">
                                                {player.username.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Username */}
                                    <div className="flex-1">
                                        <p className="text-gray-200 font-medium group-hover:text-[#FFD700] transition-colors">
                                            {player.username}
                                        </p>
                                        <p className="text-[#6b7280] text-xs font-mono uppercase tracking-wider">
                                            Sleeper
                                        </p>
                                    </div>

                                    {/* Host crown */}
                                    {player.id === players[0]?.id && (
                                        <Crown className="w-4 h-4 text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Start button (host only) */}
                    {isHost && (
                        <div className="flex flex-col gap-4 w-full">
                            <Button
                                onClick={onStartGame}
                                disabled={isLoading || players.length < 1}
                                className="w-full h-14 bg-gradient-to-r from-[#FFD700] to-[#E5C100] hover:from-[#E5C100] hover:to-[#FFD700] text-[#050505] font-bold tracking-widest uppercase border border-[#FFD700]/50 shadow-lg shadow-[#FFD700]/20 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed text-lg font-serif"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                        Manifesting...
                                    </>
                                ) : (
                                    'Begin the Trial'
                                )}
                            </Button>

                            {onEditGame && (
                                <Button
                                    onClick={onEditGame}
                                    variant="outline"
                                    className="w-full h-12 border-[#00C2FF]/30 text-[#00C2FF] hover:bg-[#00C2FF]/10 hover:border-[#00C2FF] transition-all duration-300 uppercase tracking-widest font-serif text-sm bg-black/40 backdrop-blur-sm"
                                >
                                    Open Weaver's Loom
                                </Button>
                            )}
                        </div>
                    )}

                    {!isHost && (
                        <div className="text-center p-6 bg-black/40 backdrop-blur-sm border border-[#FFD700]/20 rounded-lg">
                            <p className="text-[#e2e8f0] font-serif tracking-wide mb-3">
                                Waiting for the Weaver to begin the Trial...
                            </p>
                            <div className="flex justify-center gap-2">
                                <div className="w-1.5 h-1.5 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                <div className="w-1.5 h-1.5 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <div className="w-1.5 h-1.5 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>

                            {isAllowedHost && onForceReset && (
                                <div className="mt-8 pt-4 border-t border-[#FFD700]/20 text-center">
                                    <p className="text-xs text-red-500 mb-2 uppercase tracking-widest">Sovereign Override</p>
                                    <Button
                                        onClick={onForceReset}
                                        variant="destructive"
                                        className="bg-red-900/50 hover:bg-red-900 border border-red-500 text-red-200 text-xs"
                                    >
                                        ⚠ Force Reset Server
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

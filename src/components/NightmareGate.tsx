import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { projectId, publicAnonKey } from "../utils/supabase/info";
import { MysticBackground } from "./MysticBackground";
import { DISCORD_CONFIG } from "../utils/config";

interface User {
    id: string;
    username: string;
    avatar?: string;
}

interface NightmareGateProps {
    onLogin: (code: string) => void;
    error: string | null;
    isLoading: boolean;
    onDemoMode?: () => void;
    user?: User | null;
    onJoin?: () => void;
    onEditGame?: () => void;
}

export function NightmareGate({ onLogin, error, isLoading, onDemoMode, user, onJoin, onEditGame }: NightmareGateProps) {
    const [discordClientId, setDiscordClientId] = useState<string | null>(null);

    useEffect(() => {
        // Fetch Discord client ID from backend
        fetch(`http://localhost:3001/make-server-983e2ba5/config/discord`, {
            headers: {
                Authorization: `Bearer ${publicAnonKey}`,
            },
        })
            .then(res => res.json())
            .then(data => setDiscordClientId(data.clientId))
            .catch(err => console.error("Failed to fetch Discord config:", err));
    }, []);

    const handleDiscordLogin = () => {
        if (!discordClientId) {
            console.error("Discord client ID not loaded");
            return;
        }

        // Use the correctly configured Redirect URI (deep link)
        const redirectUri = encodeURIComponent(DISCORD_CONFIG.redirectUri);
        const scope = encodeURIComponent("identify guilds");
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

        window.location.href = discordAuthUrl;
    };

    return (
        <div className="min-h-screen bg-[#050505] relative overflow-hidden flex items-center justify-center">
            {/* Animated background threads */}
            <MysticBackground />

            {/* System notification box */}
            <div className="relative z-10 max-w-md w-full mx-4">
                <div className="bg-[#0a0a0a]/80 backdrop-blur-md border-2 border-[#00C2FF]/30 rounded-lg p-8 shadow-2xl shadow-[#00C2FF]/20">
                    {/* Runic corner decorations */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#FFD700] rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#FFD700] rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#FFD700] rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#FFD700] rounded-br-lg" />

                    <div className="text-center space-y-6">
                        {/* Title */}
                        <div className="space-y-2">
                            <h1 className="text-[#00C2FF] tracking-wider uppercase text-sm opacity-80">
                                [System Message]
                            </h1>
                            {user ? (
                                <>
                                    <h2 className="text-[#FFD700] text-2xl font-serif tracking-widest uppercase animate-pulse">
                                        Welcome, Sleeper
                                    </h2>
                                    <p className="text-[#e2e8f0] font-mono text-lg mt-2">
                                        {user.username}
                                    </p>
                                    <p className="text-[#00C2FF] text-sm mt-4 leading-relaxed">
                                        The Nightmare Gate is open.<br />
                                        Will you enter the Soul Sea?
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-[#00C2FF] leading-relaxed">
                                        You have been infected by the Spell.
                                    </p>
                                    <p className="text-[#6b7280] text-sm">
                                        The Nightmare Gate awaits those who dare to enter the Trial.
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Action Button */}
                        {user ? (
                            <div className="space-y-4">
                                <Button
                                    onClick={onJoin}
                                    disabled={isLoading}
                                    className="w-full h-14 bg-gradient-to-r from-[#FFD700] to-[#E5C100] hover:from-[#E5C100] hover:to-[#FFD700] text-[#050505] font-bold tracking-widest uppercase border border-[#FFD700]/50 shadow-lg shadow-[#FFD700]/20 transition-all duration-300 hover:scale-[1.02] text-lg font-serif"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                            Manifesting...
                                        </>
                                    ) : (
                                        'Enter the Soul Sea'
                                    )}
                                </Button>

                                {onEditGame && (
                                    <Button
                                        onClick={onEditGame}
                                        variant="outline"
                                        className="w-full h-10 border-[#00C2FF]/30 text-[#00C2FF] hover:bg-[#00C2FF]/10 hover:border-[#00C2FF] transition-all duration-300 uppercase tracking-wider text-xs"
                                    >
                                        Weaver's Loom (Edit Game)
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                onClick={handleDiscordLogin}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-[#7289da] to-[#5865f2] hover:from-[#5865f2] hover:to-[#4752c4] text-white border-2 border-[#00C2FF]/50 shadow-lg shadow-[#7289da]/30 transition-all duration-300 hover:shadow-[#7289da]/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting Soul...
                                    </>
                                ) : (
                                    <>
                                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                                        </svg>
                                        Connect Soul (Discord Login)
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Demo Mode Button - Only show if not logged in */}
                        {onDemoMode && !user && (
                            <Button
                                onClick={onDemoMode}
                                variant="outline"
                                className="w-full bg-transparent border-2 border-[#FFD700]/50 text-[#FFD700] hover:bg-[#FFD700]/10 hover:border-[#FFD700] transition-all duration-300"
                            >
                                Enter Demo Mode (Skip Login)
                            </Button>
                        )}

                        {/* Error message */}
                        {error && (
                            <div className="bg-[#880015]/20 border border-[#880015] rounded p-3 animate-pulse">
                                <p className="text-[#880015] text-sm">
                                    {error}
                                </p>
                            </div>
                        )}

                        {/* Warning text */}
                        <div className="pt-4 border-t border-[#00C2FF]/20">
                            <p className="text-[#6b7280] text-xs">
                                <span className="text-[#FFD700]">⚠</span> Only members of the Guilty Guild may enter
                            </p>
                            <p className="text-[#6b7280] text-xs mt-1">
                                Server ID: 982182985862377522
                            </p>
                        </div>
                    </div>
                </div>

                {/* Glowing effect */}
                <div className="absolute inset-0 -z-10 bg-[#00C2FF] blur-3xl opacity-10 animate-pulse" />
            </div>
        </div>
    );
}


import { Gavel, Shield, Handshake, ExternalLink } from "lucide-react";
import { useState } from "react";

export function GuildCards() {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const cards = [
        {
            title: "GUILTY",
            icon: <Gavel className="w-10 h-10" />,
            desc: "Judgment & Rules",
            color: "from-red-900/20 to-black",
            borderColor: "group-hover:border-[#880015]",
            glowColor: "group-hover:shadow-[#880015]/30",
            iconColor: "text-[#880015]",
            link: "#" // Add your link here
        },
        {
            title: "GUILD",
            icon: <Shield className="w-10 h-10" />,
            desc: "The Citadel",
            color: "from-[#00C2FF]/10 to-black",
            borderColor: "group-hover:border-[#00C2FF]",
            glowColor: "group-hover:shadow-[#00C2FF]/30",
            iconColor: "text-[#00C2FF]",
            link: "#"
        },
        {
            title: "GG",
            icon: <Handshake className="w-10 h-10" />,
            desc: "Good Game",
            color: "from-[#FFD700]/10 to-black",
            borderColor: "group-hover:border-[#FFD700]",
            glowColor: "group-hover:shadow-[#FFD700]/30",
            iconColor: "text-[#FFD700]",
            link: "#"
        }
    ];

    return (
        <div className="flex flex-col md:flex-row gap-6 items-center justify-center p-8 w-full max-w-5xl mx-auto">
            {cards.map((card, index) => (
                <a
                    key={index}
                    href={card.link}
                    className="relative group w-full md:w-1/3"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    {/* Card Container */}
                    <div className={`
            relative h-64 overflow-hidden rounded-xl border border-white/10 
            bg-gradient-to-br ${card.color} backdrop-blur-sm
            transition-all duration-500 ease-out
            ${card.borderColor} ${card.glowColor} group-hover:shadow-2xl group-hover:-translate-y-2
          `}>

                        {/* Background Noise/Grid Effect */}
                        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />

                        {/* Animated Shine */}
                        <div className={`
              absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700
              bg-gradient-to-r from-transparent via-white/5 to-transparent
              -skew-x-12 translate-x-[-100%] group-hover:animate-shine
            `} />

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">

                            {/* Icon Container with Ring */}
                            <div className={`
                relative mb-6 p-4 rounded-full 
                bg-black/40 border border-white/5 
                transition-all duration-500 group-hover:scale-110
                ${card.iconColor} shadow-lg
              `}>
                                {card.icon}
                                {/* Rotating Ring on Hover */}
                                <div className={`
                  absolute inset-0 rounded-full border border-dashed border-current opacity-0 
                  group-hover:opacity-30 group-hover:animate-spin-slow
                `} />
                            </div>

                            {/* Title */}
                            <h3 className={`
                text-3xl font-bold tracking-[0.2em] font-[Cinzel] mb-2 text-white
                group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r 
                group-hover:from-white group-hover:to-gray-400 transition-all
              `}>
                                {card.title}
                            </h3>

                            {/* Description */}
                            <p className="text-sm font-mono text-gray-500 uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-100">
                                {card.desc}
                            </p>

                            {/* Corner Accent */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-50 transition-opacity">
                                <ExternalLink className="w-4 h-4 text-white/50" />
                            </div>
                        </div>
                    </div>
                </a>
            ))}
        </div>
    );
}

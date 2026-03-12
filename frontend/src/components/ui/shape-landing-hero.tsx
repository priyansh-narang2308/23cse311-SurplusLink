"use client";

import { motion } from "framer-motion";
import { Circle, Apple, Carrot, Leaf, Wheat, Utensils } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

function FloatingFoodIcon({
    icon: Icon,
    className,
    delay = 0,
    size = 48,
    rotate = 0,
    gradient = "from-emerald-500/[0.2]",
}: {
    icon: React.ElementType;
    className?: string;
    delay?: number;
    size?: number;
    rotate?: number;
    gradient?: string;
}) {
    return (
        <motion.div
            initial={{
                opacity: 0,
                y: -150,
                rotate: rotate - 15,
            }}
            animate={{
                opacity: 1,
                y: 0,
                rotate: rotate,
            }}
            transition={{
                duration: 2.4,
                delay,
                ease: [0.23, 0.86, 0.39, 0.96],
                opacity: { duration: 1.2 },
            }}
            className={cn("absolute", className)}
        >
            <motion.div
                animate={{
                    y: [0, 60, 0],
                    x: [0, 40, 0],
                    rotate: [0, 10, -10, 0],
                }}
                transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                }}
                className="relative"
            >
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                    }}
                    className={cn(
                        "flex items-center justify-center p-6 rounded-3xl",
                        "bg-gradient-to-br to-transparent",
                        gradient,
                        "backdrop-blur-[4px] border border-white/[0.1]",
                        "shadow-[0_8px_32px_0_rgba(16,185,129,0.15)]",
                    )}
                >
                    <Icon size={size} className="text-emerald-500/80 drop-shadow-md" />
                </motion.div>
            </motion.div>
        </motion.div>
    );
}

function HeroGeometric({
    title1 = "Eliminate Food Waste",
    title2 = "Empower Communities",
}: {
    title1?: string;
    title2?: string;
}) {
    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 1,
                delay: 0.5 + i * 0.2,
                ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number],
            },
        }),
    };

    return (
        <div className="relative min-h-[80vh] w-full flex items-center justify-center overflow-hidden bg-background pt-32 md:pt-40 pb-20">
            {/* Enhanced animated background gradient */}
            <motion.div 
                animate={{
                    scale: [1, 1.4, 1],
                    rotate: [0, 8, -8, 0],
                    x: [0, 40, 0],
                    y: [0, -25, 0],
                }}
                transition={{
                    duration: 8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                }}
                className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-teal-500/[0.05] blur-3xl" 
            />

            <div className="absolute inset-0 overflow-hidden">
                <FloatingFoodIcon
                    icon={Apple}
                    delay={0.3}
                    size={48}
                    rotate={12}
                    gradient="from-emerald-500/[0.15]"
                    className="left-[-5%] md:left-[5%] top-[15%] md:top-[20%]"
                />

                <FloatingFoodIcon
                    icon={Carrot}
                    delay={0.5}
                    size={56}
                    rotate={-15}
                    gradient="from-teal-500/[0.15]"
                    className="right-[-5%] md:right-[15%] top-[70%] md:top-[75%]"
                />

                <FloatingFoodIcon
                    icon={Wheat}
                    delay={0.4}
                    size={40}
                    rotate={-8}
                    gradient="from-green-500/[0.15]"
                    className="left-[5%] md:left-[20%] bottom-[5%] md:bottom-[15%]"
                />

                <FloatingFoodIcon
                    icon={Leaf}
                    delay={0.6}
                    size={64}
                    rotate={20}
                    gradient="from-lime-500/[0.15]"
                    className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
                />

                <FloatingFoodIcon
                    icon={Utensils}
                    delay={0.7}
                    size={32}
                    rotate={-25}
                    gradient="from-emerald-300/[0.15]"
                    className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
                />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6">
                <div className="max-w-3xl mx-auto text-center">
                   

                    <motion.div
                        custom={1}
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black mb-6 md:mb-8 tracking-tight">
                            <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                                {title1}
                            </span>
                            <br />
                            <span
                                className={cn(
                                    "bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 "
                                )}
                            >
                                {title2}
                            </span>
                        </h1>
                    </motion.div>

                    <motion.div
                        custom={2}
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed font-medium tracking-wide max-w-xl mx-auto px-4">
                            Seamlessly connecting excess inventory with organizations that need it most, powered by intelligent routing and real-time logistics.
                        </p>
                    </motion.div>
                </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
        </div>
    );
}

export { HeroGeometric };

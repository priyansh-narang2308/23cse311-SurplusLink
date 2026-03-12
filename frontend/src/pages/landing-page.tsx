/** Landing page with hero, features, and impact overview */
import { Navbar } from '@/components/layout/navbar';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { Features } from '@/components/landing/features';
import { Process } from '@/components/landing/process';
import { Impact } from '@/components/landing/impact';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/landing/footer';
import { motion } from 'framer-motion';
import React from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect } from 'react';

export default function LandingPage() {
    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        });

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            lenis.destroy();
        };
    }, []);

    return (
        <div className="min-h-screen bg-background selection:bg-primary/30 selection:text-primary-foreground relative">

            <Navbar />

            <main>
                <HeroGeometric

                    title1="Eliminate Food Waste"
                    title2="Empower Communities"
                />



                <Features />
                <Process />
                <FAQ />

                <section className="py-24 relative overflow-hidden">
                    <div className="absolute inset-0 bg-transparent -z-10" />
                    <div className="container mx-auto px-4 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            className="max-w-4xl mx-auto rounded-[3rem] bg-foreground text-background p-12 md:p-20 relative overflow-hidden shadow-2xl z-10"
                        >
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />

                            <h2 className="text-3xl md:text-6xl font-black mb-8 leading-tight">
                                Ready to make <br />
                                <span className="text-primary italic">your first</span> impact?
                            </h2>
                            <p className="text-xl text-background/70 mb-12 max-w-2xl mx-auto">
                                Join our network of donors, NGOs, and volunteers today. Together we can save thousands of meals and reduce carbon footprints.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-6 justify-center">
                                <button className="bg-primary text-primary-foreground px-10 py-5 rounded-full text-xl font-bold hover:scale-105 transition-transform shadow-xl shadow-primary/20">
                                    Join SurplusLink
                                </button>

                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}

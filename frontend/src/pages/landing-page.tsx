import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Utensils,
    Heart,
    Truck,
    BarChart3,
    ArrowRight,
    Check,
    Building2,
    Users,
    Leaf
} from 'lucide-react';
import heroImage from "../assets/hero-image.jpg";
import { Navbar } from '@/components/layout/navbar';

const features = [
    {
        icon: Utensils,
        title: 'Smart Matching',
        description: 'AI-powered system connects surplus food with nearby NGOs in real-time.'
    },
    {
        icon: Truck,
        title: 'Seamless Logistics',
        description: 'Volunteer network ensures fast, reliable pickup and delivery.'
    },
    {
        icon: BarChart3,
        title: 'Impact Tracking',
        description: 'Measure your contribution with detailed analytics and reports.'
    },
    {
        icon: Leaf,
        title: 'Sustainability',
        description: 'Reduce food waste and carbon emissions while helping communities.'
    }
];

const stats = [
    { value: '12,450+', label: 'Meals Saved' },
    { value: '4.2 tons', label: 'CO₂ Reduced' },
    { value: '47', label: 'Active Donors' },
    { value: '23', label: 'NGO Partners' }
];

const benefits = {
    donors: [
        'Quick and easy donation posting',
        'Automatic NGO matching',
        'Real-time pickup tracking',
        'Tax deduction documentation',
        'Impact reports and analytics'
    ],
    ngos: [
        'Browse nearby donations',
        'Accept with one click',
        'Volunteer coordination tools',
        'Quality and hygiene tracking',
        'Community impact metrics'
    ]
};

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <section className="relative overflow-hidden">
                <div className="absolute inset-0 gradient-hero opacity-10" />
                <div className="container mx-auto px-4 py-16 lg:py-24">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8 animate-slide-up">
                            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                                <Leaf className="h-4 w-4" />
                                Fighting food waste together
                            </div>

                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                Connect Surplus Food with{' '}
                                <span className="text-gradient">Those in Need</span>
                            </h1>

                            <p className="text-xl text-muted-foreground max-w-lg">
                                SurplusLink bridges the gap between food donors and NGOs through smart matching and seamless logistics. Every meal counts.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button variant="hero" size="xl" asChild>
                                    <Link to="/login">
                                        Get Started
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Link>
                                </Button>
                                <Button variant="outline" size="xl" asChild>
                                    <Link to="#how-it-works">
                                        Learn More
                                    </Link>
                                </Button>
                            </div>

                            <div className="flex items-center gap-4 pt-4">
                                <div className="flex -space-x-3">
                                    {['FB', 'GC', 'TG', 'FFA'].map((initials, i) => (
                                        <div
                                            key={i}
                                            className="h-10 w-10 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-xs font-medium"
                                        >
                                            {initials}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">70+</span> organizations trust SurplusLink
                                </p>
                            </div>
                        </div>

                        <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
                            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                                <img
                                    src={heroImage}
                                    alt="Food being shared between hands, representing food redistribution"
                                    className="w-full h-auto"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                            </div>


                            <div className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-lg p-4 border border-border animate-float">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-success/10 p-2">
                                        <Heart className="h-5 w-5 text-success" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">12,450+</p>
                                        <p className="text-sm text-muted-foreground">Meals Saved</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            <section className="border-y border-border bg-muted/30">
                <div className="container mx-auto px-4 py-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, i) => (
                            <div key={i} className="text-center">
                                <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            <section id="features" className="container mx-auto px-4 py-20">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        How SurplusLink Works
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Our platform makes food redistribution simple, efficient, and impactful.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, i) => (
                        <Card key={i} className="group hover:shadow-lg transition-all duration-300 border-border/50">
                            <CardContent className="p-6">
                                <div className="rounded-xl gradient-primary p-3 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <feature.icon className="h-6 w-6 text-primary-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-muted-foreground">{feature.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <section id="how-it-works" className="bg-muted/30 py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Simple Steps to Make a Difference
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Whether you're donating or receiving, our platform guides you every step of the way.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {[
                            {
                                step: '1',
                                title: 'Post or Browse',
                                description: 'Donors list surplus food; NGOs browse available donations nearby.'
                            },
                            {
                                step: '2',
                                title: 'Match & Accept',
                                description: 'Our system suggests optimal matches. Accept with one click.'
                            },
                            {
                                step: '3',
                                title: 'Pickup & Deliver',
                                description: 'Volunteers handle logistics with real-time tracking.'
                            }
                        ].map((item, i) => (
                            <div key={i} className="relative text-center">
                                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full gradient-primary text-primary-foreground text-2xl font-bold mb-4">
                                    {item.step}
                                </div>
                                {i < 2 && (
                                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-primary/0" />
                                )}
                                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                <p className="text-muted-foreground">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            <section className="container mx-auto px-4 py-20">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Built for Everyone
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Tailored experiences for food donors and NGO partners.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">

                    <Card className="overflow-hidden border-border/50">
                        <div className="gradient-primary p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary-foreground/20 p-2">
                                    <Building2 className="h-6 w-6 text-primary-foreground" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-primary-foreground">For Donors</h3>
                                    <p className="text-primary-foreground/80 text-sm">Restaurants, Caterers, Event Organizers</p>
                                </div>
                            </div>
                        </div>
                        <CardContent className="p-6">
                            <ul className="space-y-3">
                                {benefits.donors.map((benefit, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="rounded-full bg-primary/10 p-1">
                                            <Check className="h-4 w-4 text-primary" />
                                        </div>
                                        <span>{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button variant="hero" className="w-full mt-6" asChild>
                                <Link to="/login">
                                    Start Donating
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>


                    <Card className="overflow-hidden border-border/50">
                        <div className="gradient-accent p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-accent-foreground/20 p-2">
                                    <Users className="h-6 w-6 text-accent-foreground" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-accent-foreground">For NGOs</h3>
                                    <p className="text-accent-foreground/80 text-sm">Food Banks, Shelters, Community Kitchens</p>
                                </div>
                            </div>
                        </div>
                        <CardContent className="p-6">
                            <ul className="space-y-3">
                                {benefits.ngos.map((benefit, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="rounded-full bg-accent/10 p-1">
                                            <Check className="h-4 w-4 text-accent" />
                                        </div>
                                        <span>{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button variant="accent" className="w-full mt-6" asChild>
                                <Link to="/login">
                                    Join as NGO
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>


            <section className="relative overflow-hidden">
                <div className="absolute inset-0 gradient-hero opacity-90" />
                <div className="relative container mx-auto px-4 py-20 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                        Ready to Make an Impact?
                    </h2>
                    <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8">
                        Join SurplusLink today and be part of the solution. Together, we can reduce food waste and feed those in need.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="xl" className="bg-card text-primary hover:bg-card/90" asChild>
                            <Link to="/login">
                                Get Started Free
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="border-t border-border bg-muted/30">
                <div className="container mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                            <div className="gradient-primary rounded-lg p-2">
                                <svg className="h-5 w-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <span className="font-bold text-lg">SurplusLink</span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                            © 2026 SurplusLink. All rights reserved. Making food redistribution smarter.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

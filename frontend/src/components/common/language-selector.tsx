import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Languages, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";

const languages = [
    { label: "English", value: "en" },
    { label: "Hindi (हिंदी)", value: "hi" },
    { label: "Bengali (বাংলা)", value: "bn" },
    { label: "Telugu (తెలుగు)", value: "te" },
    { label: "Marathi (मराठी)", value: "mr" },
    { label: "Tamil (தமிழ்)", value: "ta" },
    { label: "Gujarati (ગુજરાતી)", value: "gu" },
    { label: "Kannada (ಕನ್ನಡ)", value: "kn" },
    { label: "Malayalam (മലയാളം)", value: "ml" },
    { label: "Punjabi (ਪੰਜਾਬੀ)", value: "pa" },
];

export function LanguageSelector() {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("en");
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        const getCookie = (name: string) => {
            const v = document.cookie.match("(^|;) ?" + name + "=([^;]*)(;|$)");
            return v ? v[2] : null;
        };

        const cookieValue = getCookie("googtrans");
        if (cookieValue) {
            const lang = cookieValue.split("/").pop();
            if (lang) setValue(lang);
        }
    }, []);

    const handleSelect = (langCode: string) => {
        if (langCode === value) {
            setOpen(false);
            return;
        }

        setIsTranslating(true);
        setValue(langCode);
        setOpen(false);

        const gtCombo = document.querySelector(".goog-te-combo") as HTMLSelectElement;
        if (gtCombo) {
            gtCombo.value = langCode;
            gtCombo.dispatchEvent(new Event("change"));

            // Artificial delay to match the translation processing
            setTimeout(() => {
                setIsTranslating(false);
            }, 1500);
        } else {
            // Fallback for first-time init
            document.cookie = `googtrans=/en/${langCode}; path=/`;
            document.cookie = `googtrans=/en/${langCode}; domain=.${window.location.hostname}; path=/`;
            window.location.reload();
        }
    };

    return (
        <div className="flex items-center notranslate">
            {/* Hidden container for Google Translate to inject its default widget */}
            <div id="google_translate_element" className="hidden" />

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isTranslating && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-background/20 backdrop-blur-md z-[9999] flex items-center justify-center pointer-events-none"
                        >
                            <div className="bg-card p-8 rounded-[2.5rem] shadow-glow border border-primary/20 flex flex-col items-center gap-6 animate-scale-in">
                                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">Switching Language</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Updating your workspace experience</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        aria-expanded={open}
                        disabled={isTranslating}
                        className={cn(
                            "flex items-center gap-2 h-9 px-3 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300 font-bold group border border-transparent hover:border-primary/20",
                            isTranslating && "opacity-50"
                        )}
                    >
                        {isTranslating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                            <Languages className="h-4 w-4 group-hover:rotate-12 transition-transform duration-300" />
                        )}
                        <span className="hidden sm:inline text-xs uppercase tracking-widest font-black">
                            {isTranslating ? "Translating..." : (languages.find((lang) => lang.value === value)?.label.split(" (")[0] || "en")}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0 rounded-2xl border-none shadow-2xl overflow-hidden bg-card/95 backdrop-blur-xl notranslate" align="end">
                    <Command className="bg-transparent">
                        <div className="flex items-center border-b border-border/50 px-4 h-12">
                            <CommandInput placeholder="Search language..." className="border-none focus:ring-0 text-xs uppercase tracking-widest font-black h-full w-full" />
                        </div>
                        <CommandEmpty className="py-6 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">No matching language found.</CommandEmpty>
                        <CommandList className="max-h-[350px] custom-scrollbar overflow-y-auto p-1.5">
                            <CommandGroup>
                                {languages.map((lang) => (
                                    <CommandItem
                                        key={lang.value}
                                        value={lang.label}
                                        onSelect={() => handleSelect(lang.value)}
                                        className={cn(
                                            "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group mb-1 last:mb-0",
                                            value === lang.value ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                        )}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-black uppercase tracking-widest leading-none">
                                                {lang.label.split(" (")[0]}
                                            </span>
                                            {lang.label.includes("(") && (
                                                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary/70 transition-colors">
                                                    {lang.label.match(/\((.*)\)/)?.[1]}
                                                </span>
                                            )}
                                        </div>
                                        {value === lang.value && (
                                            <Check className="h-4 w-4 animate-in zoom-in duration-300" />
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div >
    );
}

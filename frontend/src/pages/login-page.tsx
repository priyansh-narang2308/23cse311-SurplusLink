/** Authentication page for login and signup */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

import { UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, Heart, Shield, Zap, CheckCircle2, Eye, EyeOff, KeyRound, Users2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Logo } from '@/components/ui/logo';
import { Mail } from 'lucide-react';

const roles: { value: UserRole; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'donor',
    label: 'Food Donor',
    icon: Building2,
    description: 'Restaurants & Event Organizers'
  },
  {
    value: 'ngo',
    label: 'NGO Partner',
    icon: Heart,
    description: 'Food Banks & Shelters'
  },
  {
    value: 'volunteer',
    label: 'Volunteer',
    icon: Zap,
    description: 'Transporters & Helpers'
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: Shield,
    description: 'Platform Management'
  },
];

export default function LoginPage() {
  const [authView, setAuthView] = useState<'tabs' | 'verification'>('tabs');
  const [activeTab, setActiveTab] = useState("register");

  const [selectedRole, setSelectedRole] = useState<UserRole>('donor');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // OTP Login State
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);

  const { login, signup, sendOTP, verifyOTP, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await login(email, password);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.response?.data?.message || "Please check your credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail) {
      toast({ title: "Email required", description: "Please enter your email address", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await sendOTP(otpEmail);
      setOtpSent(true);
      setOtpTimer(600);
    } catch (error: any) {
      toast({
        title: "Failed to send OTP",
        description: error.response?.data?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue.length !== 4) {
      toast({ title: "Invalid OTP", description: "Please enter a valid 4-digit code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await verifyOTP(otpEmail, otpValue);
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.response?.data?.message || "Invalid or expired OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('reg-email') as string;
    const password = formData.get('reg-password') as string;
    const organization = formData.get('org-name') as string;

    try {
      const response = await signup({
        name,
        email,
        password,
        role: selectedRole,
        organization: (selectedRole === 'donor' || selectedRole === 'ngo') ? organization : undefined
      });

      if (response && response.requiresOtp) {
        setOtpEmail(email);
        setOtpSent(true);
        setAuthView('verification');
        setOtpTimer(600); // 10 minutes
        toast({
          title: "Verify your email",
          description: "We've sent a code to your email. Please enter it to continue.",
        });
      } else if (response) {
        // Direct successful registration w/o OTP (fallback)
        toast({
          title: "Registration Successful",
          description: "Redirecting...",
        });
        // Navigation will be handled by the useEffect or we can force it
        // but useEffect is safer.
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && role) {
      console.log('Redirecting authenticated user with role:', role);
      navigate(`/${role}`, { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  return (
    <div className="min-h-screen w-full flex bg-background relative selection:bg-primary/30 overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none bg-[linear-gradient(to_right,rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />


      <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />


      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 left-4 lg:top-8 lg:left-8 z-50 flex items-center gap-2"
      >
        <Link to="/" className="group flex items-center gap-2 bg-card/50 backdrop-blur-md border border-border/50 px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl lg:rounded-2xl hover:bg-card hover:border-primary/30 transition-all shadow-sm">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs lg:text-sm font-semibold">Back to Home</span>
        </Link>
        <Link
          to="/community"
          id="community-board-link"
          className="group flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl lg:rounded-2xl transition-all shadow-sm shadow-orange-500/20"
        >
          <Users2 className="h-4 w-4" />
          <span className="text-xs lg:text-sm font-semibold">Community Board</span>
        </Link>
      </motion.div>

      <div className="flex-1 flex items-center justify-center p-4 lg:p-12 relative z-10 pt-24 lg:pt-12">
        <div className="w-full max-w-[1100px] flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">

          <div className="hidden lg:flex flex-col gap-10 flex-1">
            <Logo size="xl" showText={true} />

            <div className="space-y-6 lg:space-y-8">
              <h2 className="text-4xl lg:text-5xl xl:text-6xl font-black leading-[1.1] tracking-tighter">
                Empowering <span className="text-primary italic">Global</span> <br className="hidden xl:block" />Sustainability.
              </h2>
              <div className="space-y-5">
                {[
                  'Real-time AI Donation Matching',
                  'Secure Hygiene Chain Tracking',
                  'Instant Logistics Coordination'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 text-muted-foreground/90 font-semibold text-lg">
                    <CheckCircle2 className="h-6 w-6 text-[#10b981]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full max-w-md animate-scale-in py-8">
            <Card className="shadow-2xl border-border/50 backdrop-blur-sm bg-card/95 rounded-[2rem] overflow-hidden">
              {authView === 'tabs' ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <CardHeader className="pb-4 pt-8 px-8">
                    <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 rounded-xl">
                      <TabsTrigger value="login" className="rounded-lg font-bold">Sign In</TabsTrigger>
                      <TabsTrigger value="register" className="rounded-lg font-bold">Register</TabsTrigger>
                    </TabsList>
                  </CardHeader>

                  <CardContent className="p-6 lg:p-8 pt-4 lg:pt-6">
                    <TabsContent value="login" className="mt-0 space-y-4">
                      <div className="space-y-4 pt-2">
                        <div className="text-center space-y-2 mb-6">
                          <h3 className="text-2xl font-bold tracking-tight">Welcome Back</h3>
                          <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
                        </div>

                        {/* Login Method Toggle */}
                        <div className="flex p-1 bg-muted/30 rounded-lg mb-6">
                          <button
                            type="button"
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === 'password' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setLoginMethod('password')}
                          >
                            <KeyRound className="h-4 w-4" /> Password
                          </button>
                          <button
                            type="button"
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === 'otp' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setLoginMethod('otp')}
                          >
                            <Mail className="h-4 w-4" /> OTP
                          </button>
                        </div>

                        {loginMethod === 'password' ? (
                          <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                className="h-11 rounded-xl"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="password">Password</Label>
                              <div className="relative group">
                                <Input
                                  id="password"
                                  name="password"
                                  placeholder="Enter your password"
                                  type={showLoginPassword ? "text" : "password"}
                                  className="h-11 rounded-xl pr-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                  required
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-1 top-1 h-9 w-9 p-0 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                                >
                                  {showLoginPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="flex justify-end pr-1">
                              <Link
                                to="/forgot-password"
                                className="text-[11px] font-black uppercase tracking-tighter text-primary/70 hover:text-primary transition-colors"
                              >
                                Forgot Password?
                              </Link>
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-xl font-bold uppercase tracking-wider mt-2" variant="hero" disabled={isLoading}>
                              {isLoading ? 'Signing in...' : 'Sign In'}
                            </Button>
                          </form>
                        ) : (
                          /* OTP Login Form */
                          <div className="space-y-4">
                            {!otpSent ? (
                              <form onSubmit={handleSendOTP} className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="otp-email">Email Address</Label>
                                  <Input
                                    id="otp-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    className="h-11 rounded-xl"
                                    value={otpEmail}
                                    onChange={(e) => setOtpEmail(e.target.value)}
                                    required
                                  />
                                  <p className="text-xs text-muted-foreground ml-1">
                                    We'll send a one-time verification code to this email.
                                  </p>
                                </div>
                                <Button type="submit" className="w-full h-12 rounded-xl font-bold uppercase tracking-wider mt-2" variant="hero" disabled={isLoading || !otpEmail}>
                                  {isLoading ? 'Sending OTP...' : 'Send Verification Code'}
                                </Button>
                              </form>
                            ) : (
                              <form onSubmit={handleVerifyOTP} className="space-y-6">
                                <div className="space-y-2 flex flex-col items-center">
                                  <div className="text-center mb-6">
                                    <p className="text-sm text-muted-foreground mb-2">Enter the verification code sent to</p>
                                    <p className="text-base font-bold text-foreground">{otpEmail}</p>
                                  </div>
                                  <InputOTP
                                    maxLength={4}
                                    value={otpValue}
                                    onChange={(value) => setOtpValue(value)}
                                  >
                                    <InputOTPGroup className="gap-2">
                                      <InputOTPSlot index={0} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                                      <InputOTPSlot index={1} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                                      <InputOTPSlot index={2} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                                      <InputOTPSlot index={3} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                                    </InputOTPGroup>
                                  </InputOTP>
                                  <div className="text-center mt-2">
                                    {otpTimer > 0 ? (
                                      <p className="text-xs text-muted-foreground">Code expires in {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</p>
                                    ) : (
                                      <p className="text-xs text-destructive">Code expired</p>
                                    )}
                                  </div>
                                </div>

                                <Button type="submit" className="w-full h-12 rounded-xl font-bold uppercase tracking-wider" variant="hero" disabled={isLoading || otpValue.length !== 4}>
                                  {isLoading ? 'Verifying...' : 'Verify & Login'}
                                </Button>

                                <div className="flex items-center justify-between mt-4">
                                  <button
                                    type="button"
                                    onClick={() => setOtpSent(false)}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  >
                                    <ArrowLeft className="h-3 w-3" /> Change Email
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { setOtpValue(""); handleSendOTP(e); }}
                                    className="text-xs font-semibold text-primary hover:underline"
                                    disabled={otpTimer > 540}
                                  >
                                    Resend Code
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="register" className="mt-0 space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">I am registering as a...</Label>
                          <div className="grid grid-cols-2 gap-3">
                            {roles.map((role) => (
                              <button
                                key={role.value}
                                type="button"
                                onClick={() => setSelectedRole(role.value)}
                                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all duration-200 text-left ${selectedRole === role.value
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                  }`}
                              >
                                <div className={`rounded-lg p-1.5 ${selectedRole === role.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                                  }`}>
                                  <role.icon className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-bold text-xs uppercase tracking-tight">{role.label}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-4">
                          {(selectedRole === 'donor' || selectedRole === 'ngo') && (
                            <div className="space-y-2">
                              <Label htmlFor="org-name">
                                {selectedRole === 'donor' ? 'Store / Business Name' : 'Organization Name'}
                              </Label>
                              <Input id="org-name" name="org-name" placeholder={selectedRole === 'donor' ? 'e.g. Dominos' : 'e.g. Food Hub'} className="h-11 rounded-xl" required />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" name="name" placeholder="John Doe" className="h-11 rounded-xl" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reg-email">Email</Label>
                            <Input id="reg-email" name="reg-email" type="email" placeholder="you@example.com" className="h-11 rounded-xl" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reg-password">Password</Label>
                            <div className="relative group">
                              <Input
                                id="reg-password"
                                name="reg-password"
                                type={showRegisterPassword ? "text" : "password"}
                                placeholder="Create a password"
                                className="h-11 rounded-xl pr-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                required
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-9 w-9 p-0 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              >
                                {showRegisterPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-wider mt-1" variant="hero" disabled={isLoading}>
                            {isLoading ? 'Creating account...' : 'Create Account'}
                          </Button>
                        </form>
                      </div>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              ) : (
                /* Dedicated Verification View */
                <CardContent className="p-8 space-y-6 pt-12">
                  <div className="text-center space-y-2 mb-6">
                    <h3 className="text-2xl font-bold tracking-tight">Verify Your Account</h3>
                    <p className="text-sm text-muted-foreground">For security, please verify your email address.</p>
                  </div>

                  <form onSubmit={handleVerifyOTP} className="space-y-6">
                    <div className="space-y-2 flex flex-col items-center">
                      <div className="text-center mb-6">
                        <p className="text-sm text-muted-foreground mb-2">Enter the verification code sent to</p>
                        <p className="text-base font-bold text-foreground">{otpEmail}</p>
                      </div>
                      <InputOTP
                        maxLength={4}
                        value={otpValue}
                        onChange={(value) => setOtpValue(value)}
                      >
                        <InputOTPGroup className="gap-2">
                          <InputOTPSlot index={0} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                          <InputOTPSlot index={1} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                          <InputOTPSlot index={2} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                          <InputOTPSlot index={3} className="h-14 w-14 rounded-xl border-2 text-lg font-bold" />
                        </InputOTPGroup>
                      </InputOTP>
                      <div className="text-center mt-2">
                        {otpTimer > 0 ? (
                          <p className="text-xs text-muted-foreground">Code expires in {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</p>
                        ) : (
                          <p className="text-xs text-destructive">Code expired</p>
                        )}
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-12 rounded-xl font-bold uppercase tracking-wider" variant="hero" disabled={isLoading || otpValue.length !== 4}>
                      {isLoading ? 'Verifying...' : 'Complete Registration'}
                    </Button>

                    <div className="flex items-center justify-between mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView('tabs');
                          setActiveTab('register');
                          setOtpSent(false);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <ArrowLeft className="h-3 w-3" /> Back to Register
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          setOtpValue("");
                          handleSendOTP(e);
                        }}
                        className="text-xs font-semibold text-primary hover:underline"
                        disabled={otpTimer > 540}
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

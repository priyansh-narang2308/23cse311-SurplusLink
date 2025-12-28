import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, Heart, Shield } from 'lucide-react';

const roles: { value: UserRole; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'donor',
    label: 'Food Donor',
    icon: Building2,
    description: 'Restaurants, caterers, event organizers'
  },
  {
    value: 'ngo',
    label: 'NGO Partner',
    icon: Heart,
    description: 'Food banks, shelters, community kitchens'
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: Shield,
    description: 'Platform administration'
  },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('donor');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      login(selectedRole);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${selectedRole}`,
      });
      navigate(`/${selectedRole}`);
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 800));

    login(selectedRole);
    toast({
      title: "Account created!",
      description: "Welcome to SurplusLink",
    });
    navigate(`/${selectedRole}`);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="p-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="gradient-primary rounded-xl p-3">
                <svg className="h-6 w-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-bold text-2xl">SurplusLink</span>
            </Link>
            <p className="text-muted-foreground">Connect. Contribute. Change lives.</p>
          </div>

          <Card className="shadow-lg border-border/50">
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Role Selection */}
                <div className="space-y-3">
                  <Label>I am a...</Label>
                  <div className="grid gap-2">
                    {roles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left ${selectedRole === role.value
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                      >
                        <div className={`rounded-lg p-2 ${selectedRole === role.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                          }`}>
                          <role.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{role.label}</p>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <TabsContent value="login" className="mt-0 space-y-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        defaultValue="demo@surpluslink.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        defaultValue="password123"
                      />
                    </div>
                    <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                      {isLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-0 space-y-4">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input id="org-name" placeholder="Your organization" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input id="reg-email" type="email" placeholder="you@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <Input id="reg-password" type="password" placeholder="Create a password" />
                    </div>
                    <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                      {isLoading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>

                <p className="text-xs text-center text-muted-foreground pt-4 border-t border-border">
                  Demo mode: Click sign in to access the {selectedRole} dashboard
                </p>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { Sun, Moon, Bell, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { getUnreadCount } from '@/mockData/notifications';

interface NavbarProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export function Navbar({ onMenuClick, showMenu = false }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const unreadCount = user ? getUnreadCount(user.id) : 0;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          {showMenu && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          {!isAuthenticated && (
            <a href="/" className="flex items-center gap-2">
              <div className="gradient-primary rounded-lg p-2">
                <svg className="h-5 w-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-bold text-xl">SurplusLink</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {isAuthenticated && user && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full relative"
                onClick={() => navigate(`/${user.role}/notifications`)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs gradient-accent border-0">
                    {unreadCount}
                  </Badge>
                )}
              </Button>

              <div className="hidden sm:flex items-center gap-3 ml-2 pl-4 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-9 w-9 rounded-full bg-secondary"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="rounded-full text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

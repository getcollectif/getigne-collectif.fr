
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, Settings, FileText, Car, Coffee, HandHeart, PenLineIcon, BookUser, UserCog, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthButton from './AuthButton';
import UserAvatar, { getUserNames } from '@/components/UserAvatar';
import { useAuth } from '@/context/auth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Routes } from '@/routes';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [supportersCount, setSupportersCount] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { isAdmin, user, refreshUserRoles, userRoles, isRefreshingRoles } = useAuth();
  const [hasRefreshedRoles, setHasRefreshedRoles] = useState(false);
  const { settings } = useAppSettings();

  const canAccessProgram = 
    settings.modules.program || 
    userRoles.includes('admin') || 
    userRoles.includes('program_manager');

  const showSupportModule =
    settings.modules.supportCommittee || settings.modules.membershipForm;
  const showProgramLink = settings.modules.program;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!showSupportModule) return;

    const fetchSupportersCount = async () => {
      try {
        const { count, error } = await supabase
          .from('support_committee')
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          setSupportersCount(count);
        }
      } catch (error) {
        console.error('Error fetching supporters count:', error);
      }
    };

    fetchSupportersCount();
    
    // S'abonner aux changements pour mettre à jour le compteur en temps réel
    const channel = supabase
      .channel('support_committee_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_committee' }, () => {
        fetchSupportersCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showSupportModule]);

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'text-brand'
      : 'text-brand-700 hover:text-brand transition-colors duration-200';
  };

  useEffect(() => {
    // Ne pas re-vérifier les rôles automatiquement dans la navbar
    // Cela peut causer des redirections intempestives lors du changement d'onglet
    // Les rôles sont déjà gérés par AuthProvider lors du refresh de token
    if (user && !hasRefreshedRoles) {
      setHasRefreshedRoles(true);
    }
  }, [user, hasRefreshedRoles]);

  useEffect(() => {
    if (user === null) {
      setHasRefreshedRoles(false);
    }
  }, [user]);

  const NavLinks = () => (
    <>
      <li>
        <Link to={Routes.HOME} className={isActive(Routes.HOME)}>
          Accueil
        </Link>
      </li>
      {showProgramLink && (
        <li>
          <Link to={Routes.PROGRAM} className={isActive(Routes.PROGRAM)}>
            Le programme
          </Link>
        </li>
      )}
      {settings.modules.team && (
        <li>
          <Link to={Routes.TEAM} className={isActive(Routes.TEAM)}>
            L'équipe
          </Link>
        </li>
      )}
      {settings.modules.blog && (
        <li>
          <Link to={Routes.NEWS} className={isActive(Routes.NEWS)}>
            Actualités
          </Link>
        </li>
      )}
      {settings.modules.agenda && (
        <li className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className={`flex items-center ${
                  location.pathname === Routes.AGENDA || location.pathname === Routes.NEIGHBORHOOD_EVENTS 
                    ? 'text-brand' 
                    : 'text-brand-700 hover:text-brand transition-colors duration-200'
                }`}
              >
                Agenda
                <ChevronDown className="ml-1 h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link to={Routes.AGENDA} className="w-full flex items-center">
                  Tous les événements
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={Routes.NEIGHBORHOOD_EVENTS} className="w-full flex items-center">
                  <Coffee className="mr-2 h-4 w-4" />
                  Cafés de quartier
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      )}
      {settings.modules.proxy && (
        <li>
          <Link to={Routes.PROXY} className={isActive(Routes.PROXY)}>
            Espace procuration
          </Link>
        </li>
      )}
      <li>
        <Link to={Routes.CONTACT} className={isActive(Routes.CONTACT)}>
          Contact
        </Link>
      </li>
    </>
  );

  const UserMenuLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
    const navigate = useNavigate();
    const { user, profile, signOut, isAdmin, isInvitedUser } = useAuth();

    if (!user) return null;

    const { firstName, lastName, displayName } = getUserNames(user, profile);

    const handleSignOut = async () => {
      try {
        await signOut();
        if (onNavigate) onNavigate();
        toast({
          title: "Déconnexion réussie",
          description: "Vous avez été déconnecté avec succès"
        });
      } catch (error) {
        console.error('Error during sign out:', error);
        toast({
          title: "Erreur lors de la déconnexion",
          description: "Une erreur est survenue lors de la déconnexion",
          variant: "destructive"
        });
      }
    };

    return (
      <>
        <li className="pt-4 pb-2 border-t border-gray-200 mt-4">
          <span className="text-sm text-muted-foreground px-2">Mon compte</span>
        </li>
        <li className="px-2 py-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} profile={profile} size="md" />
            <div className="flex-1 min-w-0">
              {firstName ? (
                <>
                  <p className="font-medium text-sm truncate">{`${firstName} ${lastName}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
          </div>
        </li>
        <li>
          <Link 
            to={Routes.PROFILE} 
            className={`flex items-center gap-2 py-2 ${isActive(Routes.PROFILE)}`}
            onClick={onNavigate}
          >
            <UserCog className="h-4 w-4" />
            Mon profil
          </Link>
        </li>
        {isAdmin && (
          <>
            <li>
              <Link 
                to={Routes.DIRECTORY} 
                className={`flex items-center gap-2 py-2 ${isActive(Routes.DIRECTORY)}`}
                onClick={onNavigate}
              >
                <BookUser className="h-4 w-4" />
                Annuaire
              </Link>
            </li>
            <li>
              <Link 
                to={Routes.ADMIN} 
                className={`flex items-center gap-2 py-2 ${isActive(Routes.ADMIN)}`}
                onClick={onNavigate}
              >
                <Settings className="h-4 w-4" />
                Administration
              </Link>
            </li>
          </>
        )}
        <li>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 py-2 text-destructive w-full text-left"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </li>
      </>
    );
  };

  const SupportButton = ({ className = "" }: { className?: string }) => (
    <Button asChild className={`bg-brand hover:bg-brand/90 text-brand-fg shadow-sm transition-all hover:scale-105 active:scale-95 relative ${className}`}>
      <Link to={Routes.JOIN} className="flex items-center gap-2">
        <span>Je soutiens</span>
        {settings.modules.supportCommittee && supportersCount !== null && supportersCount > 0 && (
          <Badge variant="secondary" className="ml-1 bg-white text-brand hover:bg-white px-1.5 py-0 min-w-[1.2rem] h-5 flex items-center justify-center rounded-full text-[10px] font-bold border-none">
            {supportersCount}
          </Badge>
        )}
      </Link>
    </Button>
  );

  return (
    <header
      className={`fixed w-full top-0 left-0 z-50 py-3 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md py-2' : 'bg-white/90 backdrop-blur-md'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link to={Routes.HOME} className="flex items-center">
            <img
              src={settings.branding.logoUrl}
              alt={settings.branding.name}
              className="h-10"
            />
          </Link>

          <nav className="hidden lg:block">
            <ul className="flex space-x-8 items-center">
              <NavLinks />
            </ul>
          </nav>

          <div className="flex items-center space-x-3 md:space-x-4">
            {showSupportModule && (
              <div className="hidden sm:block">
                <SupportButton />
              </div>
            )}
            
            <div className="hidden lg:block">
              <AuthButton />
            </div>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <nav className="mt-8">
                  <ul className="space-y-4 text-lg">
                    <NavLinks />
                    {showSupportModule && (
                      <li className="pt-4">
                        <SupportButton className="w-full py-6 text-lg" />
                      </li>
                    )}
                    <UserMenuLinks onNavigate={() => setIsOpen(false)} />
                  </ul>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

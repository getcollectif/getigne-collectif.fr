
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useState } from 'react';
import { subscribeToNewsletter, NewsletterSubscription } from '../utils/newsletter';
import { toast } from 'sonner';
import {DiscordLogoIcon} from "@radix-ui/react-icons";
import FacebookIcon from '@/components/icons/facebook.svg?react';
import InstagramIcon from '@/components/icons/instagram.svg?react';
import { Routes } from '@/routes';
import { usePostHog } from '@/hooks/usePostHog';
import { useAppSettings } from '@/hooks/useAppSettings';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { capture } = usePostHog();
  const { settings } = useAppSettings();
  const DISCORD_INVITE_URL = import.meta.env.VITE_DISCORD_INVITE_URL as string;
  const FACEBOOK_URL = import.meta.env.VITE_FACEBOOK_URL as string;
  const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL as string;
  const addressLines = settings.content.contactAddress.split('\n');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Veuillez saisir votre adresse email");
      return;
    }

    setIsSubmitting(true);

    try {
      const subscription: NewsletterSubscription = { 
        email,
        source: 'footer'
      };
      await subscribeToNewsletter(subscription);
      
      // Track newsletter subscription in PostHog
      capture('newsletter_subscription', {
        email: email,
        source: 'footer',
        timestamp: new Date().toISOString()
      });
      
      toast.success("Merci de votre inscription à notre newsletter !");
      setEmail(''); // Réinitialiser le champ email
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      toast.error("Une erreur est survenue lors de l'inscription. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="pt-16 pb-8 bg-[var(--site-footer)] text-[var(--site-footer-fg)]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About */}
          <div>
            <div className="mb-4">
              <img
                src={settings.branding.footerLogoUrl || settings.branding.logoUrl}
                alt={settings.branding.name}
                className="h-14 mb-4"
              />
            </div>
            <p className="mb-6 whitespace-pre-line opacity-90">
              {settings.content.footerAbout}
            </p>
            <div className="flex space-x-4">
              {FACEBOOK_URL && (
                <a href={FACEBOOK_URL} aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="opacity-90 hover:opacity-100 transition-opacity">
                  <FacebookIcon />
                </a>
              )}
              {DISCORD_INVITE_URL && (
                <a href={DISCORD_INVITE_URL} className="opacity-90 hover:opacity-100 transition-opacity" aria-label="Discord" target="_blank" rel="noopener noreferrer">
                  <DiscordLogoIcon />
                </a>
              )}
              {INSTAGRAM_URL && (
                <a href={INSTAGRAM_URL} aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="opacity-90 hover:opacity-100 transition-opacity">
                  <InstagramIcon />
                </a>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-xl font-medium mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <Link to={Routes.HOME} className="opacity-90 hover:opacity-100 transition-opacity">
                  Accueil
                </Link>
              </li>
              {settings.modules.program && (
                <li>
                  <Link to={Routes.PROGRAM} className="opacity-90 hover:opacity-100 transition-opacity">
                    Élections 2026
                  </Link>
                </li>
              )}
              {settings.modules.projects && (
                <li>
                  <Link to={Routes.PROJECTS} className="opacity-90 hover:opacity-100 transition-opacity">
                    Nos projets citoyens
                  </Link>
                </li>
              )}
              {settings.modules.blog && (
                <li>
                  <Link to={Routes.NEWS} className="opacity-90 hover:opacity-100 transition-opacity">
                    Actualités
                  </Link>
                </li>
              )}
              {settings.modules.agenda && (
                <li>
                  <Link to={Routes.AGENDA} className="opacity-90 hover:opacity-100 transition-opacity">
                    Événements
                  </Link>
                </li>
              )}
              <li>
                <Link to={Routes.CONTACT} className="opacity-90 hover:opacity-100 transition-opacity">
                  Contact
                </Link>
              </li>
              <li>
                <Link to={Routes.SITEMAP} className="opacity-90 hover:opacity-100 transition-opacity">
                  Plan du site
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xl font-medium mb-4">Contact</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <Mail size={20} className="mr-3 text-brand mt-1 flex-shrink-0" />
                <span className="opacity-90">{settings.content.contactEmail}</span>
              </li>
              <li className="flex items-start">
                <Phone size={20} className="mr-3 text-brand mt-1 flex-shrink-0" />
                <span className="opacity-90">{settings.content.contactPhone}</span>
              </li>
              <li className="flex items-start">
                <MapPin size={20} className="mr-3 text-brand mt-1 flex-shrink-0" />
                <span className="opacity-90">
                  {addressLines.map((line, index) => (
                    <span key={line}>
                      {line}
                      {index < addressLines.length - 1 && <br />}
                    </span>
                  ))}
                </span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-xl font-medium mb-4">Restez informés</h3>
            <p className="opacity-90 mb-4">
              Inscrivez-vous à notre newsletter pour suivre nos actualités et événements.
            </p>
            <form className="space-y-3" onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                placeholder="Votre email"
                className="bg-white/10 text-[var(--site-footer-fg)] w-full px-4 py-2 rounded-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-brand"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="bg-brand hover:bg-brand/90 text-brand-fg font-medium px-4 py-2 rounded-md w-full transition-colors"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Envoi...' : "S'inscrire"}
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm opacity-75">
          <div className="flex flex-col md:flex-row justify-center space-y-2 md:space-y-0 md:space-x-6 mb-2">
            <Link to={Routes.LEGAL} className="hover:opacity-100 transition-opacity">
              Mentions légales
            </Link>
          </div>
          <p>© {currentYear} {settings.branding.name}. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

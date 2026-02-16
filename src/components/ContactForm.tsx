import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, CheckCircle, ArrowLeftIcon } from 'lucide-react';

import FacebookIcon from '@/components/icons/facebook.svg?react';
import InstagramIcon from '@/components/icons/instagram.svg?react';
import { useToast } from '@/components/ui/use-toast';
import { sendDiscordNotification, DiscordColors } from '@/utils/notifications';
import { DiscordLogoIcon, InstagramLogoIcon } from '@radix-ui/react-icons';
import { usePostHog } from '@/hooks/usePostHog';
import { subscribeToNewsletter } from '@/utils/newsletter';

interface ContactFormProps {
  showParticipation?: boolean;
  showNewsletter?: boolean;
  className?: string;
}

const DISCORD_URL = import.meta.env.VITE_DISCORD_INVITE_URL as string;
const FACEBOOK_URL = import.meta.env.VITE_FACEBOOK_URL as string;
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL as string;

const ContactForm = ({ 
  showParticipation = true, 
  showNewsletter = true, 
  className = "" 
}: ContactFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const { capture } = usePostHog();
  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: ''
  });

  const [participationData, setParticipationData] = useState({
    wantsToParticipate: true,
    participationTypes: [] as string[],
    otherParticipation: ''
  });

  // Effet pour traiter les paramètres URL
  useEffect(() => {
    const subject = searchParams.get('subject');
    const type = searchParams.get('type');
    
    if (subject) {
      setFormData(prev => ({ ...prev, subject: decodeURIComponent(subject) }));
    }
    
    if (type === 'organizer') {
      const messageTemplate = `Bonjour,

Je souhaite organiser un Café de quartier chez moi et j'aimerais recevoir le kit d'organisation ainsi que l'accompagnement d'un membre du collectif.

Voici les informations que je peux déjà vous communiquer :

📍 LOCALISATION :
• Adresse : [Votre adresse complète]
• Quartier/secteur : [Précisez votre secteur]

📅 DATES POSSIBLES :
• Date souhaitée : [Ex: Samedi 15 février 2025]
• Créneaux alternatifs : [Ex: Dimanche 16 ou Samedi 22 février]
• Horaire préféré : [Ex: 14h30-16h30]

🏠 LOGISTIQUE :
• Nombre de personnes max accueillies : [Ex: 8-10 personnes]
• Espace disponible : [Ex: salon, jardin selon météo]
• Accès PMR : [Oui/Non]

📞 CONTACT :
• Téléphone : [Votre numéro]
• Disponibilité pour un appel : [Ex: en semaine après 18h]

💭 MOTIVATIONS :
• Pourquoi organiser ce café : [Ex: rencontrer mes voisins, créer du lien social...]
• Sujets d'échange souhaités : [Ex: vie de quartier, projets locaux...]

N'hésitez pas à me contacter pour organiser ensemble cette belle initiative !

Cordialement,`;

      setFormData(prev => ({ 
        ...prev, 
        message: messageTemplate
      }));
      
      setParticipationData(prev => ({
        ...prev,
        wantsToParticipate: true,
        participationTypes: ['Relais local (accueillir une mini-réunion locale chez moi)']
      }));
    }
  }, [searchParams]);

  const [newsletterSubscription, setNewsletterSubscription] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleParticipationChange = (checked: boolean) => {
    setParticipationData(prev => ({ 
      ...prev, 
      wantsToParticipate: checked,
      participationTypes: checked ? prev.participationTypes : [],
      otherParticipation: checked ? prev.otherParticipation : ''
    }));
  };

  const handleParticipationTypeChange = (type: string, checked: boolean) => {
    setParticipationData(prev => ({
      ...prev,
      participationTypes: checked 
        ? [...prev.participationTypes, type]
        : prev.participationTypes.filter(t => t !== type)
    }));
  };

  const handleOtherParticipationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipationData(prev => ({ ...prev, otherParticipation: e.target.value }));
  };

  const handleNewsletterChange = (checked: boolean) => {
    setNewsletterSubscription(checked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.message) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let participationInfo = '';
      if (showParticipation && participationData.wantsToParticipate) {
        participationInfo = `
**Participation souhaitée**: Oui
**Types de participation**:
${participationData.participationTypes.length > 0 
  ? participationData.participationTypes.map(type => `• ${type}`).join('\n')
  : '• Aucun type sélectionné'
}${participationData.otherParticipation ? `\n**Autre**: ${participationData.otherParticipation}` : ''}`;
      } else if (showParticipation) {
        participationInfo = '\n**Participation souhaitée**: Non';
      }

      // Ajouter l'information de la newsletter
      const newsletterInfo = showNewsletter ? `\n**Newsletter**: ${newsletterSubscription ? 'Oui' : 'Non'}` : '';

      // Envoyer notification Discord
      await sendDiscordNotification({
        title: `📬 Nouveau message de contact : ${formData.subject || 'Sans sujet'}`,
        message: `
**De**: ${formData.firstName} ${formData.lastName} (${formData.email})

**Message**:
${formData.message}${participationInfo}${newsletterInfo}
        `,
        color: DiscordColors.BLUE,
        username: "Formulaire de Contact"
      });
      
      // Si l'utilisateur a coché la case newsletter, l'inscrire à la newsletter
      if (showNewsletter && newsletterSubscription) {
        try {
          await subscribeToNewsletter({
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            source: 'contact_form',
          });
          
          // Track newsletter subscription in PostHog
          capture('newsletter_subscription', {
            email: formData.email,
            source: 'contact_form',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Erreur lors de l\'inscription à la newsletter:', error);
        }
      }
      
      // Réinitialiser le formulaire
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        subject: '',
        message: ''
      });
      
      if (showParticipation) {
        setParticipationData({
          wantsToParticipate: true,
          participationTypes: [],
          otherParticipation: ''
        });
      }
      
      if (showNewsletter) {
        setNewsletterSubscription(false);
      }
      
      // Afficher la page de succès au lieu du toast
      setIsSubmitted(true);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si le formulaire a été soumis avec succès, afficher le message de confirmation
  if (isSubmitted) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Message de succès */}
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-brand-900 mb-2">
            Message envoyé avec succès ! 🎉
          </h3>
          <p className="text-brand-700 mb-6">
            Merci pour votre message, {formData.firstName} ! Nous vous répondrons dans les plus brefs délais.
          </p>
          
          {/* Bouton retour au formulaire */}
          <Button
            onClick={() => setIsSubmitted(false)}
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour au formulaire
          </Button>
        </div>

        {/* Bannières côte à côte - Discord et Réseaux sociaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bannière Discord - affichée seulement si participation souhaitée */}
          {showParticipation && participationData.wantsToParticipate && (
            <div className="relative overflow-hidden bg-gradient-to-r from-primary to-purple-600 rounded-xl border border-primary/20 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-purple-600/90"></div>
              <div className="relative p-4 text-white">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                    <DiscordLogoIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold mb-1">
                      Rejoignez notre Discord !
                    </h3>
                    <p className="text-white/90 text-xs mb-2">
                      Connectez-vous avec notre communauté en temps réel.
                    </p>
                    <a
                      href={DISCORD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white font-medium text-xs transition-all duration-200 hover:scale-105"
                    >
                      Rejoindre
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bloc réseaux sociaux */}
          {FACEBOOK_URL || INSTAGRAM_URL && (
            <div className="rounded-xl p-4 border border-brand-200 bg-gradient-to-br from-blue-500 to-green-200 shadow-lg">
              <h3 className="text-base text-white font-semibold text-brand-900 mb-3 text-center">
                Suivez-nous sur les réseaux sociaux
              </h3>
              <div className="flex justify-center space-x-2">
                {FACEBOOK_URL && (
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 hover:scale-105"
                >
                  <FacebookIcon className="w-4 h-4" />
                  <span className="font-medium text-xs">Facebook</span>
                </a>
                )}
                {INSTAGRAM_URL && (
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all duration-200 hover:scale-105"
                >
                  <InstagramLogoIcon className="w-4 h-4" />
                    <span className="font-medium text-xs">Instagram</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className={`space-y-4 md:space-y-6 ${className}`} onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-brand-800">
            Prénom <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            id="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="border-brand-200 focus:border-primary focus:ring-primary"
            placeholder="Votre prénom"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-brand-800">
            Nom <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            id="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="border-brand-200 focus:border-primary focus:ring-primary"
            placeholder="Votre nom"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-brand-800">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          type="email"
          id="email"
          value={formData.email}
          onChange={handleChange}
          className="border-brand-200 focus:border-primary focus:ring-primary"
          placeholder="votre.email@exemple.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject" className="text-brand-800">
          Sujet
        </Label>
        <Input
          type="text"
          id="subject"
          value={formData.subject}
          onChange={handleChange}
          className="border-brand-200 focus:border-primary focus:ring-primary"
          placeholder="Objet de votre message"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message" className="text-brand-800">
          Message <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="message"
          rows={6}
          value={formData.message}
          onChange={handleChange}
          className="border-brand-200 focus:border-primary focus:ring-primary"
          placeholder="Décrivez votre demande, question ou suggestion..."
          required
        />
      </div>

      {/* Section Participation */}
      {showParticipation && (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="wantsToParticipate"
              checked={participationData.wantsToParticipate}
              onCheckedChange={handleParticipationChange}
              className="h-6 w-6 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor="wantsToParticipate" className="text-brand-900 font-semibold text-base cursor-pointer">
              Je souhaite participer au collectif
            </Label>
          </div>

          {participationData.wantsToParticipate && (
            <div className="ml-9 space-y-4">
              <p className="text-sm font-medium text-brand-800">
                <strong>Super !</strong> 🎉 Comment souhaitez-vous participer ? (plusieurs choix possibles)
              </p>
              
              <div className="space-y-3">
                {[
                  'Bénévolat ponctuel (logistique, accueil, affichage)',
                  'Partage d\'expertise',
                  'Équipe campagne (écrire, analyser, rencontrer, organiser...)',
                  'Relais local (accueillir une mini-réunion locale chez moi)'
                ].map((option) => (
                  <div key={option} className="flex items-start space-x-3">
                    <Checkbox
                      id={`participation-${option}`}
                      checked={participationData.participationTypes.includes(option)}
                      onCheckedChange={(checked) => handleParticipationTypeChange(option, checked as boolean)}
                      className="h-6 w-6 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-0.5"
                    />
                    <Label htmlFor={`participation-${option}`} className="text-sm text-brand-700 cursor-pointer leading-relaxed">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-primary/20">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="participation-other"
                    checked={participationData.participationTypes.includes('Autre')}
                    onCheckedChange={(checked) => handleParticipationTypeChange('Autre', checked as boolean)}
                    className="h-6 w-6 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="participation-other" className="text-sm text-brand-700 cursor-pointer">
                      Autre
                    </Label>
                    
                    {participationData.participationTypes.includes('Autre') && (
                      <div className="mt-2">
                        <Input
                          type="text"
                          value={participationData.otherParticipation}
                          onChange={handleOtherParticipationChange}
                          className="w-full border-brand-200 focus:border-primary focus:ring-primary"
                          placeholder="Précisez votre souhait de participation..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Section Newsletter */}
      {showNewsletter && (
        <div className="flex items-center space-x-3">
          <Checkbox
            id="newsletter"
            checked={newsletterSubscription}
            onCheckedChange={handleNewsletterChange}
            className="h-6 w-6 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <Label htmlFor="newsletter" className="text-brand-800 cursor-pointer">
            Je souhaite m'abonner à la newsletter pour recevoir les actualités du collectif
          </Label>
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full bg-primary hover:bg-primary/90 py-3 text-base font-medium transition-all duration-200 transform hover:scale-[1.02]"
        disabled={isSubmitting}
      >
        <Send className="mr-2 h-4 w-4" /> 
        {isSubmitting ? 'Envoi en cours...' : 'Envoyer le message'}
      </Button>
    </form>
  );
};

export default ContactForm;

import { LightbulbIcon, UsersIcon, HeartIcon, VoteIcon, Zap, LayoutList, Landmark, PiggyBank, Heart, Users, Star, Shield, LucideSpeaker, Megaphone, Grab, Earth } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePostHog } from '@/hooks/usePostHog';
import { useAppSettings } from '@/hooks/useAppSettings';

const Values = () => {
  const { capture } = usePostHog();
  const { settings } = useAppSettings();
  const HELLOASSO_JOIN_URL = import.meta.env.VITE_HELLOASSO_JOIN_URL as string;

  const handleHelloAssoClick = () => {
    // Track HelloAsso click in PostHog
    capture('helloasso_join_click', {
      source: 'values_page',
      url: HELLOASSO_JOIN_URL,
      timestamp: new Date().toISOString()
    });
  };
  return (
    <section className="relative py-16 md:py-24 px-4 bg-brand-50">
      <div className="container mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="bg-brand/10 text-brand font-medium px-4 py-1 rounded-full text-sm">
            Bienvenue sur notre site
          </span>
          <h2 className="text-4xl font-bold mt-4 mb-6">
          Connaissez-vous notre collectif citoyen ?
          </h2>
          <p className="text-brand-700 text-lg">
            Découvrez ce qui nous rassemble et nous motive à agir ensemble pour notre commune.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-8 md:p-10 h-full">
              <div className="grid md:grid-cols-2 gap-10">
                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-center">Nos 3 piliers</h2>
                  <ul className="space-y-6">
                    <li className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-brand/10 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Users className="text-brand h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">Solidaire</h3>
                        <p className="text-brand-700">Nous croyons à l'entraide et à la cohésion sociale pour ne laisser personne de côté et construire ensemble.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-brand/10 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Earth className="text-brand h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">Durable</h3>
                        <p className="text-brand-700">Nous défendons la préservation de notre environnement et une transition écologique juste et accessible à tous.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-brand/10 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Star className="text-brand h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">Démocratique</h3>
                        <p className="text-brand-700">Nous promouvons l'implication de chaque citoyen dans les décisions qui concernent notre commune.</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-center">Nos objectifs</h2>
                  <ul className="space-y-6">
                    <li className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-brand/10 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Megaphone className="text-brand h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">Informer</h3>
                        <p className="text-brand-700">Apporter une information transparente et accessible sur les enjeux locaux et les actions municipales.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-brand/10 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Zap className="text-brand h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">Mobiliser</h3>
                        <p className="text-brand-700">Rassembler les citoyens autour de projets concrets pour améliorer notre cadre de vie et notre vivre-ensemble.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <div className="mt-1 w-10 h-10 bg-brand/10 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Grab className="text-brand h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium">Agir</h3>
                        <p className="text-brand-700">Porter des initiatives concrètes pour un développement harmonieux, durable et inclusif de notre commune.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-brand-100 pt-10 mt-10">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold mb-4">Vous partagez nos valeurs et notre envie d'agir ?</h2>
                  <p className="text-brand-700 max-w-2xl mx-auto">
                    Rejoignez un collectif ouvert à tous, où chaque voix compte. Ensemble, nous pouvons faire de {settings.branding.city} une commune où il fait bon vivre, aujourd'hui et pour les générations futures.
                  </p>
                </div>

                <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-8">
                  <Button
                    asChild
                    size="lg"
                    className="bg-brand hover:bg-brand/90 text-brand-fg"
                  >
                    <a href={HELLOASSO_JOIN_URL} target="_blank" rel="noopener noreferrer" onClick={handleHelloAssoClick}>
                    Adhérer
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                  >
                    <Link to="/contact">
                      Nous contacter
                    </Link>
                  </Button>

                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden shadow-sm">
              <img
                src={settings.branding.images.neighborhood}
                alt={`Collage de photos de ${settings.branding.city}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Values;

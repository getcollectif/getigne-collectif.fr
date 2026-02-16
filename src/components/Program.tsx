import { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { useAppSettings } from '@/hooks/useAppSettings';

const ProgramItem = ({ icon, title, description, delay, image }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return (
    <div 
      ref={ref}
      className={`bg-white shadow-sm border border-brand-100 rounded-xl p-6 hover-lift ${
        isVisible 
          ? 'opacity-100 translate-y-0 transition-all duration-700 ease-out' 
          : 'opacity-0 translate-y-10'
      }`}
      style={{ transitionDelay: `${delay * 100}ms` }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
          {icon && <DynamicIcon name={icon} className="text-brand" size={24} />}
        </div>
        <h3 className="text-lg font-medium">{title}</h3>
      </div>
      
      {image && (
        <div className="mb-4 rounded-lg overflow-hidden h-32">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover" 
            onError={(e) => {
              console.error(`[Program] Failed to load image: ${image}`);
              // @ts-ignore
              e.target.src = '/placeholder.svg';
            }}
          />
        </div>
      )}
      
      <p className="text-brand-700 mb-4">{description?.substring(0, 150) + (description?.length > 150 ? '...' : '')}</p>
      <Link to="/objectif-2026/programme" className="text-brand flex items-center text-sm font-medium group">
        En savoir plus
        <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
};

const Program = () => {
  const { settings } = useAppSettings();
  const [programItems, setProgramItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProgramItems = async () => {
      try {
        const { data, error } = await supabase
          .from('program_items')
          .select('*')
          .order('title');
        
        if (error) throw error;
        
        // Limiter à 5 items pour la page d'accueil
        setProgramItems(data.slice(0, 5));
        setLoading(false);
      } catch (error) {
        console.error('[Program] Error fetching program items:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchProgramItems();
  }, []);

  if (loading) {
    return (
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="container mx-auto">
          <div className="text-center">Chargement des données du programme...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="container mx-auto">
          <div className="text-center text-red-500">Une erreur est survenue: {error}</div>
        </div>
      </section>
    );
  }

  return (
    <section id="programme" className="py-24 px-4 relative overflow-hidden">
      <div className="container mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="bg-brand/10 text-brand font-medium px-4 py-1 rounded-full text-sm">
            Notre programme
          </span>
          <h2 className="text-4xl font-bold mt-4 mb-6">Des propositions concrètes pour notre commune</h2>
          <p className="text-brand-700 text-lg">
            Découvrez nos engagements et propositions pour faire de {settings.branding.city} une commune où il fait bon vivre, 
            juste, dynamique et tournée vers l'avenir.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programItems.map((item, index) => (
            <ProgramItem 
              key={item.id} 
              icon={item.icon} 
              title={item.title} 
              description={item.description}
              image={item.image}
              delay={index}
            />
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-6 mt-10 items-center justify-center">
          <div className="bg-brand-50 p-6 rounded-xl flex items-center gap-4 max-w-lg w-full">
            <img 
              src="/images/clisson-sevre-maine-aggloh.png" 
              alt="Logo de l'aggloh!" 
              className="w-24 h-auto"
            />
            <div>
              <h3 className="text-lg font-medium mb-1">{settings.branding.city} au sein de l'aggloh!</h3>
              <p className="text-brand-700 text-sm mb-2">
                Découvrez nos propositions pour une meilleure coopération intercommunale.
              </p>
              <Link to="/objectif-2026/programme" className="text-brand flex items-center text-sm font-medium group">
                En savoir plus
                <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          <Button 
            asChild
            className="bg-brand text-brand-fg rounded-md hover:bg-brand/90"
          >
            <Link to="/objectif-2026/programme">
              Programme complet
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Program;
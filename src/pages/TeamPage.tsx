import { useEffect, useMemo, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import EditorJSRenderer from '@/components/EditorJSRenderer';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Home, Loader2 } from 'lucide-react';
import type {
  ElectoralList,
  ElectoralListMemberWithDetails,
} from '@/types/electoral.types';
import { generateRoutes, Routes } from '@/routes';

type TeamListMember = ElectoralListMemberWithDetails & {
  position: number;
};

const getAge = (birthDate: string | null | undefined): number | null => {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
};

const TeamPage = () => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [electoralList, setElectoralList] = useState<ElectoralList | null>(null);
  const [members, setMembers] = useState<TeamListMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGridFading, setIsGridFading] = useState(false);

  const selectedMember = useMemo(() => {
    if (!slug) return null;
    return members.find((item) => item.team_member.slug === slug) ?? null;
  }, [members, slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadElectoralList();
  }, []);

  useEffect(() => {
    if (!slug) setIsGridFading(false);
  }, [slug]);

  const loadElectoralList = async () => {
    setLoading(true);
    try {
      // Charger la liste électorale active
      const { data: listData, error: listError } = await supabase
        .from('electoral_list')
        .select('*')
        .eq('is_active', true)
        .single();

      if (listError && listError.code !== 'PGRST116') throw listError;

      if (listData) {
        setElectoralList(listData);

        // Charger les membres de la liste avec leurs détails
        const { data: membersData, error: membersError } = await supabase
          .from('electoral_list_members')
          .select(
            `
            *,
            team_member:team_members(*),
            roles:electoral_member_roles(
              id,
              is_primary,
              thematic_role:thematic_roles(*)
            )
          `
          )
          .eq('electoral_list_id', listData.id)
          .order('position');

        if (membersError) throw membersError;

        const assignedMembers = (membersData ?? [])
          .map((member: any) => ({
            ...member,
            position: member.position,
            team_member: member.team_member,
            roles: member.roles.map((r: any) => ({
              id: r.id,
              is_primary: r.is_primary,
              thematic_role: r.thematic_role,
            })),
          }))
          .sort((a: TeamListMember, b: TeamListMember) => a.position - b.position);

        setMembers(assignedMembers);
      } else {
        // Pas de liste active
        setElectoralList(null);
        setMembers([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la liste:', error);
      setError('Impossible de charger la liste électorale.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMember = (memberSlug: string) => {
    setIsGridFading(true);
    window.setTimeout(() => {
      navigate(generateRoutes.teamMemberDetail(memberSlug), { state: { fromGrid: true } });
    }, 220);
  };

  const pageTitle = selectedMember
    ? `${selectedMember.team_member.name} | Équipe | Gétigné Collectif`
    : 'Équipe | Gétigné Collectif';
  const pageDescription = selectedMember
    ? `Découvrez ${selectedMember.team_member.name}, membre de la liste citoyenne de Gétigné Collectif.`
    : "Découvrez l'équipe candidate de Gétigné Collectif pour les élections municipales de 2026.";

  return (
    <HelmetProvider>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </Helmet>

      <div className="page-content">
        <Navbar />

        <section className="pt-32 pb-16 px-4 bg-gradient-to-br from-brand-50 to-white">
          <div className="container mx-auto text-center">
            <span className="bg-brand/10 text-brand font-medium px-4 py-1 rounded-full text-sm">
              Élections municipales Mars 2026
            </span>
            <h1 className="text-5xl font-bold mt-4 mb-6">
              {selectedMember ? selectedMember.team_member.name : electoralList?.title || 'Équipe'}
            </h1>
            {!selectedMember && electoralList?.description && (
              <p className="text-xl text-brand-700 max-w-3xl mx-auto">
                {electoralList.description}
              </p>
            )}
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="py-24 px-4">
            <div className="container mx-auto text-center">
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        ) : slug ? (
          <section className="py-12 px-4">
            <div className="container mx-auto">
              <Breadcrumb className="mb-8">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={Routes.HOME}>
                        <Home className="h-4 w-4" />
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink to={Routes.TEAM}>Équipe</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedMember?.team_member.name ?? 'Membre introuvable'}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              {!selectedMember ? (
                <div className="max-w-2xl mx-auto rounded-2xl border border-brand-100 bg-white p-8 text-center shadow-sm">
                  <h2 className="text-2xl font-semibold mb-2">Membre introuvable</h2>
                  <p className="text-muted-foreground mb-6">
                    Cette fiche n&apos;existe pas ou n&apos;est plus disponible.
                  </p>
                  <Button onClick={() => navigate(Routes.TEAM)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour à l&apos;équipe
                  </Button>
                </div>
              ) : (
                <div className="max-w-7xl mx-auto rounded-3xl border border-brand-100 bg-white shadow-2xl overflow-hidden">
                  <div className="grid lg:grid-cols-12">
                    <div className="relative lg:col-span-5 bg-brand-50">
                      <div className="absolute top-6 left-6 z-10 flex h-20 w-20 items-center justify-center rounded-full bg-brand text-brand-fg text-4xl font-bold shadow-lg">
                        {selectedMember.position}
                      </div>
                      <img
                        src={selectedMember.team_member.image || '/images/user.png'}
                        alt={selectedMember.team_member.name}
                        className="h-full w-full min-h-[680px] object-cover"
                      />
                    </div>
                    <div className="lg:col-span-7 p-8 lg:p-14 flex flex-col justify-center">
                      <h2 className="text-4xl font-bold mb-4">{selectedMember.team_member.name}</h2>
                      <p className="text-lg text-brand-700 mb-8">
                        {[getAge(selectedMember.team_member.birth_date) !== null
                          ? `${getAge(selectedMember.team_member.birth_date)} ans`
                          : null, selectedMember.team_member.profession || null]
                          .filter(Boolean)
                          .join(' · ') || 'Age et profession non renseignes'}
                      </p>
                      {selectedMember.team_member.bio?.trim() ? (
                        <EditorJSRenderer
                          data={selectedMember.team_member.bio}
                          className="mb-8 text-foreground/90 [&_.rich-content]:prose [&_.rich-content]:max-w-none"
                        />
                      ) : (
                        <p className="text-base leading-relaxed text-foreground/90 mb-8">
                          La biographie de cette personne n&apos;est pas encore disponible.
                        </p>
                      )}
                      <div className="flex gap-3">
                        <Button onClick={() => navigate(Routes.TEAM)} variant="outline">
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Retour à l&apos;équipe
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="py-12 px-4">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[1700px] min-[1900px]:max-w-[1950px]">
              <div
                className={`transition-all duration-300 ${
                  isGridFading ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'
                }`}
              >
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 items-stretch">
                  {members.map((member) => {
                    const age = getAge(member.team_member.birth_date);
                    const meta = [
                      age !== null ? `${age} ans` : null,
                      member.team_member.profession || null,
                    ]
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <button
                        key={`${member.position}-${member.team_member.slug}`}
                        type="button"
                        onClick={() => handleOpenMember(member.team_member.slug)}
                        className="h-full text-left bg-white rounded-2xl overflow-hidden border border-brand-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                      >
                        <div
                          className="relative h-72 overflow-hidden bg-brand-50 bg-cover bg-center bg-no-repeat"
                          style={{
                            backgroundImage: member.team_member.image
                              ? `url(${member.team_member.image})`
                              : 'url(/images/user.png)',
                          }}
                        >
                          <div className="absolute top-3 left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-fg text-xl font-bold shadow-md">
                            {member.position}
                          </div>
                        </div>
                        <div className="p-5 min-h-[72px]">
                          <h3 className="text-xl font-semibold line-clamp-1">{member.team_member.name}</h3>
                          <p
                            className="text-sm font-normal text-muted-foreground line-clamp-1"
                            title={meta || 'Age et profession non renseignes'}
                          >
                            {meta || 'Age et profession non renseignes'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        <Footer />
      </div>
    </HelmetProvider>
  );
};

export default TeamPage;

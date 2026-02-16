import { useEffect, useMemo, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { OutputData } from '@editorjs/editorjs';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditorJSComponent from '@/components/EditorJSComponent';
import EditorJSRenderer from '@/components/EditorJSRenderer';
import FAQDisplay from '@/components/faq/FAQDisplay';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ArrowLeft, Home, Loader2, Settings } from 'lucide-react';
import type {
  ElectoralList,
  ElectoralListMemberWithDetails,
} from '@/types/electoral.types';
import { generateRoutes, Routes } from '@/routes';
import { useAppSettings } from '@/hooks/useAppSettings';
import { SiteSettingsSection } from '@/config/siteSettings';
import { useAuth } from '@/context/auth';
import { toast } from 'sonner';

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

const applyTemplate = (
  value: string,
  { siteName, teamCount }: { siteName: string; teamCount: number }
): string =>
  value
    .split('{site.name}')
    .join(siteName)
    .split('{team.count}')
    .join(String(teamCount));

const EMPTY_EDITOR_DATA: OutputData = {
  time: Date.now(),
  blocks: [],
  version: '2.28.0',
};

const parseToEditorData = (value: string | null | undefined): OutputData => {
  if (!value?.trim()) return EMPTY_EDITOR_DATA;
  try {
    const parsed = JSON.parse(value) as OutputData;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks)) {
      return parsed;
    }
  } catch {
    // Fallback texte simple vers bloc paragraphe
  }

  return {
    time: Date.now(),
    blocks: [{ type: 'paragraph', data: { text: value } }],
    version: '2.28.0',
  };
};

const hasEditorContent = (data: OutputData): boolean => {
  if (!Array.isArray(data.blocks) || data.blocks.length === 0) return false;
  return data.blocks.some((block) => {
    const blockData = (block as { data?: Record<string, unknown> }).data;
    if (!blockData) return true;
    return Object.values(blockData).some((value) => {
      if (typeof value === 'string') {
        return value.replace(/<[^>]*>/g, '').trim().length > 0;
      }
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.keys(value).length > 0;
      return Boolean(value);
    });
  });
};

const TeamPage = () => {
  const { settings, updateSetting } = useAppSettings();
  const { isAdmin } = useAuth();
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [electoralList, setElectoralList] = useState<ElectoralList | null>(null);
  const [members, setMembers] = useState<TeamListMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGridFading, setIsGridFading] = useState(false);
  const [isUpdatingFeaturedCount, setIsUpdatingFeaturedCount] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isSavingFeaturedLabel, setIsSavingFeaturedLabel] = useState(false);
  const [featuredLabelContent, setFeaturedLabelContent] = useState<OutputData>(
    () => parseToEditorData(settings.content.teamFeaturedLabel)
  );

  const selectedMember = useMemo(() => {
    if (!slug) return null;
    return members.find((item) => item.team_member.slug === slug) ?? null;
  }, [members, slug]);
  const featuredCount = useMemo(() => {
    const safeCount = Number.isFinite(settings.content.teamFeaturedCount)
      ? settings.content.teamFeaturedCount
      : 2;
    return Math.max(0, Math.min(Math.floor(safeCount), 3, members.length));
  }, [members.length, settings.content.teamFeaturedCount]);
  const featuredMembers = useMemo(() => members.slice(0, featuredCount), [members, featuredCount]);
  const remainingMembers = useMemo(() => members.slice(featuredCount), [members, featuredCount]);
  const featuredCountOptions = useMemo(() => {
    const max = Math.min(3, members.length);
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [members.length]);
  const featuredContainerWidthClass = useMemo(() => {
    if (featuredMembers.length <= 1) return 'lg:max-w-[30rem]';
    if (featuredMembers.length === 2) return 'lg:max-w-[64rem]';
    return 'lg:max-w-[96rem]';
  }, [featuredMembers.length]);
  const featuredGridClass = useMemo(() => {
    if (featuredMembers.length <= 1) return 'grid-cols-1';
    if (featuredMembers.length === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-3';
  }, [featuredMembers.length]);
  const featuredLabelForDisplay = useMemo(
    () => parseToEditorData(settings.content.teamFeaturedLabel),
    [settings.content.teamFeaturedLabel]
  );
  const showFeaturedLabel = useMemo(
    () => hasEditorContent(featuredLabelForDisplay),
    [featuredLabelForDisplay]
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    loadElectoralList();
  }, []);

  useEffect(() => {
    if (!slug) setIsGridFading(false);
  }, [slug]);

  useEffect(() => {
    setFeaturedLabelContent(parseToEditorData(settings.content.teamFeaturedLabel));
  }, [settings.content.teamFeaturedLabel]);

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

  const handleFeaturedCountChange = async (nextCount: number) => {
    if (!isAdmin || nextCount === settings.content.teamFeaturedCount) return;

    setIsUpdatingFeaturedCount(true);
    const ok = await updateSetting(SiteSettingsSection.Content, {
      ...settings.content,
      teamFeaturedCount: nextCount,
    });

    if (!ok) {
      toast.error('Impossible de mettre à jour le nombre de têtes de liste.');
    } else {
      toast.success('Nombre de têtes de liste mis à jour.');
    }
    setIsUpdatingFeaturedCount(false);
  };

  const handleFeaturedLabelSave = async () => {
    if (!isAdmin) return;

    setIsSavingFeaturedLabel(true);
    const serialized = hasEditorContent(featuredLabelContent)
      ? JSON.stringify(featuredLabelContent)
      : '';

    const ok = await updateSetting(SiteSettingsSection.Content, {
      ...settings.content,
      teamFeaturedLabel: serialized,
    });

    if (!ok) {
      toast.error('Impossible de mettre à jour le texte des têtes de liste.');
    } else {
      toast.success('Texte des têtes de liste mis à jour.');
      setIsSettingsDialogOpen(false);
    }
    setIsSavingFeaturedLabel(false);
  };

  const pageTitle = selectedMember
    ? `${selectedMember.team_member.name} | Équipe | ${settings.branding.name}`
    : `Équipe | ${settings.branding.name}`;
  const pageDescription = selectedMember
    ? `Découvrez ${selectedMember.team_member.name}, membre de la liste citoyenne de ${settings.branding.name}.`
    : `Découvrez l'équipe candidate de ${settings.branding.name} pour les élections municipales de 2026.`;
  const teamTitle = applyTemplate(settings.content.teamPageTitle, {
    siteName: settings.branding.name,
    teamCount: members.length,
  });
  const teamSubtitle = applyTemplate(settings.content.teamPageSubtitle, {
    siteName: settings.branding.name,
    teamCount: members.length,
  });

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
              Élections municipales 2026
            </span>
            <h1 className="text-5xl font-bold mt-4 mb-6">
              {selectedMember ? selectedMember.team_member.name : teamTitle}
            </h1>
            {!selectedMember && (
              <p className="text-xl text-brand-700 max-w-3xl mx-auto">
                {teamSubtitle}
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
                          className="mb-8 max-w-none text-foreground/90 [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_h4]:text-lg [&_p]:text-foreground/90 [&_p]:leading-relaxed [&_li]:text-foreground/90 [&_blockquote]:text-foreground/90 [&_a]:text-brand [&_a]:underline"
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
                {isAdmin && (
                  <div className="mb-4 flex justify-end">
                    <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Settings className="h-4 w-4" />
                          Parametres
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Paramètres de la page équipe</DialogTitle>
                          <DialogDescription>
                            Définissez le nombre de têtes de liste à mettre en avant (maximum 3).
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-brand-900">
                              Nombre de têtes de liste mises en avant
                            </p>
                            <Select
                              value={String(featuredCount)}
                              onValueChange={(value) => handleFeaturedCountChange(Number(value))}
                              disabled={isUpdatingFeaturedCount}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir un nombre" />
                              </SelectTrigger>
                              <SelectContent>
                                {featuredCountOptions.map((option) => (
                                  <SelectItem key={option} value={String(option)}>
                                    {option} {option > 1 ? 'personnes' : 'personne'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-brand-900">
                              Texte affiché au-dessus des cartes mises en avant
                            </p>
                            <EditorJSComponent
                              value={featuredLabelContent}
                              onChange={setFeaturedLabelContent}
                              placeholder="Ex: Tête de liste"
                              className="min-h-[220px] max-h-[320px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              Ce contenu peut rester vide.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={handleFeaturedLabelSave}
                            disabled={isSavingFeaturedLabel || isUpdatingFeaturedCount}
                          >
                            {isSavingFeaturedLabel ? 'Enregistrement...' : 'Enregistrer'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                {featuredMembers.length > 0 && (
                  <div className={`mb-8 w-full mx-auto ${featuredContainerWidthClass} overflow-hidden rounded-2xl border border-brand-accent/20 shadow-xl bg-gradient-to-r from-brand to-brand-gradient-end`}>
                    <div className="relative px-4 py-4 md:px-5 md:py-5 text-white">
                      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-white/10 blur-3xl md:block" aria-hidden />
                      <div className="relative flex items-center justify-center gap-3 min-h-[1.5rem]">
                        {showFeaturedLabel && (
                          <EditorJSRenderer
                            data={featuredLabelForDisplay}
                            className="text-center [&_.rich-content]:text-white [&_.rich-content_p]:!text-white [&_.rich-content_h1]:!text-white [&_.rich-content_h2]:!text-white [&_.rich-content_h3]:!text-white [&_.rich-content_h4]:!text-white [&_.rich-content_li]:!text-white [&_.text-gray-700]:!text-white [&_.text-gray-600]:!text-white/90 [&_.rich-content_*]:my-0 [&_.rich-content]:font-semibold [&_.rich-content]:text-base md:[&_.rich-content]:text-lg"
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-4 md:p-5">
                      <div className={`grid gap-4 items-stretch ${featuredGridClass}`}>
                        {featuredMembers.map((member) => {
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
                              className="h-full text-left bg-white rounded-2xl overflow-hidden border border-brand-200 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                            >
                              <div
                                className="relative h-[20rem] overflow-hidden bg-brand-50 bg-cover bg-center bg-no-repeat"
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
                              <div className="p-4 min-h-[96px]">
                                <h3 className="text-lg font-semibold line-clamp-1">{member.team_member.name}</h3>
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
                )}

                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7 items-stretch">
                  {remainingMembers.map((member) => {
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

        {!loading && !error && !slug && <FAQDisplay slug="faq-team" />}

        <Footer />
      </div>
    </HelmetProvider>
  );
};

export default TeamPage;

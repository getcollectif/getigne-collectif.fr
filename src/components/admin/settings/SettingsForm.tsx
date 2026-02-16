
import { useEffect, useState } from 'react';
import { useForm, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAppSettings } from '@/hooks/useAppSettings';
import { SiteSettings, siteSettingsSchema } from '@/config/siteSettings';

type SettingsFormValues = SiteSettings;

export default function SettingsForm() {
  const { settings, loading, updateSettings } = useAppSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const moduleFields: { name: Path<SettingsFormValues>; label: string }[] = [
    { name: 'modules.program', label: 'Programme' },
    { name: 'modules.team', label: 'Équipe' },
    { name: 'modules.supportCommittee', label: 'Comité de soutien' },
    { name: 'modules.membershipForm', label: "Formulaire d'adhésion" },
    { name: 'modules.agenda', label: 'Agenda' },
    { name: 'modules.blog', label: 'Blog / Actualités' },
    { name: 'modules.proxy', label: 'Espace procuration' },
    { name: 'modules.committees', label: 'Comités citoyens' },
    { name: 'modules.projects', label: 'Projets citoyens' },
    { name: 'modules.committeeWorksPublic', label: 'Travaux des commissions (public)' },
  ];

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    if (!loading) {
      form.reset(settings);
    }
  }, [form, loading, settings]);

  const onSubmit = async (values: SettingsFormValues) => {
    setIsSaving(true);
    try {
      const ok = await updateSettings(values);
      if (!ok) throw new Error('Update failed');
      toast.success("Les paramètres du site ont été mis à jour avec succès.");
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Impossible d'enregistrer les paramètres du site.");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    const bucketName = 'site-assets';
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `site/${fileName}`;

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erreur upload image:', error);
      toast.error("Impossible d'envoyer l'image.");
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Personnalisation</CardTitle>
            <CardDescription>
              Identité visuelle et informations de base du site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="branding.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du collectif</FormLabel>
                    <FormControl>
                      <Input placeholder="Gétigné Collectif" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.slogan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slogan</FormLabel>
                    <FormControl>
                      <Input placeholder="Élections municipales 2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="/images/logo.png" {...field} />
                    </FormControl>
                    <FormDescription>
                      Chemin relatif ou URL absolue.
                    </FormDescription>
                  {field.value && (
                    <div className="mt-3">
                      <img
                        src={field.value}
                        alt="Prévisualisation du logo"
                        className="h-16 w-auto rounded-md border border-muted bg-white object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.faviconUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Favicon (onglet navigateur)</FormLabel>
                    <FormControl>
                      <Input placeholder="Vide = logo principal" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>Optionnel. Sinon, le logo principal est utilisé.</FormDescription>
                    {(field.value || settings.branding.logoUrl) && (
                      <div className="mt-3">
                        <img
                          src={field.value || settings.branding.logoUrl}
                          alt="Favicon"
                          className="h-8 w-8 rounded border border-muted bg-white object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.footerLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo du pied de page</FormLabel>
                    <FormControl>
                      <Input placeholder="Vide = logo principal" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>Optionnel. Sinon, le logo principal est utilisé.</FormDescription>
                    {(field.value || settings.branding.logoUrl) && (
                      <div className="mt-3">
                        <img
                          src={field.value || settings.branding.logoUrl}
                          alt="Logo footer"
                          className="h-12 w-auto rounded border border-muted bg-white object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder="Gétigné" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(
                [
                  { key: 'dominant' as const, label: 'Dominante', bgPlaceholder: '#34b190', fgPlaceholder: '#ffffff' },
                  { key: 'accent' as const, label: 'Accentuation', bgPlaceholder: '#34b190', fgPlaceholder: '#ffffff' },
                  { key: 'proximity' as const, label: 'Proximité', bgPlaceholder: '#f97316', fgPlaceholder: '#ffffff' },
                  { key: 'trust' as const, label: 'Confiance', bgPlaceholder: '#2563eb', fgPlaceholder: '#ffffff' },
                  { key: 'danger' as const, label: 'Attention / danger / erreur', bgPlaceholder: '#dc2626', fgPlaceholder: '#ffffff' },
                  { key: 'footer' as const, label: 'Pied de page', bgPlaceholder: '#1d1d1f', fgPlaceholder: '#ffffff' },
                ] as const
              ).map(({ key, label, bgPlaceholder, fgPlaceholder }) => (
                <Card key={key} className="p-4">
                  <p className="font-medium text-sm text-muted-foreground mb-3">{label}</p>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name={`branding.colors.${key}.bg`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Fond</FormLabel>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input placeholder={bgPlaceholder} {...field} className="font-mono text-sm" />
                            </FormControl>
                            <Input
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-9 w-11 p-1 shrink-0"
                              aria-label={`Couleur de fond ${label}`}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {key === 'dominant' && (
                      <FormField
                        control={form.control}
                        name="branding.gradientEnd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Fin de gradient</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input placeholder="#06b6d4" {...field} className="font-mono text-sm" />
                              </FormControl>
                              <Input
                                type="color"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="h-9 w-11 p-1 shrink-0"
                                aria-label="Couleur de fin de gradient"
                              />
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name={`branding.colors.${key}.fg`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Texte sur fond</FormLabel>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input placeholder={fgPlaceholder} {...field} className="font-mono text-sm" />
                            </FormControl>
                            <Input
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-9 w-11 p-1 shrink-0"
                              aria-label={`Couleur du texte sur ${label}`}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="branding.images.hero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo hero</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    {field.value && (
                      <div className="mt-3">
                        <img
                          src={field.value}
                          alt="Prévisualisation de la photo hero"
                          className="h-32 w-full rounded-md border border-muted object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.images.campaign"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo campagne</FormLabel>
                    <FormControl>
                      <Input placeholder="/images/..." {...field} />
                    </FormControl>
                    {field.value && (
                      <div className="mt-3">
                        <img
                          src={field.value}
                          alt="Prévisualisation de la photo campagne"
                          className="h-32 w-full rounded-md border border-muted object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.images.neighborhood"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo cafés de quartier</FormLabel>
                    <FormControl>
                      <Input placeholder="/images/..." {...field} />
                    </FormControl>
                    {field.value && (
                      <div className="mt-3">
                        <img
                          src={field.value}
                          alt="Prévisualisation de la photo cafés de quartier"
                          className="h-32 w-full rounded-md border border-muted object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="branding.images.joinMembershipPrimary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo adhésion 1</FormLabel>
                    <FormControl>
                      <Input placeholder="/images/..." {...field} />
                    </FormControl>
                    {field.value && (
                      <div className="mt-3">
                        <img
                          src={field.value}
                          alt="Prévisualisation photo adhésion 1"
                          className="h-32 w-full rounded-md border border-muted object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="branding.images.joinMembershipSecondary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo adhésion 2</FormLabel>
                    <FormControl>
                      <Input placeholder="/images/..." {...field} />
                    </FormControl>
                    {field.value && (
                      <div className="mt-3">
                        <img
                          src={field.value}
                          alt="Prévisualisation photo adhésion 2"
                          className="h-32 w-full rounded-md border border-muted object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const url = await uploadImage(file);
                          field.onChange(url);
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Textes, contact et carte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="content.heroTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre hero (ligne 1)</FormLabel>
                    <FormControl>
                      <Input placeholder="Vivre dans une commune" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content.heroTitleEmphasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre hero (mise en avant)</FormLabel>
                    <FormControl>
                      <Input placeholder="dynamique, engagée et démocratique" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content.heroTitleSuffix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre hero (ligne 3)</FormLabel>
                    <FormControl>
                      <Input placeholder="ça vous tente ?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content.siteDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description du site</FormLabel>
                    <FormControl>
                      <Input placeholder="Description courte pour le SEO" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="content.heroSubtitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sous-titre hero</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="content.teamPageTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre page Équipe</FormLabel>
                    <FormControl>
                      <Input placeholder="Découvrez la liste {site.name}" {...field} />
                    </FormControl>
                    <FormDescription>
                      Vous pouvez utiliser le placeholder <code>{'{site.name}'}</code>.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content.teamPageSubtitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sous-titre page Équipe</FormLabel>
                    <FormControl>
                      <Input placeholder="27 hommes et femmes engagés pour la commune" {...field} />
                    </FormControl>
                    <FormDescription>
                      Vous pouvez utiliser les placeholders <code>{'{team.count}'}</code> et <code>{'{site.name}'}</code>.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="content.footerAbout"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texte footer</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content.membershipText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texte adhésion</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormDescription>
                    Texte principal du bloc adhésion dans la page « Comment nous aider ».
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="content.contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de contact</FormLabel>
                    <FormControl>
                      <Input placeholder="contact@..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content.contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="06 00 00 00 00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content.contactAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="map.center.lat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        value={field.value}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="map.center.lng"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        value={field.value}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="map.zoom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zoom</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={field.value}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>
              Activez ou désactivez les modules publics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {moduleFields.map((item) => (
              <FormField
                key={item.name}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <FormLabel className="text-base">{item.label}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving || isUploading}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les paramètres'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

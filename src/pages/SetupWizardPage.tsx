import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/context/auth";
import { toast } from "@/components/ui/use-toast";
import { Routes } from "@/routes";
import { ChevronRight, ChevronLeft, Check, Building2, Image, Palette, Upload } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading";
import { supabase } from "@/integrations/supabase/client";

const STEPS = [
  { id: "identity", title: "Identité", icon: Building2 },
  { id: "logo", title: "Logo", icon: Image },
  { id: "colors", title: "Couleurs", icon: Palette },
] as const;

const SETUP_WIZARD_ALLOW_KEY = "setup_wizard_allow";

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { user, isAdmin, authChecked, isRefreshingRoles } = useAuth();
  const { settings, updateSettings } = useAppSettings();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    if (!authChecked || isRefreshingRoles) return;
    const allowedByFlag = sessionStorage.getItem(SETUP_WIZARD_ALLOW_KEY) === "1";
    if (user && !isAdmin && !allowedByFlag) {
      navigate(Routes.ADMIN, { replace: true });
      return;
    }
    setAccessChecked(true);
  }, [authChecked, isRefreshingRoles, user, isAdmin, navigate]);

  const [name, setName] = useState(settings.branding.name);
  const [slogan, setSlogan] = useState(settings.branding.slogan);
  const [city, setCity] = useState(settings.branding.city);
  const [logoUrl, setLogoUrl] = useState(settings.branding.logoUrl);
  const [faviconUrl, setFaviconUrl] = useState(settings.branding.faviconUrl ?? "");
  const [footerLogoUrl, setFooterLogoUrl] = useState(settings.branding.footerLogoUrl ?? "");
  const [uploadingField, setUploadingField] = useState<"logo" | "favicon" | "footer" | null>(null);
  const [dominantBg, setDominantBg] = useState(settings.branding.colors.dominant.bg);
  const [gradientEnd, setGradientEnd] = useState(settings.branding.gradientEnd);

  const currentStepId = STEPS[step]?.id ?? "identity";

  const uploadToSiteAssets = async (
    file: File,
    setUrl: (url: string) => void,
    field: "logo" | "favicon" | "footer"
  ) => {
    const bucketName = "site-assets";
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `site/${fileName}`;
    setUploadingField(field);
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("404"))
          throw new Error(
            "Le bucket « site-assets » n’existe pas. Lancez « make supabase_ensure_buckets » ou créez-le dans le Dashboard Supabase (Storage → New bucket, Public)."
          );
        const isRls =
          /policy|permission|row-level security|access denied|403/i.test(uploadError.message ?? "");
        if (isRls)
          throw new Error(
            "Droits d’upload insuffisants. Appliquez la migration des politiques Storage puis « supabase db reset » (ou « db push » en prod)."
          );
        throw uploadError;
      }
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      setUrl(data.publicUrl);
      toast({ title: "Logo envoyé", description: "L’image a bien été téléversée." });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Impossible d’envoyer l’image.",
        variant: "destructive",
      });
    } finally {
      setUploadingField(null);
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      if (currentStepId === "identity") {
        const ok = await updateSettings({
          ...settings,
          branding: {
            ...settings.branding,
            name,
            slogan,
            city,
          },
        });
        if (!ok) throw new Error("Erreur enregistrement");
      } else if (currentStepId === "logo") {
        const ok = await updateSettings({
          ...settings,
          branding: {
            ...settings.branding,
            logoUrl,
            faviconUrl: faviconUrl.trim(),
            footerLogoUrl: footerLogoUrl.trim(),
          },
        });
        if (!ok) throw new Error("Erreur enregistrement");
      } else if (currentStepId === "colors") {
        const ok = await updateSettings({
          ...settings,
          branding: {
            ...settings.branding,
            gradientEnd,
            colors: {
              ...settings.branding.colors,
              dominant: { ...settings.branding.colors.dominant, bg: dominantBg },
              accent: { ...settings.branding.colors.accent, bg: dominantBg },
            },
          },
        });
        if (!ok) throw new Error("Erreur enregistrement");
      }

      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        sessionStorage.removeItem(SETUP_WIZARD_ALLOW_KEY);
        toast({ title: "Configuration enregistrée", description: "Vous pouvez modifier ces réglages plus tard dans Paramètres." });
        navigate(Routes.ADMIN);
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Impossible d’enregistrer",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!accessChecked || isRefreshingRoles) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${
                    i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-muted" : "text-muted-foreground"
                  }`}
                >
                  <s.icon className="w-4 h-4" />
                  {s.title}
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </React.Fragment>
            ))}
          </div>
          <CardTitle>Configuration du site</CardTitle>
          <CardDescription>
            {currentStepId === "identity" && "Nom du collectif, slogan et ville affichés sur le site."}
            {currentStepId === "logo" && "URL ou chemin du logo utilisé dans l’en-tête et les partages."}
            {currentStepId === "colors" && "Couleur principale et fin de dégradé (bandeaux, boutons)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStepId === "identity" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom du collectif</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gétigné Collectif" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slogan</label>
                <Input value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Ex: Élections municipales 2026" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ville</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: Gétigné" />
              </div>
            </>
          )}

          {currentStepId === "logo" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Logo principal (en-tête)</label>
                <p className="text-sm text-muted-foreground">Téléversez une image ou indiquez une URL.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <label
                    htmlFor="wizard-logo-upload"
                    className={`cursor-pointer ${uploadingField === "logo" ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input
                      id="wizard-logo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={!!uploadingField}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadToSiteAssets(file, setLogoUrl, "logo");
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingField === "logo" ? "Envoi…" : "Choisir une image"}
                    </span>
                  </label>
                </div>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/images/logo.png ou URL" className="mt-2" />
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain border rounded-md mt-2 bg-white" />}
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Favicon (onglet navigateur)</label>
                <p className="text-sm text-muted-foreground">Optionnel. Sinon, le logo principal est utilisé.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <label htmlFor="wizard-favicon-upload" className={`cursor-pointer ${uploadingField === "favicon" ? "pointer-events-none opacity-60" : ""}`}>
                    <input
                      id="wizard-favicon-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={!!uploadingField}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadToSiteAssets(file, setFaviconUrl, "favicon");
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingField === "favicon" ? "Envoi…" : "Choisir une image"}
                    </span>
                  </label>
                </div>
                <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="Vide = logo principal" className="mt-2" />
                {(faviconUrl || logoUrl) && (
                  <img src={faviconUrl || logoUrl} alt="Favicon" className="h-8 w-8 object-contain border rounded mt-2 bg-white" />
                )}
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Logo du pied de page</label>
                <p className="text-sm text-muted-foreground">Optionnel. Sinon, le logo principal est utilisé.</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <label htmlFor="wizard-footer-logo-upload" className={`cursor-pointer ${uploadingField === "footer" ? "pointer-events-none opacity-60" : ""}`}>
                    <input
                      id="wizard-footer-logo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={!!uploadingField}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadToSiteAssets(file, setFooterLogoUrl, "footer");
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingField === "footer" ? "Envoi…" : "Choisir une image"}
                    </span>
                  </label>
                </div>
                <Input value={footerLogoUrl} onChange={(e) => setFooterLogoUrl(e.target.value)} placeholder="Vide = logo principal" className="mt-2" />
                {(footerLogoUrl || logoUrl) && (
                  <img src={footerLogoUrl || logoUrl} alt="Logo footer" className="h-12 w-auto object-contain border rounded mt-2 bg-white" />
                )}
              </div>
            </div>
          )}

          {currentStepId === "colors" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Couleur principale</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={dominantBg}
                    onChange={(e) => setDominantBg(e.target.value)}
                    className="h-10 w-14 p-1 cursor-pointer"
                  />
                  <Input value={dominantBg} onChange={(e) => setDominantBg(e.target.value)} className="font-mono flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fin du dégradé (bandeaux)</label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={gradientEnd}
                    onChange={(e) => setGradientEnd(e.target.value)}
                    className="h-10 w-14 p-1 cursor-pointer"
                  />
                  <Input value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="font-mono flex-1" />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
            <Button onClick={handleNext} disabled={saving}>
              {saving ? "Enregistrement…" : step === STEPS.length - 1 ? "Terminer" : "Suivant"}
              {step < STEPS.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
              {step === STEPS.length - 1 && <Check className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

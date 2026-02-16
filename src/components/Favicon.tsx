import { Helmet } from "react-helmet-async";
import { useAppSettings } from "@/hooks/useAppSettings";

/**
 * Met à jour le favicon (onglet navigateur) depuis les paramètres du site.
 * Si faviconUrl est vide, utilise le logo principal.
 */
export default function Favicon() {
  const { settings } = useAppSettings();
  const href = settings.branding.faviconUrl || settings.branding.logoUrl;
  if (!href) return null;
  return (
    <Helmet>
      <link rel="icon" href={href} />
      <link rel="shortcut icon" href={href} />
    </Helmet>
  );
}

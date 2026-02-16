import * as z from 'zod';

export enum SiteSettingsSection {
  Branding = 'branding',
  Content = 'content',
  Map = 'map',
  Modules = 'modules',
}

export enum ModuleKey {
  Program = 'program',
  Team = 'team',
  SupportCommittee = 'supportCommittee',
  MembershipForm = 'membershipForm',
  Agenda = 'agenda',
  Blog = 'blog',
  Proxy = 'proxy',
  Committees = 'committees',
  Projects = 'projects',
  CommitteeWorksPublic = 'committeeWorksPublic',
}

export enum BrandColorKey {
  Dominant = 'dominant',
  Accent = 'accent',
  Proximity = 'proximity',
  Trust = 'trust',
  Danger = 'danger',
}

export type ColorPair = {
  bg: string;
  fg: string;
};

export type BrandColors = {
  dominant: ColorPair;
  accent: ColorPair;
  proximity: ColorPair;
  trust: ColorPair;
  danger: ColorPair;
  footer: ColorPair;
};

export type BrandingSettings = {
  name: string;
  slogan: string;
  logoUrl: string;
  /** Favicon (onglet navigateur). Si vide, le logo principal est utilisé. */
  faviconUrl: string;
  /** Logo du pied de page. Si vide, le logo principal est utilisé. */
  footerLogoUrl: string;
  city: string;
  /** Couleur de fin du gradient (complément du dominant), ex. #06b6d4 */
  gradientEnd: string;
  colors: BrandColors;
  images: {
    hero: string;
    campaign: string;
    neighborhood: string;
    joinMembershipPrimary: string;
    joinMembershipSecondary: string;
  };
};

export type ContentSettings = {
  heroTitle: string;
  heroTitleEmphasis: string;
  heroTitleSuffix: string;
  heroSubtitle: string;
  teamPageTitle: string;
  teamPageSubtitle: string;
  teamFeaturedCount: number;
  teamFeaturedLabel: string;
  footerAbout: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  siteDescription: string;
  membershipText: string;
};

export type MapSettings = {
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
};

export type ModuleSettings = {
  program: boolean;
  team: boolean;
  supportCommittee: boolean;
  membershipForm: boolean;
  agenda: boolean;
  blog: boolean;
  proxy: boolean;
  committees: boolean;
  projects: boolean;
  committeeWorksPublic: boolean;
};

export type SiteSettings = {
  branding: BrandingSettings;
  content: ContentSettings;
  map: MapSettings;
  modules: ModuleSettings;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type SiteSettingsByKey = {
  [SiteSettingsSection.Branding]: BrandingSettings;
  [SiteSettingsSection.Content]: ContentSettings;
  [SiteSettingsSection.Map]: MapSettings;
  [SiteSettingsSection.Modules]: ModuleSettings;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  branding: {
    name: 'Gétigné Collectif',
    slogan: 'Élections municipales 2026',
    logoUrl: '/images/getigne-collectif-logo.png',
    faviconUrl: '',
    footerLogoUrl: '',
    city: 'Gétigné',
    gradientEnd: '#06b6d4',
    colors: {
      dominant: { bg: '#34b190', fg: '#ffffff' },
      accent: { bg: '#34b190', fg: '#ffffff' },
      proximity: { bg: '#f97316', fg: '#ffffff' },
      trust: { bg: '#2563eb', fg: '#ffffff' },
      danger: { bg: '#dc2626', fg: '#ffffff' },
      footer: { bg: '#1d1d1f', fg: '#ffffff' },
    },
    images: {
      hero: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?ixlib=rb-4.0.3&auto=format&fit=crop&w=2940&q=80',
      campaign: '/images/GC-group1.jpg',
      neighborhood: '/images/getigne-places.png',
      joinMembershipPrimary: '/images/reunion.jpg',
      joinMembershipSecondary: '/images/reunion2.jpg',
    },
  },
  content: {
    heroTitle: 'Vivre dans une commune',
    heroTitleEmphasis: 'dynamique, engagée et démocratique',
    heroTitleSuffix: 'ça vous tente ?',
    heroSubtitle:
      "Déployons la force du collectif pour rendre notre commune plus engagée et au service de toutes et tous.",
    teamPageTitle: 'Découvrez la liste {site.name}',
    teamPageSubtitle: '{team.count} hommes et femmes engagés pour la commune',
    teamFeaturedCount: 2,
    teamFeaturedLabel: 'Tête de liste',
    footerAbout:
      'Collectif citoyen engagé pour les élections municipales depuis 2020 à Gétigné.\nEnsemble, construisons une commune plus dynamique, engagée et démocratique.',
    contactEmail: 'contact@CHANGER_ICI.fr',
    contactPhone: '06 xx xx xx xx',
    contactAddress: 'xx rue de la ville\nxx xx xx xx xx',
    siteDescription:
      'Liste citoyenne et participative engagée pour les élections municipales.',
    membershipText:
      "L'adhésion annuelle est à prix libre : chaque personne donne selon ses moyens. Vous pouvez également faire un don libre pour soutenir nos actions.",
  },
  map: {
    center: { lat: 47.0847, lng: -1.2614 },
    zoom: 13,
  },
  modules: {
    program: true,
    team: true,
    supportCommittee: true,
    membershipForm: true,
    agenda: true,
    blog: true,
    proxy: true,
    committees: true,
    projects: true,
    committeeWorksPublic: true,
  },
};

const colorSchema = z.string().min(1);
const colorPairSchema = z.object({ bg: colorSchema, fg: colorSchema });

const brandingSchema = z.object({
  name: z.string().min(1),
  slogan: z.string().min(1),
  logoUrl: z.string().min(1),
  faviconUrl: z.string().default(''),
  footerLogoUrl: z.string().default(''),
  city: z.string().min(1),
  gradientEnd: colorSchema.default('#06b6d4'),
  colors: z.object({
    dominant: colorPairSchema,
    accent: colorPairSchema,
    proximity: colorPairSchema,
    trust: colorPairSchema,
    danger: colorPairSchema,
    footer: colorPairSchema,
  }),
  images: z.object({
    hero: z.string().min(1),
    campaign: z.string().min(1),
    neighborhood: z.string().min(1),
    joinMembershipPrimary: z.string().min(1),
    joinMembershipSecondary: z.string().min(1),
  }),
});

const contentSchema = z.object({
  heroTitle: z.string().min(1),
  heroTitleEmphasis: z.string().min(1),
  heroTitleSuffix: z.string().min(1),
  heroSubtitle: z.string().min(1),
  teamPageTitle: z.string().min(1),
  teamPageSubtitle: z.string().min(1),
  teamFeaturedCount: z.number().int().min(0).max(20),
  teamFeaturedLabel: z.string().default(''),
  footerAbout: z.string().min(1),
  contactEmail: z.string().min(1),
  contactPhone: z.string().min(1),
  contactAddress: z.string().min(1),
  siteDescription: z.string().min(1),
  membershipText: z.string().min(1),
});

const mapSchema = z.object({
  center: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  zoom: z.number().int().min(1),
});

const modulesSchema = z.object({
  program: z.boolean(),
  team: z.boolean(),
  supportCommittee: z.boolean(),
  membershipForm: z.boolean(),
  agenda: z.boolean(),
  blog: z.boolean(),
  proxy: z.boolean(),
  committees: z.boolean(),
  projects: z.boolean(),
  committeeWorksPublic: z.boolean(),
});

export const siteSettingsSchema = z.object({
  branding: brandingSchema,
  content: contentSchema,
  map: mapSchema,
  modules: modulesSchema,
});

export const siteSettingsSectionSchema = {
  [SiteSettingsSection.Branding]: brandingSchema,
  [SiteSettingsSection.Content]: contentSchema,
  [SiteSettingsSection.Map]: mapSchema,
  [SiteSettingsSection.Modules]: modulesSchema,
};

export const siteSettingsSections = [
  SiteSettingsSection.Branding,
  SiteSettingsSection.Content,
  SiteSettingsSection.Map,
  SiteSettingsSection.Modules,
] as const;

export function mergeSiteSettings(
  defaults: SiteSettings,
  overrides: DeepPartial<SiteSettings>
): SiteSettings {
  return {
    branding: {
      ...defaults.branding,
      ...overrides.branding,
      gradientEnd: overrides.branding?.gradientEnd ?? defaults.branding.gradientEnd,
      colors: {
        dominant: { ...defaults.branding.colors.dominant, ...overrides.branding?.colors?.dominant },
        accent: { ...defaults.branding.colors.accent, ...overrides.branding?.colors?.accent },
        proximity: { ...defaults.branding.colors.proximity, ...overrides.branding?.colors?.proximity },
        trust: { ...defaults.branding.colors.trust, ...overrides.branding?.colors?.trust },
        danger: { ...defaults.branding.colors.danger, ...overrides.branding?.colors?.danger },
        footer: { ...defaults.branding.colors.footer, ...overrides.branding?.colors?.footer },
      },
      images: {
        ...defaults.branding.images,
        ...overrides.branding?.images,
      },
    },
    content: {
      ...defaults.content,
      ...overrides.content,
    },
    map: {
      ...defaults.map,
      ...overrides.map,
      center: {
        ...defaults.map.center,
        ...overrides.map?.center,
      },
    },
    modules: {
      ...defaults.modules,
      ...overrides.modules,
    },
  };
}

export function isSiteSettingsSection(value: string): value is SiteSettingsSection {
  return siteSettingsSections.includes(value as SiteSettingsSection);
}

export function normalizeSiteSettingsValue<K extends SiteSettingsSection>(
  section: K,
  value: unknown,
  defaults: SiteSettingsByKey[K]
): SiteSettingsByKey[K] {
  if (section === SiteSettingsSection.Branding) {
    const normalized = normalizeBrandingValue(value);
    return normalized as SiteSettingsByKey[K];
  }
  if (section === SiteSettingsSection.Content) {
    const normalized = normalizeContentValue(value);
    return normalized as SiteSettingsByKey[K];
  }

  const schema = siteSettingsSectionSchema[section];
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data as SiteSettingsByKey[K];
  }
  return defaults;
}

export function normalizeSiteSettings(
  rows: { key: string; value: unknown }[]
): SiteSettings {
  const overrides: DeepPartial<SiteSettings> = {};

  rows.forEach((row) => {
    if (!row?.key) return;

    if (isSiteSettingsSection(row.key)) {
      const section = row.key as SiteSettingsSection;
      if (section === SiteSettingsSection.Branding) {
        overrides.branding = normalizeSiteSettingsValue(
          section,
          row.value,
          DEFAULT_SITE_SETTINGS.branding
        );
        return;
      }
      if (section === SiteSettingsSection.Content) {
        overrides.content = normalizeSiteSettingsValue(
          section,
          row.value,
          DEFAULT_SITE_SETTINGS.content
        );
        return;
      }
      if (section === SiteSettingsSection.Map) {
        overrides.map = normalizeSiteSettingsValue(
          section,
          row.value,
          DEFAULT_SITE_SETTINGS.map
        );
        return;
      }
      if (section === SiteSettingsSection.Modules) {
        overrides.modules = normalizeSiteSettingsValue(
          section,
          row.value,
          DEFAULT_SITE_SETTINGS.modules
        );
        return;
      }
      return;
    }

    // Compat anciens réglages
    if (row.key === 'show_program') {
      overrides.modules = {
        ...(overrides.modules ?? {}),
        program: row.value === true || row.value === 'true' || (typeof row.value === 'object' && row.value !== null && 'enabled' in row.value ? (row.value as { enabled?: boolean }).enabled === true : false),
      };
    }

    if (row.key === 'show_committee_works') {
      overrides.modules = {
        ...(overrides.modules ?? {}),
        committeeWorksPublic: row.value === true || row.value === 'true' || (typeof row.value === 'object' && row.value !== null && 'enabled' in row.value ? (row.value as { enabled?: boolean }).enabled === true : false),
      };
    }

    if (row.key === 'site_name') {
      overrides.branding = { ...(overrides.branding ?? {}), name: String(row.value ?? '') };
    }

    if (row.key === 'site_description') {
      overrides.content = { ...(overrides.content ?? {}), siteDescription: String(row.value ?? '') };
    }

    if (row.key === 'contact_email') {
      overrides.content = { ...(overrides.content ?? {}), contactEmail: String(row.value ?? '') };
    }
  });

  return mergeSiteSettings(DEFAULT_SITE_SETTINGS, overrides);
}

function normalizeBrandingValue(value: unknown): BrandingSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SITE_SETTINGS.branding;
  }
  const raw = value as Partial<BrandingSettings> & {
    colors?: Partial<BrandingSettings['colors']> & {
      green?: string;
      yellow?: string;
      orange?: string;
      blue?: string;
      red?: string;
    };
  };

  const D = DEFAULT_SITE_SETTINGS.branding.colors;
  const legacyColors = (raw.colors ?? {}) as Partial<BrandColors> & { green?: string; orange?: string; blue?: string; red?: string };
  const fromLegacy = (val: string | ColorPair | undefined, fallback: ColorPair): ColorPair => {
    if (val == null) return fallback;
    if (typeof val === 'string') return { bg: val, fg: fallback.fg };
    return { bg: val.bg ?? fallback.bg, fg: val.fg ?? fallback.fg };
  };
  const colors: BrandColors = {
    dominant: fromLegacy(raw.colors?.dominant ?? legacyColors.green, D.dominant),
    accent: fromLegacy(raw.colors?.accent ?? legacyColors.green, D.accent),
    proximity: fromLegacy(raw.colors?.proximity ?? legacyColors.orange, D.proximity),
    trust: fromLegacy(raw.colors?.trust ?? legacyColors.blue, D.trust),
    danger: fromLegacy(raw.colors?.danger ?? legacyColors.red, D.danger),
    footer: fromLegacy(raw.colors?.footer, D.footer),
  };

  const gradientEnd = typeof raw.gradientEnd === 'string' && raw.gradientEnd.length > 0
    ? raw.gradientEnd
    : DEFAULT_SITE_SETTINGS.branding.gradientEnd;
  const merged = mergeSiteSettings(DEFAULT_SITE_SETTINGS, {
    branding: {
      ...raw,
      gradientEnd,
      colors: colors,
      images: {
        ...raw.images,
      },
    },
  });

  const parsed = brandingSchema.safeParse(merged.branding);
  return parsed.success ? (parsed.data as BrandingSettings) : DEFAULT_SITE_SETTINGS.branding;
}

function normalizeContentValue(value: unknown): ContentSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SITE_SETTINGS.content;
  }
  const raw = value as Partial<ContentSettings>;
  const merged = mergeSiteSettings(DEFAULT_SITE_SETTINGS, { content: raw });
  const parsed = contentSchema.safeParse(merged.content);
  return parsed.success ? (parsed.data as ContentSettings) : DEFAULT_SITE_SETTINGS.content;
}

function hexToHsl(value: string): string | null {
  const hex = value.replace('#', '');
  if (![3, 6].includes(hex.length)) return null;
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  const int = parseInt(normalized, 16);
  if (Number.isNaN(int)) return null;
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `${hDeg} ${sPct}% ${lPct}%`;
}

/** Parse "H S% L%" and return [h, s, l] or null. */
function parseHsl(hsl: string): [number, number, number] | null {
  const m = hsl.trim().match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Returns same HSL with L reduced by reducePercent (clamped 0–100). Format "H S% L%". */
function hslDarker(hsl: string, reducePercent: number): string {
  const parsed = parseHsl(hsl);
  if (!parsed) return hsl;
  const [h, s, l] = parsed;
  const newL = Math.max(0, Math.min(100, l - reducePercent));
  return `${h} ${s}% ${newL}%`;
}

/** Returns same HSL with L increased by addPercent (clamped 0–100). Format "H S% L%". */
function hslLighter(hsl: string, addPercent: number): string {
  const parsed = parseHsl(hsl);
  if (!parsed) return hsl;
  const [h, s, l] = parsed;
  const newL = Math.max(0, Math.min(100, l + addPercent));
  return `${h} ${s}% ${newL}%`;
}

export function applySiteTheme(settings: SiteSettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const c = settings.branding.colors;
  root.style.setProperty('--site-dominant', c.dominant.bg);
  root.style.setProperty('--site-dominant-fg', c.dominant.fg);
  root.style.setProperty('--site-accent', c.accent.bg);
  root.style.setProperty('--site-accent-fg', c.accent.fg);
  root.style.setProperty('--site-proximity', c.proximity.bg);
  root.style.setProperty('--site-proximity-fg', c.proximity.fg);
  root.style.setProperty('--site-trust', c.trust.bg);
  root.style.setProperty('--site-trust-fg', c.trust.fg);
  root.style.setProperty('--site-danger', c.danger.bg);
  root.style.setProperty('--site-danger-fg', c.danger.fg);
  root.style.setProperty('--site-footer', c.footer.bg);
  root.style.setProperty('--site-footer-fg', c.footer.fg);

  const dominantHsl = hexToHsl(c.dominant.bg);
  if (dominantHsl) {
    root.style.setProperty('--primary', dominantHsl);
    root.style.setProperty('--ring', dominantHsl);
    root.style.setProperty('--site-dominant-darker', hslDarker(dominantHsl, 12));
    root.style.setProperty('--site-dominant-light', hslLighter(dominantHsl, 10));
  }
  const dominantFgHsl = hexToHsl(c.dominant.fg);
  if (dominantFgHsl) {
    root.style.setProperty('--primary-foreground', dominantFgHsl);
  }

  // Accent reste configurable (ex. pour variante) mais l’UI "brand" utilise la dominante
  const accentHsl = hexToHsl(c.accent.bg);
  if (accentHsl) {
    root.style.setProperty('--site-accent-hsl', accentHsl);
  }

  root.style.setProperty('--site-dominant-gradient-end', settings.branding.gradientEnd);
}

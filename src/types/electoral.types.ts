import { Database } from "@/integrations/supabase/types";

// Types de base depuis la base de données
export type ThematicRole = Database["public"]["Tables"]["thematic_roles"]["Row"];
export type ThematicRoleInsert = Database["public"]["Tables"]["thematic_roles"]["Insert"];
export type ThematicRoleUpdate = Database["public"]["Tables"]["thematic_roles"]["Update"];

export type ElectoralList = Database["public"]["Tables"]["electoral_list"]["Row"];
export type ElectoralListInsert = Database["public"]["Tables"]["electoral_list"]["Insert"];
export type ElectoralListUpdate = Database["public"]["Tables"]["electoral_list"]["Update"];

export type ElectoralListMemberBase = Database["public"]["Tables"]["electoral_list_members"]["Row"];
export type ElectoralListMemberInsert = Database["public"]["Tables"]["electoral_list_members"]["Insert"];
export type ElectoralListMemberUpdate = Database["public"]["Tables"]["electoral_list_members"]["Update"];

export type ElectoralMemberRole = Database["public"]["Tables"]["electoral_member_roles"]["Row"];
export type ElectoralMemberRoleInsert = Database["public"]["Tables"]["electoral_member_roles"]["Insert"];
export type ElectoralMemberRoleUpdate = Database["public"]["Tables"]["electoral_member_roles"]["Update"];

export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"] & {
  national_elector_number: string | null;
  slug: string;
  identity_card_url: string | null;
  cerfa_14997_04_url: string | null;
  commune_attachment_proof_url: string | null;
};
export type TeamMemberInsert = Database["public"]["Tables"]["team_members"]["Insert"] & {
  national_elector_number?: string | null;
  slug?: string;
  identity_card_url?: string | null;
  cerfa_14997_04_url?: string | null;
  commune_attachment_proof_url?: string | null;
};
export type TeamMemberUpdate = Database["public"]["Tables"]["team_members"]["Update"] & {
  national_elector_number?: string | null;
  slug?: string;
  identity_card_url?: string | null;
  cerfa_14997_04_url?: string | null;
  commune_attachment_proof_url?: string | null;
};

// Types étendus avec jointures

/**
 * Membre de la liste électorale avec les informations du membre d'équipe
 * et ses rôles thématiques
 */
export interface ElectoralListMemberWithDetails extends ElectoralListMemberBase {
  team_member: TeamMember;
  roles: Array<{
    id: string;
    is_primary: boolean;
    thematic_role: ThematicRole;
  }>;
}

/**
 * Liste électorale complète avec tous ses membres et leurs détails
 */
export interface ElectoralListWithMembers extends ElectoralList {
  members: ElectoralListMemberWithDetails[];
}

/**
 * Position sur la liste avec ou sans membre assigné
 */
export interface ElectoralPosition {
  position: number;
  member: ElectoralListMemberWithDetails | null;
}

/**
 * Catégorie de position (titulaire ou remplaçant)
 */
export type PositionCategory = "titular" | "substitute";

/**
 * Helper pour déterminer la catégorie d'une position
 */
export function getPositionCategory(position: number): PositionCategory {
  return position <= 27 ? "titular" : "substitute";
}

/**
 * Helper pour obtenir le label d'une position
 */
export function getPositionLabel(position: number): string {
  const category = getPositionCategory(position);
  if (category === "titular") {
    return `Titulaire ${position}`;
  } else {
    return `Remplaçant ${position - 27}`;
  }
}

/**
 * Données pour le drag & drop dans l'interface admin
 */
export interface DragDropData {
  type: "team_member" | "electoral_member";
  memberId: string;
  position?: number;
}








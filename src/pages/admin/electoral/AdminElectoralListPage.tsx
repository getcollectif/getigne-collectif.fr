import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Download, Loader2 } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ElectoralListGrid from '@/components/admin/electoral/ElectoralListGrid';
import UnassignedMembersList from '@/components/admin/electoral/UnassignedMembersList';
import EditMemberModal from '@/components/admin/electoral/EditMemberModal';
import ElectoralListAnalysis from '@/components/admin/electoral/ElectoralListAnalysis';
import { Button } from '@/components/ui/button';
import ThematicRolesAdminSection from '@/components/admin/roles/ThematicRolesAdminSection';
import TeamMembersAdminSection from '@/components/admin/team/TeamMembersAdminSection';
import type {
  ElectoralList,
  ElectoralListMemberWithDetails,
  TeamMember,
  ThematicRole,
  ElectoralPosition,
} from '@/types/electoral.types';
import * as XLSX from 'xlsx';

const AdminElectoralListPage = () => {
  const { isAdmin, authChecked, isRefreshingRoles } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [electoralList, setElectoralList] = useState<ElectoralList | null>(null);
  const [positions, setPositions] = useState<ElectoralPosition[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<TeamMember[]>([]);
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [thematicRoles, setThematicRoles] = useState<ThematicRole[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ElectoralListMemberWithDetails | null>(
    null
  );

  const getEducationLabel = (level: string | null): string => {
    if (!level) return 'Non renseigné';
    const labels: Record<string, string> = {
      brevet: 'Brevet / Fin de collège',
      cap_bep: 'CAP / BEP',
      bac_general: 'Bac général',
      bac_technologique: 'Bac technologique',
      bac_professionnel: 'Bac professionnel',
      bac_plus_1_2: 'Bac +1 / Bac +2',
      bac_plus_3: 'Bac +3',
      bac_plus_4_5: 'Bac +4 / Bac +5',
      bac_plus_6_plus: 'Bac +6 et plus',
    };
    return labels[level] || level;
  };

  const getGenderLabel = (gender: string | null): string => {
    if (!gender) return '';
    const labels: Record<string, string> = {
      femme: 'Femme',
      homme: 'Homme',
      autre: 'Autre',
    };
    return labels[gender] || gender;
  };

  // Gestion de l'onglet actif depuis l'URL
  const activeTab = searchParams.get('tab') || 'construction';
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  useEffect(() => {
    if (!authChecked) return;
    if (isRefreshingRoles) return;

    if (!isAdmin) {
      navigate('/');
      toast({
        title: 'Accès refusé',
        description: "Vous n'avez pas les droits pour accéder à cette page.",
        variant: 'destructive',
      });
      return;
    }

    loadData();
  }, [authChecked, isAdmin, navigate, toast, isRefreshingRoles]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger la liste électorale active
      const { data: listData, error: listError } = await supabase
        .from('electoral_list')
        .select('*')
        .eq('is_active', true)
        .single();

      if (listError && listError.code !== 'PGRST116') throw listError;

      let positionsArray: ElectoralPosition[];

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

        // Créer les 29 positions
        positionsArray = Array.from(
          { length: 29 },
          (_, i) => {
            const position = i + 1;
            const member = membersData?.find((m) => m.position === position);
            return {
              position,
              member: member
                ? {
                    ...member,
                    team_member: member.team_member,
                    roles: member.roles.map((r: any) => ({
                      id: r.id,
                      is_primary: r.is_primary,
                      thematic_role: r.thematic_role,
                    })),
                  }
                : null,
            };
          }
        );

        setPositions(positionsArray);
      } else {
        // Pas de liste active, créer les 29 positions vides
        positionsArray = Array.from(
          { length: 29 },
          (_, i) => ({
            position: i + 1,
            member: null,
          })
        );
        setPositions(positionsArray);
      }

      // Charger tous les membres
      const { data: allMembersData, error: allMembersError } = await supabase
        .from('team_members')
        .select('*')
        .order('name');

      if (allMembersError) throw allMembersError;
      setAllMembers(allMembersData || []);

      // Filtrer les membres non assignés en utilisant positionsArray (pas positions qui est l'ancien état)
      // Exclure aussi les membres avec max_engagement_level null (pas d'engagement)
      const assignedIds = new Set(
        positionsArray.filter((p) => p.member).map((p) => p.member!.team_member_id)
      );
      const unassigned = (allMembersData || []).filter(
        (m) => !assignedIds.has(m.id) && m.max_engagement_level !== null
      );
      setUnassignedMembers(unassigned);

      // Charger les rôles thématiques
      const { data: rolesData, error: rolesError } = await supabase
        .from('thematic_roles')
        .select('*')
        .order('sort_order');

      if (rolesError) throw rolesError;
      setThematicRoles(rolesData || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fonctions pour la règle de parité
  const getParityRule = () => {
    // Trouver la première personne placée (position la plus basse)
    const firstAssigned = positions
      .filter(p => p.member !== null)
      .sort((a, b) => a.position - b.position)[0];

    if (!firstAssigned || !firstAssigned.member) {
      return null; // Pas de règle si personne n'est placée
    }

    const firstGender = firstAssigned.member.team_member.gender;
    const firstPosition = firstAssigned.position;
    
    if (!firstGender || firstGender === 'autre') {
      return null; // Pas de règle si le genre n'est pas binaire
    }

    // Déterminer la règle basée sur la première personne
    const isFirstPositionOdd = firstPosition % 2 === 1;
    
    return {
      firstPosition,
      firstGender,
      // Si femme en position impaire -> impaires=femmes, paires=hommes
      // Si homme en position impaire -> impaires=hommes, paires=femmes
      // Si femme en position paire -> paires=femmes, impaires=hommes
      // Si homme en position paire -> paires=hommes, impaires=femmes
      genderForOddPositions: isFirstPositionOdd ? firstGender : (firstGender === 'femme' ? 'homme' : 'femme'),
      genderForEvenPositions: isFirstPositionOdd ? (firstGender === 'femme' ? 'homme' : 'femme') : firstGender,
    };
  };

  const getExpectedGenderForPosition = (position: number) => {
    const rule = getParityRule();
    if (!rule) return null;

    const isOdd = position % 2 === 1;
    return isOdd ? rule.genderForOddPositions : rule.genderForEvenPositions;
  };

  const validateParityRule = (memberId: string, targetPosition: number): boolean => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return false;

    const rule = getParityRule();
    
    // Si pas de règle établie ET c'est la première personne, accepter
    if (!rule) return true;

    // Si le genre du membre est 'autre', ne pas appliquer la règle
    if (!member.gender || member.gender === 'autre') return true;

    const expectedGender = getExpectedGenderForPosition(targetPosition);
    
    // Si pas de genre attendu (règle pas applicable), accepter
    if (!expectedGender) return true;

    // Vérifier si le genre correspond
    return member.gender === expectedGender;
  };

  // Trouver la prochaine position disponible pour un membre selon la règle de parité
  const findNextAvailablePosition = (memberId: string, startFrom: number = 1): number | null => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return null;

    // Si pas de règle de parité, trouver la première position libre
    const rule = getParityRule();
    if (!rule || !member.gender || member.gender === 'autre') {
      for (let i = startFrom; i <= 29; i++) {
        const pos = positions.find(p => p.position === i);
        if (!pos?.member) return i;
      }
      return null;
    }

    // Avec règle de parité, trouver la première position libre qui respecte la règle
    for (let i = startFrom; i <= 29; i++) {
      const pos = positions.find(p => p.position === i);
      if (!pos?.member) {
        const expectedGender = getExpectedGenderForPosition(i);
        if (!expectedGender || member.gender === expectedGender) {
          return i;
        }
      }
    }
    return null;
  };

  // Fonction pour calculer l'âge
  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const activeData = event.active.data.current;
    if (activeData?.type === 'assigned') {
      setDraggedFrom(activeData.position);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    setDraggedFrom(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Drag depuis la liste non assignée vers une position
    if (activeData?.type === 'unassigned' && overData?.type === 'position') {
      await assignMemberToPosition(activeData.memberId, overData.position);
    }

    // Drag depuis une position vers une autre position (échange)
    if (activeData?.type === 'assigned' && overData?.type === 'position') {
      await swapPositions(activeData.position, overData.position);
    }

    // Drag depuis une position vers la zone non assignée
    if (activeData?.type === 'assigned' && overData?.type === 'unassigned') {
      await removeMemberFromPosition(activeData.position);
    }
  };

  const assignMemberToPosition = async (memberId: string, position: number) => {
    try {
      if (!electoralList) {
        toast({
          title: 'Erreur',
          description: 'Aucune liste électorale active.',
          variant: 'destructive',
        });
        return;
      }

      // Vérifier la règle de parité
      if (!validateParityRule(memberId, position)) {
        const expectedGender = getExpectedGenderForPosition(position);
        const genderLabel = expectedGender === 'femme' ? 'une femme' : 'un homme';
        toast({
          title: 'Règle de parité non respectée',
          description: `La position ${position} doit être occupée par ${genderLabel} selon la règle établie.`,
          variant: 'destructive',
        });
        return;
      }

      // Vérifier si la position est déjà occupée
      const existingMember = positions.find((p) => p.position === position)?.member;
      if (existingMember) {
        toast({
          title: 'Position occupée',
          description: 'Cette position est déjà occupée.',
          variant: 'destructive',
        });
        return;
      }

      // Trouver le membre dans la liste des non assignés
      const memberToAssign = unassignedMembers.find(m => m.id === memberId);
      if (!memberToAssign) return;

      // Mise à jour optimiste de l'UI
      setUnassignedMembers(prev => prev.filter(m => m.id !== memberId));
      
      // Insérer en BDD
      const { data, error } = await supabase
        .from('electoral_list_members')
        .insert({
          electoral_list_id: electoralList.id,
          team_member_id: memberId,
          position,
        })
        .select(`
          *,
          team_member:team_members(*),
          roles:electoral_member_roles(
            id,
            is_primary,
            thematic_role:thematic_roles(*)
          )
        `)
        .single();

      if (error) throw error;

      // Mise à jour optimiste des positions
      const newMember: ElectoralListMemberWithDetails = {
        ...data,
        team_member: data.team_member,
        roles: data.roles.map((r: any) => ({
          id: r.id,
          is_primary: r.is_primary,
          thematic_role: r.thematic_role,
        })),
      };

      setPositions(prev => prev.map(p => 
        p.position === position 
          ? { ...p, member: newMember }
          : p
      ));

      toast({
        title: 'Membre assigné',
        description: 'Le membre a été assigné à la position.',
      });
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'assigner le membre.',
        variant: 'destructive',
      });
      // Recharger en cas d'erreur
      await loadData();
    }
  };

  const swapPositions = async (fromPosition: number, toPosition: number) => {
    try {
      if (!electoralList) return;

      const fromMember = positions.find((p) => p.position === fromPosition)?.member;
      const toMember = positions.find((p) => p.position === toPosition)?.member;

      if (!fromMember) return;

      // Vérifier la règle de parité pour le déplacement
      if (!validateParityRule(fromMember.team_member_id, toPosition)) {
        const expectedGender = getExpectedGenderForPosition(toPosition);
        const genderLabel = expectedGender === 'femme' ? 'une femme' : 'un homme';
        toast({
          title: 'Règle de parité non respectée',
          description: `La position ${toPosition} doit être occupée par ${genderLabel} selon la règle établie.`,
          variant: 'destructive',
        });
        return;
      }

      // Si échange avec une autre personne, vérifier aussi l'inverse
      if (toMember && !validateParityRule(toMember.team_member_id, fromPosition)) {
        const expectedGender = getExpectedGenderForPosition(fromPosition);
        const genderLabel = expectedGender === 'femme' ? 'une femme' : 'un homme';
        toast({
          title: 'Règle de parité non respectée',
          description: `L'échange violerait la règle : la position ${fromPosition} doit être occupée par ${genderLabel}.`,
          variant: 'destructive',
        });
        return;
      }

      // Mise à jour optimiste de l'UI
      setPositions(prev => prev.map(p => {
        if (p.position === fromPosition) {
          return { ...p, member: toMember };
        }
        if (p.position === toPosition) {
          return { ...p, member: fromMember };
        }
        return p;
      }));

      // Si la position de destination est vide, simple mise à jour
      if (!toMember) {
        const { error } = await supabase
          .from('electoral_list_members')
          .update({ position: toPosition })
          .eq('id', fromMember.id);

        if (error) throw error;
      } else {
        // Échange des positions
        // Utiliser une position temporaire pour éviter les conflits de contraintes
        const tempPosition = 999;

        // Étape 1: Mettre fromMember en position temporaire
        await supabase
          .from('electoral_list_members')
          .update({ position: tempPosition })
          .eq('id', fromMember.id);

        // Étape 2: Mettre toMember à fromPosition
        await supabase
          .from('electoral_list_members')
          .update({ position: fromPosition })
          .eq('id', toMember.id);

        // Étape 3: Mettre fromMember à toPosition
        const { error } = await supabase
          .from('electoral_list_members')
          .update({ position: toPosition })
          .eq('id', fromMember.id);

        if (error) throw error;
      }

      toast({
        title: 'Positions échangées',
        description: 'Les positions ont été mises à jour.',
      });
    } catch (error) {
      console.error('Erreur lors de l\'échange:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'échanger les positions.',
        variant: 'destructive',
      });
      // Recharger en cas d'erreur
      await loadData();
    }
  };

  const removeMemberFromPosition = async (position: number) => {
    try {
      const member = positions.find((p) => p.position === position)?.member;
      if (!member) return;

      // Mise à jour optimiste de l'UI
      setPositions(prev => prev.map(p => 
        p.position === position ? { ...p, member: null } : p
      ));
      setUnassignedMembers(prev => [...prev, member.team_member].sort((a, b) => a.name.localeCompare(b.name)));

      const { error } = await supabase
        .from('electoral_list_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Membre retiré',
        description: 'Le membre a été retiré de la liste.',
      });
    } catch (error) {
      console.error('Erreur lors du retrait:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer le membre.',
        variant: 'destructive',
      });
      // Recharger en cas d'erreur
      await loadData();
    }
  };

  // Fonction pour assigner un membre depuis le select (gère le déplacement automatique)
  const assignMemberFromSelect = async (memberId: string, targetPosition: number) => {
    try {
      if (!electoralList) {
        toast({
          title: 'Erreur',
          description: 'Aucune liste électorale active.',
          variant: 'destructive',
        });
        return;
      }

      // Vérifier la règle de parité
      if (!validateParityRule(memberId, targetPosition)) {
        const expectedGender = getExpectedGenderForPosition(targetPosition);
        const genderLabel = expectedGender === 'femme' ? 'une femme' : 'un homme';
        toast({
          title: 'Règle de parité non respectée',
          description: `La position ${targetPosition} doit être occupée par ${genderLabel} selon la règle établie.`,
          variant: 'destructive',
        });
        return;
      }

      const existingMember = positions.find((p) => p.position === targetPosition)?.member;
      const memberToAssign = unassignedMembers.find(m => m.id === memberId);
      if (!memberToAssign) return;

      // Mise à jour optimiste de l'UI - retirer le membre de la liste des non assignés
      setUnassignedMembers(prev => prev.filter(m => m.id !== memberId));

      // Si la position est occupée, déplacer la personne actuelle
      if (existingMember) {
        const nextPosition = findNextAvailablePosition(
          existingMember.team_member_id,
          targetPosition + 1
        );

        if (nextPosition) {
          // Mise à jour optimiste : déplacer la personne actuelle à la prochaine position
          setPositions(prev => prev.map(p => {
            if (p.position === targetPosition) {
              return { ...p, member: null };
            }
            if (p.position === nextPosition) {
              return { ...p, member: existingMember };
            }
            return p;
          }));

          // Déplacer la personne actuelle à la prochaine position disponible
          const { error: updateError } = await supabase
            .from('electoral_list_members')
            .update({ position: nextPosition })
            .eq('id', existingMember.id);
          
          if (updateError) throw updateError;
          
          toast({
            title: 'Déplacement effectué',
            description: `${existingMember.team_member.name} a été déplacé à la position ${nextPosition}.`,
          });
        } else {
          // Pas de place disponible, renvoyer dans la liste des membres disponibles
          // Mise à jour optimiste : retirer de la position et ajouter aux non assignés
          setPositions(prev => prev.map(p => 
            p.position === targetPosition ? { ...p, member: null } : p
          ));
          setUnassignedMembers(prev => [...prev, existingMember.team_member].sort((a, b) => a.name.localeCompare(b.name)));

          const { error: deleteError } = await supabase
            .from('electoral_list_members')
            .delete()
            .eq('id', existingMember.id);
          
          if (deleteError) throw deleteError;
          
          toast({
            title: 'Membre déplacé',
            description: `${existingMember.team_member.name} a été renvoyé dans la liste des membres disponibles.`,
          });
        }
      }

      // Insérer le nouveau membre en BDD
      const { data, error } = await supabase
        .from('electoral_list_members')
        .insert({
          electoral_list_id: electoralList.id,
          team_member_id: memberId,
          position: targetPosition,
        })
        .select(`
          *,
          team_member:team_members(*),
          roles:electoral_member_roles(
            id,
            is_primary,
            thematic_role:thematic_roles(*)
          )
        `)
        .single();

      if (error) throw error;

      // Mise à jour optimiste des positions avec le nouveau membre
      const newMember: ElectoralListMemberWithDetails = {
        ...data,
        team_member: data.team_member,
        roles: data.roles.map((r: any) => ({
          id: r.id,
          is_primary: r.is_primary,
          thematic_role: r.thematic_role,
        })),
      };

      setPositions(prev => prev.map(p => 
        p.position === targetPosition 
          ? { ...p, member: newMember }
          : p
      ));

      toast({
        title: 'Membre assigné',
        description: `${memberToAssign.name} a été assigné à la position ${targetPosition}.`,
      });
    } catch (error) {
      console.error('Erreur lors de l\'assignation:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'assigner le membre.',
        variant: 'destructive',
      });
      // Recharger en cas d'erreur
      await loadData();
    }
  };

  const handleOpenEditModal = (member: ElectoralListMemberWithDetails) => {
    setSelectedMember(member);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    loadData();
  };

  const handleUpdateMemberCoordinates = async (memberId: string, latitude: number, longitude: number) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ latitude, longitude })
        .eq('id', memberId);

      if (error) throw error;

      // Mettre à jour localement les positions sans recharger toute la page
      setPositions(prevPositions => 
        prevPositions.map(pos => {
          if (pos.member?.team_member_id === memberId) {
            return {
              ...pos,
              member: {
                ...pos.member,
                team_member: {
                  ...pos.member.team_member,
                  latitude,
                  longitude,
                },
              },
            };
          }
          return pos;
        })
      );

      // Mettre à jour aussi allMembers pour que les membres non assignés soient à jour
      setAllMembers(prevMembers =>
        prevMembers.map(member =>
          member.id === memberId
            ? { ...member, latitude, longitude }
            : member
        )
      );

      toast({
        title: 'Coordonnées mises à jour',
        description: 'Les coordonnées ont été sauvegardées avec succès.',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des coordonnées:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les coordonnées.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleExportXlsx = () => {
    const assignedMembers = positions
      .filter((p) => p.member)
      .sort((a, b) => a.position - b.position) as Array<ElectoralPosition & { member: ElectoralListMemberWithDetails }>;

    if (assignedMembers.length === 0) {
      toast({
        title: 'Aucun membre à exporter',
        description: 'La liste électorale ne contient pas encore de membres.',
        variant: 'destructive',
      });
      return;
    }

    const rows = assignedMembers.map((position) => {
      const member = position.member.team_member;
      const thematicRoles = position.member.roles
        .slice()
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
        .map((role) => role.thematic_role.name)
        .join(', ');

      return {
        'Numéro': position.position,
        'Nom complet': member.name || '',
        'Profession': member.profession || '',
        'Numéro National d\'Electeur': member.national_elector_number || '',
        'Genre': getGenderLabel(member.gender),
        'Date de naissance': member.birth_date || '',
        'Email': member.email || '',
        'Téléphone': member.phone || '',
        'Adresse postale': member.address || '',
        'Niveau d\'étude': getEducationLabel(member.education_level),
        'Rôles thématiques': thematicRoles,
      };
    });

    const headers = [
      'Numéro',
      'Nom complet',
      'Profession',
      'Numéro National d\'Electeur',
      'Genre',
      'Date de naissance',
      'Email',
      'Téléphone',
      'Adresse postale',
      'Niveau d\'étude',
      'Rôles thématiques',
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liste électorale');

    const workbookArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([workbookArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `liste-electorale-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export XLSX réussi',
      description: `${assignedMembers.length} membre(s) exporté(s).`,
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <HelmetProvider>
      <Helmet>
        <title>Gestion de l'équipe | Admin</title>
      </Helmet>

      <AdminLayout noContainer>
        <div className="py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Équipe</h1>
              <p className="text-muted-foreground">
                Composez l'équipe pour les élections municipales de Mars 2026
              </p>
            </div>
            <Button type="button" variant="outline" onClick={handleExportXlsx}>
              <Download className="mr-2 h-4 w-4" />
              Exporter en XLSX
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="construction">Construction de la liste</TabsTrigger>
                <TabsTrigger value="analysis">Analyse de la liste</TabsTrigger>
                <TabsTrigger value="roles">Rôles</TabsTrigger>
                <TabsTrigger value="team">Équipe</TabsTrigger>
              </TabsList>

              <TabsContent value="construction">
                <DndContext 
                  onDragStart={handleDragStart} 
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex gap-6">
                    <div className="flex-1 min-w-0">
                      <ElectoralListGrid
                        positions={positions}
                        onOpenRolesModal={handleOpenEditModal}
                        onRemoveMember={removeMemberFromPosition}
                        overId={overId}
                        draggedFrom={draggedFrom}
                        getExpectedGender={getExpectedGenderForPosition}
                      />
                    </div>

                    <div className="w-80 flex-shrink-0">
                      <UnassignedMembersList 
                        members={unassignedMembers}
                        positions={positions}
                        getExpectedGender={getExpectedGenderForPosition}
                        validateParityRule={validateParityRule}
                        onAssignMember={assignMemberFromSelect}
                      />
                    </div>
                  </div>

                  <DragOverlay>
                    {activeId && (
                      <div className="bg-white border-2 border-brand rounded-lg p-4 shadow-lg">
                        <div className="text-sm font-medium">Déplacement...</div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </TabsContent>

              <TabsContent value="analysis">
                <ElectoralListAnalysis 
                  positions={positions} 
                  onOpenEditModal={handleOpenEditModal}
                  onUpdateMemberCoordinates={handleUpdateMemberCoordinates}
                  getExpectedGenderForPosition={getExpectedGenderForPosition}
                />
              </TabsContent>

              <TabsContent value="roles">
                <ThematicRolesAdminSection showHeader={false} />
              </TabsContent>

              <TabsContent value="team">
                <TeamMembersAdminSection showHeader={false} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </AdminLayout>

      <EditMemberModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        member={selectedMember}
        thematicRoles={thematicRoles}
        onSuccess={handleEditSuccess}
      />
    </HelmetProvider>
  );
};

export default AdminElectoralListPage;


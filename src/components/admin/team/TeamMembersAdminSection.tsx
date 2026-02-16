import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Routes, generateRoutes } from '@/routes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeamMember } from '@/types/electoral.types';

type TeamMembersAdminSectionProps = {
  showHeader?: boolean;
};

const TeamMembersAdminSection = ({ showHeader = true }: TeamMembersAdminSectionProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des membres:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de récupérer les membres de l\'équipe.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberToDelete.id);

      if (error) throw error;

      toast({
        title: 'Membre supprimé',
        description: 'Le membre a été supprimé avec succès.',
      });

      fetchMembers();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le membre.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    }
  };

  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.profession && member.profession.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (member.role && member.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="py-4">
      {showHeader && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Membres de l'équipe</h1>
          <p className="text-muted-foreground">
            Gérez les membres de l'équipe du collectif
          </p>
        </div>
      )}

      <div
        className={`flex flex-col gap-4 sm:flex-row sm:items-center mb-6 ${
          showHeader ? 'sm:justify-between' : 'sm:justify-end'
        }`}
      >
        {showHeader && <div />}
        <Button onClick={() => navigate(Routes.ADMIN_TEAM_MEMBERS_NEW)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau membre
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recherche</CardTitle>
          <CardDescription>
            Recherchez un membre par nom, profession ou rôle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="overflow-hidden">
              <div className="h-48 overflow-hidden bg-gray-100">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-brand-100">
                    <span className="text-4xl text-brand-400">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-1">{member.name}</h3>
                {member.role && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge
                      variant="secondary"
                      className="text-xs text-brand rounded-[4px]"
                    >
                      {member.role}
                    </Badge>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      navigate(generateRoutes.adminTeamMembersEdit(member.id))
                    }
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setMemberToDelete(member);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredMembers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Aucun membre trouvé pour cette recherche.'
                : 'Aucun membre dans l\'équipe. Commencez par en ajouter un.'}
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {memberToDelete?.name} ? Cette
              action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamMembersAdminSection;

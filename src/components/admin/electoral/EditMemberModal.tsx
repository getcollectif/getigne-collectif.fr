import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, X, MapPin, FileText, CircleCheck, CircleX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  ElectoralListMemberWithDetails,
  ThematicRole,
} from '@/types/electoral.types';
import { geocodeAddress } from '@/utils/geocoding';
import { OutputData } from '@editorjs/editorjs';
import EditorJSComponent from '@/components/EditorJSComponent';

interface EditMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ElectoralListMemberWithDetails | null;
  thematicRoles: ThematicRole[];
  onSuccess: () => void;
}
type AdminDocumentField =
  | 'identity_card_url'
  | 'cerfa_14997_04_url'
  | 'commune_attachment_proof_url';

const EMPTY_EDITOR_DATA: OutputData = {
  time: Date.now(),
  blocks: [],
  version: '2.28.0',
};

const parseBioToEditorData = (bio: string | null | undefined): OutputData => {
  if (!bio || !bio.trim()) return { ...EMPTY_EDITOR_DATA, time: Date.now() };
  try {
    const parsed = JSON.parse(bio);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks)) {
      return parsed as OutputData;
    }
  } catch {
    // fallback texte simple
  }
  return {
    time: Date.now(),
    blocks: [{ type: 'paragraph', data: { text: bio } }],
    version: '2.28.0',
  };
};

const ADMIN_DOCUMENTS_BUCKET = 'team-member-documents';
const ADMIN_DOCUMENT_FIELDS = [
  { key: 'identity_card_url' as const, label: "Carte d'identité" },
  { key: 'cerfa_14997_04_url' as const, label: 'Cerfa 14997-04' },
  {
    key: 'commune_attachment_proof_url' as const,
    label: "Preuve d'attache avec la commune",
  },
];

const EditMemberModal = ({
  open,
  onOpenChange,
  member,
  thematicRoles,
  onSuccess,
}: EditMemberModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOverField, setDragOverField] = useState<AdminDocumentField | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingResult, setGeocodingResult] = useState<{ formattedAddress: string; latitude: number; longitude: number } | null>(null);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [bioContent, setBioContent] = useState<OutputData>({ ...EMPTY_EDITOR_DATA });
  
  // Team member form data
  const [formData, setFormData] = useState({
    name: '',
    profession: '',
    bio: '',
    image: '',
    email: '',
    phone: '',
    national_elector_number: '',
    identity_card_url: '',
    cerfa_14997_04_url: '',
    commune_attachment_proof_url: '',
    gender: '',
    birth_date: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    education_level: '',
    max_engagement_level: '',
    vignoble_arrival_year: '',
  });

  // Roles data
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [primaryRoleId, setPrimaryRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (member && open) {
      setFormData({
        name: member.team_member.name || '',
        profession: member.team_member.profession || '',
        bio: member.team_member.bio || '',
        image: member.team_member.image || '',
        email: member.team_member.email || '',
        phone: member.team_member.phone || '',
        national_elector_number: member.team_member.national_elector_number || '',
        identity_card_url: member.team_member.identity_card_url || '',
        cerfa_14997_04_url: member.team_member.cerfa_14997_04_url || '',
        commune_attachment_proof_url: member.team_member.commune_attachment_proof_url || '',
        gender: member.team_member.gender || '',
        birth_date: member.team_member.birth_date || '',
        address: member.team_member.address || '',
        latitude: member.team_member.latitude || null,
        longitude: member.team_member.longitude || null,
        education_level: member.team_member.education_level || '',
        max_engagement_level: member.team_member.max_engagement_level || '',
        vignoble_arrival_year: member.team_member.vignoble_arrival_year?.toString() || '',
      });
      setBioContent(parseBioToEditorData(member.team_member.bio));

      // Réinitialiser les états de géocodification
      setGeocodingResult(null);
      setGeocodingError(null);

      const roleIds = new Set(member.roles.map((r) => r.thematic_role.id));
      setSelectedRoles(roleIds);

      const primaryRole = member.roles.find((r) => r.is_primary);
      setPrimaryRoleId(primaryRole?.thematic_role.id || null);
    }
  }, [member, open]);

  // Géocodification automatique de l'adresse avec debounce
  useEffect(() => {
    if (!formData.address || formData.address.trim().length === 0) {
      setFormData(prev => ({ ...prev, latitude: null, longitude: null }));
      setGeocodingResult(null);
      setGeocodingError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setGeocoding(true);
      setGeocodingError(null);
      setGeocodingResult(null);
      
      try {
        const result = await geocodeAddress(formData.address);
        if (result) {
          setFormData(prev => ({
            ...prev,
            latitude: result.latitude,
            longitude: result.longitude,
          }));
          setGeocodingResult({
            formattedAddress: result.formattedAddress,
            latitude: result.latitude,
            longitude: result.longitude,
          });
          setGeocodingError(null);
        } else {
          setFormData(prev => ({
            ...prev,
            latitude: null,
            longitude: null,
          }));
          setGeocodingResult(null);
          setGeocodingError('Aucun résultat trouvé pour cette adresse');
        }
      } catch (error: any) {
        setFormData(prev => ({
          ...prev,
          latitude: null,
          longitude: null,
        }));
        setGeocodingResult(null);
        setGeocodingError(error.message || 'Erreur lors de la géocodification');
      } finally {
        setGeocoding(false);
      }
    }, 1000); // Debounce de 1 seconde

    return () => clearTimeout(timeoutId);
  }, [formData.address]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erreur',
        description: 'Le fichier doit être une image.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erreur',
        description: "L'image ne doit pas dépasser 5MB.",
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Supprimer l'ancienne image si elle existe
      if (formData.image && formData.image.includes('team-members')) {
        const oldImagePath = formData.image.split('/').pop();
        if (oldImagePath) {
          await supabase.storage.from('team-members').remove([oldImagePath]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('team-members')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('team-members').getPublicUrl(fileName);

      setFormData({ ...formData, image: data.publicUrl });
      toast({
        title: 'Image téléchargée',
        description: "L'image a été téléchargée avec succès.",
      });
    } catch (error) {
      console.error("Erreur lors du téléchargement de l'image:", error);
      toast({
        title: 'Erreur',
        description: "Impossible de télécharger l'image.",
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image: '' });
  };

  const uploadAdminDocumentFile = async (
    file: File,
    field: AdminDocumentField
  ) => {
    if (!file || !member) return;

    setUploading(true);
    try {
      if (formData[field]) {
        await supabase.storage.from(ADMIN_DOCUMENTS_BUCKET).remove([formData[field]]);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${member.team_member_id}/${field}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(ADMIN_DOCUMENTS_BUCKET)
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      setFormData((prev) => ({ ...prev, [field]: fileName }));
      toast({
        title: 'Document téléchargé',
        description: 'Le document a été enregistré.',
      });
    } catch (error) {
      console.error('Erreur lors du téléchargement du document:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de téléverser le document.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setDragOverField(null);
    }
  };

  const uploadAdminDocument = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: AdminDocumentField
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAdminDocumentFile(file, field);
    e.target.value = '';
  };

  const removeAdminDocument = (
    field: AdminDocumentField
  ) => {
    setFormData((prev) => ({ ...prev, [field]: '' }));
  };

  const handleDocumentDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    field: AdminDocumentField
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadAdminDocumentFile(file, field);
  };

  const openAdminDocument = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(ADMIN_DOCUMENTS_BUCKET)
        .createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error("Erreur lors de l'ouverture du document:", error);
      toast({
        title: 'Erreur',
        description: "Impossible d'ouvrir le document.",
        variant: 'destructive',
      });
    }
  };

  const handleBioChange = useCallback((data: OutputData) => {
    setBioContent(data);
  }, []);

  const toggleRole = (roleId: string) => {
    const newSelectedRoles = new Set(selectedRoles);
    if (newSelectedRoles.has(roleId)) {
      newSelectedRoles.delete(roleId);
      if (primaryRoleId === roleId) {
        setPrimaryRoleId(null);
      }
    } else {
      newSelectedRoles.add(roleId);
    }
    setSelectedRoles(newSelectedRoles);
  };

  const setPrimaryRole = (roleId: string) => {
    if (selectedRoles.has(roleId)) {
      setPrimaryRoleId(roleId);
    }
  };

  const handleSubmit = async () => {
    if (!member) return;

    if (!formData.name.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom est requis.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const serializedBio =
        bioContent.blocks.length > 0 ? JSON.stringify(bioContent) : null;

      // 1. Mettre à jour le team_member
      const updateData: Record<string, any> = {
        name: formData.name.trim(),
        profession: formData.profession?.trim() || null,
        bio: serializedBio,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        national_elector_number: formData.national_elector_number?.trim() || null,
        identity_card_url: formData.identity_card_url?.trim() || null,
        cerfa_14997_04_url: formData.cerfa_14997_04_url?.trim() || null,
        commune_attachment_proof_url: formData.commune_attachment_proof_url?.trim() || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        address: formData.address?.trim() || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        education_level: formData.education_level || null,
        max_engagement_level: formData.max_engagement_level || null,
        vignoble_arrival_year: formData.vignoble_arrival_year ? parseInt(formData.vignoble_arrival_year) : null,
      };

      // Ne mettre à jour l'image que si elle a été modifiée
      const currentImage = member.team_member.image || '';
      const newImage = formData.image || '';
      if (newImage !== currentImage) {
        updateData.image = formData.image || null;
      }

      const { error: updateMemberError } = await supabase
        .from('team_members')
        .update(updateData)
        .eq('id', member.team_member_id);

      if (updateMemberError) throw updateMemberError;

      // 2. Supprimer les anciens rôles
      const { error: deleteRolesError } = await supabase
        .from('electoral_member_roles')
        .delete()
        .eq('electoral_list_member_id', member.id);

      if (deleteRolesError) throw deleteRolesError;

      // 3. Ajouter les nouveaux rôles
      if (selectedRoles.size > 0) {
        const rolesToInsert = Array.from(selectedRoles).map((roleId) => ({
          electoral_list_member_id: member.id,
          thematic_role_id: roleId,
          is_primary: roleId === primaryRoleId,
        }));

        const { error: insertRolesError } = await supabase
          .from('electoral_member_roles')
          .insert(rolesToInsert);

        if (insertRolesError) throw insertRolesError;
      }

      toast({
        title: 'Membre mis à jour',
        description: 'Les informations du membre ont été mises à jour avec succès.',
      });

      onOpenChange(false);
      // Petit délai pour laisser le modal se fermer avant de recharger
      setTimeout(() => {
        onSuccess();
      }, 100);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le membre.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Modifier {member.team_member.name} - Position {member.position}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="roles">Rôles thématiques</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">
                    Nom complet <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Prénom NOM"
                  />
                </div>

                <div>
                  <Label htmlFor="profession">Profession</Label>
                  <Input
                    id="profession"
                    value={formData.profession}
                    onChange={(e) =>
                      setFormData({ ...formData, profession: e.target.value })
                    }
                    placeholder="ex: Enseignant·e, Ingénieur·e..."
                  />
                </div>

                <div>
                  <Label htmlFor="gender">Genre</Label>
                  <Select
                    value={formData.gender || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value || '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="femme">Femme</SelectItem>
                      <SelectItem value="homme">Homme</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="birth_date">Date de naissance</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_date: e.target.value })
                    }
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Optionnelle. L'âge est utilise comme critere de conformite dans l'analyse.
                  </p>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="06 12 34 56 78"
                  />
                </div>

                <div>
                  <Label htmlFor="national_elector_number">Numéro national d'électeur</Label>
                  <Input
                    id="national_elector_number"
                    value={formData.national_elector_number}
                    onChange={(e) =>
                      setFormData({ ...formData, national_elector_number: e.target.value })
                    }
                    placeholder="Numéro sur la carte électorale"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Optionnel, utilisé pour l'export XLSX de la liste
                  </p>
                </div>

                <div>
                  <Label htmlFor="address">
                    Adresse postale
                    {geocoding && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                        Géocodification en cours...
                      </span>
                    )}
                    {geocodingResult && !geocoding && (
                      <span className="ml-2 text-sm text-green-600">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        Géocodifiée
                      </span>
                    )}
                    {geocodingError && !geocoding && (
                      <span className="ml-2 text-sm text-red-600">
                        Erreur
                      </span>
                    )}
                  </Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Rue, Code postal, Ville"
                    rows={2}
                  />
                  {geocodingResult && !geocoding && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-medium text-green-800 mb-1">
                        ✓ Adresse géocodifiée avec succès
                      </div>
                      <div className="text-xs text-green-700 mb-2">
                        {geocodingResult.formattedAddress}
                      </div>
                      <div className="text-xs text-green-600 space-x-4">
                        <span>Lat: {geocodingResult.latitude.toFixed(6)}</span>
                        <span>Lng: {geocodingResult.longitude.toFixed(6)}</span>
                      </div>
                    </div>
                  )}
                  {geocodingError && !geocoding && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-sm font-medium text-red-800">
                        ⚠ {geocodingError}
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        Vérifiez que l'adresse est correcte et complète
                      </div>
                    </div>
                  )}
                  {!geocodingResult && !geocodingError && !geocoding && (
                    <p className="text-sm text-muted-foreground mt-1">
                      La latitude et longitude seront calculées automatiquement après la saisie
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="education_level">Niveau d'étude</Label>
                  <Select
                    value={formData.education_level || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, education_level: value || '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brevet">Brevet / Fin de collège</SelectItem>
                      <SelectItem value="cap_bep">CAP / BEP</SelectItem>
                      <SelectItem value="bac_general">Bac général</SelectItem>
                      <SelectItem value="bac_technologique">Bac technologique</SelectItem>
                      <SelectItem value="bac_professionnel">Bac professionnel</SelectItem>
                      <SelectItem value="bac_plus_1_2">Bac +1 / Bac +2 (BTS, DUT, DEUG)</SelectItem>
                      <SelectItem value="bac_plus_3">Bac +3 (Licence, Licence pro)</SelectItem>
                      <SelectItem value="bac_plus_4_5">Bac +4 / Bac +5 (Master, Grandes Écoles)</SelectItem>
                      <SelectItem value="bac_plus_6_plus">Bac +6 et plus (Doctorat, HDR…)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="max_engagement_level">Niveau d'engagement max envisagé sur la liste</Label>
                  <Select
                    value={formData.max_engagement_level || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, max_engagement_level: value || '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positions_1_8">8 premières places</SelectItem>
                      <SelectItem value="positions_9_21">Places 9 à 21</SelectItem>
                      <SelectItem value="positions_22_29">Places 22 à 29</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Si la position sur la liste est supérieure, la carte sera surlignée en rouge. Si inférieure ou égale, en bleu.
                  </p>
                </div>

                <div>
                  <Label htmlFor="vignoble_arrival_year">Année d'arrivée dans le vignoble</Label>
                  <Input
                    id="vignoble_arrival_year"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={formData.vignoble_arrival_year || ''}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        vignoble_arrival_year: e.target.value 
                      })
                    }
                    placeholder="Ex: 2015"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Année d'arrivée dans le vignoble nantais (optionnel)
                  </p>
                </div>

                <div>
                  <Label htmlFor="bio">Biographie</Label>
                  <div className="mt-2">
                    <EditorJSComponent
                      value={bioContent}
                      onChange={handleBioChange}
                      placeholder="Présentez-vous en quelques mots... (gras, italique, listes...)"
                      className="max-h-[420px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Photo (optionnelle)</Label>
                {formData.image ? (
                  <div className="relative mt-2">
                    <img
                      src={formData.image}
                      alt="Photo du membre"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mt-2">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <span className="text-brand hover:text-brand/80">
                          Télécharger une image
                        </span>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">
                        PNG, JPG jusqu'à 5MB
                      </p>
                    </div>
                  </div>
                )}
                {uploading && (
                  <div className="mt-4 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-brand mr-2" />
                    <span className="text-sm">Téléchargement en cours...</span>
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <Label>Démarches administratives</Label>
                  {ADMIN_DOCUMENT_FIELDS.map((doc) => {
                    const currentPath = formData[doc.key];
                    return (
                      <div
                        key={doc.key}
                        className={`rounded-lg border p-3 space-y-2 transition-colors ${
                          dragOverField === doc.key ? 'border-brand bg-brand/5' : ''
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverField(doc.key);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverField(doc.key);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverField((prev) => (prev === doc.key ? null : prev));
                        }}
                        onDrop={(e) => handleDocumentDrop(e, doc.key)}
                      >
                        <div className="flex items-center gap-2">
                          {currentPath ? (
                            <CircleCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <CircleX className="h-4 w-4 text-red-600" />
                          )}
                          <p className="text-sm font-medium">{doc.label}</p>
                        </div>
                        {currentPath ? (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openAdminDocument(currentPath)}
                              className="text-sm text-brand underline truncate text-left"
                            >
                              {currentPath.split('/').pop() || 'Voir le document'}
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removeAdminDocument(doc.key)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Retirer
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Aucun document téléversé</p>
                        )}
                        <Label
                          htmlFor={`modal-upload-${doc.key}`}
                          className="inline-flex items-center gap-2 cursor-pointer text-sm text-brand hover:text-brand/80"
                        >
                          <FileText className="h-4 w-4" />
                          Téléverser
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Glissez-deposez un fichier ici ou cliquez sur "Televerser".
                        </p>
                        <Input
                          id={`modal-upload-${doc.key}`}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => uploadAdminDocument(e, doc.key)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez les rôles thématiques pour ce membre. Vous pouvez en
              sélectionner plusieurs et désigner un rôle comme principal.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {thematicRoles.map((role) => {
                const isSelected = selectedRoles.has(role.id);
                const isPrimary = primaryRoleId === role.id;

                return (
                  <div
                    key={role.id}
                    className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-brand bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleRole(role.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{role.name}</h4>
                          {isPrimary && (
                            <Badge variant="default">Principal</Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {role.description}
                          </p>
                        )}
                      </div>
                      {isSelected && !isPrimary && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrimaryRole(role.id);
                          }}
                        >
                          Définir comme principal
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading || uploading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditMemberModal;


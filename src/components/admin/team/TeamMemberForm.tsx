import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, X, MapPin, FileText, CircleCheck, CircleX } from 'lucide-react';
import { Routes } from '@/routes';
import type { TeamMember, TeamMemberInsert, TeamMemberUpdate } from '@/types/electoral.types';
import { geocodeAddress } from '@/utils/geocoding';
import { OutputData } from '@editorjs/editorjs';
import EditorJSComponent from '@/components/EditorJSComponent';

interface TeamMemberFormProps {
  memberId?: string;
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
  {
    key: 'identity_card_url' as const,
    label: "Carte d'identité",
  },
  {
    key: 'cerfa_14997_04_url' as const,
    label: 'Cerfa 14997-04',
  },
  {
    key: 'commune_attachment_proof_url' as const,
    label: "Preuve d'attache avec la commune",
  },
];

const TeamMemberForm = ({ memberId }: TeamMemberFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingResult, setGeocodingResult] = useState<{ formattedAddress: string; latitude: number; longitude: number } | null>(null);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [dragOverField, setDragOverField] = useState<AdminDocumentField | null>(null);
  const [bioContent, setBioContent] = useState<OutputData>({ ...EMPTY_EDITOR_DATA });
  const [formData, setFormData] = useState<Partial<TeamMember>>({
    name: '',
    role: '',
    profession: '',
    bio: '',
    image: '',
    email: '',
    phone: '',
    national_elector_number: '',
    identity_card_url: null,
    cerfa_14997_04_url: null,
    commune_attachment_proof_url: null,
    gender: null,
    birth_date: null,
    is_board_member: false,
    is_elected: false,
    address: null,
    latitude: null,
    longitude: null,
    education_level: null,
    max_engagement_level: null,
    vignoble_arrival_year: null,
  });

  useEffect(() => {
    if (memberId) {
      fetchMember();
    }
  }, [memberId]);

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
        const result = await geocodeAddress(formData.address!);
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

  const fetchMember = async () => {
    if (!memberId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('id', memberId)
        .single();

      if (error) throw error;
      setFormData(data);
      setBioContent(parseBioToEditorData(data.bio));
    } catch (error) {
      console.error('Erreur lors de la récupération du membre:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de récupérer les informations du membre.',
        variant: 'destructive',
      });
      navigate(`${Routes.ADMIN_TEAM}?tab=team`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erreur',
        description: 'Le fichier doit être une image.',
        variant: 'destructive',
      });
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erreur',
        description: 'L\'image ne doit pas dépasser 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Supprimer l'ancienne image si elle existe
      if (formData.image) {
        const oldImagePath = formData.image.split('/').pop();
        if (oldImagePath) {
          await supabase.storage
            .from('team-members')
            .remove([oldImagePath]);
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
        description: 'L\'image a été téléchargée avec succès.',
      });
    } catch (error) {
      console.error('Erreur lors du téléchargement de l\'image:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de télécharger l\'image.',
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
    if (!file) return;

    setUploading(true);
    try {
      if (formData[field]) {
        const oldPath = formData[field];
        if (oldPath) {
          await supabase.storage.from(ADMIN_DOCUMENTS_BUCKET).remove([oldPath]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const safeMemberId = memberId || 'draft';
      const fileName = `${safeMemberId}/${field}/${Date.now()}-${Math.random()
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
    setFormData((prev) => ({ ...prev, [field]: null }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name?.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom est requis.',
        variant: 'destructive',
      });
      return;
    }

    const serializedBio =
      bioContent.blocks.length > 0 ? JSON.stringify(bioContent) : null;

    setLoading(true);
    try {
      if (memberId) {
        // Mise à jour
        const updateData: TeamMemberUpdate = {
          name: formData.name,
          role: formData.role || null,
          profession: formData.profession || null,
          bio: serializedBio,
          image: formData.image || null,
          email: formData.email || null,
          phone: formData.phone || null,
          national_elector_number: formData.national_elector_number || null,
          identity_card_url: formData.identity_card_url || null,
          cerfa_14997_04_url: formData.cerfa_14997_04_url || null,
          commune_attachment_proof_url: formData.commune_attachment_proof_url || null,
          gender: formData.gender || null,
          birth_date: formData.birth_date || null,
          is_board_member: formData.is_board_member,
          is_elected: formData.is_elected,
          address: formData.address || null,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          education_level: formData.education_level || null,
          max_engagement_level: formData.max_engagement_level || null,
          vignoble_arrival_year: formData.vignoble_arrival_year || null,
        };

        const { error } = await supabase
          .from('team_members')
          .update(updateData)
          .eq('id', memberId);

        if (error) throw error;

        toast({
          title: 'Membre mis à jour',
          description: 'Le membre a été mis à jour avec succès.',
        });
      } else {
        // Création
        const insertData: TeamMemberInsert = {
          name: formData.name!,
          role: formData.role || null,
          profession: formData.profession || null,
          bio: serializedBio,
          image: formData.image || null,
          email: formData.email || null,
          phone: formData.phone || null,
          national_elector_number: formData.national_elector_number || null,
          identity_card_url: formData.identity_card_url || null,
          cerfa_14997_04_url: formData.cerfa_14997_04_url || null,
          commune_attachment_proof_url: formData.commune_attachment_proof_url || null,
          gender: formData.gender || null,
          birth_date: formData.birth_date || null,
          is_board_member: formData.is_board_member || false,
          is_elected: formData.is_elected || false,
          address: formData.address || null,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          education_level: formData.education_level || null,
          max_engagement_level: formData.max_engagement_level || null,
          vignoble_arrival_year: formData.vignoble_arrival_year || null,
        };

        const { error } = await supabase
          .from('team_members')
          .insert(insertData);

        if (error) throw error;

        toast({
          title: 'Membre créé',
          description: 'Le membre a été créé avec succès.',
        });
      }

      navigate(`${Routes.ADMIN_TEAM}?tab=team`);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le membre.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && memberId) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  required
                />
              </div>

              <div>
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  value={formData.profession || ''}
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
                    setFormData({ ...formData, gender: value || null })
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
                  value={formData.birth_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, birth_date: e.target.value || null })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Optionnelle. L'âge est utilisé comme critère de conformité dans l'analyse.
                </p>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
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
                  value={formData.phone || ''}
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
                  value={formData.national_elector_number || ''}
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
                  value={formData.address || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value || null })
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
                    setFormData({ 
                      ...formData, 
                      education_level: (value || null) as 'brevet' | 'cap_bep' | 'bac_general' | 'bac_technologique' | 'bac_professionnel' | 'bac_plus_1_2' | 'bac_plus_3' | 'bac_plus_4_5' | 'bac_plus_6_plus' | null
                    })
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
                  value={formData.max_engagement_level || 'none'}
                  onValueChange={(value) =>
                    setFormData({ 
                      ...formData, 
                      max_engagement_level: (value === 'none' ? null : (value || null)) as 'positions_1_8' | 'positions_9_21' | 'positions_22_29' | null
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="positions_1_8">8 premières places</SelectItem>
                    <SelectItem value="positions_9_21">Places 9 à 21</SelectItem>
                    <SelectItem value="positions_22_29">Places 22 à 29</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Si la position sur la liste est supérieure, la carte sera surlignée en rouge. Si inférieure ou égale, en bleu. Les personnes avec "Aucun" ne seront pas affichées dans la liste électorale.
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
                      vignoble_arrival_year: e.target.value ? parseInt(e.target.value) : null 
                    })
                  }
                  placeholder="Ex: 2015"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Année d'arrivée dans le vignoble nantais (optionnel)
                </p>
              </div>
            </CardContent>
          </Card>

          
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Photo (optionnelle)</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.image ? (
                <div className="relative">
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Rôle dans l'association</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  placeholder="ex: Membre du collectif, Trésorier·e..."
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Le rôle dans le collectif (différent des rôles thématiques sur la liste)
                </p>
              </div>

              <div>
                <Label htmlFor="bio">Biographie</Label>
                <div className="mt-2">
                  <EditorJSComponent
                    value={bioContent}
                    onChange={handleBioChange}
                    placeholder="Présentez-vous en quelques mots... (gras, italique, listes...)"
                    className="max-h-[500px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Démarches administratives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ADMIN_DOCUMENT_FIELDS.map((doc) => {
                const currentPath = formData[doc.key];

                return (
                  <div
                    key={doc.key}
                    className={`rounded-lg border p-4 space-y-3 transition-colors ${
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
                      <Label className="text-sm font-medium">{doc.label}</Label>
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
                      <div className="text-xs text-muted-foreground">
                        Aucun document téléversé
                      </div>
                    )}

                    <div>
                      <Label
                        htmlFor={`upload-${doc.key}`}
                        className="inline-flex items-center gap-2 cursor-pointer text-sm text-brand hover:text-brand/80"
                      >
                        <FileText className="h-4 w-4" />
                        Téléverser
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Glissez-deposez un fichier ici ou cliquez sur "Televerser".
                      </p>
                      <Input
                        id={`upload-${doc.key}`}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => uploadAdminDocument(e, doc.key)}
                        className="hidden"
                        disabled={uploading}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`${Routes.ADMIN_TEAM}?tab=team`)}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={loading || uploading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </form>
  );
};

export default TeamMemberForm;


import React, { useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { MapPin, Users, TrendingUp, AlertCircle, Copy, Check } from 'lucide-react';
import JSZip from 'jszip';
import type { ElectoralPosition, ElectoralListMemberWithDetails } from '@/types/electoral.types';
import { useToast } from '@/components/ui/use-toast';

interface ElectoralListAnalysisProps {
  positions: ElectoralPosition[];
  onOpenEditModal: (member: ElectoralListMemberWithDetails) => void;
  onUpdateMemberCoordinates?: (memberId: string, latitude: number, longitude: number) => Promise<void>;
  getExpectedGenderForPosition?: (position: number) => 'femme' | 'homme' | null;
}

// Composant Map pour Google Maps
const Map: React.FC<{
  positions: ElectoralPosition[];
  center: { lat: number; lng: number };
  onMarkerDragEnd?: (memberId: string, latitude: number, longitude: number) => Promise<void>;
}> = ({ positions, center, onMarkerDragEnd }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [draggingMarker, setDraggingMarker] = useState<google.maps.Marker | null>(null);
  const [communePolygons, setCommunePolygons] = useState<google.maps.Polygon[]>([]);

  React.useEffect(() => {
    if (ref.current && !map) {
      const newMap = new window.google.maps.Map(ref.current, {
        center,
        zoom: 12,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
      setMap(newMap);
    }
  }, [ref, map, center]);

  // Charger les contours de la commune de Gétigné depuis le fichier KMZ
  React.useEffect(() => {
    if (!map) return;

    const loadCommuneContours = async () => {
      try {
        // Charger le fichier KMZ
        const response = await fetch('/getigne.kmz');
        if (!response.ok) {
          console.warn('Impossible de charger le fichier KMZ');
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // Décompresser le KMZ (c'est un ZIP)
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Trouver le fichier KML dans le ZIP (généralement nommé "doc.kml" ou similaire)
        const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
        if (!kmlFile) {
          console.warn('Aucun fichier KML trouvé dans le KMZ');
          return;
        }

        // Extraire et parser le KML
        const kmlContent = await zip.file(kmlFile)?.async('string');
        if (!kmlContent) {
          console.warn('Impossible d\'extraire le contenu KML');
          return;
        }

        // Parser le KML avec DOMParser
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        // Trouver tous les éléments Placemark avec des coordonnées
        const placemarks = kmlDoc.querySelectorAll('Placemark');
        const polygons: google.maps.Polygon[] = [];

        placemarks.forEach((placemark) => {
          // Chercher les coordonnées dans différents formats (Polygon, MultiGeometry, etc.)
          const coordinatesElements = placemark.querySelectorAll('coordinates');
          
          coordinatesElements.forEach((coordEl) => {
            const coordText = coordEl.textContent?.trim();
            if (!coordText) return;

            // Parser les coordonnées (format: "lng,lat,altitude" ou "lng,lat")
            const coordPairs = coordText
              .split(/\s+/)
              .filter(c => c.trim())
              .map(c => {
                const parts = c.split(',');
                return {
                  lng: parseFloat(parts[0]),
                  lat: parseFloat(parts[1]),
                };
              })
              .filter(c => !isNaN(c.lat) && !isNaN(c.lng));

            if (coordPairs.length > 0) {
              // Créer un polygone Google Maps
              const path = coordPairs.map(c => new google.maps.LatLng(c.lat, c.lng));
              
              const polygon = new google.maps.Polygon({
                paths: path,
                strokeColor: '#d97706', // Couleur orange pour correspondre au thème
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#d97706',
                fillOpacity: 0.15,
                map: map,
              });

              polygons.push(polygon);
            }
          });
        });

        setCommunePolygons(polygons);

        // Ajuster la vue de la carte pour inclure tous les polygones
        if (polygons.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          polygons.forEach(polygon => {
            const paths = polygon.getPath();
            paths.forEach((latLng) => {
              bounds.extend(latLng);
            });
          });
          map.fitBounds(bounds);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des contours de la commune:', error);
      }
    };

    loadCommuneContours();

    // Nettoyer les polygones lors du démontage
    return () => {
      setCommunePolygons(prev => {
        prev.forEach(polygon => {
          polygon.setMap(null);
        });
        return [];
      });
    };
  }, [map]);

  // Gestion des marqueurs
  React.useEffect(() => {
    if (!map) return;

    // Nettoyer les anciens marqueurs
    markers.forEach(marker => marker.setMap(null));
    
    const newMarkers: google.maps.Marker[] = [];

    positions.forEach(position => {
      if (position.member) {
        // Utiliser les coordonnées existantes ou la position par défaut de Gétigné
        const hasCoordinates = position.member.team_member.latitude && position.member.team_member.longitude;
        const markerPosition = hasCoordinates
          ? { 
              lat: position.member.team_member.latitude!, 
              lng: position.member.team_member.longitude! 
            }
          : center; // Position par défaut à Gétigné

        const marker = new google.maps.Marker({
          position: markerPosition,
          map,
          title: `${position.member.team_member.name} - Position ${position.position}`,
          draggable: true,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="22" fill="${hasCoordinates ? '#d97706' : '#9ca3af'}" stroke="white" stroke-width="4"/>
                <text x="25" y="32" font-size="18" font-weight="bold" text-anchor="middle" fill="white" dominant-baseline="middle">${position.position}</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(50, 50),
            anchor: new google.maps.Point(25, 25),
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px;">
              <strong>${position.member.team_member.name}</strong><br/>
              Position ${position.position}<br/>
              ${hasCoordinates ? '' : '<span style="color: #9ca3af; font-size: 12px;">Position par défaut (Gétigné)</span>'}
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        // Gérer le drag & drop
        marker.addListener('dragstart', () => {
          setDraggingMarker(marker);
        });

        marker.addListener('dragend', async (e: google.maps.MapMouseEvent) => {
          setDraggingMarker(null);
          if (onMarkerDragEnd && e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            
            // Mettre à jour l'icône pour indiquer qu'il a des coordonnées
            marker.setIcon({
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
                  <circle cx="25" cy="25" r="22" fill="#d97706" stroke="white" stroke-width="4"/>
                  <text x="25" y="32" font-size="18" font-weight="bold" text-anchor="middle" fill="white" dominant-baseline="middle">${position.position}</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(50, 50),
              anchor: new google.maps.Point(25, 25),
            });

            // Sauvegarder les nouvelles coordonnées
            try {
              await onMarkerDragEnd(position.member.team_member.id, newLat, newLng);
            } catch (error) {
              console.error('Erreur lors de la sauvegarde des coordonnées:', error);
              // Revenir à la position précédente en cas d'erreur
              marker.setPosition(markerPosition);
            }
          }
        });

        newMarkers.push(marker);
      }
    });

    setMarkers(newMarkers);
  }, [map, positions, center, onMarkerDragEnd]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
};

// Composant de rendu des statuts de chargement
const render = (status: Status) => {
  switch (status) {
    case Status.LOADING:
      return (
        <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto mb-2"></div>
            <p>Chargement de la carte...</p>
          </div>
        </div>
      );
    case Status.FAILURE:
      return (
        <div className="bg-red-50 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center text-red-500 p-4">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Erreur de chargement Google Maps</p>
          </div>
        </div>
      );
    default:
      return (
        <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>Chargement...</p>
          </div>
        </div>
      );
  }
};

const ElectoralListAnalysis = ({ positions, onOpenEditModal, onUpdateMemberCoordinates, getExpectedGenderForPosition }: ElectoralListAnalysisProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_TOKEN;
  const center = { lat: 47.07758188386521, lng: -1.2481294869163988 }; // Coordonnées exactes de Gétigné
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Calculer les statistiques
  const calculateStats = () => {
    // Ne compter que les membres assignés à une position (pas les non assignés)
    const assignedMembers = positions.filter(p => p.member !== null).map(p => p.member!);
    
    // Statistiques de parité actuelles
    const women = assignedMembers.filter(m => m.team_member.gender === 'femme').length;
    const men = assignedMembers.filter(m => m.team_member.gender === 'homme').length;
    const other = assignedMembers.filter(m => m.team_member.gender === 'autre' || !m.team_member.gender).length;
    
    const total = assignedMembers.length;
    const TARGET_TOTAL = 29;
    
    // Calculer combien de femmes et d'hommes manquent selon la règle de parité
    let missingWomen = 0;
    let missingMen = 0;
    
    if (getExpectedGenderForPosition) {
      // Pour chaque position de 1 à 29, vérifier quel genre est attendu
      for (let position = 1; position <= TARGET_TOTAL; position++) {
        const expectedGender = getExpectedGenderForPosition(position);
        const currentMember = positions.find(p => p.position === position)?.member;
        
        if (!currentMember) {
          // Position vide, on a besoin du genre attendu
          if (expectedGender === 'femme') {
            missingWomen++;
          } else if (expectedGender === 'homme') {
            missingMen++;
          }
        } else {
          // Position occupée, vérifier si le genre correspond
          const actualGender = currentMember.team_member.gender;
          if (expectedGender === 'femme' && actualGender !== 'femme') {
            // On a besoin d'une femme ici mais ce n'est pas une femme
            missingWomen++;
          } else if (expectedGender === 'homme' && actualGender !== 'homme') {
            // On a besoin d'un homme ici mais ce n'est pas un homme
            missingMen++;
          }
        }
      }
    } else {
      // Fallback si getExpectedGenderForPosition n'est pas fourni
      // Utiliser l'ancien calcul basé sur 50/50
      const idealWomen = Math.ceil(TARGET_TOTAL / 2); // 15 femmes
      const idealMen = Math.floor(TARGET_TOTAL / 2); // 14 hommes
      missingWomen = Math.max(0, idealWomen - women);
      missingMen = Math.max(0, idealMen - men);
    }

    // Calculer l'âge moyen
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

    const ages = assignedMembers
      .map(m => calculateAge(m.team_member.birth_date))
      .filter((age): age is number => age !== null);
    
    const averageAge = ages.length > 0 
      ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
      : null;

    // Statistiques par tranche d'âge avec répartition par genre (pour pyramide des âges)
    const ageRangesData: Array<{
      name: string;
      femmes: number;
      hommes: number;
      total: number;
    }> = [
      { name: '18-30 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '31-40 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '41-50 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '51-60 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '61+ ans', femmes: 0, hommes: 0, total: 0 },
    ];

    assignedMembers.forEach(m => {
      const age = calculateAge(m.team_member.birth_date);
      if (age === null) return;

      const gender = m.team_member.gender;
      let rangeIndex = -1;

      if (age >= 18 && age <= 30) {
        rangeIndex = 0;
      } else if (age >= 31 && age <= 40) {
        rangeIndex = 1;
      } else if (age >= 41 && age <= 50) {
        rangeIndex = 2;
      } else if (age >= 51 && age <= 60) {
        rangeIndex = 3;
      } else if (age >= 61) {
        rangeIndex = 4;
      }

      if (rangeIndex >= 0) {
        ageRangesData[rangeIndex].total++;
        if (gender === 'femme') {
          ageRangesData[rangeIndex].femmes++;
        } else if (gender === 'homme') {
          ageRangesData[rangeIndex].hommes++;
        }
      }
    });

    // Filtrer les tranches vides et préparer les données pour le graphique
    const ageRangeData = ageRangesData
      .filter(range => range.total > 0)
      .map(range => ({
        name: range.name,
        femmes: -range.femmes, // Négatif pour afficher à gauche (pyramide)
        hommes: range.hommes,  // Positif pour afficher à droite
        total: range.total,
      }));

    // Statistiques par niveau d'étude
    const educationLevels: Record<string, number> = {};
    assignedMembers.forEach(m => {
      const level = m.team_member.education_level || 'Non renseigné';
      educationLevels[level] = (educationLevels[level] || 0) + 1;
    });

    const educationData = Object.entries(educationLevels).map(([name, value]) => ({
      name: getEducationLabel(name),
      value,
    }));

    // Statistiques d'ancrage territorial (nombre d'années dans le vignoble)
    const currentYear = new Date().getFullYear();
    const territorialAnchorageData: Array<{
      name: string;
      femmes: number;
      hommes: number;
      total: number;
    }> = [
      { name: '0-5 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '6-10 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '11-15 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '16-20 ans', femmes: 0, hommes: 0, total: 0 },
      { name: '21+ ans', femmes: 0, hommes: 0, total: 0 },
    ];

    assignedMembers.forEach(m => {
      const arrivalYear = m.team_member.vignoble_arrival_year;
      if (!arrivalYear) return;

      const yearsInVignoble = currentYear - arrivalYear;
      const gender = m.team_member.gender;
      let rangeIndex = -1;

      if (yearsInVignoble >= 0 && yearsInVignoble <= 5) {
        rangeIndex = 0;
      } else if (yearsInVignoble >= 6 && yearsInVignoble <= 10) {
        rangeIndex = 1;
      } else if (yearsInVignoble >= 11 && yearsInVignoble <= 15) {
        rangeIndex = 2;
      } else if (yearsInVignoble >= 16 && yearsInVignoble <= 20) {
        rangeIndex = 3;
      } else if (yearsInVignoble >= 21) {
        rangeIndex = 4;
      }

      if (rangeIndex >= 0) {
        territorialAnchorageData[rangeIndex].total++;
        if (gender === 'femme') {
          territorialAnchorageData[rangeIndex].femmes++;
        } else if (gender === 'homme') {
          territorialAnchorageData[rangeIndex].hommes++;
        }
      }
    });

    // Filtrer les tranches vides et préparer les données pour le graphique
    const territorialAnchorageChartData = territorialAnchorageData
      .filter(range => range.total > 0)
      .map(range => ({
        name: range.name,
        femmes: -range.femmes, // Négatif pour afficher à gauche (pyramide)
        hommes: range.hommes,  // Positif pour afficher à droite
        total: range.total,
      }));

    // Identifier les fiches incomplètes
    const incompleteProfiles = assignedMembers
      .map(m => {
        const missingFields: Array<{ label: string; severity: 'required' | 'optional' }> = [];
        const memberAge = calculateAge(m.team_member.birth_date);

        // Critères obligatoires (rouge)
        if (!m.team_member.identity_card_url) {
          missingFields.push({ label: "Carte d'identité", severity: 'required' });
        }
        if (!m.team_member.cerfa_14997_04_url) {
          missingFields.push({ label: 'Cerfa 14997-04', severity: 'required' });
        }
        if (!m.team_member.commune_attachment_proof_url) {
          missingFields.push({ label: "Preuve d'attache avec la commune", severity: 'required' });
        }
        if (!m.team_member.profession || !m.team_member.profession.trim()) {
          missingFields.push({ label: 'Profession', severity: 'required' });
        }
        if (!m.team_member.bio || !m.team_member.bio.trim()) {
          missingFields.push({ label: 'Biographie', severity: 'required' });
        }
        if (memberAge === null) {
          missingFields.push({ label: 'Age (date de naissance)', severity: 'required' });
        } else if (memberAge < 18) {
          missingFields.push({ label: 'Age (18 ans minimum)', severity: 'required' });
        }

        // Critères complémentaires (orange)
        if (!m.team_member.address) {
          missingFields.push({ label: 'Adresse', severity: 'optional' });
        }
        if (!m.team_member.education_level) {
          missingFields.push({ label: "Niveau d'étude", severity: 'optional' });
        }
        
        return {
          member: m,
          position: positions.find(p => p.member?.team_member.id === m.team_member.id)?.position || 0,
          missingFields,
        };
      })
      .filter(p => p.missingFields.length > 0)
      .sort((a, b) => a.position - b.position);

    return {
      women,
      men,
      other,
      missingWomen,
      missingMen,
      averageAge,
      educationData,
      ageRangeData,
      territorialAnchorageChartData,
      total,
      incompleteProfiles,
    };
  };

  const getEducationLabel = (level: string): string => {
    const labels: Record<string, string> = {
      'brevet': 'Brevet / Fin de collège',
      'cap_bep': 'CAP / BEP',
      'bac_general': 'Bac général',
      'bac_technologique': 'Bac technologique',
      'bac_professionnel': 'Bac professionnel',
      'bac_plus_1_2': 'Bac +1 / Bac +2',
      'bac_plus_3': 'Bac +3',
      'bac_plus_4_5': 'Bac +4 / Bac +5',
      'bac_plus_6_plus': 'Bac +6 et plus',
      'Non renseigné': 'Non renseigné',
    };
    return labels[level] || level;
  };

  const stats = calculateStats();

  const buildMissingInfoText = () => {
    const explosiveLabels = new Set([
      "Carte d'identité",
      'Cerfa 14997-04',
      "Preuve d'attache avec la commune",
      'Biographie',
      'Age (date de naissance)',
      'Age (18 ans minimum)',
    ]);

    const lines: string[] = [];
    lines.push('Recapitulatif des pieces obligatoires - Liste electorale');
    lines.push('');

    const explosiveIssues = stats.incompleteProfiles
      .map((profile) => ({
        ...profile,
        explosiveMissing: profile.missingFields.filter((field) => explosiveLabels.has(field.label)),
      }))
      .filter((profile) => profile.explosiveMissing.length > 0)
      .sort((a, b) => a.position - b.position);

    if (explosiveIssues.length > 0) {
      lines.push('Personnes avec pieces/age manquants:');
      explosiveIssues.forEach((profile) => {
        lines.push(`- Position ${profile.position} - ${profile.member.team_member.name}`);
        profile.explosiveMissing.forEach((field) => {
          lines.push(`  - 🚨 ${field.label}`);
        });
      });
      lines.push('');
    } else {
      lines.push('Aucun element obligatoire manquant.');
      lines.push('');
    }

    const incompleteByMemberId = new Set(
      explosiveIssues.map((profile) => profile.member.team_member.id)
    );
    const assignedMembers = positions
      .filter((p) => p.member !== null)
      .map((p) => ({ position: p.position, member: p.member! }))
      .sort((a, b) => a.position - b.position);

    const fullyCompleteMembers = assignedMembers.filter(
      ({ member }) => !incompleteByMemberId.has(member.team_member.id)
    );

    if (fullyCompleteMembers.length > 0) {
      lines.push('Personnes tout niquel:');
      fullyCompleteMembers.forEach(({ position, member }) => {
        lines.push(`- ✅ Position ${position} - ${member.team_member.name}`);
      });
    }

    return lines.join('\n').trim();
  };

  const handleCopyMissingInfo = async () => {
    try {
      await navigator.clipboard.writeText(buildMissingInfoText());
      setCopied(true);
      toast({
        title: 'Copie reussie',
        description: 'Le recapitulatif des informations manquantes a ete copie.',
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Erreur lors de la copie:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de copier le recapitulatif.',
        variant: 'destructive',
      });
    }
  };

  const COLORS = [
    '#d97706', // brand
    '#059669', // green
    '#2563eb', // blue
    '#dc2626', // red
    '#7c3aed', // purple
    '#ea580c', // orange
    '#0891b2', // cyan
    '#be185d', // pink
    '#65a30d', // lime
    '#64748b', // gray
  ];

  const educationChartConfig = stats.educationData.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  const ageRangeChartConfig = {
    femmes: {
      label: 'Femmes',
      color: '#dc2626', // rouge
    },
    hommes: {
      label: 'Hommes',
      color: '#2563eb', // bleu
    },
  };

  return (
    <div className="space-y-6">
      {/* Première ligne : 3 colonnes sur très grand écran */}
      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {/* État de la liste - Première position */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                État de la liste
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyMissingInfo}
                title="Copier les informations manquantes"
                aria-label="Copier les informations manquantes"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Membres assignés</span>
                <span className="font-semibold">{stats.total} / 29</span>
              </div>
              {stats.total < 29 && (
                <div className="text-muted-foreground text-sm">
                  Il reste {29 - stats.total} personne(s) à assigner
                </div>
              )}
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Pour compléter la liste (29 personnes avec parité) :
              </p>
              {stats.missingWomen > 0 && (
                <div className="flex justify-between items-center text-red-600">
                  <span className="text-sm">Femmes à trouver</span>
                  <span className="font-semibold">{stats.missingWomen}</span>
                </div>
              )}
              {stats.missingMen > 0 && (
                <div className="flex justify-between items-center text-blue-600">
                  <span className="text-sm">Hommes à trouver</span>
                  <span className="font-semibold">{stats.missingMen}</span>
                </div>
              )}
              {stats.missingWomen === 0 && stats.missingMen === 0 && stats.total === 29 && (
                <div className="text-green-600 text-sm font-medium">
                  ✓ Liste complète et paritaire
                </div>
              )}
            </div>

            {/* Fiches incomplètes intégrées */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Fiches incomplètes</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Rouge : obligatoire, Orange : recommande
              </p>
              {stats.incompleteProfiles.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.incompleteProfiles.map((profile) => (
                    <div
                      key={profile.member.team_member.id}
                      className="border rounded-lg p-2 space-y-1 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => onOpenEditModal(profile.member)}
                    >
                      <div className="font-medium text-sm">
                        Position {profile.position} - {profile.member.team_member.name}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {profile.missingFields.map((field) => (
                          <span
                            key={`${profile.member.team_member.id}-${field.label}`}
                            className={`text-xs px-2 py-0.5 rounded ${
                              field.severity === 'required'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {field.label}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-brand">
                        Cliquer pour modifier →
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-green-600 text-sm">
                  ✓ Toutes les fiches sont complètes
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Graphique camembert - Niveau d'étude */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Répartition par niveau d'étude
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.educationData.length > 0 ? (
              <ChartContainer config={educationChartConfig} className="h-[300px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={stats.educationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.educationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Âge de la liste - Groupe âge moyen et pyramide */}
        <Card className="md:col-span-2 2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Âge de la liste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Âge moyen */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">Âge moyen</div>
              {stats.averageAge !== null ? (
                <div className="text-3xl font-bold text-brand">
                  {stats.averageAge} ans
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  Impossible de calculer (dates de naissance manquantes)
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Basé sur {positions.filter(p => p.member?.team_member.birth_date).length} membre(s)
              </p>
            </div>

            {/* Pyramide des âges */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">Pyramide des âges</div>
              {stats.ageRangeData.length > 0 ? (
                <ChartContainer config={ageRangeChartConfig} className="h-[250px]">
                  <BarChart
                    data={stats.ageRangeData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => Math.abs(value).toString()}
                    />
                    <YAxis dataKey="name" type="category" width={70} />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{data.name}</p>
                              <p className="text-sm text-red-600">
                                Femmes: {Math.abs(data.femmes)}
                              </p>
                              <p className="text-sm text-blue-600">
                                Hommes: {data.hommes}
                              </p>
                              <p className="text-sm font-semibold mt-1">
                                Total: {data.total}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="femmes" 
                      fill="#dc2626" 
                      name="Femmes"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar 
                      dataKey="hommes" 
                      fill="#2563eb" 
                      name="Hommes"
                      radius={[4, 0, 0, 4]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carte Google Maps et Ancrage territorial - 1 colonne normalement, 2 sur très grand écran */}
      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Répartition géographique
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="rounded-lg h-96 overflow-hidden">
            <Wrapper apiKey={apiKey} render={render}>
              <Map 
                positions={positions} 
                center={center} 
                onMarkerDragEnd={onUpdateMemberCoordinates}
              />
            </Wrapper>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {positions.filter(p => p.member?.team_member.latitude && p.member?.team_member.longitude).length} membre(s) avec une adresse géolocalisée
            </p>
            {positions.filter(p => p.member && (!p.member.team_member.latitude || !p.member.team_member.longitude)).length > 0 && (
              <p className="text-sm text-amber-600">
                {positions.filter(p => p.member && (!p.member.team_member.latitude || !p.member.team_member.longitude)).length} membre(s) affiché(s) à la position par défaut (Gétigné) - Déplacez les marqueurs pour les géolocaliser
              </p>
            )}
          </div>
          </CardContent>
        </Card>

        {/* Ancrage territorial */}
        <Card className="2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ancrage territorial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              Nombre d'années passées dans le vignoble nantais
            </div>
            {stats.territorialAnchorageChartData.length > 0 ? (
              <div className="w-full overflow-hidden">
                <ChartContainer config={ageRangeChartConfig} className="h-[350px] w-full">
                  <BarChart
                    data={stats.territorialAnchorageChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => Math.abs(value).toString()}
                    />
                    <YAxis dataKey="name" type="category" width={70} />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{data.name}</p>
                              <p className="text-sm text-red-600">
                                Femmes: {Math.abs(data.femmes)}
                              </p>
                              <p className="text-sm text-blue-600">
                                Hommes: {data.hommes}
                              </p>
                              <p className="text-sm font-semibold mt-1">
                                Total: {data.total}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="femmes" 
                      fill="#dc2626" 
                      name="Femmes"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar 
                      dataKey="hommes" 
                      fill="#2563eb" 
                      name="Hommes"
                      radius={[4, 0, 0, 4]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée disponible (années d'arrivée non renseignées)
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ElectoralListAnalysis;


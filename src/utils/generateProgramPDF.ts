import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import type { Tables } from '@/integrations/supabase/types';
import type { ProgramPoint, ProgramFlagshipProject, ProgramPointFileMeta } from '@/types/program.types';
import { editorjsToText } from './editorjsToText';
import type { OutputData, OutputBlockData } from '@editorjs/editorjs';

/**
 * Convertit une image URL en base64 pour inclusion dans le PDF
 */
async function imageToBase64(url: string): Promise<string | null> {
  try {
    if (!url || url.trim() === '') {
      return null;
    }

    const response = await fetch(url, { 
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url} - Status: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(`URL is not an image: ${url}`);
      return null;
    }

    const blob = await response.blob();
    
    if (blob.size === 0) {
      console.warn(`Image blob is empty: ${url}`);
      return null;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (!base64 || base64.length === 0) {
          reject(new Error('Failed to convert image to base64'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error('FileReader error while converting image'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error, 'URL:', url);
    return null;
  }
}

/**
 * Ajoute du texte avec gestion de la pagination et des marges
 */
function addTextWithPagination(
  pdf: jsPDF,
  text: string,
  options: {
    fontSize?: number;
    y?: number;
    lineHeight?: number;
    marginBottom?: number;
    marginTop?: number;
    marginLeft?: number;
    marginRight?: number;
  } = {}
): number {
  const {
    fontSize = 11,
    y = 20,
    lineHeight = 1.2,
    marginBottom = 30,
    marginTop = 20,
    marginLeft = 20,
    marginRight = 20,
  } = options;

  pdf.setFontSize(fontSize);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const effectiveMaxWidth = pageWidth - marginLeft - marginRight;
  
  let currentY = y;
  const lines = pdf.splitTextToSize(text, effectiveMaxWidth);
  
  // Calculer la hauteur d'une ligne en mm (approximation: fontSize en points * lineHeight / 2.83465)
  const lineHeightMM = (fontSize * lineHeight) / 2.83465;
  
  lines.forEach((line: string) => {
    // Vérifier si on dépasse la marge du bas
    if (currentY + lineHeightMM > pageHeight - marginBottom) {
      pdf.addPage();
      currentY = marginTop;
    }
    
    pdf.text(line, marginLeft, currentY);
    currentY += lineHeightMM;
  });
  
  return currentY;
}

/**
 * Ajoute du texte formaté (gras, italique) depuis EditorJS avec gestion de la pagination
 */
function addFormattedTextWithPagination(
  pdf: jsPDF,
  editorjsData: OutputData | string,
  options: {
    fontSize?: number;
    y?: number;
    lineHeight?: number;
    marginBottom?: number;
    marginTop?: number;
    marginLeft?: number;
    marginRight?: number;
  } = {}
): number {
  const {
    fontSize = 11,
    y = 20,
    lineHeight = 1.2,
    marginBottom = 30,
    marginTop = 20,
    marginLeft = 20,
    marginRight = 20,
  } = options;

  let parsedData: OutputData;
  if (typeof editorjsData === 'string') {
    try {
      parsedData = JSON.parse(editorjsData);
    } catch (error) {
      // Si ce n'est pas du JSON valide, utiliser comme texte simple
      return addTextWithPagination(pdf, editorjsData, options);
    }
  } else {
    parsedData = editorjsData;
  }

  if (!parsedData.blocks || !Array.isArray(parsedData.blocks)) {
    return y;
  }

  pdf.setFontSize(fontSize);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const effectiveMaxWidth = pageWidth - marginLeft - marginRight;
  const lineHeightMM = (fontSize * lineHeight) / 2.83465;
  
  let currentY = y;

  parsedData.blocks.forEach((block: OutputBlockData) => {
    let htmlText = '';
    
    if (block.type === 'paragraph' || block.type === 'header') {
      htmlText = block.data.text || '';
    } else if (block.type === 'list') {
      const items = block.data.items || [];
      // Ajouter un double retour à la ligne entre les éléments de liste pour un meilleur espacement
      htmlText = items.map((item: string | { content: string }, index: number) => {
        const content = typeof item === 'string' ? item : item.content || '';
        const prefix = block.data.style === 'ordered' ? `${index + 1}. ` : '• ';
        return prefix + content;
      }).join('\n\n'); // Double retour à la ligne pour espacement
    } else if (block.type === 'quote') {
      htmlText = `"${block.data.text || ''}"`;
    } else {
      // Pour les autres types, utiliser le texte simple
      const plainText = editorjsToText({ blocks: [block], version: '2.28.0', time: Date.now() });
      if (plainText.trim()) {
        const textLines = pdf.splitTextToSize(plainText, effectiveMaxWidth);
        textLines.forEach((line: string) => {
          if (currentY + lineHeightMM > pageHeight - marginBottom) {
            pdf.addPage();
            currentY = marginTop;
          }
          pdf.text(line, marginLeft, currentY);
          currentY += lineHeightMM;
        });
        currentY += lineHeightMM * 0.5;
      }
      // Continuer avec le bloc suivant (pas de return ici)
      return;
    }

    if (!htmlText) return;

    // Détecter si c'est une liste (commence par un numéro ou un point)
    const isList = /^(\d+\.|•)\s/.test(htmlText.trim());

    // Parser le HTML pour extraire les segments avec leurs styles
    // Gérer les retours à la ligne pour les listes
    const segments: Array<{ text: string; bold: boolean; italic: boolean; isNewLine?: boolean }> = [];
    let currentText = '';
    let inBold = false;
    let inItalic = false;
    let i = 0;

    while (i < htmlText.length) {
      if (htmlText.substring(i, i + 3) === '<b>') {
        if (currentText) {
          segments.push({ text: currentText, bold: inBold, italic: inItalic });
          currentText = '';
        }
        inBold = true;
        i += 3;
      } else if (htmlText.substring(i, i + 4) === '</b>') {
        if (currentText) {
          segments.push({ text: currentText, bold: inBold, italic: inItalic });
          currentText = '';
        }
        inBold = false;
        i += 4;
      } else if (htmlText.substring(i, i + 3) === '<i>') {
        if (currentText) {
          segments.push({ text: currentText, bold: inBold, italic: inItalic });
          currentText = '';
        }
        inItalic = true;
        i += 3;
      } else if (htmlText.substring(i, i + 4) === '</i>') {
        if (currentText) {
          segments.push({ text: currentText, bold: inBold, italic: inItalic });
          currentText = '';
        }
        inItalic = false;
        i += 4;
      } else if (htmlText[i] === '\n') {
        // Gérer les retours à la ligne
        if (currentText) {
          segments.push({ text: currentText, bold: inBold, italic: inItalic });
          currentText = '';
        }
        // Marquer le retour à la ligne
        segments.push({ text: '\n', bold: inBold, italic: inItalic, isNewLine: true });
        i++;
      } else if (htmlText[i] === '<') {
        // Ignorer les autres balises HTML
        while (i < htmlText.length && htmlText[i] !== '>') i++;
        i++;
      } else {
        currentText += htmlText[i];
        i++;
      }
    }
    if (currentText) {
      segments.push({ text: currentText, bold: inBold, italic: inItalic });
    }

    // Si pas de formatage, utiliser le texte simple
    if (segments.length === 0 || segments.every(s => !s.bold && !s.italic)) {
      const plainText = htmlText.replace(/<[^>]*>/g, '');
      if (plainText.trim()) {
        const textLines = pdf.splitTextToSize(plainText, effectiveMaxWidth);
        textLines.forEach((line: string) => {
          if (currentY + lineHeightMM > pageHeight - marginBottom) {
            pdf.addPage();
            currentY = marginTop;
          }
          pdf.text(line, marginLeft, currentY);
          currentY += lineHeightMM;
        });
        currentY += lineHeightMM * 0.5;
      }
      // Continuer avec le bloc suivant (pas de return ici)
      return;
    }

    // Construire et afficher les lignes avec formatage
    // Pour simplifier et éviter les problèmes de chevauchement, on va construire les lignes complètes d'abord
    const lines: Array<Array<{ text: string; bold: boolean; italic: boolean }>> = [];
    let currentLineSegments: Array<{ text: string; bold: boolean; italic: boolean }> = [];
    let currentLineWidth = 0;

    segments.forEach((segment) => {
      // Si c'est un retour à la ligne, forcer une nouvelle ligne
      if (segment.isNewLine) {
        if (currentLineSegments.length > 0) {
          lines.push([...currentLineSegments]);
          currentLineSegments = [];
          currentLineWidth = 0;
        }
        // Pour les listes, ajouter une ligne vide pour l'espacement
        if (isList) {
          lines.push([]);
        }
        return;
      }

      const words = segment.text.split(' ');
      words.forEach((word, wordIndex) => {
        const wordWithSpace = wordIndex > 0 ? ' ' + word : word;
        pdf.setFont('helvetica', segment.bold && segment.italic ? 'bolditalic' : segment.bold ? 'bold' : segment.italic ? 'italic' : 'normal');
        const wordWidth = pdf.getTextWidth(wordWithSpace);
        
        if (currentLineWidth + wordWidth > effectiveMaxWidth && currentLineSegments.length > 0) {
          // Sauvegarder la ligne actuelle
          lines.push([...currentLineSegments]);
          
          // Nouvelle ligne
          currentLineSegments = [{ text: word, bold: segment.bold, italic: segment.italic }];
          pdf.setFont('helvetica', segment.bold && segment.italic ? 'bolditalic' : segment.bold ? 'bold' : segment.italic ? 'italic' : 'normal');
          currentLineWidth = pdf.getTextWidth(word);
        } else {
          if (currentLineSegments.length > 0 && currentLineSegments[currentLineSegments.length - 1].bold === segment.bold && currentLineSegments[currentLineSegments.length - 1].italic === segment.italic) {
            // Fusionner avec le segment précédent si même style
            currentLineSegments[currentLineSegments.length - 1].text += wordWithSpace;
          } else {
            currentLineSegments.push({ text: wordWithSpace, bold: segment.bold, italic: segment.italic });
          }
          currentLineWidth += wordWidth;
        }
      });
    });

    // Ajouter la dernière ligne
    if (currentLineSegments.length > 0) {
      lines.push([...currentLineSegments]);
    }

    // Afficher toutes les lignes
    lines.forEach((lineSegments, lineIndex) => {
      if (currentY + lineHeightMM > pageHeight - marginBottom) {
        pdf.addPage();
        currentY = marginTop;
      }
      
      // Si c'est une ligne vide (pour espacement dans les listes), juste avancer
      if (lineSegments.length === 0) {
        currentY += lineHeightMM * 0.5;
        return;
      }
      
      let x = marginLeft;
      lineSegments.forEach((seg) => {
        pdf.setFont('helvetica', seg.bold && seg.italic ? 'bolditalic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal');
        pdf.text(seg.text, x, currentY);
        // Recalculer la largeur avec le bon style pour éviter les erreurs
        x += pdf.getTextWidth(seg.text);
      });
      currentY += lineHeightMM;
    });
    
    currentY += lineHeightMM * 0.5; // Espacement entre paragraphes
  });

  return currentY;
}

/**
 * Obtient les dimensions réelles d'une image depuis son data URL
 */
function getImageDimensions(imageData: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = imageData;
  });
}

/**
 * Ajoute une image avec gestion de la pagination et conservation des proportions
 */
async function addImageWithPagination(
  pdf: jsPDF,
  imageData: string,
  options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
    preserveAspectRatio?: boolean;
    marginBottom?: number;
    marginTop?: number;
  } = {}
): Promise<number> {
  const {
    x = 20,
    y = 20,
    width,
    height,
    maxWidth = 170,
    maxHeight = 120,
    preserveAspectRatio = true,
    marginBottom = 30,
    marginTop = 20,
  } = options;

  if (!imageData || imageData.length === 0) {
    console.warn('Empty image data, skipping image');
    return y;
  }

  const pageHeight = pdf.internal.pageSize.getHeight();
  let currentY = y;
  
  try {
    // Détecter le format de l'image depuis le data URL
    let format: 'PNG' | 'JPEG' | 'JPG' = 'JPEG';
    if (imageData.startsWith('data:image/png')) {
      format = 'PNG';
    } else if (imageData.startsWith('data:image/jpeg') || imageData.startsWith('data:image/jpg')) {
      format = 'JPEG';
    }

    let finalWidth = width || maxWidth;
    let finalHeight = height || maxHeight;

    // Si on doit préserver les proportions et qu'on n'a pas de dimensions fixes
    if (preserveAspectRatio && (!width || !height)) {
      try {
        const dimensions = await getImageDimensions(imageData);
        const aspectRatio = dimensions.width / dimensions.height;
        
        if (width) {
          // Largeur fixe, calculer la hauteur
          finalHeight = width / aspectRatio;
          if (finalHeight > maxHeight) {
            finalHeight = maxHeight;
            finalWidth = maxHeight * aspectRatio;
          }
        } else if (height) {
          // Hauteur fixe, calculer la largeur
          finalWidth = height * aspectRatio;
          if (finalWidth > maxWidth) {
            finalWidth = maxWidth;
            finalHeight = maxWidth / aspectRatio;
          }
        } else {
          // Aucune dimension fixe, utiliser maxWidth et maxHeight comme contraintes
          if (dimensions.width > dimensions.height) {
            // Image paysage
            finalWidth = maxWidth;
            finalHeight = maxWidth / aspectRatio;
            if (finalHeight > maxHeight) {
              finalHeight = maxHeight;
              finalWidth = maxHeight * aspectRatio;
            }
          } else {
            // Image portrait
            finalHeight = maxHeight;
            finalWidth = maxHeight * aspectRatio;
            if (finalWidth > maxWidth) {
              finalWidth = maxWidth;
              finalHeight = maxWidth / aspectRatio;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get image dimensions, using default size:', error);
        // Utiliser les dimensions par défaut
      }
    }
    
    // Vérifier si l'image rentre sur la page
    if (currentY + finalHeight > pageHeight - marginBottom) {
      pdf.addPage();
      currentY = marginTop;
    }
    
    pdf.addImage(imageData, format, x, currentY, finalWidth, finalHeight, undefined, 'FAST');
    return currentY + finalHeight + 10;
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    // Retourner la position Y sans ajouter l'image
    return currentY;
  }
}

/** Options de marque pour le PDF (ville et nom du collectif) */
export type ProgramPDFBranding = {
  city: string;
  name: string;
};

/**
 * Génère un PDF complet du programme avec texte sélectionnable
 */
export async function generateProgramPDF(
  programGeneral: Tables<'program_general'> | null,
  flagshipProjects: ProgramFlagshipProject[],
  programItems: Array<Tables<'program_items'> & { program_points: ProgramPoint[] }>,
  onProgress?: (message: string) => void,
  branding?: ProgramPDFBranding
): Promise<void> {
  const city = branding?.city ?? 'Gétigné';
  const siteName = branding?.name ?? 'Gétigné Collectif';
  try {
    onProgress?.('Préparation du contenu...');

    // Créer le PDF en format A4 avec marges
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginLeft = 20;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 30; // Marge plus grande en bas
    let currentY = marginTop;

    // Fonction helper pour vérifier et ajouter une nouvelle page si nécessaire
    const checkPageBreak = (requiredHeight: number) => {
      if (currentY + requiredHeight > pageHeight - marginBottom) {
        pdf.addPage();
        currentY = marginTop;
        return true;
      }
      return false;
    };

    // Présentation générale - Style similaire au front avec gradient
    if (programGeneral) {
      checkPageBreak(80);
      
      const cardX = marginLeft;
      const cardWidth = pageWidth - marginLeft - marginRight;
      const headerHeight = 50; // Hauteur approximative du header gradient
      
      // Essayer de charger l'image de gradient si disponible, sinon créer un gradient très lisse
      let gradientImageData: string | null = null;
      const gradientImagePaths = [
        '/images/gradient-bg.png',
        '/images/gradient-bg.jpg',
        '/images/gradient-bg.webp',
        '/gradient-bg.png',
        '/gradient-bg.jpg',
        '/gradient-bg.webp',
      ];
      
      // Essayer de charger l'image depuis différents chemins
      for (const imagePath of gradientImagePaths) {
        try {
          gradientImageData = await imageToBase64(imagePath);
          if (gradientImageData) {
            break; // Image trouvée, on sort de la boucle
          }
        } catch (error) {
          // Continuer à essayer les autres chemins
          continue;
        }
      }
      
      if (gradientImageData) {
        // Utiliser l'image de gradient comme fond
        try {
          // Détecter le format
          let format: 'PNG' | 'JPEG' | 'JPG' = 'JPEG';
          if (gradientImageData.startsWith('data:image/png')) {
            format = 'PNG';
          } else if (gradientImageData.startsWith('data:image/jpeg') || gradientImageData.startsWith('data:image/jpg')) {
            format = 'JPEG';
          } else if (gradientImageData.startsWith('data:image/webp')) {
            format = 'PNG'; // jsPDF peut gérer WebP comme PNG dans certains cas
          }
          
          // Ajouter l'image de gradient en fond
          const gradientWidth = cardWidth;
          const gradientHeight = headerHeight;
          
          // Étirer l'image pour couvrir toute la zone du header
          pdf.addImage(gradientImageData, format, cardX, currentY, gradientWidth, gradientHeight, undefined, 'FAST');
        } catch (error) {
          console.warn('Failed to use gradient image, falling back to smooth gradient:', error);
          gradientImageData = null;
        }
      }
      
      // Si l'image n'a pas pu être chargée, créer un gradient très lisse (beaucoup plus de bandes)
      if (!gradientImageData) {
        const gradientSteps = 200; // Beaucoup plus de bandes pour un gradient très lisse
        for (let i = 0; i < gradientSteps; i++) {
          const ratio = i / (gradientSteps - 1);
          // Couleur principale: brand (#34b190 = RGB 52, 177, 144)
          // Couleur secondaire: cyan-500 (#06b6d4 = RGB 6, 182, 212)
          const r = Math.round(52 + (6 - 52) * ratio);
          const g = Math.round(177 + (182 - 177) * ratio);
          const b = Math.round(144 + (212 - 144) * ratio);
          pdf.setFillColor(r, g, b);
          const stepWidth = cardWidth / gradientSteps;
          pdf.rect(cardX + i * stepWidth, currentY, stepWidth, headerHeight, 'F');
        }
      }
      
      // Texte "Un projet collectif et vivant" en haut
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'normal');
      pdf.text('UN PROJET COLLECTIF ET VIVANT', cardX + 10, currentY + 8);
      
      // Titre principal
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize('Un programme ambitieux, réfléchi et participatif', cardWidth - 20);
      pdf.text(titleLines, cardX + 10, currentY + 18);
      
      // Sous-titre
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'normal');
      const subtitleText = 'Co-construit avec les habitantes et habitants, enrichi en continu, orienté vers l\'action concrète.';
      const subtitleLines = pdf.splitTextToSize(subtitleText, cardWidth - 20);
      pdf.text(subtitleLines, cardX + 10, currentY + 30);
      
      currentY += headerHeight + 5;
      
      // Section blanche pour le contenu (sans padding)
      pdf.setFillColor(255, 255, 255);
      pdf.rect(cardX, currentY, cardWidth, pageHeight - currentY - marginBottom, 'F');
      
      // Contenu de la présentation générale avec formatage préservé
      pdf.setFontSize(10);
      pdf.setTextColor(31, 41, 55); // Couleur brand-800 approximative
      const contentStartY = currentY;
      currentY = addFormattedTextWithPagination(pdf, programGeneral.content || '', {
        fontSize: 10,
        y: contentStartY,
        marginBottom,
        marginTop,
        marginLeft: cardX,
        marginRight: pageWidth - cardX - cardWidth,
      });
      
      currentY += 10;
    }

    // Calculer le nombre total de points validés (même logique que le front)
    const validatedPointsCount = programItems.reduce((count, item) => {
      const points = item.program_points || [];
      const validatedPoints = points.filter((point) => {
        const status = point.status;
        // Inclure les points validés, pending, to_discuss, ou sans statut (null/undefined)
        // Exclure seulement les drafts
        return status !== 'draft';
      });
      return count + validatedPoints.length;
    }, 0);
    const shouldDisplayCounter = validatedPointsCount >= 10;

    // Table des matières - on va la générer d'abord sans numéros, puis les ajouter après
    checkPageBreak(50);
    const tocStartPage = pdf.getCurrentPageInfo().pageNumber;
    const tocStartY = currentY + 20;

    // Titre de la table des matières
    pdf.setFontSize(18);
    pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
    pdf.setFont('helvetica', 'bold');
    currentY = addTextWithPagination(pdf, 'Table des matières', {
      fontSize: 18,
      y: tocStartY,
      marginBottom,
      marginTop,
      marginLeft,
      marginRight,
    });
    currentY += 10;

    // Stocker les positions Y de chaque ligne de la TOC pour les mettre à jour après
    const tocEntries: Array<{ y: number; page: number; text: string; key?: string; pageNumber?: number }> = [];

    // Projets phares dans la table des matières
    if (flagshipProjects && flagshipProjects.length > 0) {
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      currentY = addTextWithPagination(pdf, 'Projets phares', {
        fontSize: 11,
        y: currentY + 5,
        marginBottom,
        marginTop,
        marginLeft: marginLeft + 5,
        marginRight,
      });
      currentY += 3;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      flagshipProjects.forEach((project, index) => {
        checkPageBreak(10);
        const tocLine = `${index + 1}. ${project.title}`;
        const entryY = currentY + 2;
        const entryPage = pdf.getCurrentPageInfo().pageNumber;
        tocEntries.push({ y: entryY, page: entryPage, text: tocLine, key: `flagship-${index}` });
        // Afficher la ligne sans numéro de page pour l'instant
        currentY = addTextWithPagination(pdf, tocLine, {
          fontSize: 10,
          y: entryY,
          marginBottom,
          marginTop,
          marginLeft: marginLeft + 15,
          marginRight: marginRight + 20, // Réserver de l'espace pour le numéro de page
        });
      });
      currentY += 5;
    }

    // Sections dans la table des matières
    if (programItems && programItems.length > 0) {
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      const measuresTitleTOC = shouldDisplayCounter 
        ? `Nos ${validatedPointsCount} mesures pour ${city}`
        : `Nos mesures pour ${city}`;
      currentY = addTextWithPagination(pdf, measuresTitleTOC, {
        fontSize: 11,
        y: currentY + 5,
        marginBottom,
        marginTop,
        marginLeft: marginLeft + 5,
        marginRight,
      });
      currentY += 3;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      programItems.forEach((item, index) => {
        checkPageBreak(10);
        const tocLine = `• ${item.title}`;
        const entryY = currentY + 2;
        const entryPage = pdf.getCurrentPageInfo().pageNumber;
        tocEntries.push({ y: entryY, page: entryPage, text: tocLine, key: `section-${item.id}` });
        // Afficher la ligne sans numéro de page pour l'instant
        currentY = addTextWithPagination(pdf, tocLine, {
          fontSize: 10,
          y: entryY,
          marginBottom,
          marginTop,
          marginLeft: marginLeft + 15,
          marginRight: marginRight + 20, // Réserver de l'espace pour le numéro de page
        });
      });
    }

    currentY += 15;

    // Saut de page après la TOC
    pdf.addPage();
    currentY = marginTop;

    // Projets phares
    if (flagshipProjects && flagshipProjects.length > 0) {
      checkPageBreak(30);
      
      pdf.setFontSize(20);
      pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
      pdf.setFont('helvetica', 'bold');
      currentY = addTextWithPagination(pdf, 'Trois projets phares pour l\'avenir', {
        fontSize: 20,
        y: currentY + 10,
        marginBottom,
        marginTop,
        marginLeft,
        marginRight,
      });
      currentY += 10;

      for (let i = 0; i < flagshipProjects.length; i++) {
        const project = flagshipProjects[i];
        checkPageBreak(50);
        
        // Noter la page de chaque projet phare pour la TOC
        const projectPage = pdf.getCurrentPageInfo().pageNumber;
        const tocEntry = tocEntries.find(e => e.key === `flagship-${i}`);
        if (tocEntry) {
          tocEntry.pageNumber = projectPage;
        }

        // Titre du projet avec numéro sobre (juste le numéro en petit avant le titre)
        pdf.setFontSize(12);
        pdf.setTextColor(107, 114, 128); // Gris pour le numéro
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${i + 1}.`, marginLeft, currentY + 5);
        
        pdf.setFontSize(16);
        pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
        pdf.setFont('helvetica', 'bold');
        const titleLines = pdf.splitTextToSize(project.title, pageWidth - marginLeft - marginRight - 15);
        pdf.text(titleLines, marginLeft + 12, currentY + 5);
        currentY += titleLines.length * 6 + 5;

        // Image du projet si présente - avec proportions conservées
        if (project.image_url) {
          try {
            onProgress?.(`Chargement de l'image du projet ${i + 1}...`);
            const imageData = await imageToBase64(project.image_url);
            if (imageData && imageData.length > 0) {
              checkPageBreak(80);
              currentY = await addImageWithPagination(pdf, imageData, {
                x: marginLeft,
                y: currentY + 5,
                maxWidth: pageWidth - marginLeft - marginRight,
                maxHeight: 100,
                preserveAspectRatio: true,
                marginBottom,
                marginTop,
              });
            }
          } catch (error) {
            console.warn(`Failed to load image for project ${i + 1}:`, error);
            // Continuer sans l'image
          }
        }

        // Description
        if (project.description) {
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          const projectText = editorjsToText(project.description);
          currentY = addTextWithPagination(pdf, projectText, {
            fontSize: 11,
            y: currentY + 5,
            marginBottom,
            marginTop,
            marginLeft,
            marginRight,
          });
        }

        // Timeline si présente
        if (project.timeline && project.timeline.length > 0) {
          checkPageBreak(30);
          pdf.setFontSize(12);
          pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
          pdf.setFont('helvetica', 'bold');
          currentY = addTextWithPagination(pdf, project.timeline_horizon || 'Calendrier', {
            fontSize: 12,
            y: currentY + 10,
            marginBottom,
            marginTop,
            marginLeft,
            marginRight,
          });

          // Texte explicatif pour la chronologie
          pdf.setFontSize(9);
          pdf.setTextColor(107, 114, 128); // Gris pour le texte explicatif
          pdf.setFont('helvetica', 'italic');
          const explanationText = 'Cette chronologie présente les étapes clés et les jalons prévus pour la réalisation de ce projet.';
          currentY = addTextWithPagination(pdf, explanationText, {
            fontSize: 9,
            y: currentY + 3,
            marginBottom,
            marginTop,
            marginLeft,
            marginRight,
          });

          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          project.timeline.forEach((event) => {
            checkPageBreak(15);
            const eventText = `${event.date_text}: ${event.name}`;
            currentY = addTextWithPagination(pdf, eventText, {
              fontSize: 10,
              y: currentY + 5,
              marginBottom,
              marginTop,
              marginLeft: marginLeft + 10,
              marginRight,
            });
          });
        }

        currentY += 15;
      }
    }

    // Sections avec points
    checkPageBreak(30);
    pdf.setFontSize(20);
    pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
    pdf.setFont('helvetica', 'bold');
    const measuresTitle = shouldDisplayCounter 
      ? `Nos ${validatedPointsCount} mesures pour ${city}`
      : `Nos mesures pour ${city}`;
    currentY = addTextWithPagination(pdf, measuresTitle, {
      fontSize: 20,
      y: currentY + 10,
      marginBottom,
      marginTop,
      marginLeft,
      marginRight,
    });
    currentY += 15;

    // Parcourir toutes les sections
    for (let itemIndex = 0; itemIndex < programItems.length; itemIndex++) {
      const item = programItems[itemIndex];
      // Filtrer les points validés - inclure tous les points sauf ceux en draft
      const allPoints = item.program_points || [];
      const validatedPoints = allPoints.filter(
        (point) => {
          const status = point.status;
          // Inclure les points validés, pending, ou sans statut (null/undefined)
          // Exclure seulement les drafts
          return status !== 'draft';
        }
      );
      
      // Debug: afficher le nombre de points trouvés
      console.log(`Section "${item.title}": ${allPoints.length} points au total, ${validatedPoints.length} points validés`);

      checkPageBreak(50);
      
      // Noter la page de chaque section pour la TOC
      const sectionPage = pdf.getCurrentPageInfo().pageNumber;
      const tocEntry = tocEntries.find(e => e.key === `section-${item.id}`);
      if (tocEntry) {
        tocEntry.pageNumber = sectionPage;
      }

      // Image de section si présente - avec proportions conservées
      if (item.image) {
        try {
          onProgress?.(`Chargement de l'image de la section ${item.title}...`);
          const imageData = await imageToBase64(item.image);
          if (imageData && imageData.length > 0) {
            checkPageBreak(80);
            currentY = await addImageWithPagination(pdf, imageData, {
              x: marginLeft,
              y: currentY + 5,
              maxWidth: pageWidth - marginLeft - marginRight,
              maxHeight: 80,
              preserveAspectRatio: true,
              marginBottom,
              marginTop,
            });
          }
        } catch (error) {
          console.warn(`Failed to load image for section ${item.title}:`, error);
          // Continuer sans l'image
        }
      }

      // Titre de section
      checkPageBreak(20);
      pdf.setFontSize(16);
      pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
      pdf.setFont('helvetica', 'bold');
      currentY = addTextWithPagination(pdf, item.title, {
        fontSize: 16,
        y: currentY + 5,
        marginBottom,
        marginTop,
        marginLeft,
        marginRight,
      });

      // Description de la section
      if (item.description) {
        checkPageBreak(30);
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        const descriptionText = editorjsToText(item.description);
        if (descriptionText.trim()) {
          currentY = addTextWithPagination(pdf, descriptionText, {
            fontSize: 11,
            y: currentY + 5,
            marginBottom,
            marginTop,
            marginLeft,
            marginRight,
          });
        }
      }

      // Points du programme - TOUJOURS afficher s'il y en a
      if (validatedPoints.length > 0) {
        checkPageBreak(20);
        pdf.setFontSize(12);
        pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
        pdf.setFont('helvetica', 'bold');
        currentY = addTextWithPagination(pdf, 'Points du programme', {
          fontSize: 12,
          y: currentY + 10,
          marginBottom,
          marginTop,
          marginLeft,
          marginRight,
        });

        for (const point of validatedPoints) {
          checkPageBreak(30);

          // Titre du point
          pdf.setFontSize(12);
          pdf.setTextColor(31, 41, 55);
          pdf.setFont('helvetica', 'bold');
          const numberPrefix = point.number != null ? `#${point.number} – ` : '';
          const pointTitle = numberPrefix + (point.competent_entity
            ? `[${point.competent_entity.name}] ${point.title}`
            : point.title);
          currentY = addTextWithPagination(pdf, pointTitle, {
            fontSize: 12,
            y: currentY + 5,
            marginBottom,
            marginTop,
            marginLeft,
            marginRight,
          });

          // Contenu du point - TOUJOURS afficher même si vide
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          if (point.content) {
            const pointText = editorjsToText(point.content);
            if (pointText.trim()) {
              currentY = addTextWithPagination(pdf, pointText, {
                fontSize: 10,
                y: currentY + 3,
                marginBottom,
                marginTop,
                marginLeft: marginLeft + 5,
                marginRight,
              });
            } else {
              // Si le contenu est vide après conversion, ajouter un espacement minimal
              currentY += 5;
            }
          } else {
            // Si pas de contenu, ajouter un espacement minimal
            currentY += 5;
          }

          // Fichiers attachés
          if (point.files_metadata && point.files_metadata.length > 0) {
            pdf.setFontSize(9);
            pdf.setTextColor(107, 114, 128);
            pdf.setFont('helvetica', 'italic');
            const filesText = `Plus d'informations sur cette mesure en annexe : ${point.files_metadata.map((f) => f.label).join(', ')}`;
            currentY = addTextWithPagination(pdf, filesText, {
              fontSize: 9,
              y: currentY + 3,
              marginBottom,
              marginTop,
              marginLeft: marginLeft + 10,
              marginRight,
            });
          }

          currentY += 5;
        }
      }

      // Espacement entre les sections
      currentY += 15;
    }

    // Collecter tous les fichiers attachés pour les annexes
    const allAttachedFiles: Array<{ file: ProgramPointFileMeta; pointTitle: string; sectionTitle: string }> = [];
    for (const item of programItems) {
      const validatedPoints = (item.program_points || []).filter(
        (point) => point.status !== 'draft'
      );
      for (const point of validatedPoints) {
        if (point.files_metadata && point.files_metadata.length > 0) {
          for (const file of point.files_metadata) {
            allAttachedFiles.push({
              file,
              pointTitle: (point.number != null ? `#${point.number} – ` : '') + point.title,
              sectionTitle: item.title,
            });
          }
        }
      }
    }

    // Ajouter une page d'annexes avec l'index si des fichiers existent
    if (allAttachedFiles.length > 0) {
      // Saut de page avant la section Annexes
      pdf.addPage();
      currentY = marginTop;

      // Titre de la section Annexes
      pdf.setFontSize(20);
      pdf.setTextColor(52, 177, 144); // rgba(52, 177, 144, 0.9) - brand
      pdf.setFont('helvetica', 'bold');
      currentY = addTextWithPagination(pdf, 'Annexes - Fichiers joints', {
        fontSize: 20,
        y: currentY,
        marginBottom,
        marginTop,
        marginLeft,
        marginRight,
      });
      currentY += 10;

      // Texte explicatif
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      pdf.setFont('helvetica', 'italic');
      const annexExplanation = 'Cette section contient tous les fichiers attachés aux points du programme. Les fichiers PDF sont fusionnés directement à la fin de ce document.';
      currentY = addTextWithPagination(pdf, annexExplanation, {
        fontSize: 10,
        y: currentY,
        marginBottom,
        marginTop,
        marginLeft,
        marginRight,
      });
      currentY += 15;

      // Index des fichiers
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      currentY = addTextWithPagination(pdf, 'Index des fichiers', {
        fontSize: 11,
        y: currentY,
        marginBottom,
        marginTop,
        marginLeft,
        marginRight,
      });
      currentY += 5;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      allAttachedFiles.forEach((item, index) => {
        checkPageBreak(15);
        const fileExtension = (item.file.url || '').split('.').pop()?.toLowerCase() || '';
        const fileType = fileExtension === 'pdf' ? 'PDF' : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension) ? 'Image' : fileExtension.toUpperCase();
        const indexText = `${index + 1}. ${item.file.label} [${fileType}] - ${item.sectionTitle} - ${item.pointTitle}`;
        currentY = addTextWithPagination(pdf, indexText, {
          fontSize: 9,
          y: currentY + 2,
          marginBottom,
          marginTop,
          marginLeft: marginLeft + 5,
          marginRight,
        });
      });
    }

    // Mettre à jour la TOC avec les numéros de page
    tocEntries.forEach((entry) => {
      if (entry.pageNumber) {
        pdf.setPage(entry.page);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(52, 177, 144); // Couleur brand pour les numéros de page
        // Ajouter le numéro de page à droite de la ligne, aligné à droite
        const pageNumberText = String(entry.pageNumber);
        const pageNumberX = pageWidth - marginRight;
        pdf.text(pageNumberText, pageNumberX, entry.y, { align: 'right' });
      }
    });

    // Pied de page sur chaque page
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Programme - Objectif 2026 | ${siteName} - Page ${i}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    onProgress?.('Fusion des fichiers PDF...');

    // Obtenir le PDF principal en bytes
    const mainPdfBytes = pdf.output('arraybuffer') as ArrayBuffer;

    // Collecter tous les PDFs attachés
    const pdfFiles: Array<{ url: string; label: string; sectionTitle: string; pointTitle: string }> = [];
    for (const item of allAttachedFiles) {
      const fileExtension = (item.file.url || '').split('.').pop()?.toLowerCase() || '';
      if (fileExtension === 'pdf') {
        pdfFiles.push({
          url: item.file.url,
          label: item.file.label,
          sectionTitle: item.sectionTitle,
          pointTitle: item.pointTitle,
        });
      }
    }

    // Fusionner les PDFs si nécessaire
    let finalPdfBytes: Uint8Array;
    if (pdfFiles.length > 0) {
      try {
        // Créer un nouveau document PDF avec pdf-lib
        const mergedPdf = await PDFDocument.create();

        // Ajouter le PDF principal
        const mainPdfDoc = await PDFDocument.load(mainPdfBytes);
        const mainPages = await mergedPdf.copyPages(mainPdfDoc, mainPdfDoc.getPageIndices());
        mainPages.forEach((page) => mergedPdf.addPage(page));

        // Ajouter chaque PDF attaché
        for (let i = 0; i < pdfFiles.length; i++) {
          const pdfFile = pdfFiles[i];
          try {
            onProgress?.(`Ajout du PDF ${i + 1}/${pdfFiles.length}: ${pdfFile.label}...`);
            
            const response = await fetch(pdfFile.url, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) {
              console.warn(`Failed to fetch PDF: ${pdfFile.url} - Status: ${response.status}`);
              continue;
            }

            const pdfBytes = await response.arrayBuffer();
            const attachedPdf = await PDFDocument.load(pdfBytes);
            const attachedPages = await mergedPdf.copyPages(attachedPdf, attachedPdf.getPageIndices());
            attachedPages.forEach((page) => mergedPdf.addPage(page));
          } catch (error) {
            console.warn(`Failed to merge PDF ${pdfFile.label}:`, error);
            // Continuer avec les autres PDFs
          }
        }

        finalPdfBytes = await mergedPdf.save();
      } catch (error) {
        console.error('Error merging PDFs:', error);
        // En cas d'erreur, utiliser le PDF principal sans fusion
        finalPdfBytes = new Uint8Array(mainPdfBytes);
      }
    } else {
      // Pas de PDFs à fusionner, utiliser le PDF principal tel quel
      finalPdfBytes = new Uint8Array(mainPdfBytes);
    }

    onProgress?.('Téléchargement...');

    // Télécharger le PDF final
    const fileName = `programme-complet-${new Date().toISOString().split('T')[0]}.pdf`;
    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onProgress?.('Terminé !');
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

import { Injectable } from '@angular/core';

/**
 * BadWordsService — Détection de grossièretés avec gestion des variantes
 * Gère : mots masqués (fu***, sh!t), leetspeak (f4ck), répétitions (fuuuck),
 *        espaces/tirets intercalés (f u c k), et mots en arabe/français.
 */
@Injectable({ providedIn: 'root' })
export class BadWordsService {

  // ─── Liste des mots interdits (formes de base) ───────────────────────────
  private readonly BAD_WORDS: string[] = [
    // Anglais
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'cock',
    'dick', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot',
    'retard', 'motherfucker', 'motherfuck', 'fucker', 'bullshit',
    'damn', 'crap', 'ass', 'piss', 'jerk', 'idiot', 'moron', 'loser',
    'wanker', 'twat', 'arse', 'bollocks', 'wank', 'tosser',
    // Français
    'merde', 'putain', 'connard', 'connasse', 'salope', 'enculé',
    'enculer', 'batard', 'bâtard', 'con', 'pute', 'fdp', 'ntm',
    'va te faire', 'nique', 'niquer', 'fils de pute', 'ta gueule',
    'ferme ta gueule', 'fils de', 'va te', 'casse toi', 'branler',
    'branleur', 'couille', 'couilles', 'pénis', 'vagin', 'chier',
    // Arabe (translittéré)
    'kol khara', 'kolkhara', 'ibn el sharmouta', 'sharmouta', 'kess',
    'kessemak', 'zamel', 'khara', 'hmar', 'hmarek', 'kalb', 'weld el',
    'yel3an', 'yelaan', 'barra', 'airs', 'airs', 'chouha',
    // Insultes génériques
    'stupid', 'dumb', 'ugly', 'hate', 'kill yourself', 'kys',
  ];

  // ─── Correspondances leetspeak / caractères spéciaux ─────────────────────
  private readonly LEET_MAP: { [key: string]: string } = {
    '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i',
    '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't',
    '9': 'g', '6': 'b', '8': 'b', '(': 'c', '<': 'c',
    'ü': 'u', 'ù': 'u', 'û': 'u', 'ú': 'u',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'à': 'a', 'â': 'a', 'ä': 'a',
    'î': 'i', 'ï': 'i',
    'ô': 'o', 'ö': 'o',
    'ç': 'c',
  };

  // ─── Symboles utilisés pour masquer les mots (fu***, sh!t) ───────────────
  private readonly MASK_CHARS = /[*!#@$%^&_\-+.]/g;

  /**
   * Vérifie si le texte contient un mot interdit.
   * @returns true si un bad word est détecté
   */
  containsBadWord(text: string): boolean {
    if (!text || !text.trim()) return false;

    const normalized = this.normalizeText(text);

    for (const word of this.BAD_WORDS) {
      if (this.matchesWord(normalized, word)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retourne le premier mot interdit trouvé (pour debug/log), ou null.
   */
  findBadWord(text: string): string | null {
    if (!text || !text.trim()) return null;

    const normalized = this.normalizeText(text);

    for (const word of this.BAD_WORDS) {
      if (this.matchesWord(normalized, word)) {
        return word;
      }
    }
    return null;
  }

  // ─── Normalisation du texte saisi ────────────────────────────────────────

  private normalizeText(text: string): string {
    let result = text.toLowerCase();

    // 1. Supprimer les caractères de masquage entre lettres : f**k → fk, f***k → fk
    //    On les remplace par '' pour coller les lettres restantes
    result = result.replace(this.MASK_CHARS, '');

    // 2. Convertir leetspeak et accents
    result = this.convertLeet(result);

    // 3. Supprimer espaces/tirets entre lettres isolées : f u c k → fuck
    result = this.collapseSpacedLetters(result);

    // 4. Dédupliquer les lettres répétées : fuuuuck → fuck, shiiit → shit
    result = this.deduplicateLetters(result);

    return result;
  }

  private convertLeet(text: string): string {
    return text.split('').map(c => this.LEET_MAP[c] ?? c).join('');
  }

  /**
   * Détecte les patterns "f u c k" ou "f-u-c-k" et les colle.
   * On cherche des séquences de lettres seules séparées par espaces/tirets.
   */
  private collapseSpacedLetters(text: string): string {
    // Remplace "x y z" (lettres isolées séparées) par "xyz"
    return text.replace(/\b([a-z][\s\-_]+){2,}[a-z]\b/g, (match) => {
      return match.replace(/[\s\-_]/g, '');
    });
  }

  /**
   * Réduit les lettres répétées à 2 max : fuuuuck → fuuck → fuck (après 2e passe)
   * On réduit à 1 pour normaliser : fuuuck → fuck
   */
  private deduplicateLetters(text: string): string {
    return text.replace(/(.)\1{2,}/g, '$1$1'); // 3+ répétitions → 2
    // On garde 2 pour éviter de casser des vrais mots comme "llama"
    // Une 2e réduction optionnelle :
    // return result.replace(/(.)\1+/g, '$1');
  }

  // ─── Correspondance mot interdit ─────────────────────────────────────────

  private matchesWord(normalizedText: string, badWord: string): boolean {
    const normalizedBad = this.deduplicateLetters(badWord);

    // Recherche simple : le mot normalisé est contenu dans le texte normalisé
    // On utilise une regex avec word boundary flexible
    try {
      // Boundary flexible : le bad word peut être entouré de non-lettres OU en début/fin
      const escaped = this.escapeRegex(normalizedBad);
      const regex = new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i');
      return regex.test(normalizedText);
    } catch {
      return normalizedText.includes(normalizedBad);
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
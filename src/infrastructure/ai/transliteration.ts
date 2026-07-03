/**
 * Deterministic Devanagari → Roman (Latin) transliteration guard.
 *
 * The personas must always answer in Roman-script Hinglish. Prompt rules push
 * the model in that direction but can never guarantee it — the model still
 * occasionally emits a stray Devanagari word. This module is the deterministic
 * safety net: it converts any Devanagari that reaches the output stream into
 * readable Roman script so the UI never renders देवनागरी.
 *
 * For text that is already fully Roman (the overwhelming majority of output)
 * this is a pass-through, so it does not alter the model's own Hinglish
 * spelling — it only rewrites the rare Devanagari fragments.
 *
 * The scheme is phonetic ITRANS-style with word-final schwa deletion (so
 * आप → "aap", not "aapa"). It is intentionally simple: perfect Hindi
 * transliteration is out of scope because this only ever touches leaked
 * fragments, not the primary reply.
 */

const DEVANAGARI_START = 0x0900;
const DEVANAGARI_END = 0x097f;

const VIRAMA = "\u094d"; // ्  halant — suppresses the inherent vowel
const NUKTA = "\u093c"; // ़
const ANUSVARA = "\u0902"; // ं
const CHANDRABINDU = "\u0901"; // ँ
const VISARGA = "\u0903"; // ः
const AVAGRAHA = "\u093d"; // ऽ
const DANDA = "\u0964"; // ।
const DOUBLE_DANDA = "\u0965"; // ॥
const OM = "\u0950"; // ॐ

const INDEPENDENT_VOWELS: Record<string, string> = {
  "\u0905": "a", // अ
  "\u0906": "aa", // आ
  "\u0907": "i", // इ
  "\u0908": "ii", // ई
  "\u0909": "u", // उ
  "\u090a": "uu", // ऊ
  "\u090b": "ri", // ऋ
  "\u0960": "ri", // ॠ
  "\u090c": "li", // ऌ
  "\u090e": "e", // ऎ
  "\u090f": "e", // ए
  "\u0910": "ai", // ऐ
  "\u0912": "o", // ऒ
  "\u0913": "o", // ओ
  "\u0914": "au", // औ
  "\u090d": "e", // ऍ
  "\u0911": "o", // ऑ
};

const MATRAS: Record<string, string> = {
  "\u093e": "aa", // ा
  "\u093f": "i", // ि
  "\u0940": "ii", // ी
  "\u0941": "u", // ु
  "\u0942": "uu", // ू
  "\u0943": "ri", // ृ
  "\u0944": "ri", // ॄ
  "\u0946": "e", // ॆ
  "\u0947": "e", // े
  "\u0948": "ai", // ै
  "\u094a": "o", // ॊ
  "\u094b": "o", // ो
  "\u094c": "au", // ौ
  "\u0945": "e", // ॅ
  "\u0949": "o", // ॉ
};

const CONSONANTS: Record<string, string> = {
  "\u0915": "k", // क
  "\u0916": "kh", // ख
  "\u0917": "g", // ग
  "\u0918": "gh", // घ
  "\u0919": "ng", // ङ
  "\u091a": "ch", // च
  "\u091b": "chh", // छ
  "\u091c": "j", // ज
  "\u091d": "jh", // झ
  "\u091e": "ny", // ञ
  "\u091f": "t", // ट
  "\u0920": "th", // ठ
  "\u0921": "d", // ड
  "\u0922": "dh", // ढ
  "\u0923": "n", // ण
  "\u0924": "t", // त
  "\u0925": "th", // थ
  "\u0926": "d", // द
  "\u0927": "dh", // ध
  "\u0928": "n", // न
  "\u0929": "n", // ऩ
  "\u092a": "p", // प
  "\u092b": "ph", // फ
  "\u092c": "b", // ब
  "\u092d": "bh", // भ
  "\u092e": "m", // म
  "\u092f": "y", // य
  "\u0930": "r", // र
  "\u0932": "l", // ल
  "\u0933": "l", // ळ
  "\u0935": "v", // व
  "\u0936": "sh", // श
  "\u0937": "sh", // ष
  "\u0938": "s", // स
  "\u0939": "h", // ह
};

/** Precomposed nukta consonants (single code point). */
const PRECOMPOSED_NUKTA: Record<string, string> = {
  "\u0958": "q", // क़
  "\u0959": "kh", // ख़
  "\u095a": "gh", // ग़
  "\u095b": "z", // ज़
  "\u095c": "r", // ड़
  "\u095d": "rh", // ढ़
  "\u095e": "f", // फ़
  "\u095f": "y", // य़
};

/** Base consonant + combining nukta (U+093C) → Roman. */
const BASE_PLUS_NUKTA: Record<string, string> = {
  "\u0915": "q", // क़
  "\u0916": "kh", // ख़
  "\u0917": "gh", // ग़
  "\u091c": "z", // ज़
  "\u0921": "r", // ड़
  "\u0922": "rh", // ढ़
  "\u092b": "f", // फ़
  "\u092f": "y", // य़
};

const DIGITS: Record<string, string> = {
  "\u0966": "0",
  "\u0967": "1",
  "\u0968": "2",
  "\u0969": "3",
  "\u096a": "4",
  "\u096b": "5",
  "\u096c": "6",
  "\u096d": "7",
  "\u096e": "8",
  "\u096f": "9",
};

/**
 * True when a character is in the Devanagari Unicode block.
 */
export function isDevanagari(char: string): boolean {
  const code = char.codePointAt(0);
  return (
    code !== undefined && code >= DEVANAGARI_START && code <= DEVANAGARI_END
  );
}

/**
 * True when the character continues the current orthographic word — i.e. it is
 * a Devanagari letter or combining mark that attaches to the preceding
 * consonant. Used to decide whether a consonant is word-final (schwa deleted).
 */
function continuesWord(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }

  return (
    CONSONANTS[char] !== undefined ||
    PRECOMPOSED_NUKTA[char] !== undefined ||
    INDEPENDENT_VOWELS[char] !== undefined ||
    MATRAS[char] !== undefined ||
    char === VIRAMA ||
    char === NUKTA ||
    char === ANUSVARA ||
    char === CHANDRABINDU ||
    char === VISARGA
  );
}

/**
 * Transliterates any Devanagari in `text` into Roman script, passing through
 * all other characters unchanged.
 */
export function transliterateDevanagari(text: string): string {
  let out = "";
  let index = 0;
  const length = text.length;

  while (index < length) {
    const char = text[index];

    if (!isDevanagari(char)) {
      out += char;
      index += 1;
      continue;
    }

    if (DIGITS[char]) {
      out += DIGITS[char];
      index += 1;
      continue;
    }

    if (char === DANDA || char === DOUBLE_DANDA) {
      out += ".";
      index += 1;
      continue;
    }

    if (char === AVAGRAHA) {
      out += "'";
      index += 1;
      continue;
    }

    if (char === OM) {
      out += "om";
      index += 1;
      continue;
    }

    if (INDEPENDENT_VOWELS[char]) {
      out += INDEPENDENT_VOWELS[char];
      index += 1;
      continue;
    }

    let base = CONSONANTS[char] ?? PRECOMPOSED_NUKTA[char];
    let consumed = base === undefined ? 0 : 1;

    if (CONSONANTS[char] && text[index + 1] === NUKTA) {
      base = BASE_PLUS_NUKTA[char] ?? CONSONANTS[char];
      consumed = 2;
    }

    if (base !== undefined) {
      index += consumed;
      const next = text[index];

      if (next === VIRAMA) {
        out += base;
        index += 1;
      } else if (next !== undefined && MATRAS[next]) {
        out += base + MATRAS[next];
        index += 1;
      } else if (continuesWord(next)) {
        out += `${base}a`;
      } else {
        // Word-final consonant: delete the inherent schwa (आप → "aap").
        out += base;
      }

      continue;
    }

    if (char === ANUSVARA || char === CHANDRABINDU) {
      out += "n";
      index += 1;
      continue;
    }

    if (char === VISARGA) {
      out += "h";
      index += 1;
      continue;
    }

    if (MATRAS[char]) {
      out += MATRAS[char];
      index += 1;
      continue;
    }

    // Stray virama / nukta / any unmapped Devanagari code point: drop it so
    // Devanagari can never reach the UI.
    index += 1;
  }

  return out;
}

/**
 * Returns the start index of the maximal trailing run of Devanagari characters
 * in `text`. Everything before it ends on a non-Devanagari character, so every
 * Devanagari cluster within `text.slice(0, start)` is complete and safe to
 * transliterate; the trailing run may still be extended by the next chunk.
 */
function trailingDevanagariRunStart(text: string): number {
  let index = text.length;

  while (index > 0 && isDevanagari(text[index - 1])) {
    index -= 1;
  }

  return index;
}

/**
 * Creates a streaming transform that transliterates Devanagari to Roman on the
 * fly. It holds back only a trailing run of Devanagari characters (which a
 * later chunk might extend into a longer cluster) and flushes the remainder
 * transliterated, so schwa deletion and matra handling stay correct across
 * chunk boundaries. Fully-Roman chunks pass straight through with no buffering.
 */
export function createDevanagariGuard(): TransformStream<string, string> {
  let buffer = "";

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;

      const runStart = trailingDevanagariRunStart(buffer);
      const safe = buffer.slice(0, runStart);
      buffer = buffer.slice(runStart);

      if (safe.length > 0) {
        controller.enqueue(transliterateDevanagari(safe));
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(transliterateDevanagari(buffer));
      }
    },
  });
}

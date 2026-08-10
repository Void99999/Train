/**
 * Verifies every locale against the reference locale (English).
 *
 * Catches the two mistakes that actually happen: a key added in English and
 * forgotten elsewhere, and a placeholder that survives translation in one
 * language but gets dropped or renamed in another - which would render as a
 * literal "{amount}" in front of the player.
 *
 *     node tools/check-locales.js
 */

import en from "../src/data/locales/en.js";
import de from "../src/data/locales/de.js";

const REFERENCE = "en";
const LOCALES = { en, de };

const placeholdersIn = (text) =>
  new Set(Array.from(text.matchAll(/\{(\w+)\}/g), (match) => match[1]));

const problems = [];
const referenceStrings = LOCALES[REFERENCE].strings;

for (const [code, locale] of Object.entries(LOCALES)) {
  if (code === REFERENCE) continue;

  for (const key of Object.keys(referenceStrings)) {
    if (!(key in locale.strings)) {
      problems.push(`${code}: missing key ${key}`);
      continue;
    }

    const expected = placeholdersIn(referenceStrings[key]);
    const actual = placeholdersIn(locale.strings[key]);
    for (const name of expected) {
      if (!actual.has(name)) problems.push(`${code}: ${key} lost placeholder {${name}}`);
    }
    for (const name of actual) {
      if (!expected.has(name)) problems.push(`${code}: ${key} has unknown placeholder {${name}}`);
    }
  }

  for (const key of Object.keys(locale.strings)) {
    if (!(key in referenceStrings)) problems.push(`${code}: key ${key} is not in ${REFERENCE}`);
  }
}

const emptyValues = Object.entries(LOCALES).flatMap(([code, locale]) =>
  Object.entries(locale.strings)
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([key]) => `${code}: ${key} is empty`),
);
problems.push(...emptyValues);

if (problems.length > 0) {
  console.error("Localization problems:");
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

const count = Object.keys(referenceStrings).length;
console.log(`Locales OK: ${Object.keys(LOCALES).length} languages, ${count} keys each.`);

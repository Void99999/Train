#!/usr/bin/env node
/**
 * Structural checks for the LAST TRAIN Unreal project.
 *
 * WHAT THIS IS NOT: a compiler. It cannot tell you whether the C++ builds, and
 * it never will - that needs Unreal Build Tool and the engine headers. Anything
 * this passes may still fail to compile.
 *
 * WHAT IT IS: the set of mistakes that are cheap to make in an Unreal project
 * and expensive to find, checked without the engine present:
 *
 *   - a .uproject that is not valid JSON, or names a module that does not exist
 *   - a UCLASS/USTRUCT/UENUM without its GENERATED_BODY
 *   - a header with a .generated.h include that is not the last include, or is
 *     missing entirely, which produces an error message that names the wrong file
 *   - a .cpp that does not include its own header
 *   - a class declared LASTTRAIN_API in a file the module does not compile
 *   - a DataTable CSV whose columns do not match its row struct, which fails
 *     silently at import and leaves the fields at zero
 *   - a header without #pragma once
 *
 * Run it before every commit, and before asking anyone to open the project.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "Source");
const CONTENT = path.join(ROOT, "Content");

const problems = [];
const warnings = [];
let checks = 0;

const fail = (file, message) => problems.push(`${path.relative(ROOT, file)}: ${message}`);
const warn = (file, message) => warnings.push(`${path.relative(ROOT, file)}: ${message}`);

function walk(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(full);
  }
  return found;
}

/* ------------------------------------------------------------- uproject */

function checkUProject() {
  const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(".uproject"));
  if (files.length !== 1) {
    problems.push(`Expected exactly one .uproject at the root, found ${files.length}.`);
    return;
  }

  const file = path.join(ROOT, files[0]);
  let project;
  try {
    project = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `is not valid JSON: ${error.message}`);
    return;
  }
  checks += 1;

  if (!project.EngineAssociation) fail(file, "has no EngineAssociation.");
  if (!Array.isArray(project.Modules) || project.Modules.length === 0) {
    fail(file, "declares no modules, so the C++ will never be built.");
    return;
  }

  for (const module of project.Modules) {
    checks += 1;
    const buildFile = path.join(SOURCE, module.Name, `${module.Name}.Build.cs`);
    if (!fs.existsSync(buildFile)) {
      fail(file, `declares module '${module.Name}' but ${path.relative(ROOT, buildFile)} does not exist.`);
    }
  }

  // Targets. Without these, Generate Project Files produces nothing to build.
  for (const target of ["LastTrain.Target.cs", "LastTrainEditor.Target.cs"]) {
    checks += 1;
    if (!fs.existsSync(path.join(SOURCE, target))) {
      problems.push(`Source/${target} is missing; the project cannot be built or opened as C++.`);
    }
  }
}

/* --------------------------------------------------------------- C++ */

const UOBJECT_MACROS = /^\s*(UCLASS|USTRUCT|UENUM|UINTERFACE)\s*\(/;

function checkHeader(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const name = path.basename(file, ".h");
  checks += 1;

  if (!text.includes("#pragma once")) {
    fail(file, "has no #pragma once.");
  }

  const declares = lines.some((line) => UOBJECT_MACROS.test(line));
  const generatedInclude = `#include "${name}.generated.h"`;

  if (declares) {
    if (!text.includes(generatedInclude)) {
      fail(file, `declares a UCLASS/USTRUCT/UENUM but does not include "${name}.generated.h".`);
    } else {
      // Unreal Header Tool requires it to be the last include. When it is not,
      // the error it produces names a different file entirely.
      const includes = lines
        .map((line, index) => ({ line: line.trim(), index }))
        .filter(({ line }) => line.startsWith("#include"));
      const last = includes[includes.length - 1];
      if (last && !last.line.includes(`${name}.generated.h`)) {
        fail(file, `"${name}.generated.h" must be the last #include; it is followed by ${last.line}.`);
      }
    }

    // Every UCLASS/USTRUCT/UINTERFACE needs a GENERATED_BODY. UENUM does not.
    let expected = 0;
    for (const line of lines) {
      const match = line.match(UOBJECT_MACROS);
      if (match && match[1] !== "UENUM") expected += 1;
    }
    const found = (text.match(/GENERATED_BODY\s*\(\s*\)/g) ?? []).length;
    if (found < expected) {
      fail(file, `has ${expected} UCLASS/USTRUCT/UINTERFACE declarations but only ${found} GENERATED_BODY().`);
    }
  }

  // A LASTTRAIN_API class in a header the module does not compile is a link
  // error at best and a silent omission at worst.
  if (text.includes("LASTTRAIN_API") && !file.startsWith(path.join(SOURCE, "LastTrain"))) {
    fail(file, "uses LASTTRAIN_API but is outside the LastTrain module.");
  }
}

function checkSource(file) {
  const text = fs.readFileSync(file, "utf8");
  const name = path.basename(file, ".cpp");
  checks += 1;

  const header = file.replace(/\.cpp$/, ".h");
  if (fs.existsSync(header) && !text.includes(`#include "`)) {
    fail(file, "includes nothing at all, which cannot be right.");
    return;
  }

  // Its own header should come first, so the header is proven self-sufficient.
  if (fs.existsSync(header)) {
    const firstInclude = text.split("\n").find((line) => line.trim().startsWith("#include"));
    if (firstInclude && !firstInclude.includes(`${name}.h`)) {
      warn(file, `does not include its own header first (found ${firstInclude.trim()}).`);
    }
  }
}

function checkBraces(file) {
  const text = fs.readFileSync(file, "utf8");
  // Crude, but it catches a truncated file, which is the failure this is for.
  const opens = (text.match(/\{/g) ?? []).length;
  const closes = (text.match(/\}/g) ?? []).length;
  if (opens !== closes) {
    fail(file, `has ${opens} '{' and ${closes} '}' - the file is probably truncated.`);
  }
}

/* -------------------------------------------------------------- CSVs */

/**
 * Reads the UPROPERTY field names out of a row struct, so the CSVs can be
 * checked against the struct they will be imported into. A column that does not
 * match a field is dropped silently on import and the field stays at zero,
 * which is a very quiet way to lose a whole catalogue.
 */
function readRowStructFields(headerText, structName) {
  const start = headerText.indexOf(`struct LASTTRAIN_API ${structName}`);
  if (start < 0) return null;

  const body = headerText.slice(start);
  const end = body.indexOf("\n};");
  const scope = end > 0 ? body.slice(0, end) : body;

  /*
   * Line-based rather than one big regex.
   *
   * A UPROPERTY's parentheses nest - meta = (ClampMin = "0.0") - so a pattern
   * like UPROPERTY\([^)]*\) stops at the wrong bracket and matches nothing.
   * That produced a run where every column in every CSV was reported as
   * unknown, which is a good demonstration of why the checker needs checking.
   */
  const fields = [];
  const lines = scope.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("UPROPERTY(")) continue;

    // Walk forward past however many lines the macro's arguments span, to the
    // declaration itself.
    for (let j = i + 1; j < lines.length && j < i + 8; j += 1) {
      const line = lines[j].trim();
      if (line.length === 0 || line.startsWith("//")) continue;
      if (!line.endsWith(";") && !line.includes("=")) continue;

      // "float RangeMetres = 50.f;" or "FName AmmoCargoId;"
      const match = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:=[^;]*)?;/);
      if (match) fields.push(match[1]);
      break;
    }
  }
  return fields;
}

function checkDataTables() {
  const rowsHeader = path.join(SOURCE, "LastTrain", "Data", "LastTrainCatalogRows.h");
  if (!fs.existsSync(rowsHeader)) return;
  const headerText = fs.readFileSync(rowsHeader, "utf8");

  const tables = [
    ["DT_Weapons.csv", "FWeaponRow"],
    ["DT_Vehicles.csv", "FVehicleRow"],
    ["DT_Cargo.csv", "FCargoRow"],
    ["DT_Enemies.csv", "FEnemyRow"],
    ["DT_Outposts.csv", "FOutpostRow"],
  ];

  for (const [csvName, structName] of tables) {
    const csvPath = path.join(CONTENT, "LastTrain", "Data", "Source", csvName);
    if (!fs.existsSync(csvPath)) {
      warn(csvPath, "is missing, so this catalogue can only come from the compiled-in defaults.");
      continue;
    }
    checks += 1;

    const fields = readRowStructFields(headerText, structName);
    if (!fields) {
      fail(rowsHeader, `has no struct ${structName}, but ${csvName} expects one.`);
      continue;
    }

    const headerLine = fs.readFileSync(csvPath, "utf8").split("\n")[0].trim();
    const columns = headerLine.split(",").map((c) => c.trim());

    if (columns[0] !== "Name") {
      fail(csvPath, `first column must be 'Name' (the row name); found '${columns[0]}'.`);
    }

    for (const column of columns.slice(1)) {
      // Nested struct members are written Parent.Child in a DataTable CSV.
      const root = column.split(".")[0];
      if (!fields.includes(root)) {
        fail(csvPath, `column '${column}' does not match any UPROPERTY on ${structName}; it will be dropped on import.`);
      }
    }

    // Row counts, so a truncated CSV is noticed.
    const dataRows = fs.readFileSync(csvPath, "utf8").split("\n").filter((l) => l.trim().length > 0).length - 1;
    if (dataRows <= 0) fail(csvPath, "has a header but no rows.");
  }
}

/* --------------------------------------------------------------- run */

console.log("LAST TRAIN - Unreal project structure check\n");

checkUProject();

const headers = walk(SOURCE, [".h"]);
const sources = walk(SOURCE, [".cpp"]);

for (const file of headers) {
  checkHeader(file);
  checkBraces(file);
}
for (const file of sources) {
  checkSource(file);
  checkBraces(file);
}

checkDataTables();

console.log(`  ${headers.length} headers, ${sources.length} source files, ${checks} checks.`);

if (warnings.length > 0) {
  console.log(`\n  ${warnings.length} warning(s):`);
  for (const warning of warnings) console.log(`    - ${warning}`);
}

if (problems.length > 0) {
  console.log(`\n  ${problems.length} problem(s):`);
  for (const problem of problems) console.log(`    - ${problem}`);
  console.log("\nFAILED\n");
  process.exit(1);
}

console.log("\nStructure OK.");
console.log("This does NOT mean the project compiles. Only Unreal Build Tool can tell you that.\n");

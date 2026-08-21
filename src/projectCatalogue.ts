import * as XLSX from "xlsx";
import { INTERNAL_CODE_MINIMUM, UNKNOWN_PROJECT_CODE } from "./config";
import type {
  InternalCatalogueItem,
  ProjectCatalogueItem,
  TimeEntry,
} from "./domain";
import { extractProjectCode } from "./processing";

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function addItem(
  values: Map<string, ProjectCatalogueItem>,
  code: string | undefined,
  description: string,
  source: ProjectCatalogueItem["sources"][number],
  metadata: Partial<
    Pick<ProjectCatalogueItem, "client" | "projectManager" | "projectDirector">
  > = {},
) {
  const cleanDescription = description.trim();
  if (
    !code ||
    code === UNKNOWN_PROJECT_CODE ||
    Number(code) >= INTERNAL_CODE_MINIMUM ||
    !cleanDescription ||
    /^(job|project)\s*(name|description)$/i.test(cleanDescription)
  )
    return;
  const key = `${code}|${normalise(cleanDescription)}`;
  const current = values.get(key);
  values.set(key, {
    code,
    description: cleanDescription,
    client: metadata.client ?? current?.client,
    projectManager: metadata.projectManager ?? current?.projectManager,
    projectDirector: metadata.projectDirector ?? current?.projectDirector,
    sources: current ? [...new Set([...current.sources, source])] : [source],
  });
}

export function catalogueFromCurrentEntries(entries: TimeEntry[]) {
  const values = new Map<string, ProjectCatalogueItem>();
  for (const entry of entries)
    if (entry.classification === "project")
      addItem(
        values,
        entry.projectCode,
        entry.description,
        "current-timesheets",
      );
  return [...values.values()];
}

export function catalogueFromAnnualWorkbook(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const values = new Map<string, ProjectCatalogueItem>();
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
    for (let row = range.s.r; row <= range.e.r; row++) {
      const rawCode = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })]?.v;
      const rawDescription = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })]?.v;
      addItem(
        values,
        extractProjectCode(rawCode),
        typeof rawDescription === "string" ? rawDescription : "",
        "annual-workbook",
      );
    }
  }
  return [...values.values()].sort(
    (a, b) =>
      Number(a.code) - Number(b.code) ||
      a.description.localeCompare(b.description),
  );
}

export function mergeProjectCatalogues(
  ...catalogues: ProjectCatalogueItem[][]
) {
  const values = new Map<string, ProjectCatalogueItem>();
  for (const item of catalogues.flat())
    addItem(values, item.code, item.description, item.sources[0], item);
  for (const item of catalogues.flat()) {
    const key = `${item.code}|${normalise(item.description)}`;
    const current = values.get(key);
    if (current)
      current.sources = [...new Set([...current.sources, ...item.sources])];
  }
  return [...values.values()].sort(
    (a, b) =>
      Number(a.code) - Number(b.code) ||
      a.description.localeCompare(b.description),
  );
}

export function internalCatalogueFromEntries(entries: TimeEntry[]) {
  const values = new Map<string, InternalCatalogueItem>();
  for (const entry of entries) {
    if (entry.classification !== "internal") continue;
    const description = (entry.internalCategory ?? entry.description).trim();
    if (!description) continue;
    const key = `${entry.projectCode ?? ""}|${normalise(description)}`;
    values.set(key, {
      code: entry.projectCode,
      description,
      source: "current-timesheets",
    });
  }
  return [...values.values()];
}

export function internalCatalogueFromAnnualWorkbook(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const values = new Map<string, InternalCatalogueItem>();
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
    for (let row = range.s.r; row <= range.e.r; row++) {
      const rawCode = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })]?.v;
      const rawDescription = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })]?.v;
      const code = extractProjectCode(rawCode);
      const description =
        typeof rawDescription === "string" ? rawDescription.trim() : "";
      if (!code || Number(code) < INTERNAL_CODE_MINIMUM || !description)
        continue;
      values.set(`${code}|${normalise(description)}`, {
        code,
        description,
        source: "annual-workbook",
      });
    }
  }
  return [...values.values()].sort((a, b) => Number(a.code) - Number(b.code));
}

export function mergeInternalCatalogues(
  ...catalogues: InternalCatalogueItem[][]
) {
  const values = new Map<string, InternalCatalogueItem>();
  for (const item of catalogues.flat())
    values.set(`${item.code ?? ""}|${normalise(item.description)}`, item);
  return [...values.values()];
}

const TIME_IN_LIEU_PATTERN = /\b(?:time\s+in\s+lieu|in\s+lieu|toil)\b/i;

/** Time in Lieu is an authorised NEXUS non-project category, not an EAS code. */
export function suggestsTimeInLieu(sourceText: string) {
  // A lone "lieu" is deliberately insufficient to suggest a classification.
  return TIME_IN_LIEU_PATTERN.test(sourceText);
}

const INTERNAL_PHRASES: [RegExp, RegExp][] = [
  [/\b(in lieu|toil)\b/i, /\b(time in lieu|toil)\b/i],
  [/\b(holiday|annual leave)\b/i, /\b(holiday|annual leave)\b/i],
  [/\b(sick|sickness)\b/i, /\b(sick|sickness)\b/i],
  [/\b(research|r&d)\b/i, /\b(research|r&d)\b/i],
  [/\badmin(?:istration)?\b/i, /\badmin(?:istration)?\b/i],
  [/\btraining|conference\b/i, /\btraining|conference\b/i],
  [/\btravel\b/i, /\btravel\b/i],
  [/\bmarketing\b/i, /\bmarketing\b/i],
  [/\bteam meeting|project discussion\b/i, /\b(meeting|discussion)\b/i],
];

export function suggestInternalCategories(
  sourceText: string,
  catalogue: InternalCatalogueItem[],
  limit = 3,
) {
  const matches = INTERNAL_PHRASES.filter(([source]) =>
    source.test(sourceText),
  );
  if (!matches.length) return [];
  return catalogue
    .map((item) => ({
      item,
      score: Math.max(
        ...matches.map(([, category]) =>
          category.test(item.description) ? 1 : 0,
        ),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.item.code ?? Infinity) - Number(b.item.code ?? Infinity),
    )
    .slice(0, limit);
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function projectSimilarity(query: string, candidate: string) {
  const left = normalise(query);
  const right = normalise(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  const tokenScore = overlap.length / Math.max(leftTokens.size, 1);
  const compactLeft = left.replace(/ /g, "");
  const compactRight = right.replace(/ /g, "");
  const distanceScore =
    1 -
    editDistance(compactLeft, compactRight) /
      Math.max(compactLeft.length, compactRight.length);
  const containment =
    compactRight.includes(compactLeft) || compactLeft.includes(compactRight)
      ? 0.85
      : 0;
  return Math.max(tokenScore, distanceScore, containment);
}

export function suggestProjects(
  sourceText: string,
  catalogue: ProjectCatalogueItem[],
  limit = 3,
) {
  return catalogue
    .map((project) => ({
      project,
      score: Math.max(
        projectSimilarity(sourceText, project.description),
        projectSimilarity(sourceText, `${project.code} ${project.description}`),
        projectSimilarity(
          sourceText,
          [project.client, project.projectManager, project.projectDirector]
            .filter(Boolean)
            .join(" "),
        ),
      ),
    }))
    .filter((item) => item.score >= 0.5)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.project.code) - Number(b.project.code) ||
        a.project.description.localeCompare(b.project.description),
    )
    .slice(0, limit);
}

export interface ProjectSearchIndex {
  projects: {
    project: ProjectCatalogueItem;
    normalized: string;
  }[];
}

export function createProjectSearchIndex(
  catalogue: ProjectCatalogueItem[],
): ProjectSearchIndex {
  return {
    projects: catalogue.map((project) => ({
      project,
      normalized: normalise(
        [
          project.code,
          project.description,
          project.client,
          project.projectManager,
          project.projectDirector,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    })),
  };
}

export function searchProjects(
  index: ProjectSearchIndex,
  query: string,
  limit = 8,
) {
  const normalized = normalise(query);
  if (!normalized) return [];
  const tokens = normalized.split(" ");
  return index.projects
    .map(({ project, normalized: candidate }) => {
      const code = project.code.toLowerCase();
      const score =
        code === normalized
          ? 4
          : code.startsWith(normalized)
            ? 3
            : code.includes(normalized)
              ? 2.5
              : tokens.every((token) => candidate.includes(token))
                ? 2
                : 0;
      return { project, score };
    })
    .filter(({ score }) => score >= 0.5)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.project.code) - Number(b.project.code) ||
        a.project.description.localeCompare(b.project.description),
    )
    .slice(0, limit);
}

export function isMeaningfulProjectDescription(value: string) {
  const normalized = normalise(value);
  return (
    !!normalized && !["uncoded entry", "unknown project"].includes(normalized)
  );
}

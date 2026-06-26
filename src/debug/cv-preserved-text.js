/**
 * Flatten cvData / resumeData fields for retention metrics (never "[object Object]").
 */

function flattenExperienceEntry(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry !== 'object') return String(entry || '').trim();
  return [
    entry.role,
    entry.company,
    entry.location,
    entry.dates,
    entry.startDate,
    entry.endDate,
    ...(entry.bullets || []),
    ...(entry.clients || []),
  ]
    .filter(Boolean)
    .map((x) => String(x).trim())
    .join(' ');
}

/**
 * @param {object} cvData
 */
export function flattenCvDataPreservedText(cvData) {
  const d = cvData || {};
  const expList = [
    ...(d.experience || []),
    ...(d.experiences || []),
    ...(d.unknownExperience || []),
  ];
  const toClassify = (d.toClassify || []).map((x) =>
    typeof x === 'string' ? x : x?.text || x?.detected || ''
  );
  const archive = [
    ...(d.metadata?.unsortedArchive || []),
    ...(d.unsortedArchive || []),
  ].map((x) => (typeof x === 'string' ? x : x?.text || ''));
  const parts = [
    d.name,
    d.title,
    d.email,
    d.phone,
    d.location,
    d.linkedin,
    d.portfolio,
    d.summary,
    ...expList.map(flattenExperienceEntry),
    ...(d.education || []),
    ...(d.skills || []),
    ...(d.tools || []),
    ...(d.languages || []),
    ...(d.clients || []),
    ...(d.interests || []),
    ...(d.projects || []),
    ...(d.awards || []),
    ...(d.exhibitions || []),
    ...(d.publications || []),
    ...(d.portfolioLinks || []),
    ...(d.extra || []),
    ...(d.other || []),
    ...(d.unsorted || []),
    ...archive,
    ...toClassify,
    ...(d.structuredResume?.unsorted || []),
    ...(d.structuredResume?.metadata?.unsortedArchive || []).map((x) =>
      typeof x === 'string' ? x : x?.text || ''
    ),
    ...(d.structuredResume?.experiences || []).map(flattenExperienceEntry),
  ];
  return parts
    .flat()
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Classified fields only (excludes unsorted + archive).
 * @param {object} structured
 */
export function flattenStructuredFieldsOnly(structured) {
  const s = structured || {};
  const id = s.identity || {};
  const exp = (s.experiences || []).map(flattenExperienceEntry);
  return [
    id.name,
    id.title,
    id.email,
    id.phone,
    id.location,
    id.website,
    id.linkedin,
    s.summary,
    ...exp,
    ...(s.education || []),
    ...(s.skills || []),
    ...(s.tools || []),
    ...(s.languages || []),
    ...(s.clients || []),
    ...(s.projects || []),
    ...(s.interests || []),
    ...(s.awards || []),
    ...(s.exhibitions || []),
    ...(s.publications || []),
    ...(s.portfolioLinks || []),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {object} structured
 */
export function flattenArchivePreservedText(structured) {
  const s = structured || {};
  return [
    ...(s.unsorted || []),
    ...(s.unsortedArchive || []).map((x) => (typeof x === 'string' ? x : x?.text || '')),
    ...(s.metadata?.unsortedArchive || []).map((x) => (typeof x === 'string' ? x : x?.text || '')),
    ...(s.metadata?.UNSORTED_ARCHIVE || []).map((x) => (typeof x === 'string' ? x : x?.text || '')),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {object} structured
 */
export function flattenStructuredPreservedText(structured) {
  const s = structured || {};
  const id = s.identity || {};
  const exp = (s.experiences || []).map(flattenExperienceEntry);
  return [
    id.name,
    id.title,
    id.email,
    id.phone,
    id.location,
    id.website,
    id.linkedin,
    s.summary,
    ...exp,
    ...(s.education || []),
    ...(s.skills || []),
    ...(s.tools || []),
    ...(s.languages || []),
    ...(s.clients || []),
    ...(s.projects || []),
    ...(s.interests || []),
    ...(s.awards || []),
    ...(s.exhibitions || []),
    ...(s.publications || []),
    ...(s.portfolioLinks || []),
    ...(s.unsorted || []),
    ...(s.metadata?.unsortedArchive || []).map((x) =>
      typeof x === 'string' ? x : x?.text || ''
    ),
    ...(s.unsortedArchive || []).map((x) => (typeof x === 'string' ? x : x?.text || '')),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Rich CV parser — ported from legacy index.html inline implementation.
 * Single source of truth for browser UI and Node QA tests.
 */

import {
  stripContactFromProse,
  sanitizeSummaryText,
  segregateClientBrands,
  isValidSummaryField,
  isValidTitleField,
  isValidExperienceLine,
  isValidListItem,
  isValidEducationItem,
  lineIsClientList,
  EXPERIENCE_ROLE_RE,
} from './field-sanitize.js';
import { cleanTextWithRejected, isLikelyGarbageLine } from './line-cleaner.js';
import {
  extractStrictLanguageLine,
  isForbiddenLanguageLine,
} from './strict-language-extraction.js';
import {
  detectNameFromLines,
  detectTitleFromText,
  harvestEducation,
  structureEducationEntries,
  harvestExperienceFromLines,
  recoverOrphanLinesToUnsorted,
  partitionSkillsAndInterests,
  isBadTitleCandidate,
  NAME_UNCERTAIN_LABEL,
} from './parser-recovery.js';
import {
  extractLockedIdentity,
  IDENTITY_CONFIDENCE_MIN,
  isValidIdentityTitle,
} from './identity-extraction.js';
import { applyOcrContaminationFirewall, isSectionAnchorField } from './ocr-contamination-firewall.js';
import { applyExperienceReconstruction } from './experience-reconstruction-engine.js';
import { applyDataSanitizationLayer } from '../validation/data-sanitization-layer.js';
import {
  extractEmailFromHeaderText,
  extractPhoneFromHeaderText,
} from './header-cleaner.js';
import {
  extractPhoneCandidate,
  normalizeContactPhone,
  validatePhoneStrict,
} from './phone-normalize.js';
import {
  extractExperiencesFromSectionAnchors,
  resolveCreativeProfessionalTitle,
} from './section-anchor-extract.js';
import { isLineCorrupted } from './corruption-detector.js';
import { EDUCATION_KEYWORDS } from '../../data/dictionaries/educationKeywords.js';
import { fuzzySectionKey } from './section-fuzzy.js';
import { postProcessOcrText, looksLikeOcrText } from './ocr-postprocess.js';
import { normalizeCvDocument } from './cv-normalizer.js';
import { safeClean, strictClean, measureCleanLoss } from './clean.js';
import { collectSectionsOrderAgnostic } from './section-mapper.js';
import {
  applyParserEnterprisePass,
  attachIdentityFields,
  buildEnterpriseParse,
  enterpriseToLegacyCvData,
  experienceEntryToLegacyString,
  lineMayBeUnknownExperience,
  PARSER_ENTERPRISE_THRESHOLD,
  scoreEducationLine,
} from './parser-enterprise.js';
import { CLIENT_COMPANY_KEYWORDS } from '../../data/dictionaries/clientCompanyKeywords.js';
import { termMatchesHay } from '../../data/dictionaries/match-utils.js';
import { TOOLS } from '../../data/dictionaries/tools.js';
import { passesExperienceGate, isLikelyPortfolioProject, hasExperienceDate } from './section-sanity.js';
import { parseStrictExperiencesFromLines } from './experience-parser.js';

/** Per-parse extraction line archive (set by pipeline from enterprise engine). */
let activeExtractionLines = null;

export function setParseExtractionLines(lines) {
  activeExtractionLines = lines?.length ? lines : null;
}

export function getParseExtractionLines() {
  return activeExtractionLines;
}

let _lastRejectedLines = [];
let _lastUncertainLines = [];
let _lastCleanLoss = null;

export function getLastRejectedLines() {
  return _lastRejectedLines;
}

export function getLastUncertainLines() {
  return _lastUncertainLines;
}

export function getLastCleanLoss() {
  return _lastCleanLoss;
}

export const KNOWN_CLIENTS = CLIENT_COMPANY_KEYWORDS;
export const KNOWN_TOOLS = TOOLS;
export const KNOWN_LANGS=[
 {re:/\b(french|français|francais)\b/i,label:'French'},
 {re:/\b(english|anglais)\b/i,label:'English'},
 {re:/\b(dutch|nederlands|néerlandais)\b/i,label:'Dutch'},
 {re:/\b(german|deutsch|allemand)\b/i,label:'German'},
 {re:/\b(spanish|español|espagnol)\b/i,label:'Spanish'},
 {re:/\b(italian|italiano|italien)\b/i,label:'Italian'},
 {re:/\b(portuguese|português|portugais)\b/i,label:'Portuguese'},
 {re:/\b(mandarin|chinese)\b/i,label:'Mandarin'},
];
export const TITLE_HINTS=/\b(designer|illustrator|developer|engineer|manager|director|consultant|artist|architect|analyst|specialist|coordinator|lead|head|senior|junior|freelance|graphiste|créatif|creative|strategist|producer|marketer|writer|photographer|videographer|ontwerper|ingenieur|adviseur|consultante?|chef de projet|project manager|product owner|ux|ui|art director|creative director|graphic designer|product designer|marketing manager)\b/i;
export const PROFESSIONAL_TITLE_WORDS=/\b(design|graphic|illustration|illustrator|direction|director|manager|marketing|product|creative|visual|brand|digital|web|motion|print|packaging|identity|communication|strategy|strategist|consultant|engineer|developer|analyst|coordinator|specialist|producer|editor|photographer|architect|freelance|senior|lead|head)\b/i;
export const CONTACT_HEADER_RE=/^(contact|contact details?|coordonnées|contactgegevens|kontakt|reach me|get in touch)\b/i;
export const LOCATION_HEADER_RE=/^(location|localisation|address|adresse|based in|based|woonplaats|locatie|city|ville|woonort|residence|domicile)\b/i;
export const SECTION_HEADERS={
 summary:/^(profile|profil|summary|about me|about|objective|objectif|résumé|resume|personal statement|profiel|over mij|persoonlijk profiel)\b/i,
 experience:/^(experience|expériences?|expérience professionnelle|work experience|professional experience|employment|parcours|work history|career history|werkervaring|beroepservaring|carrière|positions? held|employment history)\b/i,
 education:/^(education|formation|formations?|studies|academic background|academic|scholarship|diploma|diplômes?|opleiding|onderwijs|studies?)\b/i,
 skills:/^(skills|technical skills|compétences|competences|competencies|expertise|core competencies|key skills|vaardigheden|compétences clés)\b/i,
 tools:/^(tools|outils|software|logiciels|technical tools|tech stack|technologies|applications)\b/i,
 languages:/^(languages|langues|linguistic|language skills|talen|langues parlées)\b/i,
 clients:/^(clients|brands|selected clients|références|key clients|referenties|klanten)\b/i,
 interests:/^(interests|hobbies|personal interests|centres d'intérêt|loisirs)\b/i,
 certifications:/^(certifications?|certificates?|licenses?|licences?|credentials|professional certifications?)\b/i,
 volunteer:/^(volunteer(?:ing)?|volunteer experience|community service|civic engagement)\b/i,
 projects:/^(projects|selected projects|portfolio projects|selected work|personal work)\b/i,
 contact:CONTACT_HEADER_RE,
 location:LOCATION_HEADER_RE,
 achievements:/^(achievements|accomplishments|réalisations|highlights|key achievements|succès)\b/i
};
export const LOCATION_CITIES=/\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|London|Berlin|Amsterdam|Brussels|Bruxelles|Zurich|Geneva|Genève|Milan|Barcelona|Madrid|New York|Los Angeles|San Francisco|Montréal|Montreal|Remote|Télétravail|Remote-first|Hybride|Rotterdam|Utrecht|Den Haag|Antwerp|Anvers|Ghent|Gand)\b/i;
export const LOCATION_COUNTRY=/\b(France|UK|United Kingdom|USA|U\.S\.|Belgium|Belgique|Switzerland|Suisse|Germany|Allemagne|Canada|Spain|Espagne|Italy|Italie|Netherlands|Pays-Bas|Nederland|België)\b/i;
export const EMAIL_RE=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
export const PHONE_RE=/(?:\+?(?:33|31|32|1|41|49|34|39|44|352|353|351|358|45|46|47|48|39)[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|\+\d{1,3}[\s.-]?\d[\d\s().-]{6,16}\d/;
export const LINKEDIN_RE=/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[\w\-/?=&%.#]+|linkedin\.com\/in\/[\w\-]+/i;
export const PORTFOLIO_RE=/https?:\/\/[\w.-]+(?:\/[\w\-/?=&%.#]*)?/i;
export const LENIENT_WORD_MIN=80;
export const PDF_EXTRACT_FAIL_MSG='PDF extraction failed. Paste your CV text manually or upload TXT/DOCX.';
export const CV_PLACEHOLDER_RE=/^(candidate\s*name|your\s*name|full\s*name|email@example\.com|john\s+doe|jane\s+doe|company\s*name|xxx+|n\/?a|tbd|\[.*\])$/i;
export const MANUAL_CORRECTION_MSG='Correction manuelle recommandée — collez le texte du CV ci-dessous, vérifiez puis confirmez.';


export function titleCaseName(s){return s.toLowerCase().replace(/\b[\p{L}'-]+/gu,w=>w.charAt(0).toUpperCase()+w.slice(1))}
export function dedupeTokensInLine(line){
 const words=line.split(/\s+/).filter(Boolean);
 if(words.length<4)return line;
 const out=[];let prev='';
 words.forEach(w=>{const k=w.toLowerCase();if(k===prev)return;out.push(w);prev=k});
 return out.join(' ');
}
export function stripOcrGarbage(s){
 return String(s||'')
  .replace(/[\u200B-\u200D\uFEFF\u00AD]/g,'')
  .replace(/[|¦‖§¶†‡•◦▪▫■□▢▣▤▥▦▧▨▩◆◇◈◉○●]/g,' ')
  .replace(/([A-Za-zÀ-ÿ])[\|\\\/_]{1,3}([A-Za-zÀ-ÿ])/g,'$1 $2')
  .replace(/([a-zà-ö])([A-ZÀ-Ö])(?=[a-zà-ö])/g,'$1 $2')
  .replace(/([A-Za-zÀ-ÿ])\1{3,}/gi,'$1$1')
  .replace(/[^\S\n]{2,}/g,' ')
  .replace(/([.!?])\s+([a-zà-ö])/g,(m,a,b)=>a+' '+b.toUpperCase());
}
export function mergeBrokenLines(lines){
 const out=[];
 for(let i=0;i<lines.length;i++){
  let cur=lines[i];
  while(i+1<lines.length){
   const next=lines[i+1];
   const nextIsContact=EMAIL_RE.test(next)||PHONE_RE.test(next)||/^https?:\/\//i.test(next);
   const cont=/[,;:]$/.test(cur.trim())||(!/[.!?]$/.test(cur.trim())&&/^[a-zà-ö0-9(]/.test(next)&&next.length<120&&!isSectionHeaderLine(next)&&!nextIsContact&&!lineLooksLikeTitle(cur));
   if(cont){cur=(cur+' '+next).replace(/\s+/g,' ').trim();i++}else break;
  }
  out.push(cur);
 }
 return out;
}
export function cleanExtraction(raw = '', opts = {}) {
  const mode = opts.mode === 'strict' ? 'strict' : 'safe';
  const sourceRaw = String(raw || '');

  if (opts.applyCvNormalizer !== false && (opts.ocr || looksLikeOcrText(sourceRaw))) {
    const norm = normalizeCvDocument(sourceRaw, {
      rawText: sourceRaw,
      extractionMethod: opts.extractionMethod,
      ocr: true,
    });
    _lastRejectedLines = norm.rejectedLines || [];
    _lastUncertainLines = norm.uncertainLines || [];
    _lastCleanLoss = measureCleanLoss(sourceRaw, norm.text);
    return normalizeText(norm.text);
  }

  let source = sourceRaw;
  if (mode === 'strict' && looksLikeOcrText(source)) {
    source = postProcessOcrText(source, { ocr: true });
  }
  source = mode === 'strict' ? strictClean(source) : safeClean(source);
  const { cleanedText, rejectedLines, uncertainLines } = cleanTextWithRejected(source, { mode });
  _lastRejectedLines = rejectedLines;
  const ocrUncertain =
    typeof globalThis !== 'undefined' && Array.isArray(globalThis.__HIRELY_OCR_UNCERTAIN_LINES)
      ? globalThis.__HIRELY_OCR_UNCERTAIN_LINES.splice(0)
      : [];
  _lastUncertainLines = [...(uncertainLines || []), ...ocrUncertain];
  _lastCleanLoss = measureCleanLoss(sourceRaw, cleanedText);

  let lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (mode === 'strict') {
    lines = mergeBrokenLines(lines);
    const seen = new Set();
    lines = lines
      .map((l) => dedupeTokensInLine(l))
      .filter((l) => {
        const k = l.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  } else {
    lines = removeDuplicateLinesSafe(lines);
  }
  return normalizeText(lines.join('\n'));
}

function collapseLineKey(line) {
  let out = '';
  let prevWs = false;
  const s = String(line || '').slice(0, 320).toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (!prevWs && out.length) {
        out += ' ';
        prevWs = true;
      }
    } else {
      out += ch;
      prevWs = false;
    }
  }
  return out.trim();
}

function removeDuplicateLinesSafe(lines) {
  const seen = new Set();
  return lines.filter((l) => {
    const k = collapseLineKey(l);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
export function isBadName(n){
 return !n||/^votre\s+nom$/i.test(n)||/^(candidate|your\s+name|name\s+here|nom\s+prénom)$/i.test(n)||/\d{3,}/.test(n)||/\\|\/|_|@/.test(n)||lineLooksLikeClientList(n)||nameLooksLikeBrandList(n)||lineHasJunk(n);
}
export function nameLooksLikeBrandList(line){
 if(!line)return true;
 const sample=String(line||'').slice(0,200);
 const hits=clientInLine(sample);
 if(hits.length>=2)return true;
 const words=line.split(/\s+/).filter(Boolean);
 const brandWords=words.filter(w=>KNOWN_CLIENTS.some(c=>c.toLowerCase()===w.toLowerCase()));
 return words.length>=2&&brandWords.length/words.length>=0.5;
}
export function lineHasJunk(line){
 if(isLineCorrupted(line))return true;
 return /(?:m[ée]ca|seow|vessie|youz|cope|a1\s|\\|\bss\b|\bfi\b|professionally positioned|lorem ipsum|xxx|test\s*test|asdf|qwerty|ocr\s*error|undefined|null\b)/i.test(line)||/[^\x20-\x7E\u00C0-\u024F]{4,}/.test(line)||/\b[A-Za-z]{1,2}\s+(?:[A-Za-z]{1,2}\s+){3,}/.test(line)||/(?:\bNF\b|\bPs\b|\bam\b.*\bPhotoshop\b)/i.test(line)}
/** Legacy gate disabled — always accept readable text. */
export function isLowQualityExtraction(){return false}
export function isWeirdToken(w){
 if(!w||w.length<2)return true;
 if(/^[^A-Za-zÀ-ÿ]+$/.test(w))return true;
 if(w.length===1)return true;
 if(/(.)\1{2,}/.test(w))return true;
 if(EDUCATION_KEYWORDS.some(k=>k.toLowerCase()===w.toLowerCase()))return false;
 if(/^[A-ZÀ-Ö]{3,12}$/.test(w)&&/[AEIOUYaeiouy]/.test(w))return false;
 if(w.length>=4&&!/[aeiouàâéèêëïîôùûüæœ]/i.test(w))return true;
 if(/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(w))return true;
 if(/[\d\\\/_|@#%]{2,}/.test(w))return true;
 if(w.length>22)return true;
 if(/^[A-ZÀ-Ö]{4,}$/.test(w)&&w.length<8&&!KNOWN_CLIENTS.includes(w)&&!KNOWN_TOOLS.includes(w))return true;
 if(KNOWN_CLIENTS.some(c=>c.toLowerCase()===w.toLowerCase()))return false;
 return false;
}
export function normalizeLine(l){
 let s=String(l||'').replace(/[\u200B-\u200D\uFEFF]/g,' ').replace(/[\\|{}\[\]^_~]+/g,' ').replace(/[•·▪●■◆]/g,'- ').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/([a-zà-ö])([A-ZÀ-Ö])/g,'$1 $2').replace(/([A-Za-zÀ-ÿ])\1{2,}/gi,'$1$1');
 s=s.replace(/([A-Za-zÀ-ÿ]{2,})((?:19|20)\d{2}\b)/g,'$1 $2').replace(/((?:19|20)\d{2})([A-ZÀ-Ö][a-zà-ö])/g,'$1 $2').replace(/(\d{2,4})([A-ZÀ-Ö][a-zà-ö]{2,})/g,'$1 $2');
 return s.replace(/\s{2,}/g,' ').trim();
}
export function normalizeText(raw=''){
 let s=String(raw||'').replace(/\r/g,'\n').replace(/[^\S\n]+/g,' ').replace(/[•·▪●■◆]/g,'\n');
 s=s.split('\n').map(normalizeLine).filter(Boolean).filter(l=>{
  if(EMAIL_RE.test(l)||PHONE_RE.test(l))return true;
  if(/^[\W\d\s]+$/.test(l))return false;
  if(/^[-–—•*·]{1,3}$/.test(l))return false;
  const toks=l.split(/\s+/).filter(Boolean);
  if(!toks.length)return false;
  const singles=toks.filter(t=>t.length===1).length;
  if(singles/toks.length>0.45)return false;
  if(toks.filter(isWeirdToken).length/toks.length>0.4)return false;
  if(lineHasJunk(l))return false;
  return true;
 }).join('\n');
 return s.replace(/\n{3,}/g,'\n\n').trim();
}
export function headerKeyForLine(line){
 let t=collapseLineKey(String(line||'').trim().slice(0,56));
 while(t.length&&'#*'.includes(t[0])) t=t.slice(1).trim();
 t=t.replace(/[:：|#•]+\s*$/,'').trim();
 if(t.length>56||t.length<2)return null;
 const fuzzy=fuzzySectionKey(t);
 if(fuzzy)return fuzzy;
 const norm=t.toLowerCase();
 if(CONTACT_HEADER_RE.test(norm)||CONTACT_HEADER_RE.test(t))return 'contact';
 if(LOCATION_HEADER_RE.test(norm)||LOCATION_HEADER_RE.test(t))return 'location';
 if(t.length<=36&&t===t.toUpperCase()&&/[A-ZÀ-Ö]/.test(t)&&/[A-ZÀ-Ö]{3,}/.test(t)){
  const key=Object.entries(SECTION_HEADERS).find(([k,re])=>k!=='contact'&&k!=='location'&&re.test(norm))?.[0];
  if(key)return key;
  if(CONTACT_HEADER_RE.test(norm))return 'contact';
  if(LOCATION_HEADER_RE.test(norm))return 'location';
 }
 return Object.entries(SECTION_HEADERS).find(([k,re])=>{
  if(k==='contact'||k==='location')return false;
  return re.test(t)||re.test(norm);
 })?.[0]||(CONTACT_HEADER_RE.test(norm)?'contact':LOCATION_HEADER_RE.test(norm)?'location':null);
}
export function detectSections(text){
 const out={top:[]};let cur='top';
 String(text||'').split('\n').forEach(line=>{
  const trimmed=line.trim();
  const inline=trimmed.match(/^([A-Za-zÀ-ÿ][\w\s&/'-]{1,40})\s*[:：]\s*(.+)$/);
  if(inline){
   const key=headerKeyForLine(inline[1]);
   if(key){cur=key;out[cur]=out[cur]||[];if(inline[2].length>1)out[cur].push(inline[2].trim());return}
  }
  const key=headerKeyForLine(trimmed);
  if(key){cur=key;out[cur]=out[cur]||[]}else{(out[cur]=out[cur]||[]).push(trimmed)}
 });
 return enrichBlocksFromTop(out);
}
export function enrichBlocksFromTop(blocks){
 const out={...blocks,top:[...(blocks.top||[])]};
 const hasBody=['experience','education','skills','summary'].some(k=>(out[k]||[]).length);
 if(hasBody)return out;
 const top=out.top||[];
 if(top.length<6)return out;
 let cur='top';
 const split={top:[]};
 top.forEach(line=>{
  const key=headerKeyForLine(line);
  if(key){cur=key;split[cur]=split[cur]||[]}else{(split[cur]=split[cur]||[]).push(line)}
 });
 const gained=['experience','education','skills','tools','languages','summary','clients','contact','location'].filter(k=>(split[k]||[]).length);
 if(!gained.length)return out;
 gained.forEach(k=>{out[k]=split[k]});
 out.top=split.top||[];
 return out;
}
export function sectionBlocks(text){return detectSections(text)}
export function isSectionHeaderLine(line){
 try{return !!headerKeyForLine(line)}catch{return false}
}
export function clientInLine(line){
 const sample=String(line||'').slice(0,320);
 if(!sample)return [];
 return KNOWN_CLIENTS.filter((c)=>termMatchesHay(sample,c));
}
export function lineLooksLikeClientList(line){
 const hits=clientInLine(line);
 const words=line.split(/\s+/).filter(Boolean);
 return hits.length>=2||(words.length>=3&&hits.length/words.length>=0.45);
}
export function lineLooksLikeName(line){
 if(!line||line.length<4||line.length>52)return false;
 if(lineLooksLikeClientList(line))return false;
 if(/[@+0-9]|https?:|linkedin|portfolio|experience|education|skills|profile|cv|resume/i.test(line))return false;
 if(TITLE_HINTS.test(line)&&line.split(/\s+/).length>4)return false;
 const words=line.replace(/[^A-Za-zÀ-ÿ' -]/g,' ').trim().split(/\s+/).filter(Boolean);
 if(words.length<2||words.length>5)return false;
 if(words.some(w=>isWeirdToken(w)||w.length<2||w.length>20))return false;
 if(words.some(w=>KNOWN_CLIENTS.some(c=>c.toLowerCase()===w.toLowerCase())))return false;
 if(words.every(w=>/^[A-ZÀ-Ö][a-zà-ö'-]+$/.test(w)||/^[A-ZÀ-Ö]{2,}$/.test(w)))return true;
 if(words.length<=4&&!TITLE_HINTS.test(line))return true;
 return false;
}
export function lineLooksLikeTitle(line){
 if(!line||line.length<6||line.length>90)return false;
 if(isBadTitleCandidate(line))return false;
 if(lineLooksLikeClientList(line)||nameLooksLikeBrandList(line))return false;
 if(lineHasJunk(line))return false;
 if(EMAIL_RE.test(line)||PHONE_RE.test(line))return false;
 if(/https?:\/\//i.test(line)||/\b(linkedin|portfolio|github|behance|dribbble)\b/i.test(line))return false;
 if(isSectionHeaderLine(line))return false;
 const words=line.replace(/[&/]/g,' and ').split(/\s+/).filter(w=>w.length>1);
 if(words.length===1&&TITLE_HINTS.test(line))return true;
 if(words.length<2||words.length>8)return false;
 if(words.filter(isWeirdToken).length>0)return false;
 if(TITLE_HINTS.test(line)||PROFESSIONAL_TITLE_WORDS.test(line))return true;
 const caps=words.filter(w=>/^[A-ZÀ-Ö]/.test(w)).length;
 if(caps>=2&&caps>=Math.ceil(words.length*0.5)&&(line.includes('&')||/\//.test(line)||/[-–—]/.test(line)))return true;
 if(words.length<=5&&caps>=2&&!/\b(19|20)\d{2}\b/.test(line))return true;
 return false;
}
export function splitListItems(text){
 const src=String(text||'').trim();
 if(!src)return [];
 const parts=src.split(/\n|;|·|•|\*|―|—|–|\||,(?![0-9])/).map(x=>x.trim().replace(/^[-•*]\s*/,'').replace(/\s{2,}/g,' ').trim());
 return parts.filter(x=>{
  if(x.length<2||x.length>56)return false;
  if(x.length===1||/^[\W\d]+$/.test(x))return false;
  if(isWeirdToken(x)||lineHasJunk(x))return false;
  if(KNOWN_CLIENTS.includes(x))return false;
  if(/^(experience|education|skills|tools|languages|ervaring|opleiding)$/i.test(x))return false;
  return true;
 });
}
export function experienceSourceLines(blocks){
 const top=(blocks.top||[]);
 let topExp=[];
 if(!((blocks.experience||[]).length)){
  let inExp=false;
  top.forEach(l=>{
   const k=headerKeyForLine(l);
   if(k==='experience'||k==='achievements'){inExp=true;return}
   if(k&&k!=='experience'&&k!=='achievements'){inExp=false;return}
   if(inExp)topExp.push(l);
  });
  if(!topExp.length){
   const start=top.findIndex(l=>/\b(19|20)\d{2}\b/.test(l)||TITLE_HINTS.test(l)||/\b(illustrator|designer|freelance|manager)\b/i.test(l));
   if(start>=0)topExp=top.slice(start).filter(l=>{
    const k=headerKeyForLine(l);
    if(isLikelyPortfolioProject(l))return false;
    return !k||k==='experience'||k==='achievements';
   });
  }
 }
 return [].concat(blocks.experience||[],blocks.achievements||[],topExp);
}
export function formatExperienceEntry(title,meta,bullets){
 const role=String(title||'').replace(/\s+/g,' ').trim();
 const company=String(meta||'').replace(/\s+/g,' ').trim();
 const dateM=(role+ ' '+company).match(/\b((?:19|20)\d{2}\s*[-–—]\s*(?:present|présent|current|now|aujourd'?hui|\d{4}))\b/i);
 const dates=dateM?dateM[1]:'';
 let roleClean=dates?role.replace(dates,'').trim():role;
 let companyClean=dates&&company?company.replace(dates,'').trim():company;
 if(!companyClean&&roleClean.includes(' — ')){
  const parts=roleClean.split(/\s*[-–—|@]\s*/).map(p=>p.trim()).filter(Boolean);
  if(parts.length>=2){roleClean=parts[0];companyClean=parts.slice(1).join(' — ');}
 }
 const head=[roleClean,companyClean,dates].filter(Boolean).join(' — ').replace(/\s+/g,' ').trim();
 if(bullets.length){
  const b=bullets.slice(0,3).map(x=>x.replace(/^[-•*]\s*/,'').trim()).filter(x=>x.length>8);
  if(b.length)return head+(b.length?': '+b.join(' · '):'');
 }
 return head;
}
export function detectExperience(blocks){
 const lines=experienceSourceLines(blocks);
 const strict=parseStrictExperiencesFromLines(lines,{experienceSectionLines:lines});
 const out=strict.experiences.map(e=>{
  const head=[e.role,e.company,e.dates||e.startDate].filter(Boolean).join(' — ');
  const b=(e.bullets||[]).slice(0,3).map(x=>x.replace(/^[-•*]\s*/,'').trim()).filter(x=>x.length>8);
  return b.length?formatExperienceEntry(e.role,e.company?`${e.company} · ${e.dates||''}`:e.dates||'',b):head;
 }).filter(x=>isValidExperienceLine(x));
 return [...new Set(out.map(x=>x.replace(/\s+/g,' ').trim()))].slice(0,12);
}
export function parseExperienceLines(lines){return detectExperience({experience:lines})}
export function parseEducationLines(lines, allLines = lines){
 return harvestEducation(allLines || lines, lines, {
  lineHasJunk,
  isSectionHeaderLine,
 });
}
export function extractSummaryText(blocks,lines,name,title){
 const fromSec=(blocks.summary||[]).filter(l=>{
  if(l.length<20||lineHasJunk(l)||lineIsClientList(l)||isSectionHeaderLine(l))return false;
  if(EMAIL_RE.test(l)||PHONE_RE.test(l)||LINKEDIN_RE.test(l))return false;
  return true;
 });
 if(fromSec.length){
  const joined=stripContactFromProse(fromSec.join(' ').replace(/\s+/g,' ').trim());
  return isValidSummaryField(joined)?joined:'';
 }
 const top=blocks.top||[];
 const paras=[];
 for(const l of top){
  if(l===name||l===title)continue;
  if(headerKeyForLine(l))break;
  if(EMAIL_RE.test(l)||PHONE_RE.test(l)||LINKEDIN_RE.test(l))continue;
  if(/\b(19|20)\d{2}\b/.test(l)&&l.length<40)break;
  if(lineLooksLikeTitle(l)||EXPERIENCE_ROLE_RE.test(l))continue;
  if(lineIsClientList(l))continue;
  if(l.length>=36)paras.push(stripContactFromProse(l));
  if(paras.length>=2)break;
 }
 const joined=paras.join(' ').replace(/\s+/g,' ').trim();
 return isValidSummaryField(joined)?joined:'';
}
export function detectToolsFromText(text,blocks){
 const fromSection=splitListItems((blocks.tools||[]).join('\n'));
 const found=[];
 KNOWN_TOOLS.forEach(tool=>{
  if(new RegExp('\\b'+tool.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text))found.push(tool);
 });
 return [...new Set([...fromSection,...found])].filter(t=>!isWeirdToken(t)).slice(0,10);
}
export function detectSkills(blocks,skillSetExclude,toolSetExclude){
 const raw=splitListItems((blocks.skills||[]).join('\n'));
 const seen=new Set();
 const filtered=raw.filter(s=>{
  const k=s.toLowerCase();
  if(seen.has(k))return false;
  if(KNOWN_CLIENTS.some(c=>c.toLowerCase()===k))return false;
  if(KNOWN_TOOLS.some(t=>t.toLowerCase()===k))return false;
  if(skillSetExclude&&skillSetExclude.has(k))return false;
  if(toolSetExclude&&toolSetExclude.has(k))return false;
  if(isWeirdToken(s)||lineHasJunk(s))return false;
  seen.add(k);
  return s.length>2&&s.length<40;
 });
 return partitionSkillsAndInterests(filtered).skills.slice(0,14);
}
export function detectInterests(blocks){
 const fromSection=splitListItems((blocks.interests||[]).join('\n'));
 const raw=splitListItems((blocks.skills||[]).join('\n'));
 const fromSkills=partitionSkillsAndInterests(raw).interests;
 return [...new Set([...fromSection,...fromSkills])].slice(0,8);
}
export function detectSkillsFromBlocks(blocks,skillSetExclude){return detectSkills(blocks,skillSetExclude)}
export function normalizeUrl(url){
 if(!url)return '';
 let u=String(url).trim();
 if(!/^https?:\/\//i.test(u))u='https://'+u.replace(/^\/\//,'');
 return u.replace(/[),.;]+$/,'').slice(0,120);
}
export function validateLinkedIn(u){return u&&LINKEDIN_RE.test(u)&&u.length<120}
export function validatePortfolio(u){
 if(!u||u.length<8||u.length>120)return false;
 if(LINKEDIN_RE.test(u))return false;
 if(EMAIL_RE.test(u))return false;
 return /^https?:\/\//i.test(u)||/^[\w.-]+\.(com|net|org|io|fr|be|nl|design|art|me|dev)\b/i.test(u);
}
export function detectContactInfo(cleanedText,lines,blocks){
 const contactBlock=(blocks.contact||[]).join('\n');
 const blob=contactBlock?[contactBlock,cleanedText].filter(Boolean).join('\n'):cleanedText;
 const emails=[...new Set((blob.match(new RegExp(EMAIL_RE.source,'gi'))||[]).map(e=>e.trim()))];
 const email=emails.find(e=>!/\.\.|@\.|\.@/.test(e))||'';
 const phones=[...new Set((blob.match(new RegExp(PHONE_RE.source,'g'))||[]).map(p=>p.trim()))];
 let phone='';
 for(const raw of phones){
  const norm=normalizeContactPhone(raw);
  if(norm.phone&&validatePhone(norm.phone)){phone=norm.phone;break}
 }
 if(!phone){
  const fromBlob=extractPhoneCandidate(blob);
  if(fromBlob&&validatePhone(fromBlob))phone=fromBlob;
 }
 let linkedin='';
 const liMatch=blob.match(LINKEDIN_RE);
 if(liMatch)linkedin=normalizeUrl(liMatch[0]);
 else{
  for(const l of lines.slice(0,12)){
   const liFromLine=l.match(/linkedin\.com\/[\w\-/]+/i);
   if(/linkedin/i.test(l)&&liFromLine){linkedin=normalizeUrl('https://'+liFromLine[0]);break}
  }
 }
 let portfolio='';
 const urls=(blob.match(/https?:\/\/[^\s)]+/gi)||[]).filter(u=>!LINKEDIN_RE.test(u)&&!/linkedin\.com/i.test(u));
 if(urls.length)portfolio=normalizeUrl(urls[0]);
 else{
  for(const l of lines.slice(0,12)){
   if(/portfolio|behance|dribbble|github|site web|website/i.test(l)){
    const m=l.match(PORTFOLIO_RE);
    if(m&&!LINKEDIN_RE.test(m[0])){portfolio=normalizeUrl(m[0]);break}
   }
  }
 }
 const location=parseLocation(cleanedText,lines,blocks);
 return{email,phone,linkedin,portfolio,location};
}
export function parseLocation(cleanedText,lines,blocks){
 const locLines=(blocks.location||[]).filter(l=>!lineHasJunk(l)&&l.length>2&&l.length<80);
 if(locLines.length)return locLines.join(', ').replace(/\s+/g,' ').trim().slice(0,72);
 for(const l of lines.slice(0,8)){
  if(lineLooksLikeName(l)||lineLooksLikeTitle(l))continue;
  if(EMAIL_RE.test(l)||PHONE_RE.test(l))continue;
  if(/linkedin|portfolio|github|behance|http/i.test(l))continue;
  const t=l.trim();
  if(t.length<4||t.length>72||lineHasJunk(t))continue;
  if(LOCATION_CITIES.test(t)||LOCATION_COUNTRY.test(t)||/\b\d{5}\b/.test(t))return t;
  if(/,\s*(France|UK|USA|Belgium|Switzerland|Germany|Canada)/i.test(t))return t;
 }
 const m=cleanedText.match(new RegExp('('+LOCATION_CITIES.source+')\\s*,?\\s*('+LOCATION_COUNTRY.source+')?','i'));
 if(m)return m[0].trim().slice(0,72);
 return '';
}
export function validateEmail(e){return e&&EMAIL_RE.test(e)&&e.length<80&&!/\s/.test(e)}
export function validatePhone(p){return validatePhoneStrict(p)}
export function validateLocation(loc){return loc&&loc.length>=3&&loc.length<=72&&!lineHasJunk(loc)&&!EMAIL_RE.test(loc)&&!validatePhone(loc)}
export function parseLanguages(lines){
 const out=[];
 for(const raw of lines||[]){
  for(const chunk of splitListItems(String(raw||''))){
   const l=chunk.trim();
   if(!l)continue;
   const strict=extractStrictLanguageLine(l);
   if(strict.ok&&strict.display){
    out.push(strict.display);
    continue;
   }
   KNOWN_LANGS.forEach(({re,label})=>{
    if(re.test(l)&&!out.some(x=>x.toLowerCase().startsWith(label.toLowerCase()))){
     const candidate=extractStrictLanguageLine(label);
     if(candidate.ok&&candidate.display)out.push(candidate.display);
     else if(!isForbiddenLanguageLine(l))out.push(label);
    }
   });
  }
 }
 return [...new Set(out)].slice(0,6);
}
export function emptyCVData(){return{name:'',title:'',email:'',phone:'',linkedin:'',portfolio:'',location:'',summary:'',experience:[],unknownExperience:[],toClassify:[],education:[],skills:[],tools:[],languages:[],clients:[],awards:[],exhibitions:[],publications:[],portfolioLinks:[],interests:[],projects:[],other:[],unsorted:[],sectionConfidence:{},extra:[],_creativeMode:null}}
export function isPlaceholderValue(s){
 const t=String(s||'').trim();
 if(!t)return true;
 if(CV_PLACEHOLDER_RE.test(t))return true;
 if(/^professional\s+(profile|summary)/i.test(t)&&t.length<90)return true;
 return false;
}
export function mergeScalar(validated,structured,key){
 const a=String((validated&&validated[key])||'').trim();
 const b=String((structured&&structured[key])||'').trim();
 if(!isPlaceholderValue(a))return a;
 if(!isPlaceholderValue(b))return b;
 return '';
}
export function mergeList(validated,structured,key,filterFn,max){
 const seen=new Set();
 const out=[];
 [...(validated&&validated[key]||[]),...(structured&&structured[key]||[])].forEach(x=>{
  const t=String(x||'').trim();
  if(!t||seen.has(t.toLowerCase()))return;
  if(filterFn&&!filterFn(t))return;
  seen.add(t.toLowerCase());
  out.push(t);
 });
 return out.slice(0,max);
}
export function sanitizeScalarField(val,key){
 const s=String(val||'').trim().slice(0,key==='name'?200:520);
 if(!s||isPlaceholderValue(s))return '';
 if(key==='name'&&(isBadName(s)||nameLooksLikeBrandList(s)||isSectionAnchorField(s)))return '';
 if(key==='title'&&(lineHasJunk(s)||!isValidTitleField(s)||isSectionAnchorField(s)))return '';
 if(key==='summary'&&(lineIsClientList(s)||!isValidSummaryField(stripContactFromProse(s))))return '';
 if(key==='summary')return stripContactFromProse(s).slice(0,520);
 return s;
}
export function normalizeCvData(p){
 const d=emptyCVData();
 if(!p)return d;
 d.name=sanitizeScalarField(p.name,'name');
 d.title=sanitizeScalarField(p.title,'title');
 const rawEmail=String(p.email||'').trim();
 const extractedEmail=extractEmailFromHeaderText(rawEmail);
 d.email=validateEmail(rawEmail)?rawEmail:(validateEmail(extractedEmail)?extractedEmail:'');
 const rawPhone=String(p.phone||'').trim();
 const phoneNorm=normalizeContactPhone(rawPhone);
 const headerPhone=extractPhoneCandidate(extractPhoneFromHeaderText(rawPhone));
 d.phone=phoneNorm.phone&&validatePhone(phoneNorm.phone)?phoneNorm.phone:(headerPhone&&validatePhone(headerPhone)?headerPhone:'');
 d.linkedin=validateLinkedIn(p.linkedin)?String(p.linkedin||'').trim():'';
 d.portfolio=validatePortfolio(p.portfolio)?String(p.portfolio||'').trim():'';
 d.location=validateLocation(p.location)?String(p.location||'').trim():sanitizeScalarField(p.location,'location');
 d.summary=sanitizeScalarField(p.summary,'summary');
 d.experience=(p.experience||[]).map(x=>{
  if(x&&typeof x==='object'){
   const parts=[x.role,x.company,x.dates].filter(Boolean);
   if(x.bullets?.length)return parts.concat(x.bullets).join(' — ');
   return parts.join(' — ');
  }
  const raw=String(x||'').trim();
  const line=isValidExperienceLine(raw)?raw:stripContactFromProse(raw);
  return line;
 }).filter(x=>isValidExperienceLine(x)&&!isSectionHeaderLine(x)).slice(0,12);
 d.unknownExperience=(p.unknownExperience||[]).map(x=>String(x||'').trim()).filter(x=>x.length>=4&&!isSectionHeaderLine(x)).slice(0,12);
 d.education=(p.education||[]).map(x=>String(x||'').trim()).filter(x=>isValidEducationItem(x)).slice(0,6);
 const part=partitionSkillsAndInterests((p.skills||[]).map(x=>String(x||'').trim()));
 d.skills=part.skills.filter(x=>isValidListItem(x)).slice(0,14);
 const interestMap=new Map();
 [...(p.interests||[]),...part.interests].forEach(x=>{
  const t=String(x||'').trim();
  if(t&&isValidListItem(t))interestMap.set(t.toLowerCase(),t);
 });
 d.interests=[...interestMap.values()].slice(0,8);
 d.tools=(p.tools||[]).map(x=>String(x||'').trim()).filter(x=>isValidListItem(x)).slice(0,10);
 d.languages=(p.languages||[]).map(x=>String(x||'').trim()).filter(x=>isValidListItem(x)).slice(0,4);
 d.clients=(p.clients||[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,12);
 d.projects=(p.projects||[]).map(x=>String(x||'').trim()).filter(x=>x&&!isSectionHeaderLine(x)).slice(0,12);
 d.unsorted=(p.unsorted||[]).map(x=>String(x||'').trim()).filter(x=>x&&!isSectionHeaderLine(x)).slice(0,24);
 d.toClassify=(p.toClassify||[]).map(x=>{
  if(x&&typeof x==='object'&&x.text)return x;
  const t=String(x||'').trim();
  return t?{id:`tc-n-${t.slice(0,12)}`,text:t,source:'import',confidence:45}:null;
 }).filter(Boolean).slice(0,48);
 d.sectionConfidence={...(p.sectionConfidence||{})};
 d._enterprise=p._enterprise||null;
 d._parserReview=[...(p._parserReview||[])];
 d._extractionReview=[...(p._extractionReview||[])];
 d._sourceLines=[...(p._sourceLines||[])];
 d.extra=(p.extra||[]).map(x=>String(x||'').trim()).filter(x=>isValidListItem(x)).slice(0,8);
 if(isBadName(d.name)||nameLooksLikeBrandList(d.name)||isPlaceholderValue(d.name))d.name='';
 if(!d.name)d.name=NAME_UNCERTAIN_LABEL;
 if(isPlaceholderValue(d.title)||!isValidTitleField(d.title)||isBadTitleCandidate(d.title))d.title='';
 if(d.title&&(d.title.length>52||/^(Led|Built|Managed|Created|Developed|Shipped|Collaborated|Translated|Designed|Delivered)\b/i.test(d.title)))d.title='';
 if(isPlaceholderValue(d.email))d.email='';
 d.summary=sanitizeSummaryText(d.summary,{email:d.email,phone:d.phone});
 if(!isValidSummaryField(d.summary))d.summary='';
 const firewalled=applyOcrContaminationFirewall(segregateClientBrands(d));
 if(firewalled._experienceReconstructed){
  return applyDataSanitizationLayer(firewalled);
 }
 const reconstructed=applyExperienceReconstruction(firewalled);
 reconstructed._experienceReconstructed=true;
 return applyDataSanitizationLayer(reconstructed);
}
export function cvDataHasMinimum(d){
 if(!d)return false;
 return !!(d.name||d.title||d.email||d.phone||(d.summary&&d.summary.length>5)||(d.experience&&d.experience.length)||(d.unknownExperience&&d.unknownExperience.length)||(d.toClassify&&d.toClassify.length)||(d.skills&&d.skills.length)||(d.education&&d.education.length)||(d.tools&&d.tools.length)||(d.unsorted&&d.unsorted.length));
}
export function cvDataIsRenderable(d){
 if(!d)return false;
 if(cvDataHasMinimum(d))return true;
 return !!(
  (d.summary&&d.summary.length>8)||
  (d.experience&&d.experience.length)||
  (d.unknownExperience&&d.unknownExperience.length)||
  (d.toClassify&&d.toClassify.length)||
  (d.unsorted&&d.unsorted.length)||
  (d.name&&d.name.length>1)
 );
}
/** Never null — summary + experience lines + keyword skills from any readable input. */
export function buildForcedPartialCvData(rawText,cleanText){
 const raw=String(rawText||'').trim();
 const clean=String(cleanText||cleanExtraction(raw)).trim()||raw;
 const lines=clean.split('\n').map(l=>l.trim()).filter(Boolean);
 const out={...emptyCVData()};
 const paragraphs=clean.split(/\n\n+/).map(p=>p.replace(/\s+/g,' ').trim()).filter(p=>p.length>20);
 const sumCand=stripContactFromProse(paragraphs[0]||lines.find(l=>l.length>40&&!isSectionHeaderLine(l)&&!EMAIL_RE.test(l)&&!lineIsClientList(l))||'');
 out.summary=isValidSummaryField(sumCand)?sumCand.slice(0,520):'';
 out.experience=lines.filter(l=>{
  if(l.length<10||isSectionHeaderLine(l)||EMAIL_RE.test(l)||PHONE_RE.test(l))return false;
  if(l===out.summary)return false;
  if(isLikelyPortfolioProject(l))return false;
  return passesExperienceGate(l);
 }).slice(0,12);
 out.projects=lines.filter(l=>isLikelyPortfolioProject(l)).slice(0,12);
 const skillLine=lines.find(l=>/^(skills|compétences|competences|expertise)\b/i.test(l)&&/,/.test(l));
 if(skillLine)out.skills=splitListItems(skillLine.replace(/^[^:]+:\s*/i,'')).slice(0,14);
 if(!out.skills.length){
  const comma=lines.find(l=>/,/.test(l)&&l.length>12&&l.length<140&&!EMAIL_RE.test(l)&&!isSectionHeaderLine(l));
  if(comma)out.skills=splitListItems(comma).slice(0,14);
 }
 if(!out.skills.length){
  out.skills=KNOWN_TOOLS.filter(t=>new RegExp('\\b'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(clean)).slice(0,8);
 }
 for(const l of lines.slice(0,8)){
  if(lineLooksLikeName(l)&&!nameLooksLikeBrandList(l)){
   const n=titleCaseName(l.replace(/[^A-Za-zÀ-ÿ' -]/g,' ').replace(/\s+/g,' ').trim());
   if(!isBadName(n)){out.name=n;break}
  }
 }
 for(const l of lines.slice(0,10)){
  if(l===out.name)continue;
  if(lineLooksLikeTitle(l)){out.title=l.trim();break}
 }
 const email=clean.match(EMAIL_RE);
 if(email)out.email=email[0];
 const phone=clean.match(PHONE_RE);
 if(phone)out.phone=phone[0].trim();
 return normalizeCvData(out);
}
/** Keep manual textarea edits under Experience visible in preview (append lines missing from parse). */
export function syncExperienceFromRawText(rawText,cvData){
 if(!cvData||!rawText)return cvData;
 const lines=String(rawText).split('\n').map(l=>l.trim()).filter(Boolean);
 const base=(cvData.experience||[]).map(x=>String(x).trim()).filter(Boolean);
 const known=new Set(base.map(x=>x.toLowerCase()));
 const added=[];
 let inExp=false;
 for(const line of lines){
  if(/^(experience|expériences?|professional experience|work experience|emploi|parcours)\b/i.test(line)){inExp=true;continue}
  if(inExp&&/^(education|formation|skills?|compétences|tools?|languages?|langues|clients?|projects?|certifications?)\b/i.test(line)){inExp=false;continue}
  if(inExp&&line.length>8&&!known.has(line.toLowerCase())&&!isSectionHeaderLine(line)&&!lineHasJunk(line)){
   added.push(line);
   known.add(line.toLowerCase());
  }
 }
 if(!added.length)return cvData;
 const merged=[...added,...base.filter(x=>!added.some(a=>a.toLowerCase()===x.toLowerCase()))];
 return normalizeCvData({...cvData,experience:merged});
}
/** Canonical: rawText → cleanText → parseCV() → cvData (never null). */
export function forceCvDataFromText(rawText){
 const text=String(rawText||'').trim();
 if(!text)return buildForcedPartialCvData('','');
 const cleanText=cleanExtraction(text);
 if(text.length<20)return buildForcedPartialCvData(text,cleanText);
 const parsed=normalizeCvData(parseCV(cleanText.length>=20?cleanText:text));
 if(cvDataIsRenderable(parsed))return parsed;
 return buildForcedPartialCvData(text,cleanText);
}
export function hasValidInput(){
 return !!(state.cvData||String(state.text||($('cvText')&&$('cvText').value)||'').trim().length>=10);
}
export function buildFallbackCvDataFromText(cleanText){
 return forceCvDataFromText(String(cleanText||'').trim());
}
export function buildPartialCvDataFromText(cleanText,structured){
 const clean=String(cleanText||'').trim();
 if(structured&&cvDataIsRenderable(normalizeCvData(structured)))return normalizeCvData(structured);
 return buildForcedPartialCvData(clean,cleanExtraction(clean));
}
export function ensureCvDataFromPipeline(pipeline){
 if(!pipeline)return buildForcedPartialCvData('','');
 const clean=String(pipeline.cleanedText||pipeline.rawText||'').trim();
 if(!clean)return buildForcedPartialCvData('','');
 return forceCvDataFromText(clean);
}
export function extractRawText(raw){return String(raw||'')}

/** Browser UI must use importText/importFile; Node QA may set HIRELY_ALLOW_LEGACY_PARSE_CV=true. */
export function isLegacyParseCvAllowed() {
  if (globalThis.HIRELY_ALLOW_LEGACY_PARSE_CV === true) return true;
  if (typeof window === 'undefined') return true;
  return false;
}

/** @deprecated Production UI — use canonical importFile/importText (blocks pipeline only). */
export function parseCV(rawText){
 if(!isLegacyParseCvAllowed()){
  console.warn('[Hirely] parseCV() disabled in browser. Use importText() or importFile().');
  return normalizeCvData(emptyCVData());
 }
 const raw=String(rawText||'').trim();
 const cleaned=cleanExtraction(raw);
 const text=cleaned.length>=20?cleaned:raw;
 const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
 const out={...emptyCVData()};
 if(text.length<20){
  if(raw.length>=10){
   out.summary=raw.replace(/\s+/g,' ').slice(0,520);
   out.experience=lines.filter(l=>passesExperienceGate(l)).slice(0,12);
  }
  return normalizeCvData(out);
 }
 const s=parseStructuredCV(text);
 out.name=s.name||'';
 out.title=s.title||'';
 out.email=s.email||'';
 out.phone=s.phone||'';
 out.linkedin=s.linkedin||'';
 out.portfolio=s.portfolio||'';
 out.location=s.location||'';
 out.summary=s.summary||'';
 out.experience=[...(s.experience||[])];
 out.unknownExperience=[...(s.unknownExperience||[])];
 out.education=[...(s.education||[])];
 out.skills=[...(s.skills||[])];
 out.tools=[...(s.tools||[])];
 out.languages=[...(s.languages||[])];
 out.clients=[...(s.clients||[])];
 out.interests=[...(s.interests||[])];
 out.projects=[...(s.projects||[])];
 out.unsorted=[...(s.unsorted||[])];
 out.sectionConfidence={...(s.sectionConfidence||{})};
 out._extractionReview=[...(s._extractionReview||[])];
 out._parserReview=[...(s._parserReview||[])];
 out._enterprise=s._enterprise||null;
 out._sourceLines=lines;
 if(!out.summary||out.summary.length<20){
  for(const l of lines){
   if(isSectionHeaderLine(l)||EMAIL_RE.test(l)||PHONE_RE.test(l))continue;
   if(l===out.name||l===out.title)continue;
   if(EXPERIENCE_ROLE_RE.test(l))continue;
   if(l.length>40&&!lineIsClientList(l)){
    const cand=stripContactFromProse(l).slice(0,520);
    if(isValidSummaryField(cand)){out.summary=cand;break}
   }
  }
 }
 if(!out.experience.length){
  lines.forEach(l=>{
   const t=l.replace(/^[-•*]\s*/,'').trim();
   if(t.length<10||isSectionHeaderLine(t)||EMAIL_RE.test(t)||PHONE_RE.test(t))return;
   if(t===out.name||t===out.title||t===out.summary)return;
   if(isLikelyPortfolioProject(t)){
    if(!out.projects.includes(t))out.projects.push(t);
    return;
   }
   if(!passesExperienceGate(t))return;
   if(!out.experience.includes(t))out.experience.push(t);
  });
 }
 if(!out.skills.length){
  for(const l of lines){
   if(/^(skills|compétences|competences|expertise)\b/i.test(l)&&/,/.test(l)){
    out.skills=splitListItems(l.replace(/^[^:]+:\s*/i,'')).slice(0,14);
    break;
   }
  }
  if(!out.skills.length){
   const comma=lines.find(l=>/,/.test(l)&&l.length>12&&l.length<140&&!EMAIL_RE.test(l)&&!PHONE_RE.test(l)&&!isSectionHeaderLine(l));
    if(comma)out.skills=splitListItems(comma).slice(0,14);
  }
 }
 const rejected=getLastRejectedLines();
 const uncertain=getLastUncertainLines();
 for(const l of [...rejected,...uncertain]){
  const t=String(l||'').trim();
  if(t.length<6||isSectionHeaderLine(t))continue;
  if(isLikelyGarbageLine(t))continue;
  if(!out.unsorted.includes(t))out.unsorted.push(t);
 }
 if(out.education.length<=1){
  const eduLines=lines.filter(l=>/\b(19|20)\d{2}|créapole|lisaa|school|university|formation\b/i.test(l)&&l.length>8);
  out.education=structureEducationEntries([...new Set([...out.education,...eduLines])]);
 }
 if(!out.experience.length){
  const anchored=extractExperiencesFromSectionAnchors(lines,cleaned);
  if(anchored.length){
   out.experience=anchored.map(e=>{
    const head=[e.role,e.company,[e.startDate,e.endDate].filter(Boolean).join('–')].filter(Boolean).join(' — ');
    return e.bullets?.length?`${head}: ${e.bullets.join(' · ')}`:head;
   });
  }else out.experience=harvestExperienceFromLines(lines,{lineHasJunk,isSectionHeaderLine});
 }
 if(!out.title||isBadTitleCandidate(out.title)){
  const ct=resolveCreativeProfessionalTitle(lines,cleaned);
  if(ct&&isValidIdentityTitle(ct))out.title=ct;
 }
 if(!out.experience.length&&!out.unknownExperience.length){
  const orphanCareer=lines.filter((l)=>lineMayBeUnknownExperience(l));
  if(orphanCareer.length)out.unknownExperience=orphanCareer.slice(0,12);
 }
 out.unsorted=recoverOrphanLinesToUnsorted(lines,out);
 if(!out.experience.length&&!out.skills.length&&out.unsorted.length)out._unsortedOnly=true;
 const locked=extractLockedIdentity(lines,{
  contact:{email:out.email,phone:out.phone},
  skillsLines:out.skills,
  interestsLines:out.interests,
  toolsLines:out.tools,
  unsortedLines:out.unsorted,
 });
 if(locked.name&&locked.nameConfidence>=IDENTITY_CONFIDENCE_MIN)out.name=locked.name;
 if(locked.title&&locked.titleConfidence>=IDENTITY_CONFIDENCE_MIN)out.title=locked.title;
 out.extra=[];
 if(out.summary&&out.experience[0]===out.summary)out.experience=out.experience.slice(1);
 return normalizeCvData(out);
}
export function parseCVData(raw){return parseCV(raw)}
export function scoreCV(p){
 p=normalizeCvData(p||emptyCVData());
 let pts=0;
 if(p.name&&!isBadName(p.name))pts+=12;
 if(p.title&&p.title.length>1)pts+=10;
 if(validateEmail(p.email))pts+=10;
 if(validatePhone(p.phone))pts+=8;
 if(p.summary&&p.summary.length>50)pts+=14;
 else if(p.summary&&p.summary.length>20)pts+=8;
 if(p.experience.length>=4)pts+=18;
 else if(p.experience.length>=2)pts+=14;
 else if(p.experience.length>=1)pts+=8;
 if(p.skills.length>=6)pts+=12;
 else if(p.skills.length>=3)pts+=8;
 else if(p.skills.length>=1)pts+=4;
 if(p.education.length)pts+=8;
 if(p.tools.length)pts+=4;
 if(p.languages.length)pts+=4;
 if(validateLinkedIn(p.linkedin)||validatePortfolio(p.portfolio))pts+=4;
 if(p.name&&p.title&&p.summary&&p.experience.length)pts+=6;
 return clampTotalScore(pts);
}
export function parseStructuredCV(cleanedText){
 const blocks=collectSectionsOrderAgnostic(cleanedText, enrichBlocksFromTop, activeExtractionLines);
 const lines=cleanedText.split('\n').filter(Boolean);
 const contact=detectContactInfo(cleanedText,lines,blocks);
 const parseHelpers={titleCaseName,lineLooksLikeName,isBadName,nameLooksLikeBrandList,isSectionHeaderLine,lineLooksLikeTitle};
 const locked=extractLockedIdentity(lines,{contact});
 let name=locked.name&&locked.nameConfidence>=IDENTITY_CONFIDENCE_MIN?locked.name:'';
 let title=locked.title&&locked.titleConfidence>=IDENTITY_CONFIDENCE_MIN?locked.title:'';
 const nameResult={
  resolvedName:name,
  selectedName:name,
  displayName:name,
  candidates:locked.nameCandidates||[],
  confidence:locked.nameConfidence||0,
  uncertain:!name,
  source:locked.nameSource,
 };
 const titleResult={
  selectedTitle:title,
  best:title,
  confidence:locked.titleConfidence||0,
  source:locked.titleSource,
  sourceLines:title?[title]:[],
 };
 let enterprise=blocks._enterprise||buildEnterpriseParse(blocks,lines);
 enterprise=attachIdentityFields(enterprise,nameResult,titleResult,contact);
 if(enterprise.identity.name?.value&&!enterprise.identity.name.needsReview)name=enterprise.identity.name.value;
 if(enterprise.identity.title?.value&&!enterprise.identity.title.needsReview)title=enterprise.identity.title.value;
 const languages=enterprise.languages.length
  ?enterprise.languages.map(e=>e.text)
  :parseLanguages(blocks.languages||[]);
 const langSet=new Set(languages.map(l=>l.split(/[—–-]/)[0].trim().toLowerCase()));
 const blockTools=detectToolsFromText(cleanedText,blocks);
 const entTools=enterprise.tools.map(e=>e.text);
 const tools=[...new Set([...blockTools,...entTools])].slice(0,14);
 const toolSet=new Set(tools.map(t=>t.toLowerCase()));
 const blockSkills=detectSkills(blocks,langSet,toolSet);
 const entSkills=enterprise.skills.map(e=>e.text);
 const skills=[...new Set([...blockSkills,...entSkills])].filter(s=>{
  const k=s.toLowerCase();
  return !toolSet.has(k)&&!langSet.has(k);
 }).slice(0,16);
 const interests=detectInterests(blocks);
 let experience=enterprise.experiences.map(experienceEntryToLegacyString);
 if(!experience.length){
  experience=detectExperience(blocks).filter(l=>passesExperienceGate(l));
 }
 if(!experience.length){
  experience=harvestExperienceFromLines(lines,parseHelpers);
 }
 const eduRaw=[
  ...enterprise.education.map(e=>e.text),
  ...(blocks.education||[]).map(l=>String(l).trim()),
  ...parseEducationLines(blocks.education||[],lines),
 ].filter(Boolean);
 let education=structureEducationEntries([...new Set(eduRaw)]);
 const summary=enterprise.summary?.needsReview?'':(enterprise.summary?.value||extractSummaryText(blocks,lines,name,title));
 const clientBlock=(blocks.clients||[]).join('\n');
 const clients=enterprise.clients.length
  ?enterprise.clients.map(e=>e.text)
  :KNOWN_CLIENTS.filter(c=>{
  const re=new RegExp('\\b'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
  return re.test(cleanedText)||re.test(clientBlock);
 });
 const projects=enterprise.projects.length
  ?enterprise.projects.map(e=>e.text)
  :(blocks.projects||[]).map(l=>String(l).trim()).filter(Boolean);
 const unsorted=[...new Set([...(enterprise.unsorted||[]),...(blocks.unsorted||[]).map(l=>String(l).trim()).filter(Boolean)])];
 const legacy=enterpriseToLegacyCvData(enterprise,{
  name,title,email:contact.email,phone:contact.phone,linkedin:contact.linkedin,portfolio:contact.portfolio,location:contact.location,
  summary,experience,education,skills,tools,languages:languages.filter(l=>!toolSet.has(l.split(/[—–-]/)[0].trim().toLowerCase())),
  clients,
  awards:(enterprise.awards||[]).map(e=>typeof e==='string'?e:e.text).filter(Boolean),
  exhibitions:(enterprise.exhibitions||[]).map(e=>typeof e==='string'?e:e.text).filter(Boolean),
  publications:(enterprise.publications||[]).map(e=>typeof e==='string'?e:e.text).filter(Boolean),
  portfolioLinks:(enterprise.portfolioLinks||[]).map(e=>typeof e==='string'?e:e.text).filter(Boolean),
  interests,projects,unsorted,
  _creativeMode:blocks._creativeMode||null,
 });
 return{
  ...legacy,
  sectionConfidence:blocks.sectionConfidence||{},
  _extractionReview:blocks._extractionReview||[],
  _parserReview:enterprise.needsReview||[],
  _sourceLines:lines,
  _enterprise:enterprise,
 };
}

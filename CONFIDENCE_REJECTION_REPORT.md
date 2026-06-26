# Confidence Rejection Report
Generated: 2026-06-06T07:38:12.277Z
Input: Yoaz OCR (`tests/output/ocr-quality-yoaz/report.json`)
## Thresholds
| Gate | Threshold | Source |
|------|-----------|--------|
| Fact pipeline (partition) | 80% | `fact-types.js` FACT_CONFIDENCE_THRESHOLD |
| Line classification | 80% | `classification-engine-v2.js` CLASSIFICATION_CONFIDENCE_MIN |
| Identity (resumeData) | 95% | `confidence-gate.js` |
| Experience | 85% | `confidence-gate.js` |
| Education | 85% | `confidence-gate.js` |
| Skills / tools | 75% | `confidence-gate.js` |

## Summary
| Stage | Rejections |
|-------|------------|
| fact-pipeline (`partitionFactsByConfidence`) | 20 |
| confidence-gate (`applyConfidenceGate`) | 3 |
| **Total** | **23** |

Struct after section-engine: experiences=0, education=4, skills=4, unsorted=31

## 1. Fact pipeline rejections
Trace: `section-engine-v2.js` → `extractFieldsFromSectionBlocks` → `runFactPipeline` → `partitionFactsByConfidence`

| text | predicted section | confidence | required | reason |
|------|-------------------|------------|----------|--------|
| ee à A A TN v3 2 GRADRIC designer & Illustrator | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:section_hint_low |
| designer edition, logos... | unknown | 35% | 80% | fact_type_unknown; fact_confidence_35%_below_80%; classifier:section_hint_low; line_confidence_35% |
| 20N : McCann G. Agency (Internship) | summary | 79% | 80% | fact_confidence_79%_below_80%; classifier:prose_summary; line_confidence_35% |
| visuel identity | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability |
| corporate identity. | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability |
| logos | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability |
| illustrations. | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability |
| editions | unknown | 35% | 80% | fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35% |
| client analyse | unknown | 35% | 80% | fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35% |
| target customer | unknown | 35% | 80% | fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35% |
| art history | unknown | 35% | 80% | fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35% |
| » Be.net/yoaz marketing, technologie, marketing studies | summary | 79% | 80% | fact_confidence_79%_below_80%; classifier:prose_summary; line_confidence_35% |
| ergonomie | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name |
| extern observation | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name |
| maquette | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name |
| TT Lu French: native Photograph: | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token |
| English: fluent Ps] photoshop EEE CTT Mustrator RE scowboscc | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token |
| Print | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token |
| Logo | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability |
| Vector | unknown | 79% | 80% | fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability |

### Fact pipeline detail (JSON)
```json
[
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "ee à A A TN v3 2 GRADRIC designer & Illustrator",
    "predictedSection": "unknown",
    "linePredictedSection": "garbage",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:section_hint_low",
    "classifierReason": "section_hint_low",
    "sectionHint": "unknown",
    "blockClassifyReason": "role_company_block"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "designer edition, logos...",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:section_hint_low; line_confidence_35%",
    "classifierReason": "section_hint_low",
    "sectionHint": "unknown",
    "blockClassifyReason": "role_company_block"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "20N : McCann G. Agency (Internship)",
    "predictedSection": "summary",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_confidence_79%_below_80%; classifier:prose_summary; line_confidence_35%",
    "classifierReason": "prose_summary",
    "sectionHint": "unknown",
    "blockClassifyReason": "section_hint"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "visuel identity",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "corporate identity.",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "logos",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "illustrations.",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "editions",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "client analyse",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "target customer",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "art history",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "» Be.net/yoaz marketing, technologie, marketing studies",
    "predictedSection": "summary",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_confidence_79%_below_80%; classifier:prose_summary; line_confidence_35%",
    "classifierReason": "prose_summary",
    "sectionHint": "unknown",
    "blockClassifyReason": "tag_cluster_rejected_v2"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "ergonomie",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name",
    "classifierReason": "contract_failed:Education must contain a school name",
    "sectionHint": "education",
    "blockClassifyReason": "v2_education_school_entity"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "extern observation",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name",
    "classifierReason": "contract_failed:Education must contain a school name",
    "sectionHint": "education",
    "blockClassifyReason": "v2_education_school_entity"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "maquette",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name",
    "classifierReason": "contract_failed:Education must contain a school name",
    "sectionHint": "education",
    "blockClassifyReason": "v2_education_school_entity"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "TT Lu French: native Photograph:",
    "predictedSection": "unknown",
    "linePredictedSection": "languages",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token",
    "classifierReason": "invalid_language_token",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "English: fluent Ps] photoshop EEE CTT Mustrator RE scowboscc",
    "predictedSection": "unknown",
    "linePredictedSection": "languages",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token",
    "classifierReason": "invalid_language_token",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "Print",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token",
    "classifierReason": "invalid_language_token",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "Logo",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "Vector",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  }
]
```

## 2. Confidence gate rejections (resumeData)
Trace: `resumeDataFromStructured` → `normalizeResumeData` → `applyConfidenceGate`

| text | predicted section | confidence | required | reason |
|------|-------------------|------------|----------|--------|
| Nom à confirmer | identity.name | 0 | 95 | empty_or_placeholder_name |
| 30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator,  | summary | 40 | 85 | partial_sentence_or_ocr_fragment |
| Ic) yoaz27 2008 2009 : Créapole creation school management ign fin hie.  | education | 60 | 85 | below_education_threshold |

### Confidence gate detail (JSON)
```json
[
  {
    "stage": "confidence-gate",
    "module": "confidence-gate.js → applyConfidenceGate",
    "text": "Nom à confirmer",
    "predictedSection": "identity.name",
    "confidence": 0,
    "requiredThreshold": 95,
    "reasonRejected": "empty_or_placeholder_name"
  },
  {
    "stage": "confidence-gate",
    "module": "confidence-gate.js → applyConfidenceGate",
    "text": "30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.",
    "predictedSection": "summary",
    "confidence": 40,
    "requiredThreshold": 85,
    "reasonRejected": "partial_sentence_or_ocr_fragment"
  },
  {
    "stage": "confidence-gate",
    "module": "confidence-gate.js → applyConfidenceGate",
    "text": "Ic) yoaz27 2008 2009 : Créapole creation school management ign fin hie. je",
    "predictedSection": "education",
    "confidence": 60,
    "requiredThreshold": 85,
    "reasonRejected": "below_education_threshold"
  }
]
```

## 3. Per-line classification audit (section-engine input)
| text | block type | predicted section | class conf | fact threshold | notes |
|------|------------|-------------------|------------|----------------|-------|
| ee à A A TN v3 2 GRADRIC designer & Illustrator | UNKNOWN | garbage | 95% | 80% | 1 fact(s) pending |
| 30-year old Illustrator and graphic 2011-2022 : Freelancer I | CONTACT | summary | 82% | 80% | — |
| designer edition, logos... | UNKNOWN | unsorted | 35% | 80% | line_classification_below_80; bucket_unsorted; 1 fact(s) pending |
| (Nike Louis Vuitton, Marvel Cadillec, Fortune, Converse | CLIENTS | clients | 94% | 80% | — |
| Pantone, Adobe, Arte and more) | CLIENTS | tools | 82% | 80% | — |
| 20N : McCann G. Agency (Internship) | UNKNOWN | unsorted | 35% | 80% | line_classification_below_80; bucket_unsorted; 1 fact(s) pending |
| +33649434839 2011 2012 : LISAA, web and motion design | CONTACT | education | 96% | 80% | — |
| 2009 20M : Créapole, creation school management @ man visual | UNKNOWN | education | 92% | 80% | — |
| yoaz@hotmail fr (typography, visuel identity, corporate iden | SKILLS | skills | 92% | 80% | — |
| packaging. poster, logos, web design, illustrations. | SKILLS | skills | 82% | 80% | — |
| editions, client analyse, target customer, art history | SKILLS | unsorted | 35% | 80% | line_classification_below_80; bucket_unsorted |
| » Be.net/yoaz marketing, technologie, marketing studies | UNKNOWN | unsorted | 35% | 80% | line_classification_below_80; bucket_unsorted; 1 fact(s) pending |
| Ic) yoaz27 2008 2009 : Créapole creation school management i | CONTACT | education | 96% | 80% | — |
| Q voaz.tumblr com product design (infographie, ergonomie, ex | EDUCATION | skills | 82% | 80% | — |
| 2007 2009 : Créapole creation school management multisectora | EDUCATION | education | 96% | 80% | — |
| TT Lu French: native Photograph: | LANGUAGES | languages | 94% | 80% | 1 fact(s) pending |
| English: fluent Ps] photoshop EEE CTT Mustrator RE scowboscc | LANGUAGES | languages | 94% | 80% | 1 fact(s) pending |
| [6] incesion me SE Drawing Iustration, Graphic design, Movie | LANGUAGES | skills | 82% | 80% | — |
| Print, Logo, Vector, Art... Reading Music Nature | LANGUAGES | skills | 82% | 80% | — |

## 4. Likely false rejections (valid content flagged)
- **ee à A A TN v3 2 GRADRIC designer & Illustrator** — fact-pipeline: fact_type_unknown; fact_confidence_79%_below_80%; classifier:section_hint_low (conf 79% < 80%)
- **30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic ** — confidence-gate: partial_sentence_or_ocr_fragment (conf 40 < 85)
- **Ic) yoaz27 2008 2009 : Créapole creation school management ign fin hie. je** — confidence-gate: below_education_threshold (conf 60 < 85)

## 5. All rejections (combined)
```json
[
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "ee à A A TN v3 2 GRADRIC designer & Illustrator",
    "predictedSection": "unknown",
    "linePredictedSection": "garbage",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:section_hint_low",
    "classifierReason": "section_hint_low",
    "sectionHint": "unknown",
    "blockClassifyReason": "role_company_block"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "designer edition, logos...",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:section_hint_low; line_confidence_35%",
    "classifierReason": "section_hint_low",
    "sectionHint": "unknown",
    "blockClassifyReason": "role_company_block"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "20N : McCann G. Agency (Internship)",
    "predictedSection": "summary",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_confidence_79%_below_80%; classifier:prose_summary; line_confidence_35%",
    "classifierReason": "prose_summary",
    "sectionHint": "unknown",
    "blockClassifyReason": "section_hint"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "visuel identity",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "corporate identity.",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "logos",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "illustrations.",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "editions",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "client analyse",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "target customer",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "art history",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "35%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_35%_below_80%; classifier:contract_failed:Skill must be a professional capability; line_confidence_35%",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "skill",
    "blockClassifyReason": "v2_skill_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "» Be.net/yoaz marketing, technologie, marketing studies",
    "predictedSection": "summary",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_confidence_79%_below_80%; classifier:prose_summary; line_confidence_35%",
    "classifierReason": "prose_summary",
    "sectionHint": "unknown",
    "blockClassifyReason": "tag_cluster_rejected_v2"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "ergonomie",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name",
    "classifierReason": "contract_failed:Education must contain a school name",
    "sectionHint": "education",
    "blockClassifyReason": "v2_education_school_entity"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "extern observation",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name",
    "classifierReason": "contract_failed:Education must contain a school name",
    "sectionHint": "education",
    "blockClassifyReason": "v2_education_school_entity"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "maquette",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Education must contain a school name",
    "classifierReason": "contract_failed:Education must contain a school name",
    "sectionHint": "education",
    "blockClassifyReason": "v2_education_school_entity"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "TT Lu French: native Photograph:",
    "predictedSection": "unknown",
    "linePredictedSection": "languages",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token",
    "classifierReason": "invalid_language_token",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "English: fluent Ps] photoshop EEE CTT Mustrator RE scowboscc",
    "predictedSection": "unknown",
    "linePredictedSection": "languages",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token",
    "classifierReason": "invalid_language_token",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "Print",
    "predictedSection": "unknown",
    "linePredictedSection": "unsorted",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:invalid_language_token",
    "classifierReason": "invalid_language_token",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "Logo",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "fact-pipeline",
    "module": "cv-from-facts.js → partitionFactsByConfidence",
    "text": "Vector",
    "predictedSection": "unknown",
    "linePredictedSection": "skills",
    "confidence": "79%",
    "requiredThreshold": "80%",
    "reasonRejected": "fact_type_unknown; fact_confidence_79%_below_80%; classifier:contract_failed:Skill must be a professional capability",
    "classifierReason": "contract_failed:Skill must be a professional capability",
    "sectionHint": "language",
    "blockClassifyReason": "v2_language_strict"
  },
  {
    "stage": "confidence-gate",
    "module": "confidence-gate.js → applyConfidenceGate",
    "text": "Nom à confirmer",
    "predictedSection": "identity.name",
    "confidence": 0,
    "requiredThreshold": 95,
    "reasonRejected": "empty_or_placeholder_name"
  },
  {
    "stage": "confidence-gate",
    "module": "confidence-gate.js → applyConfidenceGate",
    "text": "30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.",
    "predictedSection": "summary",
    "confidence": 40,
    "requiredThreshold": 85,
    "reasonRejected": "partial_sentence_or_ocr_fragment"
  },
  {
    "stage": "confidence-gate",
    "module": "confidence-gate.js → applyConfidenceGate",
    "text": "Ic) yoaz27 2008 2009 : Créapole creation school management ign fin hie. je",
    "predictedSection": "education",
    "confidence": 60,
    "requiredThreshold": 85,
    "reasonRejected": "below_education_threshold"
  }
]
```

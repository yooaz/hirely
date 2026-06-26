# CV Corpus QA Report

**Result:** PASS

**Generated:** 2026-06-08T16:03:50.021Z

## Scope

P1 real-world CV corpus — 10 archetypes parsed through the production import pipeline.

## Corpus

| Archetype | File |
|-----------|------|
| designer | `tests/cv-corpus/designer.txt` |
| developer | `tests/cv-corpus/developer.txt` |
| marketing | `tests/cv-corpus/marketing.txt` |
| teacher | `tests/cv-corpus/teacher.txt` |
| nurse | `tests/cv-corpus/nurse.txt` |
| engineer | `tests/cv-corpus/engineer.txt` |
| freelancer | `tests/cv-corpus/freelancer.txt` |
| student | `tests/cv-corpus/student.txt` |
| executive | `tests/cv-corpus/executive.txt` |
| consultant | `tests/cv-corpus/consultant.txt` |

## Pass thresholds

| Dimension | Threshold | Aggregate | Status |
|-----------|-----------|-----------|--------|
| Identity | ≥ 95% | 100% | PASS |
| Experience | ≥ 90% | 94.7% | PASS |
| Education | ≥ 90% | 100% | PASS |
| Skills | ≥ 85% | 93.5% | PASS |
| Languages | measured | 94.7% | — |

## Per-CV recall

| CV | Identity | Experience | Education | Skills | Languages |
|----|----------|------------|-----------|--------|-----------|
| Designer CV | 100% | 100% | 100% | 100% | 100% |
| Developer CV | 100% | 100% | 100% | 100% | 100% |
| Marketing CV | 100% | 100% | 100% | 80% | 100% |
| Teacher CV | 100% | 100% | 100% | 100% | 100% |
| Nurse CV | 100% | 100% | 100% | 100% | 50% |
| Engineer CV | 100% | 100% | 100% | 75% | 100% |
| Freelancer CV | 100% | 100% | 100% | 80% | 100% |
| Student CV | 100% | 50% | 100% | 100% | 100% |
| Executive CV | 100% | 100% | 100% | 100% | 100% |
| Consultant CV | 100% | 100% | 100% | 100% | 100% |

## Top failure causes

- skills:Missing (3)
- languages:Missing (1)
- experience:Missing (1)

## QA command

```bash
npm run qa:cv-corpus
```

## Console output

```
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 7,
  tools: 4,
  languages: 2,
  clients: 0,
  projects: 1,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 1,
  skills: 5,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 2
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 2,
  skills: 5,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 1,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 4,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 1,
  education: 1,
  skills: 5,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 1
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 3,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 1,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 12,
  tools: 1,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 1
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 4,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 1
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 5,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 2,
  skills: 6,
  tools: 0,
  languages: 3,
  clients: 0,
  projects: 0,
  unsorted: 0
}
OK Corpus size 10/10
OK Identity recall 100% >= 95%
OK Experience recall 94.7% >= 90%
OK Education recall 100% >= 90%
OK Skills recall 93.5% >= 85%

── Per-CV scores ──
designer     identity=100% exp=100% edu=100% skills=100% langs=100%
developer    identity=100% exp=100% edu=100% skills=100% langs=100%
marketing    identity=100% exp=100% edu=100% skills=80% langs=100%
  · skills: Missing: SEO
teacher      identity=100% exp=100% edu=100% skills=100% langs=100%
nurse        identity=100% exp=100% edu=100% skills=100% langs=50%
  · languages: Missing: Vietnamese — conversational
engineer     identity=100% exp=100% edu=100% skills=75% langs=100%
  · skills: Missing: manufacturing processes
freelancer   identity=100% exp=100% edu=100% skills=80% langs=100%
  · skills: Missing: Node.js
student      identity=100% exp=50% edu=100% skills=100% langs=100%
  · experience: Missing: Teaching Assistant — University College London — London — 2024 – Present
executive    identity=100% exp=100% edu=100% skills=100% langs=100%
consultant   identity=100% exp=100% edu=100% skills=100% langs=100%

═══ CV Corpus QA: PASS (identity 100%, experience 94.7%, education 100%, skills 93.5%, languages 94.7%) ═══
```

## Stderr

```
(node:72747) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
[cv-corpus] 1/10 designer…
[cv-corpus] 2/10 developer…
[cv-corpus] 3/10 marketing…
[cv-corpus] 4/10 teacher…
[cv-corpus] 5/10 nurse…
[cv-corpus] 6/10 engineer…
[cv-corpus] 7/10 freelancer…
[cv-corpus] 8/10 student…
[cv-corpus] 9/10 executive…
[cv-corpus] 10/10 consultant…
```

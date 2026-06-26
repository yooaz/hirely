# HIRELY 100 CV BENCHMARK

Generated: 2026-06-07T00:15:34.441Z
Fixtures: **100** (20 creative · 20 developer · 20 marketing · 20 recruiter · 20 consultant)
Method: synthetic seeded CVs · paste import · no candidate-specific rules

## Pass criteria

- Experience recall **> 85%**
- Education recall **> 90%**
- Identity recall **> 98%** (name + email + phone)

### Goal status: **MET**

## Aggregate scores

| Metric | Average | Worst | Best | Goal | Status |
|--------|--------:|------:|-----:|-----:|:------:|
| Identity recall | 100% | 100% | 100% | 98% | ✓ |
| Experience recall | 98% | 50% | 100% | 85% | ✓ |
| Education recall | 99% | 50% | 100% | 90% | ✓ |
| Skills recall | 100% | 100% | 100% | — | ✓ |
| Overall score | 99.3% | 88% | 100% | — | ✓ |

### Aggregate recall (TP-weighted)

- **Identity:** 100%
- **Experience:** 97.8%
- **Education:** 98.8%
- **Skills:** 100%

## Extremes

- **Best overall:** `creative-01` (100%) — Creative CV 1
- **Worst overall:** `creative-08` (88%) — Creative CV 8

## Per-archetype breakdown

| Archetype | Identity | Experience | Education | Skills | Avg overall |
|-----------|--------:|-----------:|----------:|-------:|------------:|
| Creative CVs | 100% | 100% | 95% | 100% | 98.8% |
| Developer CVs | 100% | 100% | 100% | 100% | 100% |
| Marketing CVs | 100% | 100% | 100% | 100% | 100% |
| Recruiter CVs | 100% | 90% | 100% | 100% | 97.6% |
| Consultant CVs | 100% | 100% | 100% | 100% | 100% |

## Failure causes (top 15)

| Cause | Count |
|-------|------:|
| experience:Missing | 4 |
| education:Missing | 2 |

## Worst 10 fixtures

| Fixture | Archetype | Overall | Identity | Experience | Education | Skills |
|---------|-----------|--------:|---------:|-----------:|----------:|-------:|
| creative-08 | creative | 88% | 100% | 100% | 50% | 100% |
| creative-18 | creative | 88% | 100% | 100% | 50% | 100% |
| recruiter-05 | recruiter | 88% | 100% | 50% | 100% | 100% |
| recruiter-07 | recruiter | 88% | 100% | 50% | 100% | 100% |
| recruiter-13 | recruiter | 88% | 100% | 50% | 100% | 100% |
| recruiter-15 | recruiter | 88% | 100% | 50% | 100% | 100% |
| creative-01 | creative | 100% | 100% | 100% | 100% | 100% |
| creative-02 | creative | 100% | 100% | 100% | 100% | 100% |
| creative-03 | creative | 100% | 100% | 100% | 100% | 100% |
| creative-04 | creative | 100% | 100% | 100% | 100% | 100% |

## Identity extraction detail

| Signal | Pass rate |
|--------|----------:|
| Name | 100/100 (100%) |
| Email | 100/100 (100%) |
| Phone | 100/100 (100%) |

## Run

```bash
npm run stress:benchmark-100
npm run stress:benchmark-100-report
```

Raw JSON: `tests/output/benchmark-100/report.json`

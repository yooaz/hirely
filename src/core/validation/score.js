/**
 * Recruiter / ATS score from structured cvData.
 */

export function scoreCV(cv) {
  let score = 35;
  if (cv.name) score += 10;
  if (cv.title) score += 10;
  if (cv.email || cv.phone) score += 15;
  if (cv.experience?.length) score += 15;
  if (cv.education?.length) score += 6;
  if (cv.skills?.length > 3) score += 10;
  if (cv.clients?.length || cv.tools?.length) score += 8;
  if (cv.summary?.length > 120) score += 7;
  score = Math.max(35, Math.min(92, score));
  return {
    overall: score,
    ats: Math.max(35, Math.min(92, score + (cv.email ? 4 : -6))),
    recruiter: score,
    readability: Math.max(35, Math.min(92, score + 2)),
    impact: Math.max(35, Math.min(92, score + (cv.clients?.length ? 5 : -8))),
    completeness: Math.max(35, Math.min(92, score + (cv.skills?.length ? 3 : -10))),
  };
}

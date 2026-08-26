// Deprecated: ATS-X is served at domain root (no /job basepath in production).
// /job is handled by public/job.html iframe. Kept as a no-op for old deploys.
export default function handler(_req, res) {
  res.statusCode = 302;
  res.setHeader("Location", "/job");
  res.end();
}

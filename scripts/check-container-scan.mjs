import { readFileSync } from "node:fs";

const [, , reportPath, exceptionsPath] = process.argv;

if (!reportPath || !exceptionsPath) {
  console.error(
    "Usage: node scripts/check-container-scan.mjs <grype-report.json> <exceptions.json>",
  );
  process.exit(2);
}

const report = readJson(reportPath);
const policy = readJson(exceptionsPath);
const currentDate = process.env.CONTAINER_SCAN_DATE ?? today();

if (!Array.isArray(report.matches)) {
  throw new Error("Grype report must contain a matches array.");
}

if (policy.version !== 1 || !Array.isArray(policy.exceptions)) {
  throw new Error("Container scan exceptions must use version 1 and an exceptions array.");
}

if (!isIsoDate(currentDate)) {
  throw new Error(`Invalid policy evaluation date: ${currentDate}`);
}

const exceptions = policy.exceptions.map(validateException);
const expired = exceptions.filter(
  (exception) => exception.expiresOn < currentDate,
);

if (expired.length > 0) {
  console.error("Expired container vulnerability exceptions:");
  for (const exception of expired) {
    console.error(`- ${formatException(exception)}`);
  }
  process.exit(1);
}

const findings = uniqueFindings(report.matches).filter((finding) =>
  ["HIGH", "CRITICAL"].includes(finding.severity.toUpperCase()),
);
const unmatched = findings.filter(
  (finding) => !exceptions.some((exception) => matches(exception, finding)),
);
const unused = exceptions.filter(
  (exception) => !findings.some((finding) => matches(exception, finding)),
);

if (unused.length > 0) {
  console.warn("Container vulnerability exceptions no longer present in the report:");
  for (const exception of unused) {
    console.warn(`- ${formatException(exception)}`);
  }
}

if (unmatched.length > 0) {
  console.error("Unapproved high or critical container vulnerabilities:");
  for (const finding of unmatched) {
    console.error(
      `- ${finding.severity} ${finding.vulnerability} in ${finding.package}@${finding.version}`,
    );
  }
  process.exit(1);
}

console.log(
  `Container vulnerability policy passed: ${findings.length} high/critical findings, ${findings.length - unmatched.length} covered by current exceptions.`,
);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${path}.`, { cause: error });
  }
}

function validateException(exception, index) {
  for (const field of [
    "vulnerability",
    "package",
    "version",
    "expiresOn",
    "reason",
    "trackingIssue",
  ]) {
    if (typeof exception?.[field] !== "string" || !exception[field].trim()) {
      throw new Error(`Container scan exception ${index} requires ${field}.`);
    }
  }

  if (!isIsoDate(exception.expiresOn)) {
    throw new Error(
      `Container scan exception ${index} has an invalid expiration date.`,
    );
  }

  return exception;
}

function uniqueFindings(matches_) {
  const findings = new Map();

  for (const match of matches_) {
    const finding = {
      vulnerability: match?.vulnerability?.id,
      severity: match?.vulnerability?.severity,
      package: match?.artifact?.name,
      version: match?.artifact?.version,
    };

    if (Object.values(finding).some((value) => typeof value !== "string")) {
      throw new Error("Grype match is missing vulnerability or package metadata.");
    }

    findings.set(
      [finding.vulnerability, finding.package, finding.version].join("\0"),
      finding,
    );
  }

  return [...findings.values()];
}

function matches(exception, finding) {
  return (
    exception.vulnerability === finding.vulnerability &&
    exception.package === finding.package &&
    exception.version === finding.version
  );
}

function formatException(exception) {
  return `${exception.vulnerability} in ${exception.package}@${exception.version} (expires ${exception.expiresOn}, ${exception.trackingIssue})`;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

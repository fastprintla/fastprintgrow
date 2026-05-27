import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../admin-auth";
import { getSessionUser } from "../../../lib/auth";
import { getPlanConfig } from "../../../lib/plans";

type EmailLeadRequest = {
  id: string;
  website?: string;
};

type EmailStatus =
  | "Email Found"
  | "Multiple Found"
  | "Contact Form Found"
  | "Phone Only"
  | "Fetch Blocked"
  | "Website Unavailable"
  | "Not Found";

type EmailResult = {
  id: string;
  primaryEmail: string;
  allEmails: string[];
  emailStatus: EmailStatus;
  emailType: string;
  pagesChecked: string[];
  contactPageUrl: string;
  failureReason: string;
};

const COMMON_PATHS = [
  "/contact",
  "/contact/",
  "/contact-us",
  "/contact-us/",
  "/contacts",
  "/about",
  "/about-us",
  "/locations",
  "/reservation",
  "/reservations",
  "/catering",
  "/events",
];
const LINK_HINTS = ["contact", "reservation", "catering", "events", "booking"];
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const REQUEST_TIMEOUT_MS = 8000;
const BLOCKED_EMAIL_PARTS = [
  "example.",
  "sentry",
  "wixpress",
  "wixstatic",
  "sentry-next",
  "schema.org",
  "w3.org",
  "localhost",
  "noreply",
  "no-reply",
  "donotreply",
];
const LOW_PRIORITY_PREFIXES = ["privacy", "abuse", "legal", "noreply", "no-reply", "careers", "hr"];
const HIGH_PRIORITY_PREFIXES = [
  "info",
  "hello",
  "contact",
  "reservations",
  "reservation",
  "catering",
  "events",
  "booking",
  "manager",
  "sales",
];
const PLATFORM_DOMAINS = ["wixpress.com", "wix.com", "squarespace.com", "shopify.com", "weebly.com"];

function normalizeWebsite(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

function getEmailParts(email: string) {
  const cleanedEmail = email.trim().replace(/^mailto:/i, "").toLowerCase();
  const [localPart = "", domain = ""] = cleanedEmail.split("@");
  const prefix = localPart.split(/[.+_-]/)[0];
  return { cleanedEmail, localPart, domain, prefix };
}

function isLikelyPublicEmail(email: string) {
  const { cleanedEmail, localPart, domain, prefix } = getEmailParts(email);

  if (!localPart || !domain || localPart.length > 64) {
    return false;
  }

  if (/^[a-f0-9]{24,}$/i.test(localPart)) {
    return false;
  }

  if (BLOCKED_EMAIL_PARTS.some((part) => cleanedEmail.includes(part))) {
    return false;
  }

  if (prefix === "support" && PLATFORM_DOMAINS.some((platformDomain) => domain.endsWith(platformDomain))) {
    return false;
  }

  return !/\.(png|jpe?g|gif|webp|svg|css|js|json|ico)$/i.test(cleanedEmail);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/&at;/gi, "@")
    .replace(/&dot;/gi, ".")
    .replace(/&amp;/gi, "&");
}

function decodeCloudflareEmail(encoded: string) {
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let email = "";

  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
  }

  return email;
}

function getVisibleHtmlText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function getScriptText(html: string) {
  return Array.from(html.matchAll(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1])
    .join(" ");
}

function normalizeEmailCandidate(email: string) {
  return decodeURIComponent(decodeHtmlEntities(email))
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/[),.;:'"\]\s]+$/g, "");
}

function extractEmailsFromHtml(html: string) {
  const decodedHtml = decodeHtmlEntities(html);
  const mailtoEmails = Array.from(decodedHtml.matchAll(/mailto:([^"'?<#\s]+)/gi)).map((match) => match[1]);
  const cloudflareEmails = Array.from(decodedHtml.matchAll(/data-cfemail=["']([a-f0-9]+)["']/gi)).map(
    (match) => decodeCloudflareEmail(match[1]),
  );
  const rawEmails = decodedHtml.match(EMAIL_REGEX) || [];
  const visibleTextEmails = getVisibleHtmlText(decodedHtml).match(EMAIL_REGEX) || [];
  const scriptEmails = getScriptText(decodedHtml).match(EMAIL_REGEX) || [];

  return Array.from(new Set([...mailtoEmails, ...cloudflareEmails, ...rawEmails, ...visibleTextEmails, ...scriptEmails]))
    .map(normalizeEmailCandidate)
    .filter(isLikelyPublicEmail);
}

function hasContactForm(html: string) {
  const lower = html.toLowerCase();
  return lower.includes("<form") && (lower.includes("contact") || lower.includes("enquiry") || lower.includes("inquiry"));
}

function uniqueUrls(urls: URL[]) {
  const seen = new Set<string>();

  return urls.filter((url) => {
    url.hash = "";
    const key = url.toString();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildBaseCandidateUrls(websiteUrl: URL) {
  const originalUrl = new URL(websiteUrl.toString());
  const directoryPath = originalUrl.pathname.endsWith("/")
    ? originalUrl.pathname
    : originalUrl.pathname.slice(0, originalUrl.pathname.lastIndexOf("/") + 1);

  return uniqueUrls([
    originalUrl,
    new URL("/", originalUrl.origin),
    ...COMMON_PATHS.map((path) => new URL(path, originalUrl.origin)),
    ...COMMON_PATHS.map((path) => new URL(`${directoryPath}${path.replace(/^\//, "")}`, originalUrl.origin)),
  ]);
}

function extractHintLinks(html: string, baseUrl: URL) {
  return Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      const href = decodeHtmlEntities(match[1]);
      const label = getVisibleHtmlText(match[2]).toLowerCase();
      const combined = `${href} ${label}`.toLowerCase();

      if (!LINK_HINTS.some((hint) => combined.includes(hint))) {
        return null;
      }

      try {
        const url = new URL(href, baseUrl);
        return url.origin === baseUrl.origin ? url : null;
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url));
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getRobotsTxt(origin: string) {
  try {
    const robotsUrl = new URL("/robots.txt", origin);
    const response = await fetchWithTimeout(robotsUrl);

    if (!response.ok) {
      return "";
    }

    return await response.text();
  } catch {
    return "";
  }
}

function isAllowedByRobots(robotsTxt: string, pathname: string) {
  if (!robotsTxt.trim()) {
    return true;
  }

  const lines = robotsTxt.split(/\r?\n/);
  let appliesToUs = false;
  const disallowRules: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();

    if (!line) {
      continue;
    }

    const [field, ...rest] = line.split(":");
    const key = field.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      appliesToUs = value === "*" || value.toLowerCase().includes("fastleadai");
      continue;
    }

    if (appliesToUs && key === "disallow" && value) {
      disallowRules.push(value);
    }
  }

  return !disallowRules.some((rule) => pathname.startsWith(rule));
}

function scoreEmail(email: string, websiteHost: string) {
  const { domain, prefix } = getEmailParts(email);
  let score = 0;

  if (domain && websiteHost.includes(domain.replace(/^www\./, ""))) {
    score += 20;
  }

  const highPriorityIndex = HIGH_PRIORITY_PREFIXES.indexOf(prefix);
  if (highPriorityIndex >= 0) {
    score += 100 - highPriorityIndex * 5;
  }

  if (LOW_PRIORITY_PREFIXES.includes(prefix)) {
    score -= 80;
  }

  return score;
}

function selectPrimaryEmail(emails: string[], websiteHost: string) {
  return [...emails].sort((first, second) => scoreEmail(second, websiteHost) - scoreEmail(first, websiteHost))[0] || "";
}

function getEmailType(email: string) {
  if (!email) {
    return "";
  }

  const { prefix } = getEmailParts(email);

  if (["reservations", "reservation", "booking"].includes(prefix)) {
    return "Reservations";
  }

  if (prefix === "catering") {
    return "Catering";
  }

  if (prefix === "events") {
    return "Events";
  }

  if (["info", "hello", "contact"].includes(prefix)) {
    return "General";
  }

  if (["manager", "sales"].includes(prefix)) {
    return "Business";
  }

  return "Other";
}

async function extractEmailForLead(lead: EmailLeadRequest): Promise<EmailResult> {
  const websiteUrl = normalizeWebsite(lead.website);

  if (!websiteUrl) {
    return {
      id: lead.id,
      primaryEmail: "",
      allEmails: [],
      emailStatus: "Website Unavailable",
      emailType: "",
      pagesChecked: [],
      contactPageUrl: "",
      failureReason: "No website URL was available from Google Places.",
    };
  }

  const robotsTxt = await getRobotsTxt(websiteUrl.origin);
  const pagesChecked: string[] = [];
  const emails = new Set<string>();
  const candidateUrls = buildBaseCandidateUrls(websiteUrl);
  let contactPageUrl = "";
  let sawAvailableWebsite = false;
  let sawContactForm = false;
  let sawFetchBlocked = false;
  let failureReason = "";

  for (let index = 0; index < candidateUrls.length && index < 20; index += 1) {
    const pageUrl = candidateUrls[index];

    if (!isAllowedByRobots(robotsTxt, pageUrl.pathname)) {
      failureReason = "Skipped one or more pages because robots.txt disallowed them.";
      continue;
    }

    pagesChecked.push(pageUrl.toString());

    try {
      const response = await fetchWithTimeout(pageUrl);
      const contentType = response.headers.get("content-type") || "";

      if ([401, 403, 429].includes(response.status)) {
        sawFetchBlocked = true;
        failureReason = `Fetch blocked with status ${response.status}.`;
        continue;
      }

      if (!response.ok || !contentType.includes("text")) {
        failureReason = `Skipped ${pageUrl.toString()} because it returned status ${response.status}.`;
        continue;
      }

      sawAvailableWebsite = true;
      const html = await response.text();

      if (index === 0) {
        candidateUrls.push(...extractHintLinks(html, pageUrl));
      }

      if (hasContactForm(html)) {
        sawContactForm = true;
        contactPageUrl ||= pageUrl.toString();
      }

      for (const email of extractEmailsFromHtml(html)) {
        emails.add(email);
        contactPageUrl ||= pageUrl.toString();
      }
    } catch (error) {
      sawFetchBlocked = true;
      failureReason = error instanceof Error ? error.message : "Fetch failed.";
      continue;
    }
  }

  const allEmails = Array.from(emails);
  const primaryEmail = selectPrimaryEmail(allEmails, websiteUrl.hostname.toLowerCase());

  if (primaryEmail) {
    return {
      id: lead.id,
      primaryEmail,
      allEmails,
      emailStatus: allEmails.length > 1 ? "Multiple Found" : "Email Found",
      emailType: getEmailType(primaryEmail),
      pagesChecked,
      contactPageUrl,
      failureReason: "",
    };
  }

  if (sawContactForm) {
    return {
      id: lead.id,
      primaryEmail: "",
      allEmails: [],
      emailStatus: "Contact Form Found",
      emailType: "",
      pagesChecked,
      contactPageUrl,
      failureReason: "A public contact form was found, but no email address was visible.",
    };
  }

  return {
    id: lead.id,
    primaryEmail: "",
    allEmails: [],
    emailStatus: sawFetchBlocked ? "Fetch Blocked" : sawAvailableWebsite ? "Not Found" : "Website Unavailable",
    emailType: "",
    pagesChecked,
    contactPageUrl,
    failureReason:
      failureReason ||
      (sawAvailableWebsite
        ? "Checked public pages but did not find a visible email address."
        : "Could not access a public website page."),
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { leads?: EmailLeadRequest[]; plan?: string };
  const sessionUser = await getSessionUser(request);
  const isAdmin = isAdminRequest(request) || sessionUser?.plan === "admin";
  const isPaidPlan = sessionUser
    ? getPlanConfig(sessionUser.plan).allowEmailExtraction
    : ["starter", "growth", "pro", "agency"].includes(body.plan || "");

  if (!isAdmin && !isPaidPlan) {
    return NextResponse.json({ error: "Email extraction requires a paid plan." }, { status: 403 });
  }

  const leads = Array.isArray(body.leads) ? body.leads.slice(0, 1000) : [];

  const results = await Promise.all(leads.map(extractEmailForLead));

  return NextResponse.json({ results });
}

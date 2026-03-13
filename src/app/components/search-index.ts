/**
 * search-index.ts
 * ───────────────────────────────────────────────────────────────
 * Single-responsibility file that owns the full-text search index.
 *
 * Three layers build the index automatically:
 *   1. text-overrides.json  — every edited UI string, auto-synced
 *   2. data.ts projects/studies — structural content, auto-synced
 *   3. Static hardcoded entries — tooltips & inline text from App.tsx
 *
 * When you update text-overrides.json or data.ts the search index
 * updates on the next page load — no manual maintenance needed
 * (except for the small Layer 3 static entries).
 */

import textOverrides from './text-overrides.json';
import { projects, studies } from './data';

// ── Types ─────────────────────────────────────────────────────
export interface SearchEntry {
  /** The searchable display text */
  label: string;
  /** HTML element id to scroll to */
  section: string;
  /** Human-friendly section name shown in results */
  sectionLabel: string;
  /** Material icon name */
  icon: string;
  /** If present, clicking opens a modal instead of scrolling */
  action?: { type: 'modal'; modalType: 'project' | 'study'; id: number };
}

// ── Prefix → Section mapping ──────────────────────────────────
interface SectionMeta {
  section: string;
  sectionLabel: string;
  icon: string;
}

const prefixMap: [string, SectionMeta][] = [
  ['hero.',        { section: 'hero',                sectionLabel: 'Hero',                icon: 'home' }],
  ['nav.',         { section: 'hero',                sectionLabel: 'Navigation',          icon: 'menu' }],
  ['sidenav.',     { section: 'hero',                sectionLabel: 'Navigation',          icon: 'menu' }],
  ['solutions.',   { section: 'delivered-solutions', sectionLabel: 'Delivered Solutions',  icon: 'analytics' }],
  ['chart.',       { section: 'delivered-solutions', sectionLabel: 'Delivered Solutions',  icon: 'bar_chart' }],
  ['project.',     { section: 'delivered-solutions', sectionLabel: 'Delivered Solutions',  icon: 'folder_special' }],
  ['modal.project.', { section: 'delivered-solutions', sectionLabel: 'Project Detail',    icon: 'open_in_full' }],
  ['exp.',         { section: 'experience',          sectionLabel: 'Experience',           icon: 'work_outline' }],
  ['studies.',     { section: 'studies',             sectionLabel: 'Studies',              icon: 'school' }],
  ['study.',       { section: 'studies',             sectionLabel: 'Studies',              icon: 'school' }],
  ['modal.study.', { section: 'studies',             sectionLabel: 'Study Detail',         icon: 'open_in_full' }],
  ['about.',       { section: 'about',              sectionLabel: 'About',                icon: 'person_outline' }],
  ['contact.',     { section: 'contact',            sectionLabel: 'Contact',              icon: 'mail_outline' }],
  ['footer.',      { section: 'contact',            sectionLabel: 'Footer',               icon: 'info' }],
];

// Sorted so longer prefixes match first (modal.project. before project.)
const sortedPrefixMap = [...prefixMap].sort((a, b) => b[0].length - a[0].length);

function resolveKey(key: string): { meta: SectionMeta; action?: SearchEntry['action'] } | null {
  // Skip image keys, search chrome, snackbar
  if (key.startsWith('img.') || key.startsWith('search.') || key.startsWith('snackbar.')) return null;

  for (const [prefix, meta] of sortedPrefixMap) {
    if (key.startsWith(prefix)) {
      let action: SearchEntry['action'] | undefined;

      // Extract modal actions
      if (prefix === 'modal.project.') {
        const rest = key.slice(prefix.length); // e.g. "0.title"
        const id = parseInt(rest, 10);
        if (!isNaN(id)) action = { type: 'modal', modalType: 'project', id };
      } else if (prefix === 'modal.study.') {
        const rest = key.slice(prefix.length);
        const id = parseInt(rest, 10);
        if (!isNaN(id)) action = { type: 'modal', modalType: 'study', id };
      }

      return { meta, action };
    }
  }
  return null;
}

// ── Build helpers ─────────────────────────────────────────────
function addEntry(
  map: Map<string, SearchEntry>,
  label: string,
  section: string,
  sectionLabel: string,
  icon: string,
  action?: SearchEntry['action'],
) {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length < 2) return;          // skip blanks & single chars
  const key = trimmed.toLowerCase();
  if (map.has(key)) return;                             // first writer wins (overrides > data.ts)
  map.set(key, { label: trimmed, section, sectionLabel, icon, action });
}

// ── Layer 1: text-overrides.json ──────────────────────────────
function addOverrideEntries(map: Map<string, SearchEntry>) {
  const overrides = textOverrides as Record<string, string>;
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value !== 'string') continue;
    const resolved = resolveKey(key);
    if (!resolved) continue;
    addEntry(map, value, resolved.meta.section, resolved.meta.sectionLabel, resolved.meta.icon, resolved.action);
  }
}

// ── Layer 2: data.ts projects & studies ───────────────────────
function addProjectEntries(map: Map<string, SearchEntry>) {
  for (const p of projects) {
    const action: SearchEntry['action'] = { type: 'modal', modalType: 'project', id: p.id };
    const sec = 'delivered-solutions';
    const secLabel = 'Project Detail';
    const icon = p.icon || 'folder_special';

    addEntry(map, p.title, sec, secLabel, icon, action);
    addEntry(map, p.desc, sec, secLabel, icon, action);
    addEntry(map, p.category, sec, secLabel, icon, action);
    addEntry(map, p.overview, sec, secLabel, icon, action);
    addEntry(map, p.challenge, sec, secLabel, icon, action);
    addEntry(map, p.quote.text, sec, secLabel, icon, action);
    addEntry(map, p.quote.attr, sec, secLabel, icon, action);
    for (const t of p.tags) addEntry(map, t, sec, secLabel, icon, action);
    for (const o of p.outcomes) addEntry(map, o, sec, secLabel, icon, action);
    for (const s of p.skills) addEntry(map, s.name, sec, secLabel, icon, action);
    for (const k of p.kpis) {
      addEntry(map, k.label, sec, secLabel, icon, action);
      addEntry(map, `${k.val} ${k.label}`, sec, secLabel, icon, action);
    }
    for (const st of p.stats) addEntry(map, st.label, sec, secLabel, icon, action);
    for (const ph of p.phases) addEntry(map, ph.label, sec, secLabel, icon, action);
  }
}

function addStudyEntries(map: Map<string, SearchEntry>) {
  for (const s of studies) {
    const action: SearchEntry['action'] = { type: 'modal', modalType: 'study', id: s.id };
    const sec = 'studies';
    const secLabel = 'Study Detail';
    const icon = s.icon || 'school';

    addEntry(map, s.title, sec, secLabel, icon, action);
    addEntry(map, s.desc, sec, secLabel, icon, action);
    addEntry(map, s.category, sec, secLabel, icon, action);
    addEntry(map, s.institution, sec, secLabel, icon, action);
    addEntry(map, s.overview, sec, secLabel, icon, action);
    addEntry(map, s.thesis, sec, secLabel, icon, action);
    addEntry(map, s.highlight, sec, secLabel, icon, action);
    for (const t of s.tags) addEntry(map, t, sec, secLabel, icon, action);
    for (const m of s.modules) addEntry(map, m, sec, secLabel, icon, action);
    for (const sk of s.skills) addEntry(map, sk.name, sec, secLabel, icon, action);
  }
}

// ── Layer 3: Static hardcoded entries ─────────────────────────
// These cover inline text that only exists in App.tsx and has no editKey
function addStaticEntries(map: Map<string, SearchEntry>) {
  // Bar chart tooltips
  const barTips = [
    '2014-19: Sr UX Designer',
    '2020-21: UX Design Operator',
    '2021-22: Sr Product Designer',
    '2022-23: Sr Product Designer',
    '2024-Now: Principal Product Designer',
  ];
  for (const t of barTips) addEntry(map, t, 'delivered-solutions', 'Delivered Solutions', 'bar_chart');

  // Bar chart company labels
  const barLabels = ['Glynlyon Inc', 'Siemens Inc', 'Opentech Alliance', 'Freeport McMoRan', 'Plexus Worldwide'];
  for (const l of barLabels) addEntry(map, l, 'delivered-solutions', 'Delivered Solutions', 'bar_chart');

  // Donut chart tooltips
  const donutTips = [
    'Digital Products: 40% (59 projects)',
    'UX Research: 25% (37 projects)',
    'Strategy: 20% (30 projects)',
    'Engineering: 15% (22 projects)',
  ];
  for (const t of donutTips) addEntry(map, t, 'delivered-solutions', 'Delivered Solutions', 'donut_large');

  // Donut legend labels
  const donutLegend = ['Digital Products', 'UX Research', 'Strategy', 'Engineering'];
  for (const l of donutLegend) addEntry(map, l, 'delivered-solutions', 'Delivered Solutions', 'donut_large');

  // Industry coverage labels
  const industries = ['e-commerce', 'Mining Tech', 'Property Tech', 'Enterprise SaaS', 'Ed-Tech', 'Military Tech'];
  for (const l of industries) addEntry(map, l, 'delivered-solutions', 'Delivered Solutions', 'pie_chart');

  // Satisfaction sparkline tooltips
  const satisfactionTips = ['Jan 2023: 4.5★', 'Mid 2023: 4.7★', 'Jan 2024: 4.8★', 'Current: 4.9★'];
  for (const t of satisfactionTips) addEntry(map, t, 'delivered-solutions', 'Delivered Solutions', 'star');

  // Solutions KPI card tooltips
  const solutionsTooltips = [
    'Tracking where users drop off and struggle reveals the highest-impact opportunities. Task success rate improved 12% after friction mapping.',
    'Scalable design systems and component libraries let teams ship 24% more deliverables without adding headcount. Reuse rate reached 72% org-wide.',
    'Connecting UX decisions to revenue goals generates measurable ROI. Projects aligned to business KPIs returned +31% ROI in the first 6 months post-launch.',
    'High-fidelity prototypes tested with real users before engineering investment cut time-to-profit by 60%.',
  ];
  for (const t of solutionsTooltips) addEntry(map, t, 'delivered-solutions', 'Delivered Solutions', 'analytics');

  // Studies KPI card tooltips
  const studiesKpiTooltips = [
    'Bachelor of Art, 2005',
    'Comptia, Microsoft, LambdaTest, NASBA, Atlassian, Project Managment Institute',
    'It is basically like a full time job. (In addition to my full time jobs.)',
    '6 Company awards including 2 for excellence in presentation and leadership of design.',
  ];
  for (const t of studiesKpiTooltips) addEntry(map, t, 'studies', 'Studies', 'school');

  // Learning timeline milestone labels
  const milestones = [
    'Bachelor in Art. Sept. 2005',
    'Animation for Simulation - In studio training',
    'Multi-media for Ed-Tech - In studio training',
    'Web UX for Ed-Tech - In studio training',
    'Industial Software Design - On-site taining',
    'Microsoft Certification',
    'Atlassian Certification',
    'LambdaTest Certifiation',
    'AI for Design – MIT',
  ];
  for (const m of milestones) addEntry(map, m, 'studies', 'Studies', 'school');

  // Experience timeline — roles, companies, popup items
  const jobs = [
    { role: 'Principal Product Designer', company: 'Apex Digital Solutions', year: '2022 – Present' },
    { role: 'Senior UX Strategist', company: 'McKinsey Digital', year: '2019 – 2022' },
    { role: 'Product Design Lead', company: 'Techbridge Labs', year: '2016 – 2019' },
    { role: 'UI/UX Designer', company: 'Freelance & Agency', year: '2014 – 2016' },
    { role: 'Junior Visual Designer', company: 'CreativePulse Agency', year: '2012 – 2014' },
  ];
  for (const j of jobs) {
    addEntry(map, j.role, 'experience', 'Experience', 'work_outline');
    addEntry(map, j.company, 'experience', 'Experience', 'business_center');
    addEntry(map, j.year, 'experience', 'Experience', 'calendar_today');
  }

  // Experience skill chips
  const skillChips = [
    'Product Design', 'Design Systems', 'UX Research', 'Journey Mapping', 'Figma', 'Prototyping', 'Usability Testing',
    'HTML/CSS', 'React', 'TypeScript', 'Node.js', 'SQL', 'APIs',
    'Product Strategy', 'Team Building', 'OKRs', 'Stakeholder Mgmt', 'Agile', 'Data Analysis',
  ];
  for (const c of skillChips) addEntry(map, c, 'experience', 'Experience', 'build');

  // About section trait titles
  const traits = ['Curiosity-led', 'Detail-obsessed', 'Team-first', 'Outcome-driven'];
  for (const t of traits) addEntry(map, t, 'about', 'About', 'person_outline');

  // Section-level anchors
  addEntry(map, 'Delivered Solutions', 'delivered-solutions', 'Delivered Solutions', 'analytics');
  addEntry(map, 'Experience', 'experience', 'Experience', 'work_outline');
  addEntry(map, 'Studies', 'studies', 'Studies', 'school');
  addEntry(map, 'About', 'about', 'About', 'person_outline');
  addEntry(map, 'Contact', 'contact', 'Contact', 'mail_outline');
  addEntry(map, 'Hero', 'hero', 'Hero', 'home');
}

// ── Assemble & export ─────────────────────────────────────────
function buildSearchIndex(): SearchEntry[] {
  const map = new Map<string, SearchEntry>();

  // Layer 1: overrides first (highest priority — reflects edited content)
  addOverrideEntries(map);

  // Layer 2: data.ts projects & studies
  addProjectEntries(map);
  addStudyEntries(map);

  // Layer 3: static hardcoded text from App.tsx
  addStaticEntries(map);

  return Array.from(map.values());
}

export const searchIndex = buildSearchIndex();

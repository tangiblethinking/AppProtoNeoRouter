/**
 * Christopher Kenreigh Resume HTML
 * This file contains the HTML resume that opens in a new tab
 */

export const resumeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Christopher Kenreigh – Staff Product Designer</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --blue: #2563c7;
      --dark: #111111;
      --mid: #444444;
      --light: #666666;
      --rule: #dddddd;
      --bg: #ffffff;
      --sidebar-bg: #f7f8fa;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      font-size: 10.5pt;
      color: var(--dark);
      background: #e8e8e8;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 32px 16px;
      min-height: 100vh;
    }

    .page {
      background: var(--bg);
      width: 850px;
      max-width: 100%;
      box-shadow: 0 4px 40px rgba(0,0,0,0.18);
      display: grid;
      grid-template-rows: auto 1fr;
    }

    /* ── HEADER ── */
    header {
      padding: 28px 36px 18px;
      border-bottom: 2px solid var(--rule);
    }
    header h1 {
      font-family: 'DM Serif Display', serif;
      font-size: clamp(20pt, 5vw, 30pt);
      font-weight: 400;
      color: var(--dark);
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    header .title-line {
      font-size: clamp(9pt, 2.5vw, 11pt);
      font-weight: 700;
      color: var(--blue);
      margin: 3px 0 8px;
      letter-spacing: 0.2px;
    }
    header .contact {
      font-size: 9.5pt;
      color: var(--mid);
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    header .contact a {
      color: var(--blue);
      text-decoration: none;
      font-weight: 500;
    }
    header .contact span { color: var(--rule); }

    /* ── BODY LAYOUT ── */
    .body {
      display: grid;
      grid-template-columns: 1fr 240px;
    }

    /* ── LEFT (Experience) ── */
    .main {
      padding: 24px 36px 32px;
      border-right: 1px solid var(--rule);
    }

    .section-title {
      font-family: 'DM Serif Display', serif;
      font-size: 14pt;
      font-weight: 400;
      color: var(--dark);
      border-bottom: 1.5px solid var(--dark);
      padding-bottom: 4px;
      margin-bottom: 14px;
    }

    .job { margin-bottom: 20px; }

    .job-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: var(--dark);
    }
    .job-company {
      font-size: 10pt;
      font-weight: 500;
      color: var(--blue);
      text-decoration: none;
    }
    .job-company:hover { text-decoration: underline; }

    .job-meta {
      font-size: 8.5pt;
      color: var(--light);
      margin: 2px 0 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .job-meta .material-symbols-outlined {
      color: #00A000;
      font-size: 16px;
      vertical-align: middle;
    }

    .job ul {
      list-style: disc;
      padding-left: 16px;
    }
    .job ul li {
      font-size: 9.5pt;
      color: var(--mid);
      line-height: 1.5;
      margin-bottom: 3px;
    }

    /* ── RIGHT (Sidebar) ── */
    .sidebar {
      background: var(--sidebar-bg);
      padding: 24px 22px 32px;
    }

    .sidebar-section { margin-bottom: 22px; }

    .sidebar .section-title {
      font-size: 12pt;
      border-bottom-color: var(--mid);
    }

    .summary-quote {
      font-size: 9.5pt;
      font-style: italic;
      color: var(--mid);
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .summary-bullets {
      list-style: disc;
      padding-left: 14px;
    }
    .summary-bullets li {
      font-size: 8.8pt;
      color: var(--mid);
      line-height: 1.55;
      margin-bottom: 3px;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }
    .tag {
      font-size: 8pt;
      font-weight: 500;
      color: var(--blue);
      background: rgba(37,99,199,0.08);
      border-radius: 3px;
      padding: 2px 7px;
    }

    .dot-list {
      list-style: disc;
      padding-left: 14px;
    }
    .dot-list li {
      font-size: 9pt;
      color: var(--mid);
      line-height: 1.6;
    }

    /* Education */
    .edu-degree {
      font-size: 9.5pt;
      font-weight: 700;
      color: var(--dark);
    }
    .edu-school {
      font-size: 9pt;
      color: var(--blue);
      font-weight: 500;
    }
    .edu-meta {
      font-size: 8.5pt;
      color: var(--light);
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }
    .edu-meta .material-symbols-outlined {
      color: #00A000;
      font-size: 15px;
      vertical-align: middle;
    }
    .cert-list {
      margin-top: 10px;
      font-size: 8.5pt;
      color: var(--mid);
      line-height: 1.65;
    }

    .share-link {
      display: block;
      text-align: right;
      font-size: 8.5pt;
      color: var(--blue);
      text-decoration: none;
      font-style: italic;
      margin-top: 16px;
    }
    .share-link:hover { text-decoration: underline; }

    /* ── MOBILE RESPONSIVE ── */
    @media (max-width: 680px) {
      body {
        padding: 0;
        background: var(--bg);
        align-items: stretch;
      }
      .page {
        width: 100%;
        box-shadow: none;
        border-radius: 0;
      }
      header { padding: 20px 18px 14px; }
      header h1 { font-size: 22pt; }
      header .title-line { font-size: 9pt; }
      header .contact { font-size: 9pt; gap: 6px; row-gap: 4px; }
      .body {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
      }
      .main {
        padding: 18px 18px 24px;
        border-right: none;
        border-bottom: 1px solid var(--rule);
        order: 2;
      }
      .sidebar {
        padding: 18px 18px 20px;
        order: 1;
        border-bottom: 2px solid var(--rule);
      }
      .section-title { font-size: 13pt; }
      .sidebar .section-title { font-size: 11pt; }
      .job ul li { font-size: 9pt; }
      .job-meta { font-size: 8pt; gap: 4px; }
      .summary-quote { font-size: 9pt; }
      .tag { font-size: 7.5pt; }
    }

    @media (min-width: 681px) and (max-width: 900px) {
      body { padding: 16px 8px; }
      .page { width: 100%; }
      header { padding: 22px 24px 14px; }
      .main { padding: 20px 24px 28px; }
      .sidebar { padding: 20px 16px 28px; }
      .body { grid-template-columns: 1fr 200px; }
    }

    @media print {
      body { background: white; padding: 0; }
      .page { box-shadow: none; width: 100%; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <header>
    <h1>Christopher Kenreigh</h1>
    <div class="title-line">Staff Product Designer | Consumer-Facing Fintech Experiences | End-to-End Product Design | Design Systems | Cross-Functional Leadership</div>
    <div class="contact">
      <span style="color: #212121; font-weight:700">480-206-2145</span>
      <span>|</span>
      <a href="mailto:c.kenreigh@gmail.com" style="font-weight:800;">c.kenreigh@gmail.com</a>
      <span>|</span>
      <a href="https://www.linkedin.com/in/kenreigh/" target="_blank">LinkedIn</a>
      <span>|</span>
      <a href="https://kenreigh-one.figma.site" target="_blank">Portfolio</a>
      <span>|</span>
      <span style="color: var(--mid);">Phoenix, AZ</span>
    </div>
  </header>

  <!-- BODY -->
  <div class="body">

    <!-- MAIN EXPERIENCE -->
    <main class="main">
      <h2 class="section-title">Experience</h2>

      <div class="job">
        <div class="job-title">Staff Product Designer (Principal)</div>
        <a class="job-company" href="https://www.plexusworldwide.com" target="_blank">Plexus Worldwide</a>
        <div class="job-meta">
          <span class="material-symbols-outlined">calendar_month</span>
          05/2024 – Present
          <span class="material-symbols-outlined">location_on</span>
          Phoenix, AZ | Office
        </div>
        <ul>
          <li>Led 5 UX/content designers delivering consumer-facing e-commerce experiences across 3 international regions, owning end-to-end product journeys from discovery and onboarding through post-conversion</li>
          <li>Spearheaded e-commerce modernization: identified user behavior insights via Power BI; redesigned mobile-first PDPs, PLPs, and checkout flows aligned to conversion best practices—cutting abandonment 43%</li>
          <li>Translated regulatory compliance requirements and business goals into clear, compliant user experiences across membership join, cart, and application flows</li>
          <li>Facilitated design workshops and A/B tested high-fidelity prototypes with cross-functional partners (Product, Engineering, Marketing) to validate complex interaction decisions</li>
          <li>Architected and deployed scalable design system consolidating 6 tools; implemented across CMS for consistency—enabling teams to build without friction</li>
          <li>Led adoption of LLM-driven AI tools, increasing sprint delivery velocity 35%; mentored designers on emerging technology practices and best practices</li>
        </ul>
      </div>

      <div class="job">
        <div class="job-title">Senior Product Designer</div>
        <a class="job-company" href="https://www.freeportmcmoran.com" target="_blank">Freeport-McMoRan</a>
        <div class="job-meta">
          <span class="material-symbols-outlined">calendar_month</span>
          08/2022 – 10/2023
          <span class="material-symbols-outlined">location_on</span>
          Phoenix, AZ | Hybrid
        </div>
        <ul>
          <li>Led end-to-end design for regulated industrial digital tools; delivered responsive web and mobile interfaces improving worker efficiency 30% while meeting compliance standards</li>
          <li>Facilitated 10+ discovery workshops to translate user needs into actionable product requirements across cross-functional teams</li>
          <li>Presented product roadmaps and Agile design strategies to C-suite executives, securing approval for 5 major product releases</li>
          <li>Built and deployed scalable MUI React design system adopted across web, iOS, and Android; produced detailed documentation enabling engineering to build without friction</li>
        </ul>
      </div>

      <div class="job">
        <div class="job-title">Senior Product Designer</div>
        <a class="job-company" href="https://www.opentechalliance.com" target="_blank">OpenTech Alliance</a>
        <div class="job-meta">
          <span class="material-symbols-outlined">calendar_month</span>
          05/2021 – 08/2022
          <span class="material-symbols-outlined">location_on</span>
          Phoenix, AZ | Hybrid
        </div>
        <ul>
          <li>Evangelized consumer-centered design thinking to C-suite, securing budget for 3 new UX initiatives and elevating design maturity org-wide</li>
          <li>Redesigned Point of Sale kiosk UI applying conversion best practices, boosting task completion rates 75%</li>
          <li>Designed compliant user data capture processes aligned to regulatory requirements, reducing legal risk 100%</li>
          <li>Improved consumer e-commerce journeys through data-driven UX optimizations, increasing fulfillment 25%</li>
        </ul>
      </div>

      <div class="job">
        <div class="job-title">UX Design Lead</div>
        <a class="job-company" href="https://www.siemens.com" target="_blank">Siemens</a>
        <div class="job-meta">
          <span class="material-symbols-outlined">calendar_month</span>
          07/2020 – 05/2021
          <span class="material-symbols-outlined">location_on</span>
          Phoenix, AZ | Remote
        </div>
        <ul>
          <li>Led cross-functional collaboration to unify design systems across 4 simultaneous projects in a regulated industrial environment</li>
          <li>Produced detailed design documentation and guidelines reducing internal dissemination needs 50%, enabling engineering to build without friction</li>
          <li>Managed stakeholder alignment and project planning, securing approval for 2 high-impact initiatives</li>
          <li>Designed 3D and AutoCAD-integrated UI layouts for complex industrial application interfaces</li>
        </ul>
      </div>

      <div class="job">
        <div class="job-title">Senior UX Designer</div>
        <a class="job-company" href="https://www.glynlyon.com" target="_blank">Glynlyon Inc</a>
        <div class="job-meta">
          <span class="material-symbols-outlined">calendar_month</span>
          02/2014 – 04/2019
          <span class="material-symbols-outlined">location_on</span>
          Phoenix, AZ | Office
        </div>
        <ul>
          <li>Designed WCAG and ADA-compliant inclusive experiences across multi-platform digital products; applied Android and iOS platform guidelines throughout</li>
          <li>Drove data-informed design decisions through usability testing, roadmapping UI features that increased ease of use 65%</li>
          <li>Communicated complex interaction concepts clearly to engineering and product stakeholders to ensure technical feasibility across platforms</li>
          <li>Led cross-functional teams through Design Thinking workshops to define user needs and align on product strategy</li>
        </ul>
      </div>
    </main>

    <!-- SIDEBAR -->
    <aside class="sidebar">

      <div class="sidebar-section">
        <h2 class="section-title">Summary</h2>
        <p class="summary-quote" style="color: #212121; font-weight:700">"Senior individual contributor with 12+ years delivering end-to-end consumer-facing product design across regulated, compliance-heavy environments—from discovery through post-conversion on desktop and mobile."</p>
        <ul class="summary-bullets">
          <li>12+ years hands-on design across e-commerce, regulated enterprise, and fintech-adjacent products</li>
          <li>Translates business goals and regulatory constraints into compliant, conversion-optimized user experiences</li>
          <li>Designs scalable systems adopted across web, iOS, and Android platforms</li>
          <li>Facilitates workshops; aligns Product, Engineering, and C-suite stakeholders</li>
          <li>Proficient with emerging AI tools; advocates for product quality, ethics, and user trust</li>
          <li>Mentor to designers; evangelizes consumer-centered thinking at all organizational levels</li>
        </ul>
      </div>

      <div class="sidebar-section">
        <h2 class="section-title">Key Achievements</h2>
        <ul class="dot-list">
          <li>43% reduction in checkout abandonment</li>
          <li>–17% to +2% operating margin via AI persona platform</li>
          <li>50% faster design delivery via design system</li>
          <li>75% POS task completion uplift</li>
          <li>100% legal risk elimination on data capture</li>
          <li>30% worker efficiency gain in regulated tooling</li>
        </ul>
      </div>

      <div class="sidebar-section">
        <h2 class="section-title">Skills</h2>
        <div class="tag-list">
          <span class="tag">End-to-End Product Design</span>
          <span class="tag">Consumer UX</span>
          <span class="tag">High-Fidelity Prototyping</span>
          <span class="tag">User Flows &amp; Wireframes</span>
          <span class="tag">Figma</span>
          <span class="tag">Design Systems</span>
          <span class="tag">Design Tokens</span>
          <span class="tag">MUI React</span>
          <span class="tag">Google MD3</span>
          <span class="tag">WCAG Compliance</span>
          <span class="tag">iOS &amp; Android Guidelines</span>
          <span class="tag">Conversion Optimization</span>
          <span class="tag">A/B Testing</span>
          <span class="tag">Regulatory Compliance UX</span>
          <span class="tag">Agile / Scrum</span>
          <span class="tag">Coded Prototypes</span>
          <span class="tag">Data-Driven Design</span>
        </div>
      </div>

      <div class="sidebar-section">
        <h2 class="section-title">AI &amp; Technology</h2>
        <div class="tag-list">
          <span class="tag">LLM-Based Workflows</span>
          <span class="tag">Agentic AI</span>
          <span class="tag">AI-Assisted Prototyping</span>
          <span class="tag">Responsible AI</span>
          <span class="tag">RAG Systems</span>
          <span class="tag">Multimodal AI</span>
        </div>
      </div>

      <div class="sidebar-section">
        <h2 class="section-title">Education</h2>
        <div class="edu-degree">Bachelor of Art</div>
        <div class="edu-degree" style="font-size:8.5pt; font-weight:500;">Information Design &amp; Technology</div>
        <div class="edu-school">The Art Institute of Phoenix</div>
        <div class="edu-meta">
          <span class="material-symbols-outlined">calendar_month</span>
          09/2002 – 09/2005
          <span class="material-symbols-outlined">location_on</span>
          Phoenix, AZ
        </div>
        <div class="cert-list">
          <strong>Certifications:</strong><br/>
          Project Management &amp; Agile (NASBA) · Microsoft Business, Data &amp; Software Dev · AI Test Automation (LambdaTest, 100%) · CompTIA A+ &amp; Network+
        </div>
      </div>

      <a class="share-link" href="#">Share Resume &gt;&gt;&gt;</a>

    </aside>
  </div>
</div>
</body>
</html>`;

/**
 * Opens the resume HTML in a new browser tab using Blob URL
 */
export function openResumeInNewTab(): void {
  // Create a Blob from the HTML string
  const blob = new Blob([resumeHTML], { type: 'text/html' });
  
  // Generate a blob URL
  const blobURL = URL.createObjectURL(blob);
  
  // Open in new tab
  const newWindow = window.open(blobURL, '_blank');
  
  // Clean up the blob URL after a delay to ensure the page loads
  if (newWindow) {
    setTimeout(() => {
      URL.revokeObjectURL(blobURL);
    }, 1000);
  }
}

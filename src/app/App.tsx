import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { projects, studies, type Project, type Study } from './components/data';
import { searchIndex, type SearchEntry } from './components/search-index';
import { EditContext, EditableText, useEditContext, exportFullState } from './components/EditableText';
import type { EditChange } from './components/EditableText';
import textOverrides from './components/text-overrides.json';
import textDefaults from './components/text-defaults.json';
import { BulletDesc } from './components/BulletDesc';
import { Linkedin, Twitter, Github, Dribbble } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { ImageLightbox } from './components/ImageLightbox';
import { EditableImage } from './components/EditableImage';
import { openResumeInNewTab } from './components/resume-html';
import { PasswordModal } from './components/PasswordModal';

// Shorthand alias for brevity
const E = EditableText;
const EI = EditableImage;

// ============================================================
// UTILITY HOOKS
// ============================================================
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveals = el.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.querySelectorAll('.progress-bar-fill[data-width]').forEach((bar: Element) => {
            const b = bar as HTMLElement;
            b.style.transition = 'width 0.9s cubic-bezier(0,0,0,1)';
            b.style.width = b.dataset.width || '0%';
          });
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });
    reveals.forEach(r => obs.observe(r));
    return () => obs.disconnect();
  }, []);
  return ref;
}

function useParallax(ids: string[]) {
  useEffect(() => {
    const update = () => {
      ids.forEach(id => {
        const bg = document.getElementById(`parallax-${id}`);
        const section = document.getElementById(id);
        if (!bg || !section) return;
        const rect = section.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const shift = (rect.top / vh) * 40;
        bg.style.transform = `translateY(${shift}px)`;
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
}

// ============================================================
// SVG TOOLTIP
// ============================================================
function SvgTooltip() {
  const [tooltip, setTooltip] = useState({ text: '', x: 0, y: 0, visible: false });
  const isTouchDevice = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      isTouchDevice.current = true;
      const touch = e.touches[0];
      const el = (touch.target as HTMLElement).closest('[data-tip]') as HTMLElement;
      if (el) {
        const tipText = el.dataset.tip || '';
        const tipWidth = Math.min(280, window.innerWidth - 32);
        let xPos = touch.clientX;
        // Clamp to keep tooltip on screen
        if (xPos + tipWidth > window.innerWidth - 16) {
          xPos = window.innerWidth - tipWidth - 16;
        }
        if (xPos < 16) xPos = 16;
        setTooltip({ text: tipText, x: xPos, y: Math.max(touch.clientY - 48, 8), visible: true });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    };
    const handleOver = (e: MouseEvent) => {
      if (isTouchDevice.current) return;
      const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement;
      if (el) {
        setTooltip({ text: el.dataset.tip || '', x: e.clientX + 14, y: e.clientY - 32, visible: true });
      }
    };
    const handleMove = (e: MouseEvent) => {
      if (isTouchDevice.current) return;
      setTooltip(prev => prev.visible ? { ...prev, x: e.clientX + 14, y: e.clientY - 32 } : prev);
    };
    const handleOut = (e: MouseEvent) => {
      if (isTouchDevice.current) return;
      const el = (e.target as HTMLElement).closest('[data-tip]');
      if (el) setTooltip(prev => ({ ...prev, visible: false }));
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseout', handleOut);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseout', handleOut);
    };
  }, []);

  return (
    <div
      className={`svg-tooltip ${tooltip.visible ? 'visible' : ''}`}
      style={{
        left: Math.min(tooltip.x, window.innerWidth - 280),
        top: Math.max(tooltip.y, 8),
      }}
    >
      {tooltip.text}
    </div>
  );
}

// ============================================================
// SEARCH
// ============================================================
function doSearch(query: string): SearchEntry[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const matches = searchIndex.filter(item => item.label.toLowerCase().includes(q));
  if (matches.length === 0) return [];

  // Round-robin: take 1 result per sectionLabel first, then fill remaining slots up to 6
  const MAX = 6;
  const bySection = new Map<string, SearchEntry[]>();
  for (const m of matches) {
    const arr = bySection.get(m.sectionLabel) || [];
    arr.push(m);
    bySection.set(m.sectionLabel, arr);
  }

  const result: SearchEntry[] = [];
  const used = new Set<SearchEntry>();

  // Pass 1: one per section
  for (const [, items] of bySection) {
    if (result.length >= MAX) break;
    const pick = items[0];
    result.push(pick);
    used.add(pick);
  }

  // Pass 2: fill remaining slots
  for (const m of matches) {
    if (result.length >= MAX) break;
    if (!used.has(m)) {
      result.push(m);
      used.add(m);
    }
  }

  return result;
}

// ============================================================
// FULLSCREEN MODAL CONTENT BUILDERS
// ============================================================
function ProjectModalContent({ project: p, onClose }: { project: Project; onClose: () => void }) {
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const { edits, overrides } = useEditContext();
  const resolvedGallery = useMemo(() =>
    (p.galleryImages || []).map((img, i) => {
      const key = `img.project.${p.id}.gallery.${i}`;
      return edits[key]?.to ?? overrides[key] ?? img;
    }),
    [p.galleryImages, p.id, edits, overrides]
  );

  return (
    <>
      <div className="fs-hero">
        <div className="fs-hero-inner" style={{ background: p.bgGradient }}>
          <EI editKey={`img.project.${p.id}.image`} src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: (p.imageFit as React.CSSProperties['objectFit']) || 'cover', objectPosition: p.detailImagePosition || p.imagePosition || 'center' }} />
          <span className="material-icons-outlined fs-hero-icon">{p.icon}</span>
        </div>
        <div className="fs-hero-overlay" />
        <div className="fs-hero-meta">
          <div className={`fs-chip ${p.statusClass}`}>
            {p.status}
          </div>
          <div className="fs-title"><E editKey={`modal.project.${p.id}.title`} value={p.title} /></div>
          <div style={{ fontSize: 'var(--type-body-small)', color: 'rgba(255,255,255,0.56)', marginTop: 'var(--sp-8)' }}><E editKey={`modal.project.${p.id}.category`} value={p.category} /></div>
        </div>
      </div>
      <div className="fs-content">
        <div className="fs-kpi-row">
          {p.kpis.map((k, i) => (
            <div className="fs-kpi" key={i}>
              <div className="fs-kpi-val"><E editKey={`modal.project.${p.id}.kpi.${i}.val`} value={k.val} /></div>
              <div className="fs-kpi-label"><E editKey={`modal.project.${p.id}.kpi.${i}.label`} value={k.label} /></div>
            </div>
          ))}
        </div>
        <div className="fs-two-col">
          <div>
            <div className="fs-section-title"><E editKey={`modal.project.${p.id}.overview.heading`} value="Overview" /></div>
            {/* Sub-header row: delivery date + status */}
            <div className="fs-overview-subheader">
              <span className="fs-overview-date">
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>event</span>
                <E editKey={`modal.project.${p.id}.status`} value={p.status} /> <strong><E editKey={`modal.project.${p.id}.deliveryDate`} value={p.deliveryDate} /></strong>
              </span>
              <span className="fs-overview-success">
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>verified</span>
                <E editKey={`modal.project.${p.id}.successLabel`} value="Success" />
              </span>
            </div>
            <div className="fs-overview-accent-bar" />
            <p className="fs-desc"><E editKey={`modal.project.${p.id}.overview`} value={p.overview} /></p>
            <p className="fs-desc-muted"><E editKey={`modal.project.${p.id}.challenge`} value={p.challenge} /></p>
            <div className="fs-tag-row">
              {p.tags.map((t, i) => <span className="tag" key={i}><E editKey={`modal.project.${p.id}.tag.${i}`} value={t} /></span>)}
            </div>
          </div>
          <div>
            <div className="fs-section-title"><E editKey={`modal.project.${p.id}.phases.heading`} value="Project Phases" /></div>
            <div className="fs-phase-row">
              {p.phases.map((ph, i) => (
                <div className="fs-phase" key={i}>
                  <span className="material-icons-outlined">{ph.icon}</span>
                  <span className="fs-phase-label"><E editKey={`modal.project.${p.id}.phase.${i}.label`} value={ph.label} /></span>
                  <span className="fs-phase-status" style={{ background: ph.statusBg, color: ph.statusColor }}><E editKey={`modal.project.${p.id}.phase.${i}.status`} value={ph.status} /></span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--sp-16)' }}>
              
            </div>
            {/* 2x2 Image Gallery Grid */}
            {p.galleryImages && p.galleryImages.length > 0 && (
              <div className="fs-gallery-grid">
                {p.galleryImages.map((img, i) => (
                  <button key={i} className="fs-gallery-item" onClick={() => setLightbox({ open: true, index: i })}>
                    <EI editKey={`img.project.${p.id}.gallery.${i}`} src={img} alt={`${p.title} gallery ${i + 1}`} />
                    <div className="fs-gallery-item-overlay">
                      <span className="material-icons-outlined">zoom_in</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="fs-section-title"><E editKey={`modal.project.${p.id}.outcomes.heading`} value="Key Outcomes" /></div>
        <div className="fs-list">
          {p.outcomes.map((o, i) => (
            <div className="fs-list-item" key={i}>
              <span className="material-icons-outlined">check_circle</span>
              <span><E editKey={`modal.project.${p.id}.outcome.${i}`} value={o} /></span>
            </div>
          ))}
        </div>
        <div className="fs-section-title"><E editKey={`modal.project.${p.id}.skills.heading`} value="Skills Applied" /></div>
        <div className="fs-skill-grid">
          {p.skills.map((s, i) => (
            <div className="fs-skill-item" key={i}>
              <div className="fs-skill-name"><E editKey={`modal.project.${p.id}.skill.${i}`} value={s.name} /></div>
              <div className="fs-skill-bar-track">
                <div className="fs-skill-bar-fill" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="fs-quote">
          <div className="fs-quote-text"><E editKey={`modal.project.${p.id}.quote.text`} value={p.quote.text} /></div>
          <div className="fs-quote-attr"><E editKey={`modal.project.${p.id}.quote.attr`} value={p.quote.attr} /></div>
        </div>
        <div className="fs-action-row">
          <button className="btn btn-filled" onClick={onClose}>
            <span className="material-icons-outlined">arrow_back</span><E editKey="modal.project.back" value="Back to Projects" />
          </button>
          <a href="#contact" className="btn btn-outlined" onClick={onClose}>
            <span className="material-icons-outlined">mail_outline</span><E editKey="modal.project.discuss" value="Discuss This Project" />
          </a>
        </div>
      </div>
      {lightbox.open && (
        <ImageLightbox
          images={resolvedGallery}
          initialIndex={lightbox.index}
          onClose={() => setLightbox({ open: false, index: 0 })}
        />
      )}
    </>
  );
}

function StudyModalContent({ study: s, onClose }: { study: Study; onClose: () => void }) {
  return (
    <>
      <div className="fs-hero">
        <div className="fs-hero-inner" style={{ background: s.bgGradient }}>
          <EI editKey={`img.study.${s.id}.image`} src={s.image} alt={s.title} style={{ width: '100%', height: '100%', objectFit: (s.imageFit as React.CSSProperties['objectFit']) || 'cover', objectPosition: s.detailImagePosition || s.imagePosition || 'center' }} />
          <span className="material-icons-outlined fs-hero-icon">{s.icon}</span>
        </div>
        <div className="fs-hero-overlay" />
        <div className="fs-hero-meta">
          <div className="fs-chip chip-delivered">
            <E editKey={`modal.study.${s.id}.category`} value={s.category} />
          </div>
          <div className="fs-title"><E editKey={`modal.study.${s.id}.title`} value={s.title} /></div>
          <div style={{ fontSize: 'var(--type-body-small)', color: 'rgba(255,255,255,0.56)', marginTop: 'var(--sp-8)' }}><E editKey={`modal.study.${s.id}.institution`} value={s.institution} /> · <E editKey={`modal.study.${s.id}.period`} value={s.period} /></div>
        </div>
      </div>
      <div className="fs-content">
        <div className="fs-kpi-row">
          <div className="fs-kpi">
            <div className="fs-kpi-val"><E editKey={`modal.study.${s.id}.score`} value={s.score} /></div>
            <div className="fs-kpi-label"><E editKey={`modal.study.${s.id}.scoreLabel`} value="Final Score" /></div>
          </div>
          <div className="fs-kpi" style={{ gridColumn: 'span 3' }}>
            <div className="fs-kpi-val" style={{ fontSize: 'var(--type-title-medium)', lineHeight: 1.4 }}><E editKey={`modal.study.${s.id}.highlight`} value={s.highlight} /></div>
            <div className="fs-kpi-label"><E editKey={`modal.study.${s.id}.achieveLabel`} value="Achievement" /></div>
          </div>
        </div>
        <div className="fs-two-col">
          <div>
            <div className="fs-section-title"><E editKey={`modal.study.${s.id}.overview.heading`} value="Overview" /></div>
            <p className="fs-desc"><E editKey={`modal.study.${s.id}.overview`} value={s.overview} /></p>
            <p className="fs-desc-muted"><E editKey={`modal.study.${s.id}.thesis`} value={s.thesis} /></p>
            <div className="fs-tag-row">
              {s.tags.map((t, i) => <span className="tag" key={i}><E editKey={`modal.study.${s.id}.tag.${i}`} value={t} /></span>)}
            </div>
            <div style={{ marginTop: 'var(--sp-24)' }}>
              <div className="progress-bar-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--type-label-medium)', color: 'var(--md-on-surface-variant)', marginBottom: 'var(--sp-8)' }}>
                <span><E editKey={`modal.study.${s.id}.gradeLabel`} value="Score / Grade" /></span><span>{s.score}</span>
              </div>
              <div className="progress-bar-track" style={{ height: 8 }}>
                <div className="progress-bar-fill" style={{ width: `${s.scorePct}%` }} />
              </div>
            </div>
          </div>
          <div>
            <div className="fs-section-title"><E editKey={`modal.study.${s.id}.modules.heading`} value="Modules Covered" /></div>
            <div className="fs-list">
              {s.modules.map((m, i) => (
                <div className="fs-list-item" key={i}>
                  <span className="material-icons-outlined">menu_book</span>
                  <span><E editKey={`modal.study.${s.id}.module.${i}`} value={m} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="fs-section-title"><E editKey={`modal.study.${s.id}.skills.heading`} value="Skills Developed" /></div>
        <div className="fs-skill-grid">
          {s.skills.map((sk, i) => (
            <div className="fs-skill-item" key={i}>
              <div className="fs-skill-name"><E editKey={`modal.study.${s.id}.skill.${i}`} value={sk.name} /></div>
              <div className="fs-skill-bar-track">
                <div className="fs-skill-bar-fill" style={{ width: `${sk.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="fs-action-row">
          <button className="btn btn-filled" onClick={onClose}>
            <span className="material-icons-outlined">arrow_back</span><E editKey="modal.study.back" value="Back to Studies" />
          </button>
          <a href="#contact" className="btn btn-outlined" onClick={onClose}>
            <span className="material-icons-outlined">mail_outline</span><E editKey="modal.study.touch" value="Get in Touch" />
          </a>
        </div>
      </div>
    </>
  );
}

// ============================================================
// INDUSTRY ROW
// ============================================================
function IndustryRow({ label, pct, n, color }: { label: string; pct: number; n: number; color: string }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setAnimated(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="industry-row" data-label={label} ref={ref}>
      <div className="industry-row-bar-wrap">
        <div
          className="industry-row-bar"
          style={{ width: animated ? `${pct}%` : '0%', background: color }}
          data-tip={`${label}: ${pct}% (${n} projects)`}
        />
      </div>
      <span className="industry-row-val">{pct}%</span>
      <span className="industry-row-count">{n} projects</span>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [sideSheetOpen, setSideSheetOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopSearch, setDesktopSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');
  const [desktopResultsOpen, setDesktopResultsOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [snackbar, setSnackbar] = useState({ show: false, msg: '' });
  const [modal, setModal] = useState<{ type: 'project' | 'study'; id: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [edits, setEdits] = useState<Record<string, EditChange>>({});
  const registryRef = useRef<Record<string, string>>({});
  const [registrySize, setRegistrySize] = useState(0);

  // Register default values from each EditableText instance
  const registerKey = useCallback((key: string, defaultValue: string) => {
    if (registryRef.current[key] !== defaultValue) {
      registryRef.current[key] = defaultValue;
      setRegistrySize(Object.keys(registryRef.current).length);
    }
  }, []);

  // Text overrides from JSON file (passive layer — no timing issues)
  const overrides = useMemo(() => ({ ...textDefaults, ...textOverrides } as Record<string, string>), []);

  const handleEdit = useCallback((key: string, originalValue: string, newValue: string) => {
    setEdits(prev => {
      const next = { ...prev };
      if (newValue === originalValue) {
        delete next[key];
      } else {
        next[key] = { from: originalValue, to: newValue };
      }
      return next;
    });
  }, []);

  const editCount = useMemo(() => Object.keys(edits).length, [edits]);

  const editContextValue = useMemo(() => ({
    editable: editMode,
    edits,
    overrides,
    onEdit: handleEdit,
    register: registerKey,
  }), [editMode, edits, overrides, handleEdit, registerKey]);

  const mainRef = useScrollReveal();
  useParallax(['solutions', 'experience', 'studies', 'about', 'contact']);

  const snackbarTimeout = useRef<ReturnType<typeof setTimeout>>();
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const showSnackbar = useCallback((msg: string, duration = 3000) => {
    setSnackbar({ show: true, msg });
    clearTimeout(snackbarTimeout.current);
    snackbarTimeout.current = setTimeout(() => setSnackbar({ show: false, msg: '' }), duration);
  }, []);

  const handleCopyState = useCallback(() => {
    const json = exportFullState(registryRef.current, edits, overrides);
    navigator.clipboard.writeText(json).then(() => {
      const total = registrySize;
      const changed = editCount;
      showSnackbar(`Full state copied! (${total} keys, ${changed} edited)`, 4000);
    }).catch(() => {
      showSnackbar('Failed to copy — check clipboard permissions.', 3000);
    });
  }, [edits, overrides, editCount, registrySize, showSnackbar]);

  // Disable right-click globally when not in edit mode
  useEffect(() => {
    if (editMode) return;
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [editMode]);

  // Scroll tracking
  useEffect(() => {
    const sections = ['delivered-solutions', 'experience', 'studies', 'about', 'contact'];
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const offset = 130;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.getBoundingClientRect().top <= offset) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSideSheetOpen(false);
        setModal(null);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Body overflow for modal/sidesheet
  useEffect(() => {
    document.body.style.overflow = (modal || sideSheetOpen) ? 'hidden' : '';
  }, [modal, sideSheetOpen]);

  // Hero reveal on load
  useEffect(() => {
    const heroReveals = document.querySelectorAll('#hero .reveal');
    heroReveals.forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 100));
  }, []);

  // Click outside desktop search
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.nav-search')) setDesktopResultsOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // Helper to handle search result click (scroll or open modal)
  const handleSearchResultClick = useCallback((r: SearchEntry) => {
    if (r.action?.type === 'modal') {
      if (r.action.modalType === 'project') {
        openProjectModal(r.action.id);
      } else {
        openStudyModal(r.action.id);
      }
    } else {
      scrollTo(r.section);
    }
  }, []);

  const desktopResults = doSearch(desktopSearch);
  const mobileResults = doSearch(mobileSearch);

  const navLinks = [
    { id: 'delivered-solutions', label: 'Solutions' },
    { id: 'experience', label: 'Experience' },
    { id: 'studies', label: 'Studies' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  const getFilterStatus = (status: string) => {
    if (status === 'Delivered') return 'delivered';
    if (status === 'In Progress') return 'inprogress';
    return 'planned';
  };

  const [formSending, setFormSending] = React.useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    setFormSending(true);
    try {
      const formData = new FormData(form);
      await emailjs.send(
        'service_aqz6rgv',
        'template_h3nq3ga',
        {
          from_name: formData.get('from_name') as string,
          from_email: formData.get('from_email') as string,
          subject: formData.get('subject') as string,
          message: formData.get('message') as string,
        },
        'rX7hQpejZXaiSU_OY'
      );
      showSnackbar("Message sent! I'll be in touch soon.", 4000);
      form.reset();
    } catch (err: any) {
      console.error('EmailJS error:', err);
      const msg = err?.text || err?.message || 'Unknown error';
      showSnackbar(`Failed to send: ${msg}`, 5000);
    } finally {
      setFormSending(false);
    }
  };

  const openProjectModal = (id: number) => setModal({ type: 'project', id });
  const openStudyModal = (id: number) => setModal({ type: 'study', id });
  const closeModal = () => setModal(null);

  return (
    <EditContext.Provider value={editContextValue}>
    <div ref={mainRef}>
      {/* TOP NAV */}
      <nav id="top-nav" className={scrolled ? 'scrolled' : ''} role="navigation" aria-label="Main navigation">
        <a href="#hero" className="nav-logo" aria-label="Logo - Go to top" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>
          <div className="nav-logo-mark"><span>Ck</span></div>
          <span className="nav-logo-text"><E editKey="nav.logo" value="Christopher Kenreigh" /></span>
        </a>

        <div className="nav-links" role="menubar">
          {navLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`nav-link ${activeSection === link.id ? 'active' : ''}`}
              role="menuitem"
              onClick={(e) => { e.preventDefault(); scrollTo(link.id); }}
            >
              <E editKey={`nav.link.${link.id}`} value={link.label} />
            </a>
          ))}
        </div>

        <div className="nav-search" role="search">
          <span className="material-icons" aria-hidden="true">search</span>
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search site content"
            autoComplete="off"
            value={desktopSearch}
            onChange={(e) => {
              setDesktopSearch(e.target.value);
              setDesktopResultsOpen(e.target.value.length > 0);
            }}
          />
          <div className={`search-results ${desktopResultsOpen && desktopSearch ? 'open' : ''}`} role="listbox">
            {desktopResults.length === 0 && desktopSearch ? (
              <div className="search-result-item">
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--type-body-small)' }}><E editKey="search.noResults" value="No results found" /></span>
              </div>
            ) : desktopResults.map((r, i) => (
              <div key={i} className="search-result-item" onClick={() => { handleSearchResultClick(r); setDesktopResultsOpen(false); setDesktopSearch(''); }}>
                <span className="material-icons-outlined">{r.icon}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <span style={{ fontSize: 'var(--type-label-small)', color: 'rgba(255,255,255,0.4)' }}>{r.sectionLabel}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <button className="nav-search-mobile" onClick={() => { setMobileSearchOpen(true); setTimeout(() => mobileSearchRef.current?.focus(), 100); }} aria-label="Open search">
          <span className="material-icons">search</span>
        </button>

        <button className="nav-hamburger" onClick={() => setSideSheetOpen(true)} aria-label="Open navigation menu" aria-expanded={sideSheetOpen}>
          <span className="material-icons">menu</span>
        </button>
      </nav>

      {/* MOBILE SEARCH OVERLAY */}
      <div className={`mobile-search-overlay ${mobileSearchOpen ? 'open' : ''}`} role="search">
        <button className="side-sheet-close" onClick={() => { setMobileSearchOpen(false); setMobileSearch(''); }} aria-label="Close search">
          <span className="material-icons">arrow_back</span>
        </button>
        <input
          ref={mobileSearchRef}
          type="search"
          placeholder="Search this site…"
          aria-label="Search site"
          autoComplete="on"
          value={mobileSearch}
          onChange={(e) => setMobileSearch(e.target.value)}
          onBlur={() => {
            setTimeout(() => {
              const active = document.activeElement;
              const overlay = document.querySelector('.mobile-search-overlay');
              const results = document.querySelector('.mobile-search-results');
              if ((overlay && overlay.contains(active)) || (results && results.contains(active))) return;
              setMobileSearchOpen(false);
              setMobileSearch('');
            }, 150);
          }}
        />
        <button className="side-sheet-close" aria-label="Submit search">
          <span className="material-icons" style={{ color: 'var(--clr-teal-light)' }}>search</span>
        </button>
      </div>
      <div className={`mobile-search-results ${mobileSearchOpen && mobileSearch ? 'open' : ''}`} role="listbox">
        {mobileResults.length === 0 && mobileSearch ? (
          <div className="search-result-item">
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--type-body-small)' }}><E editKey="search.noResults.mobile" value="No results found" /></span>
          </div>
        ) : mobileResults.map((r, i) => (
          <div key={i} className="search-result-item" onClick={() => { handleSearchResultClick(r); setMobileSearchOpen(false); setMobileSearch(''); }}>
            <span className="material-icons-outlined">{r.icon}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <span style={{ fontSize: 'var(--type-label-small)', color: 'rgba(255,255,255,0.4)' }}>{r.sectionLabel}</span>
            </span>
          </div>
        ))}
      </div>

      {/* SIDE SHEET */}
      <div className={`side-sheet-scrim ${sideSheetOpen ? 'open' : ''}`} onClick={() => setSideSheetOpen(false)} aria-hidden="true" />
      <nav className={`side-sheet ${sideSheetOpen ? 'open' : ''}`} aria-label="Mobile navigation" aria-hidden={!sideSheetOpen}>
        <div className="side-sheet-header">
          <a href="#hero" className="nav-logo" onClick={(e) => { e.preventDefault(); setSideSheetOpen(false); scrollTo('hero'); }}>
            <div className="nav-logo-mark"><span>Ck</span></div>
            <span className="nav-logo-text"><E editKey="sidenav.brand" value="KPI.co" /></span>
          </a>
          <button className="side-sheet-close" onClick={() => setSideSheetOpen(false)} aria-label="Close menu">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="side-sheet-nav">
          {[
            { id: 'delivered-solutions', icon: 'analytics', label: 'Delivered Solutions' },
            { id: 'experience', icon: 'work_outline', label: 'Experience' },
            { id: 'studies', icon: 'school', label: 'Studies' },
            { id: 'about', icon: 'person_outline', label: 'About' },
          ].map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`side-sheet-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setSideSheetOpen(false); scrollTo(item.id); }}
            >
              <span className="material-icons-outlined">{item.icon}</span>
              <E editKey={`sidenav.${item.id}`} value={item.label} />
            </a>
          ))}
          <div className="side-sheet-divider" />
          <a href="#contact" className="side-sheet-nav-item" onClick={(e) => { e.preventDefault(); setSideSheetOpen(false); scrollTo('contact'); }}>
            <span className="material-icons-outlined">mail_outline</span>
            <E editKey="sidenav.contact" value="Contact" />
          </a>
        </div>
        {/* ── EDIT CONTROLS ── visibility toggle: file /src/app/App.tsx, search for EDIT_FEATURE_VISIBLE */}
        {/* EDIT_FEATURE_VISIBLE: set to false to hide edit controls */}
        {true && (
          <div className="edit-controls">
            {editMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="edit-copy-btn" onClick={() => { handleCopyState(); setSideSheetOpen(false); }}>
                  <span className="material-icons-outlined">content_copy</span>
                  Copy State
                  <span className="edit-badge" style={{ opacity: editCount > 0 ? 1 : 0.5 }}>{registrySize}</span>
                </button>
                {editCount > 0 && (
                  <button className="edit-copy-btn" onClick={() => { setEdits({}); showSnackbar('All edits cleared — back to defaults.', 3000); }} style={{ background: 'transparent', border: '1px solid var(--md-outline)', color: 'var(--md-on-surface-variant)' }}>
                    <span className="material-icons-outlined">restart_alt</span>
                    Reset All
                    <span className="edit-badge">{editCount}</span>
                  </button>
                )}
              </div>
            )}
            <div className="edit-toggle-row">
              <div className="edit-toggle-label">
                <span className="material-icons-outlined">edit_note</span>
                Edit Mode
              </div>
              <button
                className={`edit-toggle ${editMode ? 'active' : ''}`}
                onClick={() => {
                  if (editMode) {
                    setEditMode(false);
                  } else {
                    setShowPwModal(true);
                  }
                }}
                aria-label={editMode ? 'Disable edit mode' : 'Enable edit mode'}
              />
            </div>
          </div>
        )}
        <div className="side-sheet-footer"><E editKey="sidenav.footer" value="© 2024 KPI Dashboard. All rights reserved." /></div>
      </nav>

      {/* MAIN CONTENT */}
      <main id="main-content">
        {/* HERO */}
        <section id="hero" className="parallax-section">
          <div className="hero-bg-grid" />
          <div className="hero-content">
            <div className="hero-left-col">
              <div className="hero-tag reveal">
                <span className="material-icons-outlined" style={{ fontSize: 14 }}>bolt</span>
                <E editKey="hero.tag" value="Above and Beyond Design" />
                <span className="material-icons-outlined" style={{ fontSize: 14 }}>bolt</span>
              </div>
              <h1 className="hero-title reveal reveal-delay-1">
                <E editKey="hero.title.1" value="Delivering" />{' '}<em><E editKey="hero.title.2" value="Solutions" /></em><br />
              </h1>
              <div className="hero-actions reveal reveal-delay-3">
                <a href="#delivered-solutions" className="btn btn-filled btn-lg" onClick={(e) => { e.preventDefault(); scrollTo('delivered-solutions'); }}>
                  <span className="material-icons-outlined">rocket_launch</span>
                  <E editKey="hero.cta" value="View Solutions" />
                </a>
              </div>
            </div>
            <div className="hero-kpis">
              {[
                { icon: 'celebration', value: 'Product Outcomes', label: 'conversion rate, activation rate, task success rate', trend: '+10–35% systemic impact' },
                { icon: 'groups', value: 'Design Leverage', label: 'design system adoption, component reuse rate', trend: '60–90% org reuse' },
                { icon: 'star_outline', value: 'Velocity Improvement', label: 'cycle time, handoff revisions, build rework', trend: '25–40% faster delivery' },
                { icon: 'schedule', value: 'Risk Reduction', label: 'usability bugs, accessibility violations, support tickets', trend: '20–50% less UX bugs' },
              ].map((kpi, i) => (
                <div key={i} className={`hero-kpi-card reveal reveal-delay-${i + 1}`}>
                  <div className="kpi-icon"><span className="material-icons-outlined">{kpi.icon}</span></div>
                  <div className="kpi-value"><E editKey={`hero.kpi.${i}.value`} value={kpi.value} /></div>
                  <div className="kpi-label"><E editKey={`hero.kpi.${i}.label`} value={kpi.label} /></div>
                  <div className="kpi-trend up"><span className="material-icons">trending_up</span> <E editKey={`hero.kpi.${i}.trend`} value={kpi.trend} /></div>
                </div>
              ))}
            </div>
            <div className="hero-actions-mobile reveal reveal-delay-3" style={{ display: 'none' }}>
              <a href="#delivered-solutions" className="btn btn-filled btn-lg" onClick={(e: React.MouseEvent) => { e.preventDefault(); scrollTo('delivered-solutions'); }}>
                <span className="material-icons-outlined">rocket_launch</span>
                <E editKey="hero.cta" value="View Solutions" />
              </a>
            </div>
          </div>
        </section>

        {/* DELIVERED SOLUTIONS */}
        <section id="delivered-solutions" className="section parallax-section" style={{ paddingTop: 'var(--sp-96)', paddingBottom: 'var(--sp-96)' }}>
          <div className="section-bg-wrap" id="bg-solutions">
            <div className="section-bg-inner" id="parallax-solutions" style={{ background: 'var(--md-surface)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(27,154,170,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(27,154,170,0.04) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
              <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(27,154,170,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '10%', left: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,122,135,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
            </div>
            <div className="section-bg-overlay" style={{ background: 'rgba(245,241,227,0.92)' }} />
          </div>
          <div className="parallax-inner">
            <div className="section-header">
              <div className="section-eyebrow reveal"><E editKey="solutions.eyebrow" value="Delivering Impactful Solutions" /></div>
              <h2 className="section-title reveal reveal-delay-1"><E editKey="solutions.title" value="Defining OKRs, KPIs, Opportunities for Business" /></h2>
              <p className="section-subtitle reveal reveal-delay-2"><E editKey="solutions.subtitle" value="Partnering across the org is my discovery process" /></p>
            </div>

            {/* KPI Stats */}
            <div className="kpi-grid">
              {[
                { icon: 'folder_special', num: 'Where Users are', label: 'Exposes the real friction', trend: '12% Task success rate', tooltip: 'Tracking where users drop off and struggle reveals the highest-impact opportunities. Task success rate improved 12% after friction mapping.' },
                { icon: 'people_outline', num: 'Multiply Output', label: 'Increases velocity', trend: '24% more deliverables', tooltip: 'Scalable design systems and component libraries let teams ship 24% more deliverables without adding headcount. Reuse rate reached 72% org-wide.' },
                { icon: 'savings', num: 'Revenue Initiatives', label: 'Designing for business', trend: '+31% ROI first 6 months', tooltip: 'Connecting UX decisions to revenue goals generates measurable ROI. Projects aligned to business KPIs returned +31% ROI in the first 6 months post-launch.' },
                { icon: 'verified', num: 'Instant Prototypes', label: 'Validate before investing', trend: '60% less time to Profit', tooltip: 'High-fidelity prototypes tested with real users before engineering investment cut time-to-profit by 60%.' },
              ].map((kpi, i) => (
                <div key={i} className={`kpi-stat-card reveal ${i > 0 ? `reveal-delay-${i}` : ''}`} data-tip={kpi.tooltip}>
                  <div className="kpi-stat-icon"><span className="material-icons-outlined">{kpi.icon}</span></div>
                  <div className="kpi-stat-number"><E editKey={`solutions.kpi.${i}.num`} value={kpi.num} /></div>
                  <div className="kpi-stat-label"><E editKey={`solutions.kpi.${i}.label`} value={kpi.label} /></div>
                  <div className="kpi-stat-trend up"><span className="material-icons">arrow_upward</span> <E editKey={`solutions.kpi.${i}.trend`} value={kpi.trend} /></div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="chart-area">
              {/* Bar Chart */}
              <div className="chart-card reveal">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title"><E editKey="chart.bar.title" value="Solutions Delivered within Career" /></div>
                    <div className="chart-card-subtitle"><E editKey="chart.bar.subtitle" value="Most recent three companies where my solutions delivered value" /></div>
                  </div>
                </div>
                <svg className="svg-chart" viewBox="0 0 500 320" preserveAspectRatio="xMidYMid meet" aria-label="Bar chart solutions by company">
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B9AAA" /><stop offset="100%" stopColor="#0D7A87" />
                    </linearGradient>
                    <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2BBDCF" stopOpacity="0.45" /><stop offset="100%" stopColor="#1B9AAA" stopOpacity="0.25" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  <line x1="60" y1="270" x2="480" y2="270" stroke="#C9C7B5" strokeWidth="1" />
                  <line x1="60" y1="205" x2="480" y2="205" stroke="#C9C7B5" strokeWidth="0.5" strokeDasharray="4 3" />
                  <line x1="60" y1="140" x2="480" y2="140" stroke="#C9C7B5" strokeWidth="0.5" strokeDasharray="4 3" />
                  <line x1="60" y1="75" x2="480" y2="75" stroke="#C9C7B5" strokeWidth="0.5" strokeDasharray="4 3" />
                  <line x1="60" y1="10" x2="480" y2="10" stroke="#C9C7B5" strokeWidth="0.5" strokeDasharray="4 3" />
                  {/* Y-axis labels */}
                  <text x="52" y="274" textAnchor="end" fontSize="12" fill="#78766A">0</text>
                  <text x="52" y="209" textAnchor="end" fontSize="12" fill="#78766A">10</text>
                  <text x="52" y="144" textAnchor="end" fontSize="12" fill="#78766A">20</text>
                  <text x="52" y="79" textAnchor="end" fontSize="12" fill="#78766A">30</text>
                  <text x="52" y="14" textAnchor="end" fontSize="12" fill="#78766A">40</text>
                  {/* 5 Bars */}
                  {[
                    { x: 90, h: 182, label: 'Glynlyon Inc', val: '28', tip: '2014-19: Sr UX Designer', grad: 'barGrad2' },
                    { x: 170, h: 221, label: 'Siemens Inc', val: '34', tip: '2020-21: UX Design Operator', grad: 'barGrad2' },
                    { x: 250, h: 195, label: 'Opentech Alliance', val: '30', tip: '2021-22: Sr Product Designer', grad: 'barGrad' },
                    { x: 330, h: 234, label: 'Freeport McMoRan ', val: '36', tip: '2022-23: Sr Product Designer', grad: 'barGrad' },
                    { x: 410, h: 214.5, label: 'Plexus Worldwide', val: '33', tip: '2024-Now: Principal Product Designer', grad: 'barGrad' },
                  ].map((bar) => (
                    <g key={bar.label}>
                      <rect x={bar.x} y={270 - bar.h} width="48" height={bar.h} rx="4" fill={`url(#${bar.grad})`} data-tip={bar.tip} style={{ cursor: 'pointer' }} />
                      <text x={bar.x + 24} y="292" textAnchor="middle" fontSize="12" fill="#78766A" fontWeight="500">
                        {bar.label.split(' ').length > 1
                          ? bar.label.split(' ').map((word, wi) => (
                              <tspan key={wi} x={bar.x + 24} dy={wi === 0 ? 0 : 14}>{word}</tspan>
                            ))
                          : bar.label}
                      </text>
                    </g>
                  ))}
                  {/* Trend line */}
                  <polyline points="114,88 194,49 274,75 354,36 434,55.5" fill="none" stroke="#DDDBCB" strokeWidth="1.5" strokeDasharray="4 3" opacity="1" />
                </svg>
              </div>

              {/* Donut Chart */}
              <div className="chart-card reveal reveal-delay-1">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title"><E editKey="chart.donut.title" value="By Solution Type" /></div>
                    <div className="chart-card-subtitle"><E editKey="chart.donut.subtitle" value="Breakdown across 148 projects" /></div>
                  </div>
                </div>
                <div className="donut-wrapper">
                  <svg className="donut-svg" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="58" fill="none" stroke="#EAE7D3" strokeWidth="20" />
                    <circle cx="80" cy="80" r="58" fill="none" stroke="#1B9AAA" strokeWidth="20" strokeDasharray="145 219" strokeDashoffset="0" transform="rotate(-90 80 80)" data-tip="Digital Products: 40% (59 projects)" style={{ cursor: 'pointer' }} />
                    <circle cx="80" cy="80" r="58" fill="none" stroke="#2BBDCF" strokeWidth="20" strokeDasharray="91 273" strokeDashoffset="-145" transform="rotate(-90 80 80)" data-tip="UX Research: 25% (37 projects)" style={{ cursor: 'pointer' }} />
                    <circle cx="80" cy="80" r="58" fill="none" stroke="#DDDBCB" strokeWidth="20" strokeDasharray="73 291" strokeDashoffset="-236" transform="rotate(-90 80 80)" data-tip="Strategy: 20% (30 projects)" style={{ cursor: 'pointer' }} />
                    <circle cx="80" cy="80" r="58" fill="none" stroke="#46453A" strokeWidth="20" strokeDasharray="54 310" strokeDashoffset="-309" transform="rotate(-90 80 80)" data-tip="Engineering: 15% (22 projects)" style={{ cursor: 'pointer' }} />
                    <text x="80" y="75" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1A1A18" fontFamily="'DM Serif Display',serif">148</text>
                    <text x="80" y="91" textAnchor="middle" fontSize="9" fill="#46453A">projects</text>
                  </svg>
                  <div className="donut-legend">
                    {[
                      { color: '#1B9AAA', label: 'Digital Products', val: '40%' },
                      { color: '#2BBDCF', label: 'UX Research', val: '25%' },
                      { color: '#DDDBCB', label: 'Strategy', val: '20%' },
                      { color: '#46453A', label: 'Engineering', val: '15%' },
                    ].map((item, i) => (
                      <div key={i} className="donut-legend-item">
                        <div className="donut-legend-dot" style={{ background: item.color }} />
                        <span className="donut-legend-label"><E editKey={`chart.donut.legend.${i}.label`} value={item.label} /></span>
                        <span className="donut-legend-val"><E editKey={`chart.donut.legend.${i}.val`} value={item.val} /></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Industry + Satisfaction */}
            <div className="chart-area" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 'var(--sp-48)' }}>
              <div className="chart-card reveal">
                <div className="chart-card-header">
                  <div><div className="chart-card-title"><E editKey="chart.industry.title" value="Industry Coverage" /></div><div className="chart-card-subtitle"><E editKey="chart.industry.subtitle" value="Projects by sector" /></div></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-16)' }}>
                  {[
                    { label: 'e-commerce', pct: 32, n: 47, color: '#1B9AAA' },
                    { label: 'Mining Tech', pct: 22, n: 33, color: '#2BBDCF' },
                    { label: 'Property Tech', pct: 18, n: 27, color: '#0D7A87' },
                    { label: 'Enterprise SaaS', pct: 15, n: 22, color: '#4A7C88' },
                    { label: 'Ed-Tech', pct: 8, n: 12, color: '#DDDBCB' },
                    { label: 'Military Tech', pct: 5, n: 7, color: '#C9C7B5' },
                  ].map((row, i) => (
                    <IndustryRow key={i} {...row} />
                  ))}
                </div>
              </div>

              <div className="chart-card reveal reveal-delay-1">
                <div className="chart-card-header">
                  <div><div className="chart-card-title"><E editKey="chart.satisfaction.title" value="Client Satisfaction Score" /></div><div className="chart-card-subtitle"><E editKey="chart.satisfaction.subtitle" value="Rolling 24-month NPS trend" /></div></div>
                  <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: '2rem', color: 'var(--clr-teal)', lineHeight: 1 }}><E editKey="chart.satisfaction.score" value="4.9" /><span style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', fontFamily: "'DM Sans',sans-serif" }}> /5</span></div>
                </div>
                <svg viewBox="0 0 340 100" style={{ width: '100%' }} aria-label="Satisfaction sparkline">
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B9AAA" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#1B9AAA" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,72 L14,68 L28,65 L42,60 L56,58 L70,54 L84,52 L98,48 L112,45 L126,42 L140,40 L154,38 L168,35 L182,33 L196,30 L210,28 L224,25 L238,22 L252,20 L266,18 L280,15 L294,13 L308,11 L322,9 L336,7 L340,7 L340,100 L0,100 Z" fill="url(#sparkFill)" />
                  <path d="M0,72 L14,68 L28,65 L42,60 L56,58 L70,54 L84,52 L98,48 L112,45 L126,42 L140,40 L154,38 L168,35 L182,33 L196,30 L210,28 L224,25 L238,22 L252,20 L266,18 L280,15 L294,13 L308,11 L322,9 L336,7" fill="none" stroke="#1B9AAA" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="0" cy="72" r="3" fill="#1B9AAA" data-tip="Jan 2023: 4.5★" style={{ cursor: 'pointer' }} />
                  <circle cx="112" cy="45" r="3" fill="#1B9AAA" data-tip="Mid 2023: 4.7★" style={{ cursor: 'pointer' }} />
                  <circle cx="224" cy="25" r="3" fill="#1B9AAA" data-tip="Jan 2024: 4.8★" style={{ cursor: 'pointer' }} />
                  <circle cx="336" cy="7" r="4" fill="#1B9AAA" data-tip="Current: 4.9★" style={{ cursor: 'pointer' }} />
                  <text x="0" y="94" fontSize="8" fill="#78766A">Jan '23</text>
                  <text x="112" y="94" fontSize="8" fill="#78766A">Jan '23 Q3</text>
                  <text x="224" y="94" fontSize="8" fill="#78766A">Jan '24</text>
                  <text x="310" y="94" fontSize="8" fill="#78766A">Now</text>
                  <text x="324" y="14" fontSize="9" fill="#1B9AAA" fontWeight="600">4.9★</text>
                </svg>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-8)', marginTop: 'var(--sp-16)' }}>
                  {[{ val: '98%', label: 'Would Refer' }, { val: '94%', label: 'Repeat Clients' }, { val: '+73', label: 'NPS Score' }].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: 'var(--sp-12)', background: 'var(--md-surface-container-low)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1.25rem', color: 'var(--md-on-surface)' }}><E editKey={`chart.satisfaction.stat.${i}.val`} value={s.val} /></div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: 2 }}><E editKey={`chart.satisfaction.stat.${i}.label`} value={s.label} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter + Projects */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-16)', marginBottom: 'var(--sp-32)' }}>
              <h3 className="section-title reveal" style={{ fontSize: 'var(--type-headline-small)', marginBottom: 0 }}><E editKey="solutions.projects.heading" value="Featured Projects" /></h3>
              <div className="proj-filter-tabs reveal">
                {[{ key: 'all', label: 'All' }, { key: 'delivered', label: 'Delivered' }, { key: 'inprogress', label: 'In Progress' }, { key: 'planned', label: 'Planned' }].map((f, i) => (
                  <button key={f.key} className={`proj-filter-btn ${projectFilter === f.key ? 'active' : ''}`} onClick={() => setProjectFilter(f.key)}>
                    <E editKey={`project.filter.${i}`} value={f.label} />
                  </button>
                ))}
              </div>
            </div>

            <div className="projects-grid" id="projects-grid">
              {projects.filter(p => projectFilter === 'all' || getFilterStatus(p.status) === projectFilter).map((p, i) => (
                <div key={`${p.id}-${projectFilter}`} className="project-card" style={{ animation: 'fadeInUp 0.3s ease forwards', animationDelay: `${i * 60}ms` }} data-status={getFilterStatus(p.status)}>
                  <div className="project-card-img">
                    <div className="project-card-img-inner" style={{ background: p.bgGradient }}>
                      <EI editKey={`img.project.${p.id}.image`} src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: (p.imageFit as React.CSSProperties['objectFit']) || 'cover', objectPosition: p.imagePosition || 'center' }} />
                      <span className="material-icons-outlined project-card-icon">{p.icon}</span>
                    </div>
                    <span className={`project-chip ${p.statusClass}`}><E editKey={`project.${p.id}.status`} value={p.status} /></span>
                  </div>
                  <div className="project-card-body">
                    <div className="project-card-title"><E editKey={`project.${p.id}.title`} value={p.title} /></div>
                    <div className="project-card-desc"><E editKey={`project.${p.id}.desc`} value={p.desc} /></div>
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-label"><span><E editKey={`project.${p.id}.progressLabel`} value={p.progressLabel} /></span><span><E editKey={`project.${p.id}.progressValue`} value={p.progressValue} /></span></div>
                      <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${p.completion}%` }} /></div>
                    </div>
                    <div className="project-card-stats">
                      {p.stats.map((s, si) => (
                        <div key={si} className="project-stat"><span className="material-icons-outlined">{s.icon}</span><E editKey={`project.${p.id}.stat.${si}`} value={s.label} /></div>
                      ))}
                    </div>
                    <div className="project-card-tags">
                      {p.tags.slice(0, 3).map((t, ti) => <span key={ti} className="tag"><E editKey={`project.${p.id}.tag.${ti}`} value={t} /></span>)}
                    </div>
                    <div className="project-card-footer">
                      <span className="project-stat" style={{ border: 'none', background: 'none', padding: 0 }}>
                        <span className="material-icons-outlined" style={{ fontSize: 12, color: p.statusClass === 'chip-delivered' ? 'var(--clr-teal)' : p.statusClass === 'chip-inprogress' ? '#E65100' : '#1565C0' }}>
                          {p.statusClass === 'chip-delivered' ? 'task_alt' : p.statusClass === 'chip-inprogress' ? 'pending' : 'schedule'}
                        </span>
                        <E editKey={`project.${p.id}.status2`} value={p.status} />
                      </span>
                      <button className="proj-card-expand-btn" onClick={() => openProjectModal(p.id)}>
                        <span className="material-icons-outlined">open_in_full</span><E editKey="project.viewCase" value="View Case" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EXPERIENCE */}
        <section id="experience" className="section parallax-section" style={{ paddingTop: 'var(--sp-96)', paddingBottom: 'var(--sp-96)' }}>
          <div className="section-bg-wrap">
            <div className="section-bg-inner" id="parallax-experience" style={{ overflow: 'hidden' }}>
              <EI editKey="img.exp.bg.desktop" src="https://tinyurl.com/resumebg-desktop" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} className="exp-bg-desktop" />
              <EI editKey="img.exp.bg.mobile" src="https://tinyurl.com/resumebg-mobile" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} className="exp-bg-mobile" />
            </div>
            <div className="section-bg-overlay" style={{ background: 'rgba(5,5,5,0)' }} />
          </div>
          <div className="parallax-inner">
            <div className="section-header">
              <div className="section-eyebrow reveal" style={{ color: 'var(--clr-teal-light)' }}><E editKey="exp.eyebrow" value="Experience" /></div>
              <h2 className="section-title reveal reveal-delay-1"><E editKey="exp.title" value="A Decade of Craft & Curiosity" /></h2>
              <p className="section-subtitle reveal reveal-delay-2" style={{ color: 'rgba(255,255,255,0.56)' }}><E editKey="exp.subtitle" value="Spanning product, design, engineering, and strategy across industries." /></p>
            </div>

            <div className="exp-stats">
              {[
                { num: '10', suffix: '+', label: 'Years of Experience' },
                { num: '8', suffix: '', label: 'Industries Served' },
                { num: '40', suffix: '+', label: 'Enterprise Clients' },
                { num: '6', suffix: '', label: 'Awards & Recognitions' },
              ].map((s, i) => (
                <div key={i} className={`exp-stat reveal ${i > 0 ? `reveal-delay-${i}` : ''}`}>
                  <div className="exp-stat-num"><E editKey={`exp.stat.${i}.num`} value={s.num} />{s.suffix && <span><E editKey={`exp.stat.${i}.suffix`} value={s.suffix} /></span>}</div>
                  <div className="exp-stat-label"><E editKey={`exp.stat.${i}.label`} value={s.label} /></div>
                </div>
              ))}
            </div>

            <div className="experience-grid">
              <div className="timeline reveal">
                {[
                  {
                    year: '2022 – Present', role: 'Principal Product Designer', company: 'Apex Digital Solutions',
                    desc: 'Leading product strategy and design for a 150M-user B2B SaaS platform. Established design systems, led cross-functional teams of 20+.',
                    popup: {
                      title: 'Principal Product Designer', company: 'Apex Digital Solutions · 2022–Present',
                      desc: 'Leading product strategy and design for a 150M-user B2B SaaS platform. Established design systems, led cross-functional teams of 20+, and shaped product vision across 6 business units.',
                      items: ['Built and scaled a 20-person design org from scratch', 'Launched design system adopted by 14 product teams', 'Drove 38% retention increase via mobile-first redesign', 'Embedded OKR culture across design, PM, and engineering']
                    }
                  },
                  {
                    year: '2019 – 2022', role: 'Senior UX Strategist', company: 'McKinsey Digital',
                    desc: 'Embedded design and research capability in Fortune 100 clients. Delivered $2B+ in digital transformation initiatives.',
                    popup: {
                      title: 'Senior UX Strategist', company: 'McKinsey Digital · 2019–2022',
                      desc: 'Embedded design and research capability in Fortune 100 clients across financial services, healthcare, and retail. Led digital transformation programmes totalling $2B+ in client value.',
                      items: ['Delivered $2B+ in digital transformation initiatives', 'Led 9 client engagements across 5 industries', 'Built McKinsey\'s first reusable UX research playbook', 'Mentored 12 junior strategists across 3 global offices']
                    }
                  },
                  {
                    year: '2016 – 2019', role: 'Product Design Lead', company: 'Techbridge Labs',
                    desc: 'Built the product design function from 0 to 1. Grew the team from 2 to 18 designers over 3 years.',
                    popup: {
                      title: 'Product Design Lead', company: 'Techbridge Labs · 2016–2019',
                      desc: 'Built the product design function from zero, growing from a 2-person team to a full 18-person design practice.',
                      items: ['Grew design team from 2 to 18 designers in 3 years', 'Shipped 40+ product features across web and mobile', 'Established design hiring process and review criteria', 'Won 2 design awards for accessibility innovations']
                    }
                  },
                  {
                    year: '2014 – 2016', role: 'UI/UX Designer', company: 'Freelance & Agency',
                    desc: 'Worked with 30+ clients across healthcare, fintech, and e-commerce — honing craft across every pixel.',
                    popup: {
                      title: 'UI/UX Designer', company: 'Freelance & Agency · 2014–2016',
                      desc: 'Worked with 30+ clients across healthcare, fintech, and e-commerce — honing craft across every pixel.',
                      items: ['Served 30+ clients across 3 major verticals', 'Delivered brand identity through full product UX', '100% client satisfaction — all referral-based growth', 'Built first freelance e-commerce system generating $400K+']
                    }
                  },
                  {
                    year: '2012 – 2014', role: 'Junior Visual Designer', company: 'CreativePulse Agency',
                    desc: '* Designed brand identities and marketing collateral for 20+ SMB clients * Created responsive web layouts and landing pages * Collaborated with developers on front-end implementation * Supported senior designers on enterprise rebranding projects',
                    popup: {
                      title: 'Junior Visual Designer', company: 'CreativePulse Agency · 2012–2014',
                      desc: 'Started career at a boutique creative agency, rapidly building expertise in visual design, branding, and digital production across diverse client engagements.',
                      items: ['Designed brand identities for 20+ SMB clients across retail and hospitality', 'Created responsive web layouts achieving 95%+ client approval on first review', 'Collaborated with 3-person dev team on pixel-perfect front-end builds', 'Recognized as fastest-ramping junior hire in agency history']
                    },
                    isLast: true
                  },
                ].map((job, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-item-header">
                      <div>
                        <div className="timeline-year"><E editKey={`exp.job.${i}.year`} value={job.year} /></div>
                        <div className="timeline-role"><E editKey={`exp.job.${i}.role`} value={job.role} /></div>
                        <div className="timeline-company"><E editKey={`exp.job.${i}.company`} value={job.company} /></div>
                      </div>
                      <div className="job-dots-btn" tabIndex={0} aria-label="More details about this role">
                        <span className="material-icons">more_horiz</span>
                        <div className="job-popup">
                          <div className="job-popup-title"><E editKey={`exp.job.${i}.popup.title`} value={job.popup.title} /></div>
                          <div className="job-popup-company"><E editKey={`exp.job.${i}.popup.company`} value={job.popup.company} /></div>
                          <div className="job-popup-desc"><E editKey={`exp.job.${i}.popup.desc`} value={job.popup.desc} /></div>
                          <div className="job-popup-list">
                            {job.popup.items.map((item, ii) => (
                              <div key={ii} className="job-popup-list-item">
                                <span className="material-icons-outlined">check_circle</span><E editKey={`exp.job.${i}.popup.item.${ii}`} value={item} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="timeline-desc"><BulletDesc editKey={`exp.job.${i}.desc`} value={job.desc} /></div>
                    {job.isLast && <div style={{ height: 200 }} />}
                  </div>
                ))}
              </div>

              <div className="skills-section reveal reveal-delay-1">
                {[
                  { title: 'Design & Research', chips: [{ label: 'Product Design', featured: true }, { label: 'Design Systems', featured: true }, { label: 'UX Research' }, { label: 'Journey Mapping' }, { label: 'Figma' }, { label: 'Prototyping' }, { label: 'Usability Testing' }] },
                  { title: 'Engineering', chips: [{ label: 'HTML/CSS', featured: true }, { label: 'React', featured: true }, { label: 'TypeScript' }, { label: 'Node.js' }, { label: 'SQL' }, { label: 'APIs' }] },
                  { title: 'Strategy & Leadership', chips: [{ label: 'Product Strategy', featured: true }, { label: 'Team Building' }, { label: 'OKRs' }, { label: 'Stakeholder Mgmt' }, { label: 'Agile' }, { label: 'Data Analysis' }] },
                ].map((cat, ci) => (
                  <div key={ci} className="skill-category">
                    <div className="skill-category-title"><E editKey={`exp.skill.cat.${ci}`} value={cat.title} /></div>
                    <div className="skill-chips">
                      {cat.chips.map((chip, chi) => (
                        <span key={chi} className={`skill-chip ${chip.featured ? 'featured' : ''}`}><E editKey={`exp.skill.${ci}.${chi}`} value={chip.label} /></span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal resume-cta" style={{ marginTop: 'var(--sp-64)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-16)', padding: 'var(--sp-40) var(--sp-48)', background: 'rgba(27,154,170,0.07)', border: '1px solid rgba(27,154,170,0.16)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--type-headline-small)', color: 'var(--clr-white)', marginBottom: 'var(--sp-8)' }}><E editKey="exp.resume.title" value="Want the full picture?" /></div>
                <div style={{ fontSize: 'var(--type-body-medium)', color: 'rgba(255,255,255,0.56)', lineHeight: 1.6 }}><E editKey="exp.resume.desc" value="Download my resume for a comprehensive view of experience, achievements, and credentials." /></div>
              </div>
              <a href="#" className="btn btn-filled btn-lg" onClick={(e) => { e.preventDefault(); openResumeInNewTab(); }} style={{ flexShrink: 0 }}>
                <span className="material-icons-outlined">download</span>
                <E editKey="exp.resume.btn" value="Download Resume" />
              </a>
            </div>
          </div>
        </section>

        {/* STUDIES */}
        <section id="studies" className="section parallax-section" style={{ paddingTop: 'var(--sp-96)', paddingBottom: 'var(--sp-96)' }}>
          <div className="section-bg-wrap">
            <div className="section-bg-inner" id="parallax-studies" style={{ background: 'var(--md-surface-container-low)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(27,154,170,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(27,154,170,0.05) 1px,transparent 1px)', backgroundSize: '56px 56px' }} />
            </div>
            <div className="section-bg-overlay" style={{ background: 'rgba(240,237,217,0.93)' }} />
          </div>
          <div className="parallax-inner">
            <div className="section-header">
              <div className="section-eyebrow reveal"><E editKey="studies.eyebrow" value="Studies" /></div>
              <h2 className="section-title reveal reveal-delay-1"><E editKey="studies.title" value="Research, Learning & Credentials" /></h2>
              <p className="section-subtitle reveal reveal-delay-2"><E editKey="studies.subtitle" value="Formal education, professional certifications, and self-directed research that shape the work." /></p>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 'var(--sp-48)' }}>
              {[
                { icon: 'school', num: '2', label: 'University Degrees', trend: 'With distinction', trendIcon: 'verified', color: 'var(--clr-teal)', tooltip: 'Bachelor of Art, 2005' },
                { icon: 'workspace_premium', num: '9', label: 'Professional Certifications', trend: '3 in 2023–24', trendIcon: 'arrow_upward', color: 'var(--clr-teal-light)', tooltip: 'Comptia, Microsoft, LambdaTest, NASBA, Atlassian, Project Managment Institute' },
                { icon: 'menu_book', num: '40+', label: 'Courses Completed', trend: 'Ongoing', trendIcon: 'trending_up', color: 'var(--clr-teal-dark)', tooltip: 'It is basically like a full time job. (In addition to my full time jobs.)' },
                { icon: 'military_tech', num: '6', label: 'Awards & Honours', trend: 'Industry recognised', trendIcon: 'star', color: 'var(--clr-teal-dark)', tooltip: '6 Company awards including 2 for excellence in presentation and leadership of design.' },
              ].map((kpi, i) => (
                <div key={i} className={`kpi-stat-card reveal ${i > 0 ? `reveal-delay-${i}` : ''}`} style={{ borderTop: `3px solid ${kpi.color}` }} data-tip={kpi.tooltip}>
                  <div className="kpi-stat-icon"><span className="material-icons-outlined">{kpi.icon}</span></div>
                  <div className="kpi-stat-number"><E editKey={`studies.kpi.${i}.num`} value={kpi.num} /></div>
                  <div className="kpi-stat-label"><E editKey={`studies.kpi.${i}.label`} value={kpi.label} /></div>
                  <div className="kpi-stat-trend up"><span className="material-icons">{kpi.trendIcon}</span> <E editKey={`studies.kpi.${i}.trend`} value={kpi.trend} /></div>
                </div>
              ))}
            </div>

            {/* Learning Timeline */}
            <div className="chart-card reveal" style={{ marginBottom: 'var(--sp-48)' }}>
              <div className="chart-card-header">
                <div><div className="chart-card-title"><E editKey="studies.timeline.title" value="Learning Journey Timeline" /></div><div className="chart-card-subtitle"><E editKey="studies.timeline.subtitle" value="Education & certifications over time" /></div></div>
              </div>
              <div style={{ position: 'relative', padding: 'var(--sp-16) 0 var(--sp-32)' }}>
                <div style={{ height: 3, background: 'var(--md-surface-container-highest)', borderRadius: 'var(--radius-full)', position: 'relative', margin: 'var(--sp-32) 0 var(--sp-8)' }}>
                  <div style={{ height: '100%', width: '90%', background: 'linear-gradient(90deg,var(--clr-teal-dark),var(--clr-teal-light))', borderRadius: 'var(--radius-full)' }} />
                  {[
                    { left: '0%', label: 'Bachelor in Art. Sept. 2005' },
                    { left: '19%', label: 'Animation for Simulation - In studio training' },
                    { left: '22%', label: 'Multi-media for Ed-Tech - In studio training' },
                    { left: '31%', label: 'Web UX for Ed-Tech - In studio training' },
                    { left: '50%', label: 'Industial Software Design - On-site taining' },
                    { left: '60%', label: 'Microsoft Certification' },
                    { left: '70%', label: 'Atlassian Certification' },
                    { left: '80%', label: 'LambdaTest Certifiation' },
                  ].map((m, i) => (
                    <div key={i} className="study-milestone" style={{ left: m.left }} data-label={m.label} />
                  ))}
                  <div className="study-milestone study-milestone-active" style={{ left: '90%' }} data-label="AI for Design – MIT" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--type-label-small)', color: 'var(--md-on-surface-variant)', marginTop: 'var(--sp-48)' }}>
                  {['2005', '2012', '2015', '2020', '2025', '2026', '2027'].map(y => <span key={y}>{y}</span>)}
                </div>
              </div>
            </div>

            {/* Study Cards */}
            <div className="studies-grid">
              {studies.map((s, i) => (
                <div key={s.id} className={`study-card reveal ${i > 0 ? `reveal-delay-${i % 3}` : ''}`}>
                  <div className="study-card-media project-card-img">
                    <div className="project-card-img-inner" style={{ background: s.bgGradient }}>
                      <EI editKey={`img.study.${s.id}.image`} src={s.image} alt={s.title} style={{ width: '100%', height: '100%', objectFit: (s.imageFit as React.CSSProperties['objectFit']) || 'cover', objectPosition: s.imagePosition || 'center' }} />
                      <span className="material-icons-outlined project-card-icon">{s.icon}</span>
                    </div>
                    <div className="study-card-number">{String(i + 1).padStart(2, '0')}</div>
                  </div>
                  <div className="study-card-body">
                    <div className="study-card-category"><E editKey={`study.${s.id}.category`} value={s.category} /></div>
                    <div className="study-card-title"><E editKey={`study.${s.id}.title`} value={s.title} /></div>
                    <div className="study-card-desc"><E editKey={`study.${s.id}.desc`} value={s.desc} /></div>
                    <div style={{ marginBottom: 'var(--sp-16)' }}>
                      <div className="progress-bar-label"><span><E editKey={`study.${s.id}.scoreLabel`} value={s.scorePct === 98 || s.scorePct === 95 ? 'GPA' : s.scorePct === 89 ? 'Exam Score' : 'Score'} /></span><span><E editKey={`study.${s.id}.score`} value={s.score} /></span></div>
                      <div className="progress-bar-track"><div className="progress-bar-fill" data-width={`${s.scorePct}%`} style={{ width: 0 }} /></div>
                    </div>
                    <div className="study-card-footer">
                      <div className="study-meta"><span className="material-icons-outlined">calendar_today</span><E editKey={`study.${s.id}.period`} value={s.period} /></div>
                      <button className="btn btn-text" onClick={() => openStudyModal(s.id)}>
                        <span className="material-icons-outlined" style={{ fontSize: 16 }}>open_in_full</span><E editKey="study.viewBtn" value="View" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="section parallax-section" style={{ paddingTop: 'var(--sp-96)', paddingBottom: 'var(--sp-96)' }}>
          <div className="section-bg-wrap">
            <div className="section-bg-inner" id="parallax-about" style={{ background: 'var(--md-surface)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(27,154,170,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(27,154,170,0.04) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
            </div>
            <div className="section-bg-overlay" style={{ background: 'rgba(245,241,227,0.93)' }} />
          </div>
          <div className="parallax-inner">
            <div className="about-layout-v2">
              {/* LEFT COLUMN: Photo + Quote */}
              <div className="about-left-col reveal">
                <div className="about-photo-card">
                  <EI
                    editKey="img.about.photo"
                    src="https://cdn.myportfolio.com/abc1e0ab-7370-4502-8c78-92428397bf66/41ec69e3-b221-40a1-8bba-173988ae22b7.png?h=2955b7322211d1696cc25e29c415b21a"
                    alt="Profile photo"
                    className="about-photo-img"
                  />
                </div>
                <div className="about-quote-block">
                  <div className="about-quote-text"><E editKey="about.quote.text" value="Great design starts with deep empathy and ends with measurable impact." /></div>
                  <div className="about-quote-attr"><E editKey="about.quote.attr" value="— Christopher Kenreigh" /></div>
                </div>
              </div>

              {/* RIGHT COLUMN: Label + Heading + Body + Trait Cards */}
              <div className="about-right-col">
                <div className="section-eyebrow reveal" style={{ textAlign: 'left' }}><E editKey="about.eyebrow" value="— About" /></div>
                <h2 className="about-v2-title reveal reveal-delay-1"><E editKey="about.title" value="A jack of many specialties" /></h2>
                <p className="about-bio reveal reveal-delay-2">
                  <E editKey="about.bio.1" value={"I\u2019m a principal designer and strategist with 10+ years delivering digital products across fintech, health, e-commerce, and enterprise SaaS. I believe great design starts with deep empathy and ends with measurable impact."} />
                </p>
                <p className="about-bio reveal reveal-delay-2" style={{ marginTop: 'var(--sp-16)', color: 'var(--md-on-surface-variant)' }}>
                  <E editKey="about.bio.2" value={"My approach combines rigorous research with rapid iteration \u2014 always keeping the human at the centre and the business outcome in view. I\u2019ve built teams, shipped products, and turned chaos into clarity at scale."} />
                </p>
                <div className="about-trait-grid reveal reveal-delay-3">
                  {[
                    { icon: 'lightbulb', title: 'Curiosity-led', desc: 'Every project starts with a genuine question about human behaviour.' },
                    { icon: 'precision_manufacturing', title: 'Detail-obsessed', desc: 'The pixels matter. So does the paragraph. Craft is non-negotiable.' },
                    { icon: 'groups', title: 'Team-first', desc: 'The best work happens when diverse minds share a clear goal.' },
                    { icon: 'show_chart', title: 'Outcome-driven', desc: 'Beautiful work that moves the needle — not just the Dribbble likes.' },
                  ].map((v, i) => (
                    <div key={i} className="about-trait-card">
                      <div className="about-trait-icon"><span className="material-icons-outlined">{v.icon}</span></div>
                      <div className="about-trait-title"><E editKey={`about.value.${i}.title`} value={v.title} /></div>
                      <div className="about-trait-desc"><E editKey={`about.value.${i}.desc`} value={v.desc} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Centered CTA */}
            <div className="about-cta-row reveal reveal-delay-4">
              <a href="#contact" className="btn btn-filled btn-lg" onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}>
                <span className="material-icons-outlined">chat_bubble_outline</span>
                <E editKey="about.cta" value="Let's Talk" />
              </a>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="section parallax-section" style={{ paddingTop: 'var(--sp-96)', paddingBottom: 'var(--sp-96)' }}>
          <div className="section-bg-wrap">
            <div className="section-bg-inner" id="parallax-contact" style={{ background: 'var(--clr-ink)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(27,154,170,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(27,154,170,0.06) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
              <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(27,154,170,0.14) 0%,transparent 70%)', pointerEvents: 'none' }} />
            </div>
            <div className="section-bg-overlay" style={{ background: 'rgba(5,5,5,0.88)' }} />
          </div>
          <div className="parallax-inner">
            <div className="section-header">
              <div className="section-eyebrow reveal"><E editKey="contact.eyebrow" value="Contact" /></div>
              <h2 className="section-title reveal reveal-delay-1"><E editKey="contact.title" value="Start a Conversation" /></h2>
              <p className="section-subtitle reveal reveal-delay-2" style={{ color: 'rgba(255,255,255,0.56)' }}><E editKey="contact.subtitle" value={"Whether it\u2019s a project, a question, or just a hello \u2014 I\u2019m listening."} /></p>
            </div>
            <div className="contact-layout">
              <form className="reveal" onSubmit={handleFormSubmit}>
                <div className="text-field">
                  <label className="text-field-label" htmlFor="cf-name">Full Name</label>
                  <div className="text-field-container">
                    <span className="material-icons-outlined">person_outline</span>
                    <input type="text" id="cf-name" name="from_name" className="text-field-input" placeholder="Jane Smith" required />
                  </div>
                </div>
                <div className="text-field">
                  <label className="text-field-label" htmlFor="cf-email">Email Address</label>
                  <div className="text-field-container">
                    <span className="material-icons-outlined">mail_outline</span>
                    <input type="email" id="cf-email" name="from_email" className="text-field-input" placeholder="jane@company.com" required />
                  </div>
                </div>
                <div className="text-field">
                  <label className="text-field-label" htmlFor="cf-subject">Subject</label>
                  <div className="text-field-container no-icon">
                    <input type="text" id="cf-subject" name="subject" className="text-field-input" placeholder="Project inquiry…" />
                  </div>
                </div>
                <div className="text-field">
                  <label className="text-field-label" htmlFor="cf-message">Message</label>
                  <div className="text-field-container textarea">
                    <span className="material-icons-outlined">chat_outline</span>
                    <textarea id="cf-message" name="message" className="text-field-textarea" placeholder="Tell me about your project…" required />
                  </div>
                  <span className="text-field-supporting"><E editKey="contact.form.msgHint" value="Minimum 20 characters" /></span>
                </div>
                <button type="submit" className="btn btn-filled btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={formSending}>
                  <span className="material-icons-outlined">{formSending ? 'hourglass_empty' : 'send'}</span>
                  {formSending ? 'Sending…' : <E editKey="contact.form.submit" value="Send Message" />}
                </button>
              </form>

              <div className="contact-info reveal reveal-delay-1">
                <div className="contact-info-item">
                  <div className="contact-info-icon"><span className="material-icons-outlined">mail_outline</span></div>
                  <div>
                    <div className="contact-info-label"><E editKey="contact.info.0.label" value="Email" /></div>
                    <div className="contact-info-value"><E editKey="contact.info.0.value" value="hello@kpi.co" /></div>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-icon"><span className="material-icons-outlined">location_on</span></div>
                  <div>
                    <div className="contact-info-label"><E editKey="contact.info.1.label" value="Location" /></div>
                    <div className="contact-info-value"><E editKey="contact.info.1.value" value="San Francisco, CA" /></div>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="contact-info-icon"><span className="material-icons-outlined">schedule</span></div>
                  <div>
                    <div className="contact-info-label"><E editKey="contact.info.2.label" value="Availability" /></div>
                    <div className="contact-info-value"><E editKey="contact.info.2.value" value={"Mon\u2013Fri, 9am\u20136pm PST"} /></div>
                  </div>
                </div>
                <div>
                  <div className="contact-info-label" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--type-label-medium)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--sp-12)' }}><E editKey="contact.follow.label" value="Follow" /></div>
                  <div className="contact-social">
                    {[
                      { Icon: Linkedin, label: 'LinkedIn', url: 'https://www.linkedin.com/in/kenreigh' },
                      //{ Icon: Twitter, label: 'Twitter', url: 'https://twitter.com/YOUR-HANDLE' },
                      { Icon: Github, label: 'GitHub', url: 'https://github.com/tangiblethinking' },
                      //{ Icon: Dribbble, label: 'Dribbble', url: 'https://dribbble.com/YOUR-HANDLE' },
                    ].map((s, i) => (
                      <a key={i} className="social-btn" data-tip={s.label} aria-label={s.label} href={s.url} target="_blank" rel="noopener noreferrer">
                        <s.Icon size={18} strokeWidth={2} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a href="#hero" className="nav-logo" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>
                <div className="nav-logo-mark"><span>Ck</span></div>
                <span className="nav-logo-text"><E editKey="footer.brand" value="KPI.co" /></span>
              </a>
              <p><E editKey="footer.desc" value="Designing and delivering impactful digital solutions since 2014. Committed to craft, clarity, and measurable outcomes." /></p>
            </div>
            <div>
              <div className="footer-col-title"><E editKey="footer.col.sections" value="Sections" /></div>
              <div className="footer-links">
                {navLinks.map(l => <a key={l.id} href={`#${l.id}`} className="footer-link" onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}><E editKey={`footer.nav.${l.id}`} value={l.label === 'Solutions' ? 'Delivered Solutions' : l.label} /></a>)}
              </div>
            </div>
            <div>
              <div className="footer-col-title"><E editKey="footer.col.work" value="Work" /></div>
              <div className="footer-links">
                {['Projects', 'Case Studies', 'KPI Reports', 'Resume'].map((l, i) => <a key={l} href="#delivered-solutions" className="footer-link" onClick={(e) => { e.preventDefault(); scrollTo(l === 'Resume' ? 'experience' : 'delivered-solutions'); }}><E editKey={`footer.work.${i}`} value={l} /></a>)}
              </div>
            </div>
            <div>
              <div className="footer-col-title"><E editKey="footer.col.connect" value="Connect" /></div>
              <div className="footer-links">
                <a href="#contact" className="footer-link" onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}><E editKey="footer.connect.0" value="Get in Touch" /></a>
                {/* ✏️ Update footer social URLs on the lines below */}
                <a href="https://www.linkedin.com/in/kenreigh" className="footer-link" target="_blank" rel="noopener noreferrer"><E editKey="footer.connect.1" value="LinkedIn" /></a>
                <a href="https://github.com/tangiblethinking" className="footer-link" target="_blank" rel="noopener noreferrer"><E editKey="footer.connect.2" value="GitHub" /></a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-copyright"><E editKey="footer.copyright" value={"© 2024 KPI.co \u00b7 All rights reserved."} /></span>
          </div>
        </div>
      </footer>

      {/* SNACKBAR */}
      <div className={`snackbar ${snackbar.show ? 'show' : ''}`} role="alert" aria-live="polite">
        <span>{snackbar.msg}</span>
        <span className="snackbar-action" onClick={() => setSnackbar({ show: false, msg: '' })}><E editKey="snackbar.dismiss" value="Dismiss" /></span>
      </div>

      {/* FULLSCREEN MODAL */}
      <div className={`fullscreen-modal ${modal ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="fullscreen-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-12)' }}>
            <button className="fullscreen-modal-close" onClick={closeModal} aria-label="Back" style={{ width: 'auto', padding: '0 var(--sp-8)', gap: 'var(--sp-4)', fontSize: 'var(--type-label-large)', color: 'var(--md-on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 20 }}>arrow_back</span>
              <E editKey="modal.back" value="Back" />
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--md-outline-variant)' }} />
            <div className="fullscreen-modal-title">
              {modal?.type === 'project' ? projects[modal.id]?.title : modal?.type === 'study' ? studies[modal.id]?.title : 'Detail View'}
            </div>
          </div>
          <button className="fullscreen-modal-close" onClick={closeModal} aria-label="Close fullscreen">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {modal?.type === 'project' && <ProjectModalContent project={projects[modal.id]} onClose={closeModal} />}
          {modal?.type === 'study' && <StudyModalContent study={studies[modal.id]} onClose={closeModal} />}
        </div>
      </div>

      {/* SVG Tooltip */}
      <SvgTooltip />

      {/* Password Modal for Edit Mode */}
      <PasswordModal
        open={showPwModal}
        onSuccess={() => {
          setShowPwModal(false);
          setEditMode(true);
        }}
        onClose={() => setShowPwModal(false)}
      />
    </div>
    </EditContext.Provider>
  );
}

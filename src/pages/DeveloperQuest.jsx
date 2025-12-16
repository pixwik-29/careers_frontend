import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import confetti from "canvas-confetti";

import PixwikLogo from "@/assets/pixwik-logo.svg";
import { API, getAxiosConfig, extractErrorMessage } from "@/config/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "FastAPI",
  "MongoDB",
  "PostgreSQL",
  "Docker",
  "AWS",
  "CI/CD",
  "UI/UX",
];

const AVATARS = [
  { key: "pixel-1", label: "Neo Pixel" },
  { key: "pixel-2", label: "Teal Sprite" },
  { key: "pixel-3", label: "Cosmic Dev" },
  { key: "pixel-4", label: "Orange Boost" },
  { key: "pixel-5", label: "Indigo Shift" },
  { key: "pixel-6", label: "White Hat" },
];

const QUIZ = [
  {
    id: "style",
    prompt: "Your coding style?",
    options: [
      { key: "A", text: "Elegant & clean" },
      { key: "B", text: "Bold & innovative" },
      { key: "C", text: "Fast & fearless" },
    ],
  },
  {
    id: "bug",
    prompt: "A bug appears at 2am. You…",
    options: [
      { key: "A", text: "Reproduce + write a tiny test" },
      { key: "B", text: "Dive deep, find root cause" },
      { key: "C", text: "Patch it, ship it, monitor" },
    ],
  },
  {
    id: "team",
    prompt: "In a team project you’re the…",
    options: [
      { key: "A", text: "Architect of clarity" },
      { key: "B", text: "Idea catalyst" },
      { key: "C", text: "Momentum engine" },
    ],
  },
  {
    id: "vibe",
    prompt: "Pick a vibe:",
    options: [
      { key: "A", text: "Minimalist mastery" },
      { key: "B", text: "Creative chaos (controlled)" },
      { key: "C", text: "Speed-run to impact" },
    ],
  },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseBullets(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 7);
}

function pickPersona(quizAnswers) {
  const counts = { A: 0, B: 0, C: 0 };
  Object.values(quizAnswers || {}).forEach((v) => {
    if (counts[v] !== undefined) counts[v] += 1;
  });

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "A";
  if (top === "A") return "Clean Code Paladin";
  if (top === "B") return "Innovation Rogue";
  return "Speedrunner Mage";
}

function computeXp({ quizAnswers, skills, experienceYears, strengthsText, weaknessesText, projects, teaserAnswer }) {
  const quizCount = Object.keys(quizAnswers || {}).length;
  const base = 180 + quizCount * 70;

  const skillsXp = clamp((skills?.length || 0) * 25, 0, 300);
  const expXp = clamp(Math.round((experienceYears || 0) * 60), 0, 240);
  const strengthsXp = clamp(parseBullets(strengthsText).length * 45, 0, 250);
  const weaknessesXp = clamp(parseBullets(weaknessesText).length * 25, 0, 150);
  const projectsXp = clamp(Math.min(120, Math.round(((projects || "").trim().length / 40) * 10)), 0, 120);
  const teaserXp = (teaserAnswer || "").trim().length >= 8 ? 120 : 0;

  return base + skillsXp + expXp + strengthsXp + weaknessesXp + projectsXp + teaserXp;
}

function StepShell({ title, subtitle, children }) {
  return (
    <Card className="quest-card" data-testid="quest-step-card">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl sm:text-3xl font-semibold tracking-tight" data-testid="quest-step-title">
          {title}
        </CardTitle>
        {subtitle ? (
          <CardDescription className="text-base md:text-lg" data-testid="quest-step-subtitle">
            {subtitle}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

function PixelAvatar({ avatarKey, selected }) {
  const style = {
    "pixel-1": "from-teal-400/70 to-sky-600/80",
    "pixel-2": "from-emerald-400/70 to-teal-700/80",
    "pixel-3": "from-violet-400/70 to-indigo-700/80",
    "pixel-4": "from-orange-400/70 to-rose-600/80",
    "pixel-5": "from-indigo-400/70 to-fuchsia-700/80",
    "pixel-6": "from-slate-100 to-slate-300",
  }[avatarKey];

  return (
    <div
      className={`quest-avatar bg-gradient-to-br ${style} ${selected ? "quest-avatar--selected" : ""}`}
      data-testid={`avatar-${avatarKey}`}
    >
      <div className="quest-avatar__pixel" />
      <div className="quest-avatar__pixel" />
      <div className="quest-avatar__pixel" />
      <div className="quest-avatar__pixel" />
    </div>
  );
}

export default function DeveloperQuest() {
  const { toast } = useToast();

  const [showMobileLogo, setShowMobileLogo] = useState(true);

  const [screen, setScreen] = useState("hero"); // hero | quiz | wizard | success
  const [level, setLevel] = useState(1);

  const [quizAnswers, setQuizAnswers] = useState({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    gradYear: "",
    linkedin: "",
    github: "",
    avatar: "pixel-2",

    skills: [],
    experienceYears: 0,
    projects: "",
    resumeFile: null,

    strengthsText: "- ",
    weaknessesText: "- ",

    teaserAnswer: "",
  });

  const [submitState, setSubmitState] = useState({ status: "idle", error: null, result: null });

  const [jobContext] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const job = params.get("job");
    return { job_slug: job || null };
  });
  const [errors, setErrors] = useState({});

  const persona = useMemo(() => pickPersona(quizAnswers), [quizAnswers]);
  const xp = useMemo(
    () =>
      computeXp({
        quizAnswers,
        skills: form.skills,
        experienceYears: form.experienceYears,
        strengthsText: form.strengthsText,
        weaknessesText: form.weaknessesText,
        projects: form.projects,
        teaserAnswer: form.teaserAnswer,
      }),
    [quizAnswers, form.skills, form.experienceYears, form.strengthsText, form.weaknessesText, form.projects, form.teaserAnswer],
  );

  const totalSteps = 1 /* quiz */ + 5;
  const currentStep = screen === "hero" ? 0 : screen === "quiz" ? 1 : screen === "wizard" ? 1 + level : totalSteps;
  const progressValue = Math.round((currentStep / totalSteps) * 100);

  const lastXpRef = useRef(xp);
  useEffect(() => {
    lastXpRef.current = xp;
  }, [xp]);

  useEffect(() => {
    const onScroll = () => {
      // Only apply on small screens
      if (window.innerWidth >= 768) {
        setShowMobileLogo(true);
        return;
      }
      setShowMobileLogo(window.scrollY < 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function pushToast(title, description) {
    toast({ title, description });
  }

  function validateLevel(targetLevel = level) {
    const nextErrors = {};

    const emailOk = (form.email || "").includes("@");

    if (targetLevel === 1) {
      if (!form.name.trim()) nextErrors.name = "Name is required";
      if (!emailOk) nextErrors.email = "Enter a valid email";
      if (!form.phone.trim()) nextErrors.phone = "Phone is required";
      if (!form.college.trim()) nextErrors.college = "College is required";
      if (!form.gradYear.trim()) nextErrors.gradYear = "Graduation year is required";
    }

    if (targetLevel === 2) {
      if ((form.skills || []).length < 1) nextErrors.skills = "Pick at least one skill";
      if ((form.projects || "").trim().length < 20) nextErrors.projects = "Tell us about at least one key project (20+ chars)";
      if (!form.resumeFile) nextErrors.resumeFile = "Resume is required";
    }

    if (targetLevel === 3) {
      if (parseBullets(form.strengthsText).length < 3) nextErrors.strengthsText = "Add at least 3 bullets";
    }

    if (targetLevel === 4) {
      if (parseBullets(form.weaknessesText).length < 2) nextErrors.weaknessesText = "Add at least 2 bullets";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext() {
    const ok = validateLevel(level);
    if (!ok) {
      pushToast("Almost there", "Fix the highlighted fields to unlock the next level.");
      return;
    }

    const before = lastXpRef.current;
    const after = xp;
    const gained = Math.max(0, after - before);
    if (gained >= 60) {
      pushToast("Awesome!", `+${gained} XP earned.`);
    }

    setLevel((l) => clamp(l + 1, 1, 5));
    setErrors({});
  }

  function goBack() {
    setErrors({});
    setLevel((l) => clamp(l - 1, 1, 5));
  }

  async function submitApplication() {
    const ok = validateLevel(5);
    if (!ok) {
      pushToast("Quest blocked", "Finish the finale fields before submitting.");
      return;
    }

    setSubmitState({ status: "submitting", error: null, result: null });

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        college: form.college.trim(),
        grad_year: form.gradYear.trim(),
        linkedin: form.linkedin.trim() || null,
        github: form.github.trim() || null,
        avatar: form.avatar,
        skills: form.skills,
        experience_years: form.experienceYears,
        projects: form.projects.trim(),
        strengths: parseBullets(form.strengthsText),
        weaknesses: parseBullets(form.weaknessesText),
        persona,
        xp,
        teaser_answer: form.teaserAnswer.trim() || null,
        job_slug: jobContext.job_slug,
      };

      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      fd.append("resume", form.resumeFile);

      const res = await axios.post(`${API}/developer-applications`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        validateStatus: () => true,
      });

      if (res.status === 404) {
        throw new Error("API route not found (404). Please refresh and try again.");
      }
      if (res.status >= 400) {
        const detail = res?.data?.detail;
        const msg = typeof detail === "string" ? detail : "Submission failed. Please try again.";
        throw new Error(msg);
      }

      setSubmitState({ status: "success", error: null, result: res.data });
      setScreen("success");
    } catch (e) {
      const msg = extractErrorMessage(e, "Submission failed. Please try again.");
      setSubmitState({ status: "error", error: msg, result: null });
      pushToast("Submission failed", msg);
    }
  }

  useEffect(() => {
    if (screen !== "success") return;

    try {
      const end = Date.now() + 900;
      const colors = ["#0ea5e9", "#14b8a6", "#f97316", "#a78bfa"]; // sky/teal/orange/purple

      const tick = () => {
        confetti({
          particleCount: 8,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 8,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(tick);
      };

      tick();
    } catch (err) {
      // Confetti is a visual-only enhancement; ignore failures.
    }
  }, [screen]);

  const shellHeader = (
    <div className="quest-topbar" data-testid="quest-topbar">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="quest-badge" data-testid="persona-badge">
              {persona}
            </Badge>
            <Badge variant="secondary" className="quest-xp" data-testid="xp-badge">
              {xp} XP
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground" data-testid="tagline-text">
            Learn • Create • Supersede
          </div>
        </div>

        <div className="quest-progress" data-testid="quest-progress-wrapper">
          <div className="text-xs text-muted-foreground" data-testid="quest-progress-label">
            Quest progress
          </div>
          <Progress value={progressValue} className="h-2" data-testid="quest-progress-bar" />
          <div className="text-xs text-muted-foreground" data-testid="quest-progress-value">
            {progressValue}%
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="quest-page" data-testid="developer-quest-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="quest-backdrop" />

      <main className="quest-container" data-testid="quest-container">
        <a
          href="/"
          className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
          data-testid="pixwik-logo-link"
          aria-label="Pixwik"
        >
          <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="pixwik-logo-img" />
        </a>

        <div className="fixed top-6 right-6 z-50" data-testid="quest-candidate-portal-cta">
          <a href="/candidate" data-testid="quest-candidate-portal-link">
            <Button variant="secondary" size="sm">Candidate Portal</Button>
          </a>
        </div>

        {screen !== "hero" ? shellHeader : null}

        {screen === "hero" ? (
          <section className="quest-hero" data-testid="hero-section">
            <div className="quest-hero__grid">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/60" data-testid="hero-pill">
                  <span className="quest-dot" aria-hidden="true" />
                  Careers • Developer roles • Always open to talent
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="hero-title">
                  Join the Pixwik Developer Quest
                </h1>

                <p className="text-base md:text-lg text-slate-700 max-w-2xl" data-testid="hero-subtitle">
                  We’re hiring developers — learn, create, and supersede with us. Build beautiful products, ship with confidence, and level-up in a studio that cares about craft.
                </p>

                <div className="flex flex-wrap items-center gap-3" data-testid="hero-cta-row">
                  <Button
                    size="lg"
                    className="quest-primary"
                    data-testid="start-quest-button"
                    onClick={() => setScreen("quiz")}
                  >
                    Start Your Quest
                  </Button>
                  <div className="text-sm text-slate-600" data-testid="hero-side-note">
                    Takes ~4 minutes. Resume required.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2" data-testid="hero-badges">
                  <Badge className="quest-mini-badge" data-testid="hero-badge-1">Pixel badges</Badge>
                  <Badge className="quest-mini-badge" data-testid="hero-badge-2">XP progress</Badge>
                  <Badge className="quest-mini-badge" data-testid="hero-badge-3">Mentor-friendly honesty</Badge>
                </div>
              </div>

              <div className="quest-hero__card" data-testid="hero-side-card">
                <Card className="quest-card">
                  <CardHeader>
                    <CardTitle className="text-xl" data-testid="hero-card-title">What you’ll do</CardTitle>
                    <CardDescription data-testid="hero-card-desc">
                      Build features, ship fast, keep it clean. Creativity + engineering.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="quest-list" data-testid="hero-list">
                      <div className="quest-list__item" data-testid="hero-list-item-1">
                        <span className="quest-list__icon" aria-hidden="true">▣</span>
                        <span>React / FastAPI product work</span>
                      </div>
                      <div className="quest-list__item" data-testid="hero-list-item-2">
                        <span className="quest-list__icon" aria-hidden="true">▣</span>
                        <span>Design-aware engineering</span>
                      </div>
                      <div className="quest-list__item" data-testid="hero-list-item-3">
                        <span className="quest-list__icon" aria-hidden="true">▣</span>
                        <span>Strong mentorship + feedback loops</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="text-sm text-slate-600" data-testid="hero-card-footer">
                      Tip: honest growth zones unlock better mentoring.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <footer className="quest-footer" data-testid="privacy-footer">
              <div className="text-sm text-slate-600" data-testid="privacy-text">
                Privacy: your data is used only for recruitment. You can request deletion anytime.
              </div>
            </footer>
          </section>
        ) : null}

        {screen === "quiz" ? (
          <section className="space-y-6" data-testid="quiz-section">

            <StepShell
              title="Intro Quiz — choose your vibe"
              subtitle="Four quick picks to unlock your persona badge + starting XP."
            >
              <div className="space-y-6" data-testid="quiz-questions">
                {QUIZ.map((q) => (
                  <div key={q.id} className="space-y-3" data-testid={`quiz-question-${q.id}`}>
                    <div className="font-medium text-slate-900" data-testid={`quiz-prompt-${q.id}`}>
                      {q.prompt}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid={`quiz-options-${q.id}`}>
                      {q.options.map((o) => {
                        const active = quizAnswers[q.id] === o.key;
                        return (
                          <button
                            type="button"
                            key={o.key}
                            className={`quest-choice ${active ? "quest-choice--active" : ""}`}
                            data-testid={`quiz-option-${q.id}-${o.key}`}
                            onClick={() => setQuizAnswers((s) => ({ ...s, [q.id]: o.key }))}
                          >
                            <div className="quest-choice__key" aria-hidden="true">
                              {o.key}
                            </div>
                            <div className="quest-choice__text">{o.text}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2" data-testid="quiz-actions">
                  <Button
                    variant="secondary"
                    data-testid="quiz-back-to-hero-button"
                    onClick={() => setScreen("hero")}
                  >
                    Back
                  </Button>

                  <Button
                    className="quest-primary"
                    data-testid="quiz-continue-button"
                    onClick={() => {
                      const answered = Object.keys(quizAnswers).length;
                      if (answered < QUIZ.length) {
                        pushToast("Pick all four", "Answer the quiz to unlock your persona badge.");
                        return;
                      }
                      pushToast("Persona unlocked", `You are a ${persona}. +${180 + QUIZ.length * 70} base XP!`);
                      setScreen("wizard");
                      setLevel(1);
                    }}
                  >
                    Enter Level 1
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground" data-testid="quiz-persona-preview">
                  Your persona: <span className="font-medium text-slate-900">{persona}</span>
                </div>
              </div>
            </StepShell>
          </section>
        ) : null}

        {screen === "wizard" ? (
          <section className="space-y-6" data-testid="wizard-section">

            {level === 1 ? (
              <StepShell title="Level 1 — Create Your Profile" subtitle="A clean start. No fluff. Just you." >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="level1-grid">
                  <div className="space-y-4" data-testid="level1-fields">
                    <div className="space-y-2" data-testid="field-name">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        data-testid="input-name"
                        onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                        placeholder="Your full name"
                      />
                      {errors.name ? <div className="quest-error" data-testid="error-name">{errors.name}</div> : null}
                    </div>

                    <div className="space-y-2" data-testid="field-email">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={form.email}
                        data-testid="input-email"
                        onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                        placeholder="you@college.edu"
                      />
                      {errors.email ? <div className="quest-error" data-testid="error-email">{errors.email}</div> : null}
                    </div>

                    <div className="space-y-2" data-testid="field-phone">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        data-testid="input-phone"
                        onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                        placeholder="+91 …"
                      />
                      {errors.phone ? <div className="quest-error" data-testid="error-phone">{errors.phone}</div> : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="level1-college-grid">
                      <div className="space-y-2" data-testid="field-college">
                        <Label htmlFor="college">College</Label>
                        <Input
                          id="college"
                          value={form.college}
                          data-testid="input-college"
                          onChange={(e) => setForm((s) => ({ ...s, college: e.target.value }))}
                          placeholder="College / University"
                        />
                        {errors.college ? <div className="quest-error" data-testid="error-college">{errors.college}</div> : null}
                      </div>

                      <div className="space-y-2" data-testid="field-grad-year">
                        <Label htmlFor="gradYear">Grad year</Label>
                        <Input
                          id="gradYear"
                          value={form.gradYear}
                          data-testid="input-grad-year"
                          onChange={(e) => setForm((s) => ({ ...s, gradYear: e.target.value }))}
                          placeholder="2026"
                        />
                        {errors.gradYear ? <div className="quest-error" data-testid="error-grad-year">{errors.gradYear}</div> : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="level1-links-grid">
                      <div className="space-y-2" data-testid="field-linkedin">
                        <Label htmlFor="linkedin">LinkedIn (optional)</Label>
                        <Input
                          id="linkedin"
                          value={form.linkedin}
                          data-testid="input-linkedin"
                          onChange={(e) => setForm((s) => ({ ...s, linkedin: e.target.value }))}
                          placeholder="linkedin.com/in/..."
                        />
                      </div>

                      <div className="space-y-2" data-testid="field-github">
                        <Label htmlFor="github">GitHub (optional)</Label>
                        <Input
                          id="github"
                          value={form.github}
                          data-testid="input-github"
                          onChange={(e) => setForm((s) => ({ ...s, github: e.target.value }))}
                          placeholder="github.com/..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4" data-testid="level1-avatar">
                    <div>
                      <div className="font-medium text-slate-900" data-testid="avatar-title">Pick a pixel avatar</div>
                      <div className="text-sm text-muted-foreground" data-testid="avatar-subtitle">Totally optional—but it looks cool on your badge.</div>
                    </div>

                    <div className="grid grid-cols-3 gap-3" data-testid="avatar-grid">
                      {AVATARS.map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          className="quest-avatar-button"
                          data-testid={`avatar-select-${a.key}`}
                          onClick={() => setForm((s) => ({ ...s, avatar: a.key }))}
                        >
                          <PixelAvatar avatarKey={a.key} selected={form.avatar === a.key} />
                          <div className="text-xs text-slate-700 mt-2">{a.label}</div>
                        </button>
                      ))}
                    </div>

                    <div className="quest-hint" data-testid="level1-hint">
                      Pro tip: crisp profiles earn trust. Trust earns ship rights.
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3" data-testid="level1-actions">
                  <Button variant="secondary" data-testid="level1-back-button" onClick={() => setScreen("quiz")}>
                    Back to Quiz
                  </Button>
                  <Button className="quest-primary" data-testid="level1-next-button" onClick={goNext}>
                    Continue to Level 2
                  </Button>
                </div>
              </StepShell>
            ) : null}

            {level === 2 ? (
              <StepShell title="Level 2 — Build Your Toolkit" subtitle="Choose your stack. Show your craft. Upload your scroll (resume)." >
                <div className="space-y-5" data-testid="level2-fields">
                  <div className="space-y-2" data-testid="skills-section">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Tech stack (multi-select)</Label>
                      {errors.skills ? <div className="quest-error" data-testid="error-skills">{errors.skills}</div> : null}
                    </div>

                    <ToggleGroup
                      type="multiple"
                      value={form.skills}
                      onValueChange={(vals) => setForm((s) => ({ ...s, skills: vals }))}
                      className="flex flex-wrap gap-2 justify-start"
                      data-testid="skills-toggle-group"
                    >
                      {SKILLS.map((skill) => (
                        <ToggleGroupItem
                          key={skill}
                          value={skill}
                          className="quest-skill"
                          data-testid={`skill-${skill.replace(/\W+/g, "-").toLowerCase()}`}
                        >
                          {skill}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>

                    <div className="text-sm text-muted-foreground" data-testid="skills-hint">
                      Selecting more skills earns XP, but honest picks earn more respect.
                    </div>
                  </div>

                  <div className="space-y-2" data-testid="experience-section">
                    <div className="flex items-center justify-between">
                      <Label>Experience (years)</Label>
                      <Badge variant="secondary" data-testid="experience-value">{form.experienceYears.toFixed(1)} yrs</Badge>
                    </div>
                    <Slider
                      value={[form.experienceYears]}
                      onValueChange={(v) => setForm((s) => ({ ...s, experienceYears: v[0] }))}
                      min={0}
                      max={4}
                      step={0.5}
                      data-testid="experience-slider"
                    />
                    <div className="text-sm text-muted-foreground" data-testid="experience-hint">
                      Internships count. Side-projects count. Shipping counts.
                    </div>
                  </div>

                  <div className="space-y-2" data-testid="projects-section">
                    <Label htmlFor="projects">Key projects (what are you proud of?)</Label>
                    <Textarea
                      id="projects"
                      value={form.projects}
                      data-testid="textarea-projects"
                      onChange={(e) => setForm((s) => ({ ...s, projects: e.target.value }))}
                      placeholder="Example: Built a campus event app in React + FastAPI, improved load time by 35%..."
                      className="min-h-[120px]"
                    />
                    {errors.projects ? <div className="quest-error" data-testid="error-projects">{errors.projects}</div> : null}
                  </div>

                  <div className="space-y-2" data-testid="resume-section">
                    <Label htmlFor="resume">Resume upload</Label>
                    <Input
                      id="resume"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      data-testid="input-resume"
                      onChange={(e) => setForm((s) => ({ ...s, resumeFile: e.target.files?.[0] || null }))}
                    />
                    {form.resumeFile ? (
                      <div className="text-sm text-slate-700" data-testid="resume-filename">
                        Selected: <span className="font-medium">{form.resumeFile.name}</span>
                      </div>
                    ) : null}
                    {errors.resumeFile ? <div className="quest-error" data-testid="error-resume">{errors.resumeFile}</div> : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3" data-testid="level2-actions">
                  <Button variant="secondary" data-testid="level2-back-button" onClick={goBack}>
                    Back
                  </Button>
                  <Button className="quest-primary" data-testid="level2-next-button" onClick={goNext}>
                    Continue to Level 3
                  </Button>
                </div>
              </StepShell>
            ) : null}

            {level === 3 ? (
              <StepShell title="Level 3 — Your Superpowers" subtitle="3–5 bullets. Make it sharp. Make it real." >
                <div className="space-y-2" data-testid="strengths-section">
                  <Label htmlFor="strengths">What makes you stand out?</Label>
                  <Textarea
                    id="strengths"
                    value={form.strengthsText}
                    data-testid="textarea-strengths"
                    onChange={(e) => setForm((s) => ({ ...s, strengthsText: e.target.value }))}
                    className="min-h-[160px]"
                    placeholder="- Turning complex ideas into clean code\n- Communicates early, ships often\n- Strong UI details"
                  />
                  {errors.strengthsText ? <div className="quest-error" data-testid="error-strengths">{errors.strengthsText}</div> : null}
                  <div className="text-sm text-muted-foreground" data-testid="strengths-count">
                    Bullets detected: {parseBullets(form.strengthsText).length}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3" data-testid="level3-actions">
                  <Button variant="secondary" data-testid="level3-back-button" onClick={goBack}>
                    Back
                  </Button>
                  <Button className="quest-primary" data-testid="level3-next-button" onClick={goNext}>
                    Continue to Level 4
                  </Button>
                </div>
              </StepShell>
            ) : null}

            {level === 4 ? (
              <StepShell title="Level 4 — Growth Zones" subtitle="Honesty unlocks better mentoring. What are you leveling up next?" >
                <div className="space-y-2" data-testid="weaknesses-section">
                  <Label htmlFor="weaknesses">Areas you’re excited to improve</Label>
                  <Textarea
                    id="weaknesses"
                    value={form.weaknessesText}
                    data-testid="textarea-weaknesses"
                    onChange={(e) => setForm((s) => ({ ...s, weaknessesText: e.target.value }))}
                    className="min-h-[160px]"
                    placeholder="- Writing better tests\n- System design fundamentals\n- Performance profiling"
                  />
                  {errors.weaknessesText ? <div className="quest-error" data-testid="error-weaknesses">{errors.weaknessesText}</div> : null}
                  <div className="text-sm text-muted-foreground" data-testid="weaknesses-count">
                    Bullets detected: {parseBullets(form.weaknessesText).length}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3" data-testid="level4-actions">
                  <Button variant="secondary" data-testid="level4-back-button" onClick={goBack}>
                    Back
                  </Button>
                  <Button className="quest-primary" data-testid="level4-next-button" onClick={goNext}>
                    Continue to Finale
                  </Button>
                </div>
              </StepShell>
            ) : null}

            {level === 5 ? (
              <StepShell title="Level 5 — Quest Finale" subtitle="Bonus XP teaser + submit. Then we celebrate." >
                <div className="space-y-5" data-testid="finale-section">
                  <div className="quest-teaser" data-testid="teaser-box">
                    <div className="font-medium text-slate-900" data-testid="teaser-title">Bonus XP teaser</div>
                    <div className="text-sm text-muted-foreground" data-testid="teaser-prompt">
                      In 1–2 lines: What does <span className="font-mono">O(n log n)</span> often indicate?
                    </div>
                    <Input
                      value={form.teaserAnswer}
                      data-testid="input-teaser"
                      onChange={(e) => setForm((s) => ({ ...s, teaserAnswer: e.target.value }))}
                      placeholder="Example: typical time complexity of efficient sorting algorithms"
                    />
                    <div className="text-xs text-muted-foreground" data-testid="teaser-hint">
                      Optional. Great answers earn bonus XP.
                    </div>

                    <div className="quest-consent" data-testid="candidate-portal-consent">
                      After you submit, we&apos;ll email you your Candidate Portal login to track multi-round progress.
                    </div>
                  </div>

                  {submitState.status === "error" ? (
                    <div className="quest-error" data-testid="submit-error">
                      {extractErrorMessage(submitState.error)}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3" data-testid="finale-actions">
                    <Button variant="secondary" data-testid="level5-back-button" onClick={goBack}>
                      Back
                    </Button>

                    <Button
                      className="quest-primary"
                      data-testid="submit-quest-button"
                      onClick={submitApplication}
                      disabled={submitState.status === "submitting"}
                    >
                      {submitState.status === "submitting" ? "Submitting…" : "Submit Quest"}
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground" data-testid="email-provision-note">
                    After submission, we’ll email your Candidate Portal login details.
                  </div>

                  <footer className="quest-footer" data-testid="privacy-footer-wizard">
                    <div className="text-sm text-slate-600" data-testid="privacy-text-wizard">
                      Privacy: your resume is used only for hiring at Pixwik.
                    </div>
                  </footer>
                </div>
              </StepShell>
            ) : null}
          </section>
        ) : null}

        {screen === "success" ? (
          <section className="space-y-6" data-testid="success-section">
            <StepShell title="Quest Complete!" subtitle="You’re in. We’ll review and reach out soon." >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="success-grid">
                <div className="space-y-4" data-testid="success-left">
                  <div className="quest-success-badge" data-testid="success-badge">
                    <div className="text-sm text-slate-600" data-testid="success-badge-label">Persona</div>
                    <div className="text-xl font-semibold" data-testid="success-persona">{persona}</div>
                    <div className="text-sm text-slate-600" data-testid="success-xp">Total XP: {xp}</div>

                    <div className="mt-3 text-sm text-slate-700" data-testid="candidate-login-email-sent">
                      {submitState.result?.candidate_login_email_status === "sent"
                        ? "We’ve emailed your Candidate Portal login details (check spam)."
                        : "Your Candidate Portal login will be emailed shortly. If you don’t receive it, contact careers@pixwik.com."}
                    </div>
                    <a href="/candidate" className="quest-link" data-testid="candidate-portal-link">
                      Open Candidate Portal
                    </a>
                  </div>

                  {submitState.result?.id ? (
                    <div className="text-sm text-slate-700" data-testid="application-id">
                      Application ID: <span className="font-mono">{submitState.result.id}</span>
                    </div>
                  ) : null}

                  {submitState.result?.resume_download_url ? (
                    <a
                      href={`${BACKEND_URL}${submitState.result.resume_download_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="quest-link"
                      data-testid="resume-download-link"
                    >
                      Download uploaded resume
                    </a>
                  ) : null}
                </div>

                <div className="space-y-4" data-testid="success-right">
                  <Card className="quest-card">
                    <CardHeader>
                      <CardTitle className="text-xl" data-testid="next-steps-title">What happens next?</CardTitle>
                      <CardDescription data-testid="next-steps-desc">
                        Our team reviews your persona + projects. If it clicks, we schedule a quick call.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="quest-list__item" data-testid="next-step-1">
                        <span className="quest-list__icon" aria-hidden="true">▣</span>
                        <span>Shortlist within a few days</span>
                      </div>
                      <div className="quest-list__item" data-testid="next-step-2">
                        <span className="quest-list__icon" aria-hidden="true">▣</span>
                        <span>One quick technical chat</span>
                      </div>
                      <div className="quest-list__item" data-testid="next-step-3">
                        <span className="quest-list__icon" aria-hidden="true">▣</span>
                        <span>Offer & onboarding</span>
                      </div>

                      <Separator />

                      <Button
                        variant="secondary"
                        data-testid="submit-another-button"
                        onClick={() => {
                          setQuizAnswers({});
                          setForm((s) => ({
                            ...s,
                            name: "",
                            email: "",
                            phone: "",
                            college: "",
                            gradYear: "",
                            linkedin: "",
                            github: "",
                            avatar: "pixel-2",
                            skills: [],
                            experienceYears: 0,
                            projects: "",
                            resumeFile: null,
                            strengthsText: "- ",
                            weaknessesText: "- ",
                            teaserAnswer: "",
                          }));
                          setSubmitState({ status: "idle", error: null, result: null });
                          setErrors({});
                          setLevel(1);
                          setScreen("hero");
                        }}
                      >
                        Start over
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </StepShell>
          </section>
        ) : null}
      </main>
    </div>
  );
}

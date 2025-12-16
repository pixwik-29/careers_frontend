import React, { useEffect, useState } from "react";
import axios from "axios";

import PixwikLogo from "@/assets/pixwik-logo.svg";
import { API, getAxiosConfig, extractErrorMessage } from "@/config/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function JobCard({ job }) {
  const isEvent = job.type === "campus_event";

  return (
    <a
      href={`/jobs/${job.slug}`}
      className="block"
      data-testid={`job-card-link-${job.slug}`}
      aria-label={`Open ${job.title}`}
    >
      <Card className="quest-card hover:shadow-lg" data-testid={`job-card-${job.slug}`}>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-3xl font-semibold" data-testid={`job-title-${job.slug}`}>
                {job.title}
              </CardTitle>
              <CardDescription className="text-base md:text-lg" data-testid={`job-subtitle-${job.slug}`}>
                {job.team || "Engineering"} • {job.employment_type || "Internship"} • {job.work_mode || "Remote"}
              </CardDescription>
            </div>
            <Badge variant="secondary" data-testid={`job-badge-${job.slug}`}>
              {isEvent ? "Campus Event" : "Job"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" data-testid={`job-meta-${job.slug}`}>
            {job.location ? (
              <Badge className="quest-mini-badge" data-testid={`job-location-${job.slug}`}>
                {job.location}
              </Badge>
            ) : null}
            {job.deadline ? (
              <Badge className="quest-mini-badge" data-testid={`job-deadline-${job.slug}`}>
                Apply by {formatDate(job.deadline)}
              </Badge>
            ) : null}
            {job.event_date ? (
              <Badge className="quest-mini-badge" data-testid={`job-event-date-${job.slug}`}>
                Event: {formatDate(job.event_date)}
              </Badge>
            ) : null}
            {job.stipend ? (
              <Badge className="quest-mini-badge" data-testid={`job-stipend-${job.slug}`}>
                Stipend: {job.stipend}
              </Badge>
            ) : null}
          </div>

          <div className="text-sm text-slate-700" data-testid={`job-summary-${job.slug}`}>
            {job.short_description || ""}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3" data-testid={`job-cta-${job.slug}`}>
            <div className="text-sm text-slate-600" data-testid={`job-footer-${job.slug}`}>
              {job.internship_duration || "3 months"} internship • PPO based on performance
            </div>
            <Button className="quest-primary" size="sm" data-testid={`job-open-button-${job.slug}`}>
              View details
            </Button>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

export default function JobsBoard() {
  const [state, setState] = useState({ status: "loading", error: null, jobs: [] });
  const [showMobileLogo, setShowMobileLogo] = useState(true);

  useEffect(() => {
    const onScroll = () => {
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await axios.get(`${API}/jobs`, getAxiosConfig());
        if (!mounted) return;
        setState({ status: "ready", error: null, jobs: res.data.items || [] });
      } catch (e) {
        const msg = extractErrorMessage(e, "Failed to load job postings");
        if (!mounted) return;
        setState({ status: "error", error: msg, jobs: [] });
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="quest-page" data-testid="jobs-board-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="jobs-board-backdrop" />

      <a
        href="/"
        className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
        data-testid="jobs-logo-link"
        aria-label="Pixwik"
      >
        <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="jobs-logo-img" />
      </a>

      <main className="quest-container" data-testid="jobs-board-container">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5" data-testid="jobs-board-top-actions">
          <div className="text-sm text-slate-600">Already applied?</div>
          <a href="/candidate" data-testid="jobs-board-candidate-portal-link">
            <Button variant="secondary" size="sm">Candidate Portal</Button>
          </a>
        </div>

        <div className="space-y-3 mb-8" data-testid="jobs-board-hero">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/60" data-testid="jobs-board-pill">
            <span className="quest-dot" aria-hidden="true" />
            Careers • Internships • Early talent
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="jobs-board-title">
            Careers at Pixwik
          </h1>
          <p className="text-base md:text-lg text-slate-700 max-w-2xl" data-testid="jobs-board-subtitle">
            We hire for internships and full-time roles. For campus drives, apply to the event posting and complete the Developer Quest.
          </p>
        </div>

        {state.status === "error" ? (
          <div className="quest-error" data-testid="jobs-board-error">
            {extractErrorMessage(state.error)}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4" data-testid="jobs-list">
          {state.status === "loading" ? (
            <div className="text-sm text-slate-600" data-testid="jobs-loading">
              Loading jobs…
            </div>
          ) : null}

          {state.status === "ready" && state.jobs.length === 0 ? (
            <div className="text-sm text-slate-600" data-testid="jobs-empty">
              No job postings yet.
            </div>
          ) : null}

          {/* {state.jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))} */}
        </div>
        <div style={{ textAlign: "center", marginTop: "20px" ,fontSize: "20px" ,color: "green"}}>We Will come back with more jobs soon!</div>

        <footer className="quest-footer" data-testid="jobs-footer">
          <div className="text-sm text-slate-600" data-testid="jobs-privacy">
            Privacy: your data is used only for recruitment. You can request deletion anytime.
          </div>
        </footer>
      </main>
    </div>
  );
}

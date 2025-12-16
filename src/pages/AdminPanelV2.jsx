import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import PixwikLogo from "@/assets/pixwik-logo.svg";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const BACKEND_URL = "https://careersnackend.pixwik.com";
const API = `${BACKEND_URL}/api`;

// Helper function to add ngrok bypass header to axios config
function getAxiosConfig(config = {}) {
  return {
    ...config,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(config.headers || {})
    }
  };
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function parseBullets(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

function toBulletsText(list) {
  if (!list || list.length === 0) return "- ";
  return list.map((x) => `- ${x}`).join("\n");
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function extractErrorMessage(error, fallback = "An error occurred") {
  if (!error) return fallback;
  
  // If it's already a string, return it
  if (typeof error === "string") return error;
  
  // If it's an object with a detail property
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // Handle array of validation errors
      return detail.map((err) => {
        if (typeof err === "string") return err;
        if (err?.msg) return err.msg;
        return JSON.stringify(err);
      }).join(", ");
    }
    if (typeof detail === "object") {
      // Handle validation error object
      if (detail.msg) return detail.msg;
      if (detail.message) return detail.message;
      return JSON.stringify(detail);
    }
  }
  
  // If it's an object with a message property
  if (error?.message) return error.message;
  
  // Last resort: stringify the error
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

function BulkActionsMenu({ count, onReject, onSelect, onNotSelected, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" data-testid="admin-v2-candidates-bulk-actions">
          Bulk actions ({count})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          data-testid="admin-v2-candidates-bulk-actions-reject"
          onSelect={(e) => {
            e.preventDefault();
            onReject();
          }}
        >
          Reject
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="admin-v2-candidates-bulk-actions-select"
          onSelect={(e) => {
            e.preventDefault();
            onSelect();
          }}
        >
          Select
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="admin-v2-candidates-bulk-actions-not-selected"
          onSelect={(e) => {
            e.preventDefault();
            onNotSelected();
          }}
        >
          Not Selected
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="admin-v2-candidates-bulk-actions-delete"
          onSelect={(e) => {
            e.preventDefault();
            onDelete();
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


const EMPTY_DRAFT = {
  id: null,
  title: "",
  slug: "",
  type: "campus_event",
  team: "Engineering",

  employment_type: "Internship (3 months) → Full-time",

  work_mode: "Remote",
  location: "",
  stipend: "TBD",
  internship_duration: "3 months",
  short_description: "",
  full_description: "",
  role_overview: "",
  requirementsText: "- ",
  bonusText: "- ",
  deadline: "",
  event_date: "",
  application_url: "/quest",
  is_published: true,
};

export default function AdminPanelV2() {
  const { toast } = useToast();
  const [showMobileLogo, setShowMobileLogo] = useState(true);

  const [auth, setAuth] = useState({ username: "", password: "" });
  const [token, setToken] = useState("");
  const isAuthed = Boolean(token);

  const [tab, setTab] = useState("candidates");

  const [loginState, setLoginState] = useState({ status: "idle", error: null });

  const [jobsState, setJobsState] = useState({ status: "idle", error: null, rows: [], selectedId: null });
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const [appsState, setAppsState] = useState({ status: "idle", error: null, rows: [], selected: null, csvUrl: null });
  const [csvFilename, setCsvFilename] = useState("pixwik-applications.csv");
  const [candidatesCsvFilename, setCandidatesCsvFilename] = useState("pixwik-candidates.csv");

  const [auditState, setAuditState] = useState({ status: "idle", error: null, rows: [] });
  const [auditFilters, setAuditFilters] = useState({ action: "all", job_slug: "all" });

  const [candidatesState, setCandidatesState] = useState({ status: "idle", error: null, rows: [], selected: null, csvUrl: null });
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [roundsState, setRoundsState] = useState({ status: "idle", error: null, rows: [] });
  const [evalForm, setEvalForm] = useState({ score: 0, evaluator_name: "", comments: "", status: "Pass" });

  const [quizState, setQuizState] = useState({ status: "idle", error: null, items: [], selected: null });

  const [candidateJobFilter, setCandidateJobFilter] = useState("all");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");
  const [candidateRoundFilter, setCandidateRoundFilter] = useState("all");


  const [codingState, setCodingState] = useState({ status: "idle", error: null, templates: [], problems: [], selectedProblemId: "" });
  const [codingDraft, setCodingDraft] = useState({ template_id: "", title_override: "" });


  const [adminRole, setAdminRole] = useState("unknown");

  const [adminsState, setAdminsState] = useState({ status: "idle", error: null, rows: [] });
  const [adminDraft, setAdminDraft] = useState({ username: "", password: "" });

  const [scoresState, setScoresState] = useState({ status: "idle", error: null, rows: [] });

  const [quizDraft, setQuizDraft] = useState({
    question_text: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correct_answer: "A",
  });

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

  async function login() {
    setLoginState({ status: "loading", error: null });
    try {
      const res = await axios.post(`${API}/admin/login`, auth, getAxiosConfig());
      setToken(res.data.token);

      try {
        const payload = JSON.parse(atob((res.data.token || "").split(".")[1] || ""));
        setAdminRole(payload?.role || "sub_admin");
      } catch {
        setAdminRole("sub_admin");
      }

      setLoginState({ status: "idle", error: null });
    } catch (e) {
      const msg = e?.response?.data?.detail || "Login failed";
      setLoginState({ status: "error", error: msg });
    }
  }

  async function loadJobs() {
    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/jobs`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setJobsState((s) => ({ ...s, status: "idle", rows: res.data.items || [], error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load jobs";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  function selectJob(job) {
    setJobsState((s) => ({ ...s, selectedId: job.id }));
    setDraft({
      id: job.id,
      title: job.title || "",
      slug: job.slug || "",
      type: job.type || "campus_event",
      team: job.team || "Engineering",
      employment_type: job.employment_type || "Internship (3 months) → Full-time",
      work_mode: job.work_mode || "Remote",
      location: job.location || "",
      stipend: job.stipend || "TBD",
      internship_duration: job.internship_duration || "3 months",
      short_description: job.short_description || "",
      full_description: job.full_description || "",
      role_overview: job.role_overview || "",
      requirementsText: toBulletsText(job.requirements || []),
      bonusText: toBulletsText(job.bonus || []),
      deadline: job.deadline || "",
      event_date: job.event_date || "",
      application_url: job.application_url || "/quest",
      is_published: job.is_published !== false,
    });
  }

  function newJobDraft() {
    setJobsState((s) => ({ ...s, selectedId: null }));
    setDraft(EMPTY_DRAFT);
  }

  async function createJob() {
    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const payload = {
        title: draft.title,
        slug: draft.slug,
        type: draft.type,
        team: draft.team,
        employment_type: draft.employment_type,
        work_mode: draft.work_mode,
        location: draft.location || null,
        stipend: draft.stipend,
        internship_duration: draft.internship_duration,
        short_description: draft.short_description,
        full_description: draft.full_description,
        role_overview: draft.role_overview,
        requirements: parseBullets(draft.requirementsText),
        bonus: parseBullets(draft.bonusText),
        deadline: draft.deadline || null,
        event_date: draft.event_date || null,
        application_url: draft.application_url || "/quest",
        is_published: Boolean(draft.is_published),
      };

      const res = await axios.post(`${API}/admin/jobs`, payload, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadJobs();
      selectJob(res.data);
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create job";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function saveJob() {
    if (!draft.id) return;

    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const payload = {
        title: draft.title,
        slug: draft.slug,
        type: draft.type,
        team: draft.team,
        employment_type: draft.employment_type,
        work_mode: draft.work_mode,
        location: draft.location || null,
        stipend: draft.stipend,
        internship_duration: draft.internship_duration,
        short_description: draft.short_description,
        full_description: draft.full_description,
        role_overview: draft.role_overview,
        requirements: parseBullets(draft.requirementsText),
        bonus: parseBullets(draft.bonusText),
        deadline: draft.deadline || null,
        event_date: draft.event_date || null,
        application_url: draft.application_url || "/quest",
        is_published: Boolean(draft.is_published),
      };

      const res = await axios.put(`${API}/admin/jobs/${draft.id}`, payload, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadJobs();
      selectJob(res.data);
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to update job";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function deleteJob() {
    if (!draft.id) return;
    const ok = window.confirm("Delete this job posting?");
    if (!ok) return;

    setJobsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.delete(`${API}/admin/jobs/${draft.id}`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadJobs();
      newJobDraft();
      setJobsState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to delete job";
      setJobsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadSubAdmins() {
    setAdminsState((s) => ({ ...s, status: "loading", error: null, rows: Array.isArray(s.rows) ? s.rows : [] }));
    try {
      const res = await axios.get(`${API}/admin/sub-admins`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      // Ensure we always have an array - handle both direct array response and wrapped responses
      let rows = [];
      if (Array.isArray(res.data)) {
        rows = res.data;
      } else if (res.data && Array.isArray(res.data.items)) {
        rows = res.data.items;
      } else if (res.data && Array.isArray(res.data.rows)) {
        rows = res.data.rows;
      }
      setAdminsState({ status: "idle", error: null, rows });
    } catch (e) {
      const msg = extractErrorMessage(e, "Failed to load admins");
      setAdminsState((s) => ({ ...s, status: "error", error: msg, rows: Array.isArray(s.rows) ? s.rows : [] }));
    }
  }

  async function createSubAdmin() {
    if (!adminDraft.username || !adminDraft.password) return;
    const username = adminDraft.username;

    setAdminsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.post(`${API}/admin/sub-admins`, adminDraft, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setAdminDraft({ username: "", password: "" });
      await loadSubAdmins();
      toast({ title: "Sub-admin created", description: username });
    } catch (e) {
      const msg = extractErrorMessage(e, "Failed to create sub-admin");
      setAdminsState((s) => ({ ...s, status: "error", error: msg, rows: Array.isArray(s.rows) ? s.rows : [] }));
    }
  }

  async function disableSubAdmin(username) {
    const ok = window.confirm(`Disable ${username}?`);
    if (!ok) return;
    setAdminsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.post(`${API}/admin/sub-admins/${encodeURIComponent(username)}/disable`, {}, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadSubAdmins();
      toast({ title: "Sub-admin disabled", description: username });
    } catch (e) {
      const msg = extractErrorMessage(e, "Failed to disable sub-admin");
      setAdminsState((s) => ({ ...s, status: "error", error: msg, rows: Array.isArray(s.rows) ? s.rows : [] }));
    }
  }

  async function deleteSubAdmin(username) {
    const ok = window.confirm(`Delete ${username}? This cannot be undone.`);
    if (!ok) return;
    setAdminsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.delete(`${API}/admin/sub-admins/${encodeURIComponent(username)}`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadSubAdmins();
      toast({ title: "Sub-admin deleted", description: username });
    } catch (e) {
      const msg = extractErrorMessage(e, "Failed to delete sub-admin");
      setAdminsState((s) => ({ ...s, status: "error", error: msg, rows: Array.isArray(s.rows) ? s.rows : [] }));
    }
  }

  async function loadCandidateScores(candidateId) {
    if (!candidateId) return;
    setScoresState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/candidates/${candidateId}/scores`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setScoresState((s) => ({ ...s, status: "idle", error: null, rows: res.data.items || [] }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load evaluation history";
      setScoresState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadCandidates() {
    setCandidatesState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const params = [];
      if (candidateJobFilter && candidateJobFilter !== "all") params.push(`job_slug=${encodeURIComponent(candidateJobFilter)}`);
      // status + round filters are applied client-side (keeps backend simple and avoids extra query work)
      const qs = params.length ? `?${params.join("&")}` : "";
      const res = await axios.get(`${API}/admin/candidates${qs}`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      let rows = res.data.items || [];
      if (candidateStatusFilter !== "all") {
        rows = rows.filter((c) => String(c.status || "") === candidateStatusFilter);
      }
      if (candidateRoundFilter !== "all") {
        rows = rows.filter((c) => String(c.current_round || "") === candidateRoundFilter);
      }

      setCandidatesState((s) => ({ ...s, status: "idle", rows, error: null }));
      setSelectedCandidateIds((prev) => prev.filter((id) => (res.data.items || []).some((c) => c.candidate_id === id)));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load candidates";
      setCandidatesState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadRounds() {
    setRoundsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/rounds`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setRoundsState((s) => ({ ...s, status: "idle", rows: res.data.items || [], error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load rounds";
      setRoundsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  function openCandidatePanel(row) {
    setCandidatesState((s) => ({ ...s, selected: row }));
    setEvalForm({ score: 0, evaluator_name: "", comments: "", status: "Pass" });
    loadCandidateScores(row?.candidate_id);
  }

  async function submitEvaluation() {
    const candidate = candidatesState.selected;
    if (!candidate) return;

    try {
      await axios.post(
        `${API}/admin/candidates/${candidate.candidate_id}/score`,
        {
          candidate_id: candidate.candidate_id,
          score: Number(evalForm.score),
          evaluator_name: evalForm.evaluator_name,
          comments: evalForm.comments,
          status: evalForm.status,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadCandidates();
      toast({ title: "Score saved", description: `${candidate.full_name} – ${candidate.current_round} – ${Number(evalForm.score)} pts` });
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to submit score";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function promoteCandidate() {
    const candidate = candidatesState.selected;
    if (!candidate) return;

    try {
      await axios.post(`${API}/admin/candidates/${candidate.candidate_id}/promote`, {}, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadCandidates();
      setCandidatesState((s) => ({ ...s, selected: null }));
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.candidate_id));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to promote";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  function toggleCandidate(candidateId, checked) {
    setSelectedCandidateIds((prev) => {
      if (checked) return Array.from(new Set([...prev, candidateId]));
      return prev.filter((id) => id !== candidateId);
    });
  }

  function toggleAllCandidates(checked) {
    if (checked) {
      setSelectedCandidateIds(candidatesState.rows.map((c) => c.candidate_id));
    } else {
      setSelectedCandidateIds([]);
    }
  }

  async function bulkPromoteSelected() {
    if (selectedCandidateIds.length === 0) return;

    const ids = [...selectedCandidateIds];
    const ok = window.confirm(`Promote ${ids.length} candidate(s) to the next stage?`);
    if (!ok) return;

    // Optimistic clear so the UI immediately reflects the action.
    setSelectedCandidateIds([]);

    try {
      await axios.post(
        `${API}/admin/candidates/bulk-promote`,
        { candidate_ids: ids },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadCandidates();
      setCandidatesState((s) => ({ ...s, selected: null }));
    } catch (e) {
      // Restore selection on failure
      setSelectedCandidateIds(ids);
      const msg = e?.response?.data?.detail || "Failed to bulk promote";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function bulkDeleteSelected() {
    if (selectedCandidateIds.length === 0) return;

    const ids = [...selectedCandidateIds];
    const ok = window.confirm(`Delete ${ids.length} candidate(s)? Only Active/Rejected candidates can be deleted.`);
    if (!ok) return;

    setSelectedCandidateIds([]);

    try {
      await axios.post(
        `${API}/admin/candidates/bulk-delete`,
        { candidate_ids: ids },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadCandidates();
      setCandidatesState((s) => ({ ...s, selected: null }));
      toast({ title: "Candidates deleted", description: `${ids.length} candidate(s) deleted` });
    } catch (e) {
      setSelectedCandidateIds(ids);
      const msg = e?.response?.data?.detail || "Failed to delete candidates";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function bulkRejectSelected() {
    if (selectedCandidateIds.length === 0) return;

    const ids = [...selectedCandidateIds];
    const ok = window.confirm(`Reject ${ids.length} candidate(s)?`);
    if (!ok) return;

    setSelectedCandidateIds([]);

    try {
      await axios.post(
        `${API}/admin/candidates/bulk-reject`,
        { candidate_ids: ids },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadCandidates();
      setCandidatesState((s) => ({ ...s, selected: null }));
      toast({ title: "Candidates rejected", description: `${ids.length} candidate(s) rejected` });
    } catch (e) {
      setSelectedCandidateIds(ids);
      const msg = e?.response?.data?.detail || "Failed to bulk reject";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function bulkFinalizeSelected(decision) {
    if (selectedCandidateIds.length === 0) return;

    const ids = [...selectedCandidateIds];
    const label = decision === "Selected" ? "Select" : "Mark not selected";
    const ok = window.confirm(`${label} ${ids.length} candidate(s)?`);
    if (!ok) return;

    setSelectedCandidateIds([]);

    try {
      await axios.post(
        `${API}/admin/candidates/bulk-finalize`,
        { candidate_ids: ids, decision },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadCandidates();
      setCandidatesState((s) => ({ ...s, selected: null }));
      toast({ title: "Candidates updated", description: `${ids.length} candidate(s) updated` });
    } catch (e) {
      setSelectedCandidateIds(ids);
      const msg = e?.response?.data?.detail || "Failed to bulk finalize";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function finalizeCandidate(decision) {
    const candidate = candidatesState.selected;
    if (!candidate) return;

    try {
      await axios.post(
        `${API}/admin/candidates/${candidate.candidate_id}/finalize`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadCandidates();
      toast({ title: "Candidate updated", description: `${candidate.full_name} – ${decision}` });
      setCandidatesState((s) => ({ ...s, selected: null }));
      setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.candidate_id));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to update candidate";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function rejectCandidate() {
    const candidate = candidatesState.selected;
    if (!candidate) return;
    const ok = window.confirm("Reject this candidate?");
    if (!ok) return;

    try {
      await axios.post(`${API}/admin/candidates/${candidate.candidate_id}/reject`, {}, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      await loadCandidates();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to reject";
      setCandidatesState((s) => ({ ...s, error: msg }));
    }
  }

  async function loadQuizQuestions() {
    setQuizState((s) => ({ ...s, status: "loading", error: null }));
    try {
      // Round 2 is quiz enabled (round-2)
      const res = await axios.get(`${API}/admin/quiz-questions?round_id=round-2`, getAxiosConfig({
        headers: { Authorization: `Bearer ${token}` },
      }));
      setQuizState((s) => ({ ...s, status: "idle", items: res.data.items || [], error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load quiz questions";
      setQuizState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  function selectCandidate(row) {
    // Backward compat for other codepaths
    openCandidatePanel(row);
  }

  function selectQuizQuestion(q) {
    setQuizState((s) => ({ ...s, selected: q }));
    setQuizDraft({
      question_text: q.question_text || "",
      optionA: q.options?.A || "",
      optionB: q.options?.B || "",
      optionC: q.options?.C || "",
      optionD: q.options?.D || "",
      correct_answer: q.correct_answer || "A",
    });
  }

  function newQuizQuestion() {
    setQuizState((s) => ({ ...s, selected: null }));
    setQuizDraft({ question_text: "", optionA: "", optionB: "", optionC: "", optionD: "", correct_answer: "A" });
  }

  async function createQuizQuestion() {
    setQuizState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.post(
        `${API}/admin/quiz-questions`,
        {
          round_id: "round-2",
          question_text: quizDraft.question_text,
          options: {
            A: quizDraft.optionA,
            B: quizDraft.optionB,
            C: quizDraft.optionC,
            D: quizDraft.optionD,
          },
          correct_answer: quizDraft.correct_answer,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadQuizQuestions();
      setQuizState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create question";
      setQuizState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadAuditLogs() {
    setAuditState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const params = [];
      if (auditFilters.action && auditFilters.action !== "all") params.push(`action=${encodeURIComponent(auditFilters.action)}`);
      if (auditFilters.job_slug && auditFilters.job_slug !== "all") params.push(`job_slug=${encodeURIComponent(auditFilters.job_slug)}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      const res = await axios.get(`${API}/admin/audit-logs${qs}`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setAuditState((s) => ({ ...s, status: "idle", error: null, rows: res.data.items || [] }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load audit logs";
      setAuditState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function updateQuizQuestion() {
    if (!quizState.selected?.question_id) return;
    setQuizState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.put(
        `${API}/admin/quiz-questions/${quizState.selected.question_id}`,
        {
          question_text: quizDraft.question_text,
          options: {
            A: quizDraft.optionA,
            B: quizDraft.optionB,
            C: quizDraft.optionC,
            D: quizDraft.optionD,
          },
          correct_answer: quizDraft.correct_answer,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadQuizQuestions();
      setQuizState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to update question";
      setQuizState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function deleteQuizQuestion() {
    if (!quizState.selected?.question_id) return;
    const ok = window.confirm("Delete this question?");
    if (!ok) return;

    setQuizState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.delete(`${API}/admin/quiz-questions/${quizState.selected.question_id}`, getAxiosConfig({
        headers: { Authorization: `Bearer ${token}` },
      }));
      await loadQuizQuestions();
      newQuizQuestion();
      setQuizState((s) => ({ ...s, status: "idle", error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to delete question";
      setQuizState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadApplications() {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/applications`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setAppsState((s) => ({ ...s, status: "idle", rows: res.data.items || [], error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load applications";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function openApplicationDetails(id) {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/applications/${id}`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setAppsState((s) => ({ ...s, status: "idle", selected: res.data, error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to open application";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function exportApplicationsCsv() {
    setAppsState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await axios.get(`${API}/admin/export.csv`, getAxiosConfig({
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      }));
      const url = URL.createObjectURL(res.data);
      setCsvFilename(`pixwik-applications-${Date.now()}.csv`);
      setAppsState((s) => ({ ...s, status: "idle", csvUrl: url, error: null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "CSV export failed";
      setAppsState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function exportCandidatesCsv() {
    setCandidatesState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const qs = candidateJobFilter && candidateJobFilter !== "all" ? `?job_slug=${encodeURIComponent(candidateJobFilter)}` : "";
      const res = await axios.get(`${API}/admin/candidates/export.csv${qs}`, getAxiosConfig({
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      }));
      const url = URL.createObjectURL(res.data);
      setCandidatesCsvFilename(`pixwik-candidates-${Date.now()}.csv`);
      setCandidatesState((s) => ({ ...s, status: "idle", error: null, csvUrl: url }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "CSV export failed";
      setCandidatesState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function loadCoding() {
    setCodingState((s) => ({ ...s, status: "loading", error: null }));

    try {
      const [tplRes, problemsRes] = await Promise.all([
        axios.get(`${API}/admin/coding/templates`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } })),
        axios.get(`${API}/admin/coding/problems`, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } })),
      ]);

      setCodingState((s) => ({
        ...s,
        status: "idle",
        templates: tplRes.data.items || [],
        problems: problemsRes.data.items || [],
        error: null,
      }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load coding settings";
      setCodingState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function createCodingProblem() {
    if (!codingDraft.template_id) {
      setCodingState((s) => ({ ...s, error: "Pick a template first" }));
      return;
    }

    setCodingState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.post(`${API}/admin/coding/problems`, codingDraft, getAxiosConfig({ headers: { Authorization: `Bearer ${token}` } }));
      setCodingDraft({ template_id: "", title_override: "" });
      await loadCoding();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create coding problem";
      setCodingState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function assignCodingToRound(roundId) {
    if (!codingState.selectedProblemId) {
      setCodingState((s) => ({ ...s, error: "Select a coding problem to assign" }));
      return;
    }

    setCodingState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.put(
        `${API}/admin/rounds/${roundId}/coding`,
        { is_coding: true, coding_problem_id: codingState.selectedProblemId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadRounds();
      await loadCoding();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to assign coding";
      setCodingState((s) => ({ ...s, status: "error", error: msg }));
    }
  }

  async function disableCodingForRound(roundId) {
    setCodingState((s) => ({ ...s, status: "loading", error: null }));
    try {
      await axios.put(
        `${API}/admin/rounds/${roundId}/coding`,
        { is_coding: false, coding_problem_id: null },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await loadRounds();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to disable coding";
      setCodingState((s) => ({ ...s, status: "error", error: msg }));
    }
  }


  useEffect(() => {
    if (!isAuthed) return;

    const t = setTimeout(() => {
      loadJobs();
      loadRounds();
      loadCandidates();
      loadQuizQuestions();
      loadCoding();
      loadApplications();
      if (adminRole === "super_admin") {
        loadSubAdmins();
      }
    }, 0);

    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [isAuthed, adminRole, candidateJobFilter]);

  const selectedApplication = appsState.selected;
  const selectedJob = useMemo(() => jobsState.rows.find((j) => j.id === jobsState.selectedId) || null, [jobsState.rows, jobsState.selectedId]);

  const downloadResumeHref = useMemo(() => {
    if (!selectedApplication?.id) return null;



    return `${API}/developer-applications/${selectedApplication.id}/resume`;
  }, [selectedApplication]);

  return (
    <div className="quest-page" data-testid="admin-v2-page">
      <div className="quest-backdrop" aria-hidden="true" data-testid="admin-v2-backdrop" />

      <a
        href="/"
        className={`quest-brand ${showMobileLogo ? "quest-brand--visible" : "quest-brand--hidden"}`}
        data-testid="admin-v2-logo-link"
        aria-label="Pixwik"
      >
        <img src={PixwikLogo} alt="Pixwik" className="quest-brand__logo" data-testid="admin-v2-logo-img" />
      </a>

      <main className="quest-container max-w-none" data-testid="admin-v2-container">
        <div className="mb-6" data-testid="admin-v2-header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900" data-testid="admin-v2-title">
                Pixwik Admin
              </h1>
              <p className="text-base md:text-lg text-slate-700" data-testid="admin-v2-subtitle">
                Manage job postings and review applications.
              </p>
            </div>

            <div className="flex items-center gap-2" data-testid="admin-v2-auth-meta">
              <Badge variant="secondary" data-testid="admin-v2-auth-badge">
                {isAuthed ? "Logged in" : "Not logged in"}
              </Badge>
              {isAuthed ? (
                <Badge variant="secondary" data-testid="admin-v2-role-badge">
                  {adminRole === "super_admin" ? "Super Admin" : adminRole === "sub_admin" ? "Sub-admin" : "Admin"}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        {!isAuthed ? (
          <Card className="quest-card" data-testid="admin-v2-login-card">
            <CardHeader>
              <CardTitle data-testid="admin-v2-login-title">Admin Login</CardTitle>
              <CardDescription data-testid="admin-v2-login-desc">Use your Pixwik admin credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loginState.error ? (
                <div className="quest-error" data-testid="admin-v2-login-error">
                  {loginState.error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-login-fields">
                <div className="space-y-2" data-testid="admin-v2-username-field">
                  <Label htmlFor="adminUser">Username</Label>
                  <Input
                    id="adminUser"
                    value={auth.username}
                    data-testid="admin-v2-username-input"
                    onChange={(e) => setAuth((s) => ({ ...s, username: e.target.value }))}
                    placeholder="pixwikadmin"
                  />
                </div>

                <div className="space-y-2" data-testid="admin-v2-password-field">
                  <Label htmlFor="adminPass">Password</Label>
                  <Input
                    id="adminPass"
                    type="password"
                    value={auth.password}
                    data-testid="admin-v2-password-input"
                    onChange={(e) => setAuth((s) => ({ ...s, password: e.target.value }))}
                    placeholder="••••••••••"
                  />
                </div>
              </div>

              <Button
                className="quest-primary"


                data-testid="admin-v2-login-button"
                onClick={login}
                disabled={loginState.status === "loading"}
              >
                {loginState.status === "loading" ? "Signing in…" : "Sign in"}
              </Button>

              <div className="text-sm text-slate-600" data-testid="admin-v2-security-note">
                Security note: shared-password MVP. For production, we can upgrade to Google login.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={setTab} data-testid="admin-v2-tabs">
            <TabsList data-testid="admin-v2-tabs-list">
              <TabsTrigger value="jobs" data-testid="admin-v2-tab-jobs">
                Job postings
              </TabsTrigger>
              <TabsTrigger value="candidates" data-testid="admin-v2-tab-candidates">
                Candidates
              </TabsTrigger>
              <TabsTrigger value="quiz" data-testid="admin-v2-tab-quiz">
                Quiz (Round 2)
              </TabsTrigger>
              <TabsTrigger value="coding" data-testid="admin-v2-tab-coding">
                Coding
              </TabsTrigger>
              <TabsTrigger value="applications" data-testid="admin-v2-tab-apps">
                Applications
              </TabsTrigger>
              <TabsTrigger value="audit" data-testid="admin-v2-tab-audit">
                Audit Logs
              </TabsTrigger>
              {adminRole === "super_admin" ? (
                <TabsTrigger value="admins" data-testid="admin-v2-tab-admins">
                  Manage Admins
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="jobs" className="mt-6" data-testid="admin-v2-jobs-tab">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="admin-v2-jobs-grid">
                <Card className="quest-card" data-testid="admin-v2-jobs-list-card">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle data-testid="admin-v2-jobs-list-title">Job postings</CardTitle>
                        <CardDescription data-testid="admin-v2-jobs-list-desc">Published jobs appear on the public Careers page.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2" data-testid="admin-v2-jobs-actions">
                        <Button variant="secondary" data-testid="admin-v2-jobs-refresh" onClick={loadJobs}>
                          Refresh
                        </Button>
                        <Button variant="secondary" data-testid="admin-v2-jobs-new" onClick={newJobDraft}>
                          New
                        </Button>
                      </div>
                    </div>
                    {jobsState.error ? (
                      <div className="quest-error" data-testid="admin-v2-jobs-error">
                        {jobsState.error}
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2" data-testid="admin-v2-jobs-list">
                    {jobsState.status === "loading" ? (
                      <div className="text-sm text-slate-600" data-testid="admin-v2-jobs-loading">
                        Loading…
                      </div>
                    ) : null}
                    {jobsState.rows.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        className={`quest-choice ${jobsState.selectedId === job.id ? "quest-choice--active" : ""}`}
                        data-testid={`admin-v2-job-row-${job.id}`}
                        onClick={() => selectJob(job)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900" data-testid={`admin-v2-job-title-${job.id}`}>
                              {job.title}
                            </div>
                            <div className="text-xs text-slate-500" data-testid={`admin-v2-job-slug-${job.id}`}>
                              /jobs/{job.slug}
                            </div>
                            <div className="text-xs text-slate-500" data-testid={`admin-v2-job-updated-${job.id}`}>
                              Updated: {formatDateTime(job.updated_at)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="secondary" data-testid={`admin-v2-job-type-${job.id}`}>
                              {job.type}
                            </Badge>
                            <Badge variant="secondary" data-testid={`admin-v2-job-published-${job.id}`}>
                              {job.is_published ? "Published" : "Hidden"}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="quest-card" data-testid="admin-v2-job-editor-card">
                  <CardHeader>
                    <CardTitle data-testid="admin-v2-job-editor-title">Editor</CardTitle>
                    <CardDescription data-testid="admin-v2-job-editor-desc">
                      {draft.id ? "Update the selected job" : "Create a new job posting"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4" data-testid="admin-v2-job-editor">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-job-editor-top">
                      <div className="space-y-2" data-testid="admin-v2-job-title-field">
                        <Label>Title</Label>
                        <Input
                          value={draft.title}
                          data-testid="admin-v2-job-title-input"
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              title: e.target.value,
                              slug: s.slug || slugify(e.target.value),
                            }))
                          }
                          placeholder="Campus Hiring Event — Sethu Institute of Technology"
                        />
                      </div>

                      <div className="space-y-2" data-testid="admin-v2-job-slug-field">
                        <Label>Slug</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={draft.slug}
                            data-testid="admin-v2-job-slug-input"
                            onChange={(e) => setDraft((s) => ({ ...s, slug: slugify(e.target.value) }))}
                            placeholder="sethu-institute-campus-hiring-2025"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            data-testid="admin-v2-job-slug-generate"
                            onClick={() => setDraft((s) => ({ ...s, slug: slugify(s.title) }))}
                          >
                            Auto
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2" data-testid="admin-v2-job-type-field">
                        <Label>Type</Label>
                        <Select value={draft.type} onValueChange={(v) => setDraft((s) => ({ ...s, type: v }))}>
                          <SelectTrigger data-testid="admin-v2-job-type-select">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="campus_event" data-testid="admin-v2-job-type-campus">campus_event</SelectItem>
                            <SelectItem value="job" data-testid="admin-v2-job-type-job">job</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2" data-testid="admin-v2-job-work-mode-field">
                        <Label>Work mode</Label>
                        <Select value={draft.work_mode} onValueChange={(v) => setDraft((s) => ({ ...s, work_mode: v }))}>
                          <SelectTrigger data-testid="admin-v2-job-workmode-select">
                            <SelectValue placeholder="Select work mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Remote" data-testid="admin-v2-job-workmode-remote">Remote</SelectItem>
                            <SelectItem value="Hybrid" data-testid="admin-v2-job-workmode-hybrid">Hybrid</SelectItem>
                            <SelectItem value="Onsite" data-testid="admin-v2-job-workmode-onsite">Onsite</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-job-editor-meta">
                      <div className="space-y-2" data-testid="admin-v2-job-location-field">
                        <Label>Location</Label>
                        <Input
                          value={draft.location}
                          data-testid="admin-v2-job-location-input"
                          onChange={(e) => setDraft((s) => ({ ...s, location: e.target.value }))}
                          placeholder="Virudhunagar, Tamil Nadu, India"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-job-deadline-field">
                        <Label>Application deadline (YYYY-MM-DD)</Label>
                        <Input
                          value={draft.deadline}
                          data-testid="admin-v2-job-deadline-input"
                          onChange={(e) => setDraft((s) => ({ ...s, deadline: e.target.value }))}
                          placeholder="2025-12-17"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-job-event-date-field">
                        <Label>Event date (YYYY-MM-DD)</Label>
                        <Input
                          value={draft.event_date}
                          data-testid="admin-v2-job-eventdate-input"
                          onChange={(e) => setDraft((s) => ({ ...s, event_date: e.target.value }))}
                          placeholder="2025-12-19"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-job-stipend-field">
                        <Label>Stipend</Label>
                        <Input
                          value={draft.stipend}
                          data-testid="admin-v2-job-stipend-input"
                          onChange={(e) => setDraft((s) => ({ ...s, stipend: e.target.value }))}
                          placeholder="TBD"
                        />
                      </div>
                    </div>

                    <div className="space-y-2" data-testid="admin-v2-job-shortdesc-field">
                      <Label>Short description</Label>
                      <Textarea
                        value={draft.short_description}
                        data-testid="admin-v2-job-shortdesc-input"
                        onChange={(e) => setDraft((s) => ({ ...s, short_description: e.target.value }))}
                        className="min-h-[90px]"
                        placeholder="A crisp summary shown on the Careers list."
                      />
                    </div>

                    <div className="space-y-2" data-testid="admin-v2-job-fulldesc-field">
                      <Label>Full description</Label>
                      <Textarea
                        value={draft.full_description}
                        data-testid="admin-v2-job-fulldesc-input"
                        onChange={(e) => setDraft((s) => ({ ...s, full_description: e.target.value }))}
                        className="min-h-[120px]"
                        placeholder="Full details shown on the job page."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-job-bullets">
                      <div className="space-y-2" data-testid="admin-v2-job-req-field">
                        <Label>Requirements (bullets)</Label>
                        <Textarea
                          value={draft.requirementsText}
                          data-testid="admin-v2-job-req-input"
                          onChange={(e) => setDraft((s) => ({ ...s, requirementsText: e.target.value }))}
                          className="min-h-[120px]"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-job-bonus-field">
                        <Label>Nice to have (bullets)</Label>
                        <Textarea
                          value={draft.bonusText}
                          data-testid="admin-v2-job-bonus-input"
                          onChange={(e) => setDraft((s) => ({ ...s, bonusText: e.target.value }))}
                          className="min-h-[120px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="admin-v2-job-publish-row">
                      <div className="flex items-center gap-3" data-testid="admin-v2-job-publish-toggle">
                        <Switch
                          checked={Boolean(draft.is_published)}
                          onCheckedChange={(v) => setDraft((s) => ({ ...s, is_published: v }))}
                          data-testid="admin-v2-job-publish-switch"
                        />
                        <div className="text-sm text-slate-700" data-testid="admin-v2-job-publish-label">
                          Published
                        </div>
                      </div>

                      <div className="text-xs text-slate-500" data-testid="admin-v2-job-preview">
                        Preview: <span className="font-mono">/jobs/{draft.slug || "your-slug"}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-job-editor-actions">
                      {!draft.id ? (
                        <Button className="quest-primary" data-testid="admin-v2-job-create" onClick={createJob}>
                          Create job
                        </Button>
                      ) : (
                        <Button className="quest-primary" data-testid="admin-v2-job-save" onClick={saveJob}>
                          Save changes
                        </Button>
                      )}

                      {draft.id ? (
                        <Button variant="secondary" data-testid="admin-v2-job-delete" onClick={deleteJob}>
                          Delete
                        </Button>
                      ) : null}

                      <Button variant="secondary" data-testid="admin-v2-job-open-public" onClick={() => window.open(`/jobs/${draft.slug}`, "_blank")}>
                        Open public page
                      </Button>
                    </div>

                    {selectedJob ? (
                      <div className="text-xs text-slate-500" data-testid="admin-v2-job-editor-footnote">
                        ID: <span className="font-mono">{selectedJob.id}</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="candidates" className="mt-6" data-testid="admin-v2-candidates-tab">
              <div className="flex gap-6" data-testid="admin-v2-candidates-grid">
                <Card className={`quest-card transition-all ${candidatesState.selected ? "w-3/5" : "w-full"}`} data-testid="admin-v2-candidates-list-card">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle data-testid="admin-v2-candidates-title">Candidates</CardTitle>
                        <CardDescription data-testid="admin-v2-candidates-desc">
                          Multi-round pipeline (Round 1 → Round 4 → Completed).
                        </CardDescription>
                      </div>

                    <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-candidates-filters">
                      <div className="min-w-[260px]" data-testid="admin-v2-candidates-job-filter">
                        <Select value={candidateJobFilter} onValueChange={(v) => setCandidateJobFilter(v)}>
                          <SelectTrigger data-testid="admin-v2-candidates-job-filter-trigger">
                            <SelectValue placeholder="Filter by job" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All jobs</SelectItem>
                            {jobsState.rows
                              .filter((j) => j.slug)
                              .map((j) => (
                                <SelectItem key={j.id} value={j.slug}>
                                  {j.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-[200px]" data-testid="admin-v2-candidates-status-filter">
                        <Select value={candidateStatusFilter} onValueChange={(v) => setCandidateStatusFilter(v)}>
                          <SelectTrigger data-testid="admin-v2-candidates-status-filter-trigger">
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                            <SelectItem value="Selected">Selected</SelectItem>
                            <SelectItem value="Completed (not selected)">Completed (not selected)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-[260px]" data-testid="admin-v2-candidates-round-filter">
                        <Select value={candidateRoundFilter} onValueChange={(v) => setCandidateRoundFilter(v)}>
                          <SelectTrigger data-testid="admin-v2-candidates-round-filter-trigger">
                            <SelectValue placeholder="Filter by round" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All rounds</SelectItem>
                            {roundsState.rows.map((r) => (
                              <SelectItem key={r.round_id} value={r.round_name}>
                                {r.round_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        variant="secondary"
                        data-testid="admin-v2-candidates-apply-filter"
                        onClick={() => {
                          setSelectedCandidateIds([]);
                          loadCandidates();
                        }}
                      >
                        Apply
                      </Button>
                    </div>

                      <div className="flex items-center gap-2" data-testid="admin-v2-candidates-actions">
                        {selectedCandidateIds.length > 0 ? (
                          <>
                            <Button variant="secondary" data-testid="admin-v2-candidates-bulk-promote" onClick={bulkPromoteSelected}>
                              Promote ({selectedCandidateIds.length})
                            </Button>
                            <BulkActionsMenu
                              count={selectedCandidateIds.length}
                              onReject={bulkRejectSelected}
                              onSelect={() => bulkFinalizeSelected("Selected")}
                              onNotSelected={() => bulkFinalizeSelected("Completed")}
                              onDelete={bulkDeleteSelected}
                            />
                          </>
                        ) : null}
                        <Button variant="secondary" data-testid="admin-v2-candidates-export" onClick={exportCandidatesCsv}>
                          Export CSV
                        </Button>
                        {candidatesState.csvUrl ? (
                          <a
                            href={candidatesState.csvUrl}
                            download={candidatesCsvFilename}
                            className="text-sm underline text-slate-700"
                            data-testid="admin-v2-candidates-export-link"
                          >
                            Download CSV
                          </a>
                        ) : null}
                        <Button variant="secondary" data-testid="admin-v2-candidates-refresh" onClick={loadCandidates}>
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {candidatesState.error ? (
                      <div className="quest-error" data-testid="admin-v2-candidates-error">
                        {candidatesState.error}
                      </div>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-3" data-testid="admin-v2-candidates-list">
                    <div className="rounded-xl border border-slate-200/70 overflow-hidden" data-testid="admin-v2-candidates-table-wrapper">
                      <Table data-testid="admin-v2-candidates-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[38px]" data-testid="admin-v2-cand-th-select">
                              <Checkbox
                                data-testid="admin-v2-cand-select-all"
                                checked={
                                  selectedCandidateIds.length === 0
                                    ? false
                                    : selectedCandidateIds.length === candidatesState.rows.length
                                      ? true
                                      : "indeterminate"
                                }
                                onCheckedChange={(v) => toggleAllCandidates(Boolean(v))}
                                aria-label="Select all candidates"
                              />
                            </TableHead>
                            <TableHead data-testid="admin-v2-cand-th-name">Name</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-email">Email</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-round">Current round</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-r1">R1</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-r2">R2</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-r3">R3</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-r4">R4</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-score">Total</TableHead>



                            <TableHead data-testid="admin-v2-cand-th-status">Status</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-coding">Coding</TableHead>
                            <TableHead data-testid="admin-v2-cand-th-action" className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {candidatesState.rows.map((c) => (
                            <TableRow
                              key={c.candidate_id}
                              data-testid={`admin-v2-cand-row-${c.candidate_id}`}
                              data-state={candidatesState.selected?.candidate_id === c.candidate_id ? "selected" : undefined}
                              className="cursor-pointer"
                              onClick={(e) => {
                                // avoid opening panel when clicking checkbox
                                const tag = String(e.target?.tagName || "").toLowerCase();
                                const isInput = tag === "input" || tag === "button";
                                if (isInput) return;
                                openCandidatePanel(c);
                              }}
                            >
                              <TableCell data-testid={`admin-v2-cand-select-${c.candidate_id}`}>
                                <Checkbox
                                  data-testid={`admin-v2-cand-checkbox-${c.candidate_id}`}
                                  checked={selectedCandidateIds.includes(c.candidate_id)}
                                  onCheckedChange={(v) => toggleCandidate(c.candidate_id, Boolean(v))}
                                  aria-label={`Select ${c.full_name}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-slate-900" data-testid={`admin-v2-cand-name-${c.candidate_id}`}>
                                {c.full_name}
                              </TableCell>
                              <TableCell className="text-slate-700" data-testid={`admin-v2-cand-email-${c.candidate_id}`}>
                                {c.email}
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-round-${c.candidate_id}`}>
                                <Badge variant="secondary" data-testid={`admin-v2-cand-round-badge-${c.candidate_id}`}>
                                  {c.current_round}
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-r1-${c.candidate_id}`}>
                                <Badge variant="secondary">{c.round1_score ?? 0}</Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-r2-${c.candidate_id}`}>
                                <Badge variant="secondary">{c.round2_score ?? 0}</Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-r3-${c.candidate_id}`}>
                                <Badge variant="secondary">{c.round3_score ?? 0}</Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-r4-${c.candidate_id}`}>
                                <Badge variant="secondary">{c.round4_score ?? 0}</Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-score-${c.candidate_id}`}>
                                <Badge variant="secondary" data-testid={`admin-v2-cand-score-badge-${c.candidate_id}`}>
                                  {typeof c.total_score === "number" ? c.total_score : "—"}
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-status-${c.candidate_id}`}>
                                <Badge variant="secondary" data-testid={`admin-v2-cand-status-badge-${c.candidate_id}`}>
                                  {c.status}
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-cand-coding-${c.candidate_id}`}>
                                {c.is_coding ? (
                                  <Badge variant="secondary" data-testid={`admin-v2-cand-coding-badge-${c.candidate_id}`}>
                                    Coding
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-slate-500">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`admin-v2-cand-action-${c.candidate_id}`}>
                                <Button size="sm" variant="secondary" data-testid={`admin-v2-cand-evaluate-${c.candidate_id}`} onClick={() => selectCandidate(c)}>
                                  Evaluate
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {candidatesState.selected ? (
                <Card className="quest-card w-2/5" data-testid="admin-v2-eval-card">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>


                        <CardTitle data-testid="admin-v2-eval-title">Evaluation</CardTitle>
                        <CardDescription data-testid="admin-v2-eval-desc">
                          Score the selected candidate for their current round.
                        </CardDescription>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        data-testid="admin-v2-eval-close"
                        onClick={() => {
                          setCandidatesState((s) => ({ ...s, selected: null }));
                          setScoresState((st) => ({ ...st, rows: [] }));
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  </CardHeader>


                  <CardContent className="space-y-4">
                      <div className="space-y-4" data-testid="admin-v2-eval-form">
                        <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-eval-badges">
                          <Badge className="quest-badge" data-testid="admin-v2-eval-candidate-name">
                            {candidatesState.selected.full_name}
                          </Badge>
                          <Badge variant="secondary" data-testid="admin-v2-eval-round">
                            {candidatesState.selected.current_round}
                          </Badge>
                        </div>

                        <Separator />

                        <div className="space-y-2" data-testid="admin-v2-eval-score">
                          <Label>Score</Label>
                          <Input
                            type="number"
                            value={evalForm.score}
                            data-testid="admin-v2-eval-score-input"
                            onChange={(e) => setEvalForm((s) => ({ ...s, score: e.target.value }))}
                            placeholder="0"
                          />
                          <div className="text-xs text-slate-500" data-testid="admin-v2-eval-max">
                            Max score depends on the round (R1=20, R2=30, R3=30, R4=20). Round names are: Communication & Creativity, Problem-solving, Technical collaboration, Attitude & Culture fit.
                          </div>
                        </div>

                        <div className="space-y-2" data-testid="admin-v2-eval-evaluator">
                          <Label>Evaluator name</Label>
                          <Input
                            value={evalForm.evaluator_name}
                            data-testid="admin-v2-eval-evaluator-input"
                            onChange={(e) => setEvalForm((s) => ({ ...s, evaluator_name: e.target.value }))}
                            placeholder="Your name"
                          />
                        </div>

                        <div className="space-y-2" data-testid="admin-v2-eval-comments">
                          <Label>Comments</Label>
                          <Textarea
                            value={evalForm.comments}
                            data-testid="admin-v2-eval-comments-input"
                            onChange={(e) => setEvalForm((s) => ({ ...s, comments: e.target.value }))}
                            className="min-h-[110px]"
                            placeholder="Notes for internal review"
                          />
                        </div>

                        <div className="space-y-2" data-testid="admin-v2-eval-status">
                          <Label>Result</Label>
                          <Select value={evalForm.status} onValueChange={(v) => setEvalForm((s) => ({ ...s, status: v }))}>
                            <SelectTrigger data-testid="admin-v2-eval-status-select">
                              <SelectValue placeholder="Select result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pass" data-testid="admin-v2-eval-pass">Pass</SelectItem>
                              <SelectItem value="Fail" data-testid="admin-v2-eval-fail">Fail</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-eval-actions">
                          <Button className="quest-primary" data-testid="admin-v2-eval-submit" onClick={submitEvaluation}>
                            Submit score
                          </Button>

                          <Button variant="secondary" data-testid="admin-v2-eval-promote" onClick={promoteCandidate}>
                            Promote to Next Round
                          </Button>

                          <Button variant="secondary" data-testid="admin-v2-eval-reject" onClick={rejectCandidate}>
                            Reject
                          </Button>

                          <Button variant="secondary" data-testid="admin-v2-eval-final-select" onClick={() => finalizeCandidate("Selected")}>
                            Mark Selected
                          </Button>

                          <Button variant="secondary" data-testid="admin-v2-eval-final-deselect" onClick={() => finalizeCandidate("Completed")}>
                            De-select (Completed)
                          </Button>
                        </div>

                        <div className="text-xs text-slate-500" data-testid="admin-v2-eval-email-note">
                          Promotion/rejection emails are sent automatically.
                        </div>

                        <Separator />

                        <div className="space-y-2" data-testid="admin-v2-eval-history">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-slate-900">Evaluation history</div>
                            <Button
                              size="sm"
                              variant="secondary"
                              data-testid="admin-v2-eval-history-refresh"
                              onClick={() => loadCandidateScores(candidatesState.selected?.candidate_id)}
                            >
                              Refresh
                            </Button>
                          </div>

                          {scoresState.error ? <div className="quest-error">{scoresState.error}</div> : null}

                          <div className="rounded-xl border border-slate-200/70 overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Round</TableHead>
                                  <TableHead>Score</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Evaluated by</TableHead>
                                  <TableHead>Updated</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {scoresState.rows.map((s) => (
                                  <TableRow key={s.score_id}>
                                    <TableCell className="text-slate-900">{s.round_name}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{s.score}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">{s.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-slate-700">{s.evaluator_name || "—"}</TableCell>
                                    <TableCell className="text-slate-700">{formatDateTime(s.updated_at)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {scoresState.status === "loading" ? <div className="text-xs text-slate-500">Loading…</div> : null}
                          {scoresState.rows.length === 0 && scoresState.status !== "loading" ? (
                            <div className="text-xs text-slate-500">No evaluations yet.</div>
                          ) : null}
                        </div>
                      </div>
                  </CardContent>
                </Card>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="quiz" className="mt-6" data-testid="admin-v2-quiz-tab">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="admin-v2-quiz-grid">
                <Card className="quest-card" data-testid="admin-v2-quiz-list-card">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle data-testid="admin-v2-quiz-title">Round 2 Quiz Questions</CardTitle>
                        <CardDescription data-testid="admin-v2-quiz-desc">
                          Create and edit MCQs for the online assessment.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2" data-testid="admin-v2-quiz-actions">
                        <Button variant="secondary" data-testid="admin-v2-quiz-refresh" onClick={loadQuizQuestions}>
                          Refresh
                        </Button>
                        <Button variant="secondary" data-testid="admin-v2-quiz-new" onClick={newQuizQuestion}>
                          New
                        </Button>
                      </div>
                    </div>
                    {quizState.error ? (
                      <div className="quest-error" data-testid="admin-v2-quiz-error">
                        {quizState.error}
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3" data-testid="admin-v2-quiz-list">
                    <div className="rounded-xl border border-slate-200/70 overflow-hidden" data-testid="admin-v2-quiz-table-wrapper">
                      <Table data-testid="admin-v2-quiz-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="admin-v2-quiz-th-question">Question</TableHead>
                            <TableHead data-testid="admin-v2-quiz-th-correct">Correct</TableHead>
                            <TableHead className="text-right" data-testid="admin-v2-quiz-th-action">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quizState.items.map((q) => (
                            <TableRow
                              key={q.question_id}
                              data-testid={`admin-v2-quiz-row-${q.question_id}`}
                              data-state={quizState.selected?.question_id === q.question_id ? "selected" : undefined}
                            >
                              <TableCell data-testid={`admin-v2-quiz-question-${q.question_id}`} className="font-medium text-slate-900">
                                {q.question_text}
                              </TableCell>
                              <TableCell data-testid={`admin-v2-quiz-correct-${q.question_id}`}>
                                <Badge variant="secondary" data-testid={`admin-v2-quiz-correct-badge-${q.question_id}`}>
                                  {q.correct_answer}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right" data-testid={`admin-v2-quiz-action-${q.question_id}`}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  data-testid={`admin-v2-quiz-edit-${q.question_id}`}
                                  onClick={() => selectQuizQuestion(q)}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {quizState.items.length === 0 ? (
                      <div className="text-sm text-slate-600" data-testid="admin-v2-quiz-empty">
                        No questions yet. Click “New” to add your first question.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="quest-card" data-testid="admin-v2-quiz-editor-card">
                  <CardHeader>
                    <CardTitle data-testid="admin-v2-quiz-editor-title">Question Editor</CardTitle>
                    <CardDescription data-testid="admin-v2-quiz-editor-desc">
                      {quizState.selected ? "Edit selected question" : "Create a new question"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4" data-testid="admin-v2-quiz-editor">
                    <div className="space-y-2" data-testid="admin-v2-quiz-question-field">
                      <Label>Question text</Label>
                      <Textarea
                        value={quizDraft.question_text}
                        data-testid="admin-v2-quiz-question-input"
                        onChange={(e) => setQuizDraft((s) => ({ ...s, question_text: e.target.value }))}
                        className="min-h-[100px]"
                        placeholder="Write the MCQ question"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-quiz-options-grid">
                      <div className="space-y-2" data-testid="admin-v2-quiz-option-a">
                        <Label>Option A</Label>
                        <Input
                          value={quizDraft.optionA}
                          data-testid="admin-v2-quiz-option-a-input"
                          onChange={(e) => setQuizDraft((s) => ({ ...s, optionA: e.target.value }))}
                          placeholder="A"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-quiz-option-b">
                        <Label>Option B</Label>
                        <Input
                          value={quizDraft.optionB}
                          data-testid="admin-v2-quiz-option-b-input"
                          onChange={(e) => setQuizDraft((s) => ({ ...s, optionB: e.target.value }))}
                          placeholder="B"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-quiz-option-c">
                        <Label>Option C</Label>
                        <Input
                          value={quizDraft.optionC}
                          data-testid="admin-v2-quiz-option-c-input"
                          onChange={(e) => setQuizDraft((s) => ({ ...s, optionC: e.target.value }))}
                          placeholder="C"
                        />
                      </div>
                      <div className="space-y-2" data-testid="admin-v2-quiz-option-d">
                        <Label>Option D</Label>
                        <Input
                          value={quizDraft.optionD}
                          data-testid="admin-v2-quiz-option-d-input"
                          onChange={(e) => setQuizDraft((s) => ({ ...s, optionD: e.target.value }))}
                          placeholder="D"
                        />
                      </div>
                    </div>



                        <Separator />

                    <div className="space-y-2" data-testid="admin-v2-quiz-correct-field">
                      <Label>Correct answer</Label>
                      <Select value={quizDraft.correct_answer} onValueChange={(v) => setQuizDraft((s) => ({ ...s, correct_answer: v }))}>
                        <SelectTrigger data-testid="admin-v2-quiz-correct-select">
                          <SelectValue placeholder="Correct" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A" data-testid="admin-v2-quiz-correct-a">A</SelectItem>
                          <SelectItem value="B" data-testid="admin-v2-quiz-correct-b">B</SelectItem>
                          <SelectItem value="C" data-testid="admin-v2-quiz-correct-c">C</SelectItem>
                          <SelectItem value="D" data-testid="admin-v2-quiz-correct-d">D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-quiz-editor-actions">
                      {!quizState.selected ? (
                        <Button className="quest-primary" data-testid="admin-v2-quiz-create" onClick={createQuizQuestion}>
                          Create Question
                        </Button>
                      ) : (
                        <Button className="quest-primary" data-testid="admin-v2-quiz-save" onClick={updateQuizQuestion}>
                          Save Changes
                        </Button>
                      )}

                      {quizState.selected ? (
                        <Button variant="secondary" data-testid="admin-v2-quiz-delete" onClick={deleteQuizQuestion}>
                          Delete
                        </Button>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-500" data-testid="admin-v2-quiz-note">
                      These questions appear in the Candidate Portal only in Round 2.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="coding" className="mt-6" data-testid="admin-v2-coding-tab">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="admin-v2-coding-grid">
                <Card className="quest-card" data-testid="admin-v2-coding-problems-card">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle data-testid="admin-v2-coding-title">Coding tests</CardTitle>
                        <CardDescription data-testid="admin-v2-coding-desc">
                          Create coding problems from templates and assign them to hiring rounds.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2" data-testid="admin-v2-coding-actions">
                        <Button variant="secondary" data-testid="admin-v2-coding-refresh" onClick={loadCoding}>
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {codingState.error ? (
                      <div className="quest-error" data-testid="admin-v2-coding-error">
                        {codingState.error}
                      </div>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-4" data-testid="admin-v2-coding-content">
                    <div className="space-y-2" data-testid="admin-v2-coding-template">
                      <Label>Template</Label>
                      <Select value={codingDraft.template_id} onValueChange={(v) => setCodingDraft((s) => ({ ...s, template_id: v }))}>
                        <SelectTrigger data-testid="admin-v2-coding-template-select">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {codingState.templates.map((t) => (
                            <SelectItem key={t.template_id} value={t.template_id} data-testid={`admin-v2-coding-template-${t.template_id}`}>
                              {t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2" data-testid="admin-v2-coding-title-override">
                      <Label>Title override (optional)</Label>
                      <Input
                        value={codingDraft.title_override}
                        data-testid="admin-v2-coding-title-input"
                        onChange={(e) => setCodingDraft((s) => ({ ...s, title_override: e.target.value }))}
                        placeholder="E.g., Two Sum (Pixwik)"
                      />
                    </div>

                    <Button className="quest-primary" data-testid="admin-v2-coding-create" onClick={createCodingProblem}>
                      Create coding problem
                    </Button>

                    <Separator />

                    <div className="space-y-2" data-testid="admin-v2-coding-problem-select">
                      <Label>Existing coding problems</Label>
                      <Select value={codingState.selectedProblemId} onValueChange={(v) => setCodingState((s) => ({ ...s, selectedProblemId: v }))}>
                        <SelectTrigger data-testid="admin-v2-coding-problem-dropdown">
                          <SelectValue placeholder="Select coding problem" />
                        </SelectTrigger>
                        <SelectContent>
                          {codingState.problems.map((p) => (
                            <SelectItem key={p.problem_id} value={p.problem_id} data-testid={`admin-v2-coding-problem-${p.problem_id}`}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-slate-500" data-testid="admin-v2-coding-note">
                        Pick a problem then assign it to a round on the right.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="quest-card" data-testid="admin-v2-coding-assign-card">
                  <CardHeader>
                    <CardTitle data-testid="admin-v2-coding-assign-title">Assign to rounds</CardTitle>
                    <CardDescription data-testid="admin-v2-coding-assign-desc">
                      Rounds marked as coding will unlock the Coding Task button for candidates in that round.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3" data-testid="admin-v2-coding-assign-content">
                    {roundsState.rows.map((r) => (
                      <div key={r.round_id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900" data-testid={`admin-v2-coding-round-${r.round_id}`}>{r.round_name}</div>
                          <div className="text-xs text-slate-500" data-testid={`admin-v2-coding-round-meta-${r.round_id}`}>
                            {r.is_coding ? `Coding: ON (${r.coding_problem_id || "no problem"})` : "Coding: OFF"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.is_coding ? (
                            <Button size="sm" variant="secondary" data-testid={`admin-v2-coding-disable-${r.round_id}`} onClick={() => disableCodingForRound(r.round_id)}>
                              Disable
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" data-testid={`admin-v2-coding-assign-${r.round_id}`} onClick={() => assignCodingToRound(r.round_id)}>
                              Assign
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="applications" className="mt-6" data-testid="admin-v2-apps-tab">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="admin-v2-apps-grid">
                <Card className="quest-card" data-testid="admin-v2-apps-list-card">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle data-testid="admin-v2-apps-title">Applications</CardTitle>
                        <CardDescription data-testid="admin-v2-apps-desc">Newest first.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2" data-testid="admin-v2-apps-actions">
                        <Button variant="secondary" data-testid="admin-v2-apps-refresh" onClick={loadApplications}>
                          Refresh
                        </Button>
                        <Button variant="secondary" data-testid="admin-v2-apps-export" onClick={exportApplicationsCsv}>
                          Export CSV
                        </Button>
                      </div>
                    </div>

                    {appsState.csvUrl ? (
                      <a
                        href={appsState.csvUrl}
                        download={csvFilename}
                        className="quest-link"
                        data-testid="admin-v2-csv-download-link"
                      >
                        Download CSV
                      </a>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {appsState.error ? (
                      <div className="quest-error" data-testid="admin-v2-apps-error">
                        {appsState.error}
                      </div>
                    ) : null}

                    {appsState.rows.length === 0 ? (
                      <div className="text-sm text-slate-600" data-testid="admin-v2-apps-empty">
                        No applications yet.
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-200/70 overflow-hidden" data-testid="admin-v2-apps-table-wrapper">
                      <Table data-testid="admin-v2-apps-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="admin-v2-apps-th-name">Candidate</TableHead>
                            <TableHead data-testid="admin-v2-apps-th-email">Email</TableHead>
                            <TableHead data-testid="admin-v2-apps-th-job">Job</TableHead>
                            <TableHead data-testid="admin-v2-apps-th-persona">Persona</TableHead>
                            <TableHead data-testid="admin-v2-apps-th-xp">XP</TableHead>
                            <TableHead data-testid="admin-v2-apps-th-created">Created</TableHead>
                            <TableHead data-testid="admin-v2-apps-th-action" className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {appsState.rows.map((r) => (
                            <TableRow
                              key={r.id}
                              data-testid={`admin-v2-app-row-${r.id}`}
                              data-state={selectedApplication?.id === r.id ? "selected" : undefined}
                            >
                              <TableCell data-testid={`admin-v2-app-cell-name-${r.id}`} className="font-medium text-slate-900">
                                {r.name}
                              </TableCell>
                              <TableCell data-testid={`admin-v2-app-cell-email-${r.id}`} className="text-slate-700">
                                {r.email}
                              </TableCell>
                              <TableCell data-testid={`admin-v2-app-cell-job-${r.id}`}>
                                {r.job_slug ? (
                                  <Badge variant="secondary" data-testid={`admin-v2-app-job-${r.id}`}>
                                    {r.job_slug}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-slate-500" data-testid={`admin-v2-app-job-empty-${r.id}`}>
                                    —
                                  </span>
                                )}
                              </TableCell>

            <TabsContent value="audit" className="mt-6" data-testid="admin-v2-audit-tab">
              <Card className="quest-card" data-testid="admin-v2-audit-card">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle data-testid="admin-v2-audit-title">Audit logs</CardTitle>
                      <CardDescription data-testid="admin-v2-audit-desc">Track admin and candidate actions.</CardDescription>
                    </div>
                    <Button variant="secondary" data-testid="admin-v2-audit-refresh" onClick={loadAuditLogs}>
                      Refresh
                    </Button>
                  </div>

                  {auditState.error ? <div className="quest-error">{auditState.error}</div> : null}

                  <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-audit-filters">
                    <div className="min-w-[260px]">
                      <Select value={auditFilters.action} onValueChange={(v) => setAuditFilters((s) => ({ ...s, action: v }))}>
                        <SelectTrigger data-testid="admin-v2-audit-action-trigger">
                          <SelectValue placeholder="Filter by action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All actions</SelectItem>
                          <SelectItem value="candidate.promote">candidate.promote</SelectItem>
                          <SelectItem value="candidate.reject">candidate.reject</SelectItem>
                          <SelectItem value="candidate.finalize">candidate.finalize</SelectItem>
                          <SelectItem value="candidate.score">candidate.score</SelectItem>
                          <SelectItem value="candidate.bulk_promote">candidate.bulk_promote</SelectItem>
                          <SelectItem value="candidate.bulk_reject">candidate.bulk_reject</SelectItem>
                          <SelectItem value="candidate.bulk_finalize">candidate.bulk_finalize</SelectItem>
                          <SelectItem value="candidate.bulk_delete">candidate.bulk_delete</SelectItem>
                          <SelectItem value="admin.create_sub_admin">admin.create_sub_admin</SelectItem>
                          <SelectItem value="admin.disable_sub_admin">admin.disable_sub_admin</SelectItem>
                          <SelectItem value="admin.delete_sub_admin">admin.delete_sub_admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-[260px]">
                      <Select value={auditFilters.job_slug} onValueChange={(v) => setAuditFilters((s) => ({ ...s, job_slug: v }))}>
                        <SelectTrigger data-testid="admin-v2-audit-job-trigger">
                          <SelectValue placeholder="Filter by job" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All jobs</SelectItem>
                          {jobsState.rows
                            .filter((j) => j.slug)
                            .map((j) => (
                              <SelectItem key={j.id} value={j.slug}>
                                {j.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button variant="secondary" data-testid="admin-v2-audit-apply" onClick={loadAuditLogs}>
                      Apply
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="rounded-xl border border-slate-200/70 overflow-hidden">
                    <Table data-testid="admin-v2-audit-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>At</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Job</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditState.rows.map((r) => (
                          <TableRow key={r.log_id} data-testid={`admin-v2-audit-row-${r.log_id}`}>
                            <TableCell className="text-slate-700">{formatDateTime(r.at)}</TableCell>
                            <TableCell className="font-mono text-xs text-slate-900">{r.action}</TableCell>
                            <TableCell className="text-slate-900">{r.actor}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{r.actor_role}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700">{r.candidate_id || "—"}</TableCell>
                            <TableCell className="text-slate-700">{r.job_slug || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {auditState.status === "loading" ? <div className="text-xs text-slate-500 mt-2">Loading…</div> : null}
                  {auditState.rows.length === 0 && auditState.status !== "loading" ? (
                    <div className="text-xs text-slate-500 mt-2">No logs yet.</div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
                              <TableCell data-testid={`admin-v2-app-cell-persona-${r.id}`}>
                                <Badge variant="secondary" data-testid={`admin-v2-app-persona-${r.id}`}>
                                  {r.persona}
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-app-cell-xp-${r.id}`}>
                                <Badge variant="secondary" data-testid={`admin-v2-app-xp-${r.id}`}>
                                  {r.xp} XP
                                </Badge>
                              </TableCell>
                              <TableCell data-testid={`admin-v2-app-cell-created-${r.id}`} className="text-xs text-slate-500">
                                {formatDateTime(r.created_at)}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`admin-v2-app-cell-action-${r.id}`}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  data-testid={`admin-v2-app-open-${r.id}`}
                                  onClick={() => openApplicationDetails(r.id)}
                                >
                                  Open
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="quest-card" data-testid="admin-v2-app-details-card">
                  <CardHeader>
                    <CardTitle data-testid="admin-v2-app-details-title">Details</CardTitle>
                    <CardDescription data-testid="admin-v2-app-details-desc">
                      Open an application to view details and download resume.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedApplication ? (
                      <div className="text-sm text-slate-600" data-testid="admin-v2-app-details-empty">
                        Select an application from the list.
                      </div>
                    ) : (
                      <div className="space-y-4" data-testid="admin-v2-app-details">
                        <div className="flex flex-wrap items-center gap-2" data-testid="admin-v2-app-details-badges">
                          <Badge className="quest-badge" data-testid="admin-v2-app-details-persona">
                            {selectedApplication.persona}
                          </Badge>
                          <Badge variant="secondary" data-testid="admin-v2-app-details-xp">
                            {selectedApplication.xp} XP
                          </Badge>
                          <Badge variant="secondary" data-testid="admin-v2-app-details-created">
                            {formatDateTime(selectedApplication.created_at)}
                          </Badge>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-app-details-grid">
                          <div data-testid="admin-v2-app-details-name">
                            <div className="text-xs text-slate-500">Name</div>
                            <div className="font-medium text-slate-900">{selectedApplication.name}</div>
                          </div>
                          <div data-testid="admin-v2-app-details-email">
                            <div className="text-xs text-slate-500">Email</div>
                            <div className="font-medium text-slate-900">{selectedApplication.email}</div>
                          </div>
                          <div data-testid="admin-v2-app-details-phone">
                            <div className="text-xs text-slate-500">Phone</div>
                            <div className="font-medium text-slate-900">{selectedApplication.phone}</div>
                          </div>
                          <div data-testid="admin-v2-app-details-college">
                            <div className="text-xs text-slate-500">College</div>
                            <div className="font-medium text-slate-900">{selectedApplication.college}</div>
                          </div>
                          <div data-testid="admin-v2-app-details-grad-year">
                            <div className="text-xs text-slate-500">Grad year</div>
                            <div className="font-medium text-slate-900">{selectedApplication.grad_year}</div>
                          </div>
                          <div data-testid="admin-v2-app-details-skills">
                            <div className="text-xs text-slate-500">Skills</div>
                            <div className="font-medium text-slate-900">{(selectedApplication.skills || []).join(", ")}</div>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2" data-testid="admin-v2-app-details-projects">
                          <div className="text-xs text-slate-500">Projects</div>
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">{selectedApplication.projects}</div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="admin-v2-app-details-strengths-weaknesses">
                          <div data-testid="admin-v2-app-details-strengths">
                            <div className="text-xs text-slate-500">Strengths</div>
                            <ul className="list-disc pl-5 text-sm text-slate-800">
                              {(selectedApplication.strengths || []).map((s, idx) => (
                                <li key={`${idx}-${s}`} data-testid={`admin-v2-strength-${idx}`}>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div data-testid="admin-v2-app-details-weaknesses">
                            <div className="text-xs text-slate-500">Growth zones</div>
                            <ul className="list-disc pl-5 text-sm text-slate-800">
                              {(selectedApplication.weaknesses || []).map((w, idx) => (
                                <li key={`${idx}-${w}`} data-testid={`admin-v2-weakness-${idx}`}>
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex flex-wrap items-center justify-between gap-3" data-testid="admin-v2-app-details-actions">
                          {downloadResumeHref ? (
                            <a
                              href={downloadResumeHref}
                              target="_blank"
                              rel="noreferrer"
                              className="quest-link"
                              data-testid="admin-v2-resume-download-link"
                            >
                              Download resume
                            </a>
                          ) : null}

                          <div className="text-xs text-slate-500" data-testid="admin-v2-application-id">
                            ID: <span className="font-mono">{selectedApplication.id}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>


            {adminRole === "super_admin" ? (
              <TabsContent value="admins" className="mt-6" data-testid="admin-v2-admins-tab">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="admin-v2-admins-grid">
                  <Card className="quest-card" data-testid="admin-v2-admins-create-card">
                    <CardHeader>
                      <CardTitle data-testid="admin-v2-admins-create-title">Create sub-admin</CardTitle>
                      <CardDescription data-testid="admin-v2-admins-create-desc">
                        Sub-admins can do everything except manage other admins.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {adminsState.error ? <div className="quest-error">{typeof adminsState.error === "string" ? adminsState.error : JSON.stringify(adminsState.error)}</div> : null}
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={adminDraft.username}
                          onChange={(e) => setAdminDraft((s) => ({ ...s, username: e.target.value }))}
                          placeholder="e.g. reviewer1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={adminDraft.password}
                          onChange={(e) => setAdminDraft((s) => ({ ...s, password: e.target.value }))}
                          placeholder="Set a password"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button className="quest-primary" data-testid="admin-v2-admins-create" onClick={createSubAdmin}>
                          Create
                        </Button>
                        <Button variant="secondary" data-testid="admin-v2-admins-refresh" onClick={loadSubAdmins}>
                          Refresh
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="quest-card" data-testid="admin-v2-admins-list-card">
                    <CardHeader>
                      <CardTitle data-testid="admin-v2-admins-list-title">Sub-admins</CardTitle>
                      <CardDescription data-testid="admin-v2-admins-list-desc">Enable/disable or delete sub-admins.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-xl border border-slate-200/70 overflow-hidden">
                        <Table data-testid="admin-v2-admins-table">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Username</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(Array.isArray(adminsState.rows) ? adminsState.rows : []).map((a) => (
                              <TableRow key={a.username} data-testid={`admin-v2-admin-row-${a.username}`}>
                                <TableCell className="font-medium">{a.username}</TableCell>
                                <TableCell className="text-slate-700">{formatDateTime(a.created_at)}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{a.disabled ? "Disabled" : "Active"}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="secondary" disabled={a.disabled} onClick={() => disableSubAdmin(a.username)}>
                                      Disable
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => deleteSubAdmin(a.username)}>
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {(Array.isArray(adminsState.rows) ? adminsState.rows : []).length === 0 ? <div className="text-sm text-slate-600">No sub-admins created yet.</div> : null}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ) : null}

          </Tabs>
        )}
      </main>
    </div>
  );
}

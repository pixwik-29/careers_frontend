import React from "react";
import "@/App.css";

import { BrowserRouter, Route, Routes } from "react-router-dom";

import JobsBoard from "@/pages/JobsBoard";
import JobPosting from "@/pages/JobPosting";
import DeveloperQuest from "@/pages/DeveloperQuest";
import CandidatePortal from "@/pages/CandidatePortal";
import CandidateQuiz from "@/pages/CandidateQuiz";
import CandidateCoding from "@/pages/CandidateCoding";
import AdminPanelV2 from "@/pages/AdminPanelV2";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <div className="app-root" data-testid="app-root">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<JobsBoard />} />
          <Route path="/jobs/:slug" element={<JobPosting />} />
          <Route path="/quest" element={<DeveloperQuest />} />
          <Route path="/candidate" element={<CandidatePortal />} />
          <Route path="/candidate/quiz" element={<CandidateQuiz />} />
          <Route path="/candidate/coding" element={<CandidateCoding />} />
          <Route path="/admin" element={<AdminPanelV2 />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

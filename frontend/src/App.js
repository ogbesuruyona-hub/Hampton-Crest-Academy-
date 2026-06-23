import React, { lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import PublicLanding from "@/pages/PublicLanding";
import AccessDenied from "@/pages/AccessDenied";
import AcceptInvite from "@/pages/AcceptInvite";
import ResetPassword from "@/pages/ResetPassword";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const BooksLibrary = lazy(() => import("@/pages/BooksLibrary"));
const BookDetail = lazy(() => import("@/pages/BookDetail"));
const ResearchLibrary = lazy(() => import("@/pages/ResearchLibrary"));
const ResearchDetail = lazy(() => import("@/pages/ResearchDetail"));
const InvestmentEducation = lazy(() => import("@/pages/InvestmentEducation"));
const EducationDetail = lazy(() => import("@/pages/EducationDetail"));
const MonthlyReports = lazy(() => import("@/pages/MonthlyReports"));
const ReportDetail = lazy(() => import("@/pages/ReportDetail"));
const CompanyAnalysis = lazy(() => import("@/pages/CompanyAnalysis"));
const CompanyDetail = lazy(() => import("@/pages/CompanyDetail"));
const AssetValuation = lazy(() => import("@/pages/AssetValuation"));
const SavedResources = lazy(() => import("@/pages/SavedResources"));
const Settings = lazy(() => import("@/pages/Settings"));
const MemberProfile = lazy(() => import("@/pages/MemberProfile"));
const MemberDirectory = lazy(() => import("@/pages/MemberDirectory"));
const SearchResults = lazy(() => import("@/pages/SearchResults"));
const AdminMembers = lazy(() => import("@/pages/AdminMembers"));

const PageLoader = () => (
  <div className="px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border border-[var(--hc-border)] bg-[var(--hc-surface)]/50 p-6 sm:p-8">
        <div className="h-3 w-32 animate-pulse bg-[var(--hc-surface-elevated)]" />
        <div className="mt-5 h-8 w-full max-w-lg animate-pulse bg-[var(--hc-surface-elevated)]" />
        <div className="mt-4 h-4 w-full max-w-2xl animate-pulse bg-[var(--hc-surface-elevated)]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 animate-pulse border border-[var(--hc-border)] bg-[var(--hc-surface)]/50" />
        <div className="h-32 animate-pulse border border-[var(--hc-border)] bg-[var(--hc-surface)]/50" />
        <div className="h-32 animate-pulse border border-[var(--hc-border)] bg-[var(--hc-surface)]/50" />
      </div>
    </div>
  </div>
);

const withLoader = (page) => <Suspense fallback={<PageLoader />}>{page}</Suspense>;

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicLanding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={withLoader(<Dashboard />)} />
              <Route path="/books" element={withLoader(<BooksLibrary />)} />
              <Route path="/books/:id" element={withLoader(<BookDetail />)} />
              <Route path="/research" element={withLoader(<ResearchLibrary />)} />
              <Route path="/research/:id" element={withLoader(<ResearchDetail />)} />
              <Route path="/education" element={withLoader(<InvestmentEducation />)} />
              <Route path="/education/:id" element={withLoader(<EducationDetail />)} />
              <Route path="/reports" element={withLoader(<MonthlyReports />)} />
              <Route path="/reports/:id" element={withLoader(<ReportDetail />)} />
              <Route path="/companies" element={withLoader(<CompanyAnalysis />)} />
              <Route path="/companies/:id" element={withLoader(<CompanyDetail />)} />
              <Route path="/valuation" element={withLoader(<AssetValuation />)} />
              <Route path="/saved" element={withLoader(<SavedResources />)} />
              <Route path="/settings" element={withLoader(<Settings />)} />
              <Route path="/profile" element={withLoader(<MemberProfile />)} />
              <Route path="/directory" element={withLoader(<MemberDirectory />)} />
              <Route path="/search" element={withLoader(<SearchResults />)} />
              <Route path="/admin/members" element={withLoader(<AdminMembers />)} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster theme="dark" position="bottom-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ResearchLibrary from "@/pages/ResearchLibrary";
import ResearchDetail from "@/pages/ResearchDetail";
import InvestmentEducation from "@/pages/InvestmentEducation";
import EducationDetail from "@/pages/EducationDetail";
import MonthlyReports from "@/pages/MonthlyReports";
import ReportDetail from "@/pages/ReportDetail";
import CompanyAnalysis from "@/pages/CompanyAnalysis";
import CompanyDetail from "@/pages/CompanyDetail";
import SavedResources from "@/pages/SavedResources";
import Settings from "@/pages/Settings";
import MemberProfile from "@/pages/MemberProfile";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/research" element={<ResearchLibrary />} />
              <Route path="/research/:id" element={<ResearchDetail />} />
              <Route path="/education" element={<InvestmentEducation />} />
              <Route path="/education/:id" element={<EducationDetail />} />
              <Route path="/reports" element={<MonthlyReports />} />
              <Route path="/reports/:id" element={<ReportDetail />} />
              <Route path="/companies" element={<CompanyAnalysis />} />
              <Route path="/companies/:id" element={<CompanyDetail />} />
              <Route path="/saved" element={<SavedResources />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<MemberProfile />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster theme="dark" position="bottom-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

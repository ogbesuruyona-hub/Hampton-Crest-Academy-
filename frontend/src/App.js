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
import InvestmentEducation from "@/pages/InvestmentEducation";
import MonthlyReports from "@/pages/MonthlyReports";
import CompanyAnalysis from "@/pages/CompanyAnalysis";
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
              <Route path="/education" element={<InvestmentEducation />} />
              <Route path="/reports" element={<MonthlyReports />} />
              <Route path="/companies" element={<CompanyAnalysis />} />
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

import React from "react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { Bookmark } from "lucide-react";

export default function SavedResources() {
  return (
    <div data-testid="saved-page">
      <PageHeader
        overline="Members Suite · Library"
        title="Saved Resources"
        description="Your personal archive — research notes, modules, and reports you've marked to revisit."
      />

      <EmptyState
        icon={Bookmark}
        title="Nothing saved yet"
        description="Bookmark any research note, education module, or report. Your selections will appear here for quick reference."
      />
    </div>
  );
}

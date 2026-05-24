import React from "react";
import { ContentDetailView } from "../components/ContentDetailView";
import { ContentEditorDialog } from "../components/ContentEditorDialog";

export default function EducationDetail() {
  return <ContentDetailView contentType="education" EditorComponent={ContentEditorDialog} />;
}

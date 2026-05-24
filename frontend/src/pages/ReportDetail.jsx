import React from "react";
import { ContentDetailView } from "../components/ContentDetailView";
import { ContentEditorDialog } from "../components/ContentEditorDialog";

export default function ReportDetail() {
  return <ContentDetailView contentType="reports" EditorComponent={ContentEditorDialog} />;
}

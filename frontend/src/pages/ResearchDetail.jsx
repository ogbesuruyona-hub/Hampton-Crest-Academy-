import React from "react";
import { ContentDetailView } from "../components/ContentDetailView";
import { ContentEditorDialog } from "../components/ContentEditorDialog";

export default function ResearchDetail() {
  return <ContentDetailView contentType="research" EditorComponent={ContentEditorDialog} />;
}

// DEPRECATED: This file is no longer used in the application.
// The application now uses a hierarchical materials structure.
// See materials-hierarchy-store.ts for the new implementation.

export interface StudyMaterial {
  id: string;
  title: string;
  subject: string;
  unit: string;
  semester: string;
  pdfUrl: string;
  uploadedDate: string;
}
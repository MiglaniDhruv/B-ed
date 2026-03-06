import { studentPermissionsStore, StudentPermission } from "./student-permissions-data";

export function seedDemoData() {
  // Check if demo data already exists
  const existingStudents = studentPermissionsStore.getAllStudents();
  if (existingStudents.length > 0) {
    return; // Demo data already seeded
  }

  // Create demo students
  const demoStudents: StudentPermission[] = [
    {
      id: "demo-1",
      name: "John Smith",
      email: "john.smith@student.edu",
      enrollmentNumber: "ENR2024001",
      semester: "3",
      status: "pending",
      requestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    },
    {
      id: "demo-2",
      name: "Emily Johnson",
      email: "emily.johnson@student.edu",
      enrollmentNumber: "ENR2024002",
      semester: "2",
      status: "approved",
      requestDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      approvedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    },
    {
      id: "demo-3",
      name: "Michael Davis",
      email: "michael.davis@student.edu",
      enrollmentNumber: "ENR2024003",
      semester: "1",
      status: "pending",
      requestDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
  ];

  // Add demo students
  demoStudents.forEach((student) => {
    studentPermissionsStore.addStudent(student);
  });

  console.log("Demo data seeded successfully!");
}

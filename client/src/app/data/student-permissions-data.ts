export interface StudentPermission {
  id: string;
  name: string;
  email: string;
  enrollmentNumber: string;
  semester: string;
  status: "pending" | "approved" | "blocked";
  requestDate: string;
  approvedDate?: string;
}

class StudentPermissionsStore {
  private storageKey = "studentPermissions";

  getAllStudents(): StudentPermission[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  addStudent(student: StudentPermission): void {
    const students = this.getAllStudents();
    students.push(student);
    localStorage.setItem(this.storageKey, JSON.stringify(students));
  }

  updateStudentStatus(id: string, status: "pending" | "approved" | "blocked"): void {
    const students = this.getAllStudents().map((s) =>
      s.id === id ? { ...s, status, approvedDate: status === "approved" ? new Date().toISOString() : s.approvedDate } : s
    );
    localStorage.setItem(this.storageKey, JSON.stringify(students));
  }

  deleteStudent(id: string): void {
    const students = this.getAllStudents().filter((s) => s.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(students));
  }

  getStatusCounts() {
    const students = this.getAllStudents();
    return {
      total: students.length,
      pending: students.filter((s) => s.status === "pending").length,
      approved: students.filter((s) => s.status === "approved").length,
      blocked: students.filter((s) => s.status === "blocked").length,
    };
  }

  // Check if student is approved and can login
  isStudentApproved(email: string): boolean {
    const student = this.getAllStudents().find(
      (s) => s.email.toLowerCase() === email.toLowerCase()
    );
    return student?.status === "approved";
  }

  // Get student by email
  getStudentByEmail(email: string): StudentPermission | undefined {
    return this.getAllStudents().find(
      (s) => s.email.toLowerCase() === email.toLowerCase()
    );
  }
}

export const studentPermissionsStore = new StudentPermissionsStore();
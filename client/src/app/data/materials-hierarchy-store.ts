// Materials Hierarchy Data Store

export interface Material {
  id: string;
  title: string;
  pdfUrl: string;
  uploadedDate: string;
}

export interface Chapter {
  id: string;
  name: string;
  materials: Material[];
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export interface Semester {
  id: string;
  name: string;
  subjects: Subject[];
}

class MaterialsHierarchyStore {
  private readonly STORAGE_KEY = 'materials_hierarchy_store';

  private getSemesters(): Semester[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading materials hierarchy:', error);
    }
    return this.getDefaultSemesters();
  }

  private getDefaultSemesters(): Semester[] {
    return [
      { id: '1', name: 'Semester 1', subjects: [] },
      { id: '2', name: 'Semester 2', subjects: [] },
      { id: '3', name: 'Semester 3', subjects: [] },
      { id: '4', name: 'Semester 4', subjects: [] },
    ];
  }

  private saveSemesters(semesters: Semester[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(semesters));
    } catch (error) {
      console.error('Error saving materials hierarchy:', error);
    }
  }

  getAllSemesters(): Semester[] {
    return this.getSemesters();
  }

  getSemester(semesterId: string): Semester | undefined {
    const semesters = this.getSemesters();
    return semesters.find(s => s.id === semesterId);
  }

  // Subject operations
  addSubject(semesterId: string, subjectName: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const newSubject: Subject = {
        id: `subject-${Date.now()}`,
        name: subjectName,
        chapters: []
      };
      semester.subjects.push(newSubject);
      this.saveSemesters(semesters);
    }
  }

  updateSubject(semesterId: string, subjectId: string, newName: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        subject.name = newName;
        this.saveSemesters(semesters);
      }
    }
  }

  deleteSubject(semesterId: string, subjectId: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      semester.subjects = semester.subjects.filter(s => s.id !== subjectId);
      this.saveSemesters(semesters);
    }
  }

  // Chapter operations
  addChapter(semesterId: string, subjectId: string, chapterName: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        const newChapter: Chapter = {
          id: `chapter-${Date.now()}`,
          name: chapterName,
          materials: []
        };
        subject.chapters.push(newChapter);
        this.saveSemesters(semesters);
      }
    }
  }

  updateChapter(semesterId: string, subjectId: string, chapterId: string, newName: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        const chapter = subject.chapters.find(c => c.id === chapterId);
        if (chapter) {
          chapter.name = newName;
          this.saveSemesters(semesters);
        }
      }
    }
  }

  deleteChapter(semesterId: string, subjectId: string, chapterId: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        subject.chapters = subject.chapters.filter(c => c.id !== chapterId);
        this.saveSemesters(semesters);
      }
    }
  }

  // Material operations
  addMaterial(semesterId: string, subjectId: string, chapterId: string, material: Omit<Material, 'id'>): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        const chapter = subject.chapters.find(c => c.id === chapterId);
        if (chapter) {
          const newMaterial: Material = {
            id: `material-${Date.now()}`,
            ...material
          };
          chapter.materials.push(newMaterial);
          this.saveSemesters(semesters);
        }
      }
    }
  }

  updateMaterial(semesterId: string, subjectId: string, chapterId: string, materialId: string, updates: Partial<Material>): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        const chapter = subject.chapters.find(c => c.id === chapterId);
        if (chapter) {
          const material = chapter.materials.find(m => m.id === materialId);
          if (material) {
            Object.assign(material, updates);
            this.saveSemesters(semesters);
          }
        }
      }
    }
  }

  deleteMaterial(semesterId: string, subjectId: string, chapterId: string, materialId: string): void {
    const semesters = this.getSemesters();
    const semester = semesters.find(s => s.id === semesterId);
    if (semester) {
      const subject = semester.subjects.find(s => s.id === subjectId);
      if (subject) {
        const chapter = subject.chapters.find(c => c.id === chapterId);
        if (chapter) {
          chapter.materials = chapter.materials.filter(m => m.id !== materialId);
          this.saveSemesters(semesters);
        }
      }
    }
  }

  // Statistics
  getTotalMaterialsCount(): number {
    const semesters = this.getSemesters();
    let count = 0;
    semesters.forEach(sem => {
      sem.subjects.forEach(sub => {
        sub.chapters.forEach(ch => {
          count += ch.materials.length;
        });
      });
    });
    return count;
  }
}

export const materialsHierarchyStore = new MaterialsHierarchyStore();

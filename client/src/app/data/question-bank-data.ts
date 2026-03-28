export interface QuestionBankItem {
  id: string;
  questionText: string;
  options: { text: string; isCorrect: boolean }[];
  marks: number;
  subject: string;
  semester: string;
  difficulty?: string;
  quizTitle?: string;
  createdDate: string;
  negativeMarking?: boolean;
  shuffleOptions?: boolean;
  showCorrectAnswer?: boolean;
}

class QuestionBankStore {
  private storageKey = "questionBank";

  private cleanupDuplicates(questions: QuestionBankItem[]): QuestionBankItem[] {
    const seenIds = new Set<string>();
    const cleaned: QuestionBankItem[] = [];

    questions.forEach((question) => {
      if (seenIds.has(question.id)) {
        // Generate a new unique ID for duplicate
        const newId = `qb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        cleaned.push({ ...question, id: newId });
        seenIds.add(newId);
      } else {
        cleaned.push(question);
        seenIds.add(question.id);
      }
    });

    return cleaned;
  }

  getAllQuestions(): QuestionBankItem[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(this.storageKey);
    const questions = data ? JSON.parse(data) : [];
    
    // Clean up duplicates
    const cleaned = this.cleanupDuplicates(questions);
    
    // Save cleaned data if duplicates were found
    if (cleaned.length !== questions.length || 
        JSON.stringify(cleaned) !== JSON.stringify(questions)) {
      localStorage.setItem(this.storageKey, JSON.stringify(cleaned));
    }
    
    return cleaned;
  }

  addQuestion(question: QuestionBankItem): void {
    const questions = this.getAllQuestions();
    questions.push(question);
    localStorage.setItem(this.storageKey, JSON.stringify(questions));
  }

  deleteQuestion(id: string): void {
    const questions = this.getAllQuestions().filter((q) => q.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(questions));
  }

  getQuestionsBySubject(subject: string): QuestionBankItem[] {
    return this.getAllQuestions().filter((q) => q.subject === subject);
  }

  getQuestionsBySemester(semester: string): QuestionBankItem[] {
    return this.getAllQuestions().filter((q) => q.semester === semester);
  }
}

export const questionBankStore = new QuestionBankStore();
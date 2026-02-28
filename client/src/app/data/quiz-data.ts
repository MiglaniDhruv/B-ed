export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  duration: number;
  questions: QuizQuestion[];
  totalMarks: number;
  passingMarks: number;
  createdAt: string;
  status: 'draft' | 'published';
}

class QuizDataStore {
  private storageKey = "quizzes";

  getAllQuizzes(): Quiz[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  addQuiz(quiz: Quiz): void {
    const quizzes = this.getAllQuizzes();
    quizzes.push(quiz);
    localStorage.setItem(this.storageKey, JSON.stringify(quizzes));
  }

  updateQuiz(quiz: Quiz): void {
    const quizzes = this.getAllQuizzes();
    const index = quizzes.findIndex((q) => q.id === quiz.id);
    if (index !== -1) {
      quizzes[index] = quiz;
      localStorage.setItem(this.storageKey, JSON.stringify(quizzes));
    }
  }

  deleteQuiz(id: string): void {
    const quizzes = this.getAllQuizzes().filter((q) => q.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(quizzes));
  }

  getQuizById(id: string): Quiz | undefined {
    return this.getAllQuizzes().find((q) => q.id === id);
  }
}

export const quizDataStore = new QuizDataStore();

import { getFirestore } from "./firebase.js";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  const db = getFirestore();

  const catsSnap = await db.collection("categories").limit(1).get();
  if (!catsSnap.empty) return;

  const adminPassword = await bcrypt.hash("admin123", 12);
  const studentPassword = await bcrypt.hash("student123", 12);
  const now = new Date();

  await Promise.all([
    db.collection("users").doc().set({ username: "admin", email: "admin@bed.com", password: adminPassword, displayName: "Admin", avatarUrl: null, darkMode: false, createdAt: now }),
    db.collection("users").doc().set({ username: "student", email: "student@bed.com", password: studentPassword, displayName: "Demo Student", avatarUrl: null, darkMode: false, createdAt: now }),
  ]);

  const sem1Ref = db.collection("semesters").doc();
  const sem2Ref = db.collection("semesters").doc();
  const sem3Ref = db.collection("semesters").doc();
  const sem4Ref = db.collection("semesters").doc();
  

  await Promise.all([
    sem1Ref.set({ number: 1, title: "Semester 1", description: "First semester subjects and courses", order: 1 }),
    sem2Ref.set({ number: 2, title: "Semester 2", description: "Second semester subjects and courses", order: 2 }),
    sem3Ref.set({ number: 3, title: "Semester 3", description: "Third semester subjects and courses", order: 3 }),
    sem4Ref.set({ number: 4, title: "Semester 4", description: "Fourth semester subjects and courses", order: 4 }),
  ]);

  const cat1Ref = db.collection("categories").doc();
  const cat2Ref = db.collection("categories").doc();
  const cat3Ref = db.collection("categories").doc();
  const cat4Ref = db.collection("categories").doc();

  await Promise.all([
    cat1Ref.set({ semesterId: sem1Ref.id, name: "Childhood & Growing Up", description: "Understanding child development and growth", icon: "CG", color: "#3B82F6", order: 1 }),
    cat2Ref.set({ semesterId: sem1Ref.id, name: "Assessment for Learning", description: "Methods and strategies of assessment", icon: "AL", color: "#8B5CF6", order: 2 }),
    cat3Ref.set({ semesterId: sem2Ref.id, name: "ICT in Education", description: "Technology integration in teaching", icon: "IT", color: "#10B981", order: 3 }),
    cat4Ref.set({ semesterId: sem2Ref.id, name: "Language Across Curriculum", description: "Language development strategies", icon: "LC", color: "#F59E0B", order: 4 }),
  ]);

  const unitRefs = [
    { categoryId: cat1Ref.id, title: "Understanding Childhood", description: "Explore concepts and theories of childhood development", order: 1 },
    { categoryId: cat1Ref.id, title: "Developmental Stages", description: "Learn about physical, cognitive, and social development stages", order: 2 },
    { categoryId: cat1Ref.id, title: "Learning Theories", description: "Key theories of learning and their applications", order: 3 },
    { categoryId: cat1Ref.id, title: "Socialization Process", description: "Understanding how children learn social behaviors", order: 4 },
    { categoryId: cat2Ref.id, title: "Formative Assessment", description: "Continuous assessment techniques for learning improvement", order: 1 },
    { categoryId: cat2Ref.id, title: "Summative Assessment", description: "End-of-term evaluation methods and strategies", order: 2 },
    { categoryId: cat3Ref.id, title: "Digital Literacy", description: "Basic digital skills for educators", order: 1 },
    { categoryId: cat3Ref.id, title: "Educational Tools", description: "Using technology tools in classroom settings", order: 2 },
    { categoryId: cat4Ref.id, title: "Language Acquisition", description: "How children acquire language skills", order: 1 },
    { categoryId: cat4Ref.id, title: "Multilingual Education", description: "Teaching in multilingual classroom environments", order: 2 },
  ];

  await Promise.all(unitRefs.map(u => db.collection("units").doc().set(u)));

  const quiz1Ref = db.collection("quizzes").doc();
  const quiz2Ref = db.collection("quizzes").doc();
  const quiz3Ref = db.collection("quizzes").doc();
  const quiz4Ref = db.collection("quizzes").doc();
  const quiz5Ref = db.collection("quizzes").doc();

  await Promise.all([
    quiz1Ref.set({ categoryId: cat1Ref.id, title: "Child Development Basics", description: "Test your knowledge of child development stages", duration: 15, totalMarks: 10, isActive: true, createdAt: now }),
    quiz2Ref.set({ categoryId: cat1Ref.id, title: "Understanding Childhood - Complete Test", description: "Comprehensive test on childhood concepts", duration: 30, totalMarks: 20, isActive: true, createdAt: now }),
    quiz3Ref.set({ categoryId: cat2Ref.id, title: "Assessment Methods Quiz", description: "Test on various assessment methods", duration: 20, totalMarks: 15, isActive: true, createdAt: now }),
    quiz4Ref.set({ categoryId: cat3Ref.id, title: "ICT in Education - Complete Test", description: "Comprehensive test on ICT concepts", duration: 30, totalMarks: 20, isActive: true, createdAt: now }),
    quiz5Ref.set({ categoryId: cat4Ref.id, title: "Language Skills Assessment", description: "Evaluate language development understanding", duration: 20, totalMarks: 15, isActive: true, createdAt: now }),
  ]);

  const questionData = [
    { quizId: quiz1Ref.id, questionText: "Which psychologist proposed the theory of cognitive development?", options: ["Sigmund Freud", "Jean Piaget", "B.F. Skinner", "Erik Erikson"], correctAnswer: 1, explanation: "Jean Piaget is known for his theory of cognitive development in children.", order: 1 },
    { quizId: quiz1Ref.id, questionText: "At what age does the formal operational stage begin according to Piaget?", options: ["7 years", "11 years", "2 years", "5 years"], correctAnswer: 1, explanation: "The formal operational stage begins around age 11 and continues into adulthood.", order: 2 },
    { quizId: quiz1Ref.id, questionText: "What is Vygotsky's Zone of Proximal Development?", options: ["Area where child can learn independently", "Gap between what a child can do alone and with help", "Stage of physical development", "Type of assessment method"], correctAnswer: 1, explanation: "ZPD refers to the difference between what a learner can do without help and what they can achieve with guidance.", order: 3 },
    { quizId: quiz1Ref.id, questionText: "Which of the following is NOT a stage in Piaget's theory?", options: ["Sensorimotor", "Pre-operational", "Concrete operational", "Social operational"], correctAnswer: 3, explanation: "Social operational is not one of Piaget's stages.", order: 4 },
    { quizId: quiz1Ref.id, questionText: "Erik Erikson's theory focuses on which aspect of development?", options: ["Cognitive development", "Physical development", "Psychosocial development", "Language development"], correctAnswer: 2, explanation: "Erikson's theory focuses on psychosocial development across the lifespan.", order: 5 },
    { quizId: quiz1Ref.id, questionText: "What does 'nature vs nurture' debate refer to?", options: ["Indoor vs outdoor learning", "Genetics vs environment in development", "Teaching methods comparison", "Rural vs urban education"], correctAnswer: 1, explanation: "The nature vs nurture debate considers whether genetics or environmental factors have greater influence on development.", order: 6 },
    { quizId: quiz1Ref.id, questionText: "Kohlberg's theory of moral development has how many stages?", options: ["4 stages", "5 stages", "6 stages", "8 stages"], correctAnswer: 2, explanation: "Kohlberg identified 6 stages grouped into 3 levels of moral development.", order: 7 },
    { quizId: quiz1Ref.id, questionText: "What is 'scaffolding' in education?", options: ["Building physical structures", "Temporary support to help learners achieve goals", "A type of punishment", "Classroom furniture arrangement"], correctAnswer: 1, explanation: "Scaffolding is the temporary support provided to learners to help them achieve tasks they cannot do independently.", order: 8 },
    { quizId: quiz1Ref.id, questionText: "Which theorist introduced the concept of 'multiple intelligences'?", options: ["Howard Gardner", "Daniel Goleman", "Robert Sternberg", "Alfred Binet"], correctAnswer: 0, explanation: "Howard Gardner proposed the theory of multiple intelligences in 1983.", order: 9 },
    { quizId: quiz1Ref.id, questionText: "What is attachment theory primarily associated with?", options: ["Jean Piaget", "John Bowlby", "Lev Vygotsky", "Maria Montessori"], correctAnswer: 1, explanation: "John Bowlby is primarily associated with attachment theory.", order: 10 },
  ];

  await Promise.all(questionData.map(q => db.collection("questions").doc().set(q)));

  const materialData = [
    { categoryId: cat1Ref.id, title: "Child Development - Complete Notes", description: "Comprehensive notes on child development theories", fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", fileType: "pdf", createdAt: now },
    { categoryId: cat1Ref.id, title: "Piaget's Theory Summary", description: "Summary of Piaget's cognitive development stages", fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", fileType: "pdf", createdAt: now },
    { categoryId: cat2Ref.id, title: "Assessment Strategies Guide", description: "Guide to formative and summative assessments", fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", fileType: "pdf", createdAt: now },
    { categoryId: cat3Ref.id, title: "ICT Integration Handbook", description: "How to integrate ICT in classroom teaching", fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", fileType: "pdf", createdAt: now },
    { categoryId: cat4Ref.id, title: "Language Development Notes", description: "Notes on language acquisition and development", fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", fileType: "pdf", createdAt: now },
  ];

  await Promise.all(materialData.map(m => db.collection("studyMaterials").doc().set(m)));

  console.log("Firestore seeded successfully");
}

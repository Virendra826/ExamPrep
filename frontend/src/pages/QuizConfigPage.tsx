import React from "react";
import { QuizConfigForm } from "../features/quiz-config/QuizConfigForm";

export const QuizConfigPage: React.FC = () => {
  return (
    <main className="min-h-[calc(100vh-4rem)] py-8">
      <QuizConfigForm />
    </main>
  );
};

export default QuizConfigPage;

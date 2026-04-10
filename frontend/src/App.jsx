import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import PreAssessmentPage from './pages/PreAssessmentPage';
import LearningPage from './pages/LearningPage';
import PostAssessmentPage from './pages/PostAssessmentPage';
import ResultsPage from './pages/ResultsPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import MaterialSummaryPage from './pages/MaterialSummaryPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/materials/:id" element={<MaterialSummaryPage />} />
          <Route path="/session/:sessionId/pre-test" element={<PreAssessmentPage />} />
          <Route path="/session/:sessionId/learning" element={<LearningPage />} />
          <Route path="/session/:sessionId/post-test" element={<PostAssessmentPage />} />
          <Route path="/session/:sessionId/results" element={<ResultsPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

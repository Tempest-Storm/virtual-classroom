import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import Classroom from './pages/Classroom.jsx';
import Assignments from './pages/Assignments.jsx';
import AssignmentDetail from './pages/AssignmentDetail.jsx';
import Scoreboard from './pages/Scoreboard.jsx';
import Attendance from './pages/Attendance.jsx';
import FaceEnrolment from './pages/FaceEnrolment.jsx';
import Profile from './pages/Profile.jsx';

function Protected({ children, teacherOnly = false }) {
  const { user, loading, isTeacher } = useAuth();
  if (loading) return <Spinner label="Restoring your session" />;
  if (!user) return <Navigate to="/login" replace />;
  if (teacherOnly && !isTeacher) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { isTeacher } = useAuth();
  return isTeacher ? <TeacherDashboard /> : <StudentDashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* The live classroom is full-bleed, so it sits outside the chrome. */}
      <Route path="/class/:roomId" element={<Protected><Classroom /></Protected>} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Home />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="courses/:id/scoreboard" element={<Scoreboard />} />
        <Route path="courses/:id/attendance" element={<Protected teacherOnly><Attendance /></Protected>} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:id" element={<AssignmentDetail />} />
        <Route path="face-enrolment" element={<FaceEnrolment />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

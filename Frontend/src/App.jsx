import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing        from "./pages/Landing";
import Login          from "./pages/Login";
import Register       from "./pages/Register";
import Feed           from "./pages/Feed";
import Profile        from "./pages/Profile";
import ChatPage       from "./pages/ChatPage";
import CommunitiesPage from "./pages/CommunitiesPage";
import CommunityRoom  from "./pages/CommunityRoom";

import "./App.css";

function App() {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column"}}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>

            {/* Public */}
            <Route path="/"         element={<Landing />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route path="/feed" element={
              <ProtectedRoute><Feed /></ProtectedRoute>
            }/>
            <Route path="/profile/:id" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            }/>

            {/* Chat */}
            <Route path="/chat" element={
              <ProtectedRoute><ChatPage /></ProtectedRoute>
            }/>
            <Route path="/chat/:userId" element={
              <ProtectedRoute><ChatPage /></ProtectedRoute>
            }/>

            {/* Communities */}
            <Route path="/communities" element={
              <ProtectedRoute><CommunitiesPage /></ProtectedRoute>
            }/>
            <Route path="/communities/:id" element={
              <ProtectedRoute><CommunityRoom /></ProtectedRoute>
            }/>

          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
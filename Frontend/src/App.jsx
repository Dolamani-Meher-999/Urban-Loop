import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import ChatPage from "./pages/ChatPage";
import CommunitiesPage from "./pages/CommunitiesPage";
import CommunityRoom from "./pages/CommunityRoom";
import Explore from "./pages/Explore";

import IncomingCallNotification from "./components/IncomingCallNotification";
import CallRoom from "./components/CallRoom";

import "./App.css";

function AppInner() {
  const [activeCall, setActiveCall] = useState(null);

  const handleAcceptCall = (callData) => {
    setActiveCall({
      roomId: callData.roomId,
      type: callData.type,
      callType: callData.callType,
      chatId: callData.chatId,
      participants: [],
      isInitiator: false,
    });
  };

  return (
    <>
      <IncomingCallNotification
        onAccept={handleAcceptCall}
        onReject={() => {}}
      />

      <AnimatePresence>
        {activeCall && (
          <CallRoom
            roomId={activeCall.roomId}
            type={activeCall.type}
            callType={activeCall.callType}
            chatId={activeCall.chatId}
            participants={activeCall.participants}
            isInitiator={activeCall.isInitiator}
            onEnd={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <Feed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:id"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:userId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/communities"
          element={
            <ProtectedRoute>
              <CommunitiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/communities/:id"
          element={
            <ProtectedRoute>
              <CommunityRoom />
            </ProtectedRoute>
          }
        />

        <Route
          path="/explore/:city"
          element={
            <ProtectedRoute>
              <Explore />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <BrowserRouter>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

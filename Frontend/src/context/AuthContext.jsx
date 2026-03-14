import { createContext, useContext, useEffect, useState } from "react";
import API from "../services/api";
import socket from "../socket";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {

    try {

      const { data } = await API.get("/auth/me");

      setUser(data);

    } catch {

      setUser(null);

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {
    checkAuth();
  }, []);

  // CONNECT USER TO SOCKET
  useEffect(() => {

    if (!user?._id) return;

    socket.connect();

    socket.emit("user-online", user._id);

  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        checkAuth,
        socket
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => useContext(AuthContext);
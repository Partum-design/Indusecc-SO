/* eslint-disable react-refresh/only-export-components */

import { createContext, useState, useEffect } from "react";

// 1. Creamos el contexto (Sin importarlo de otro lado)
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 2. Al cargar, verificamos si hay sesión activa
  useEffect(() => {
    const checkAuth = () => {
      try {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          // Si existe, lo cargamos al estado global
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error("Error al leer el localStorage", error);
        localStorage.removeItem("user");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // 3. Función de entrada (Login)
  const login = (userData) => {
    // El backend envía { message: "...", user: { id, email, role }, token }
    const userToSave = userData.user; 
    setUser(userToSave);
    localStorage.setItem("user", JSON.stringify(userToSave));
    localStorage.setItem("token", userData.token);
    if (userData.refreshToken) localStorage.setItem("refreshToken", userData.refreshToken);
  };

  // 4. Función de salida (Logout) - LA QUE NECESITABAS CORREGIR
  const logout = () => {
    console.log("Cerrando sesión de:", user?.role);
    setUser(null);
    localStorage.clear(); // Borra TODO para asegurar que no quede rastro
    
    // Opcional: Si el router se queda trabado, fuerza el regreso al inicio
    // window.location.href = "/login"; 
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;
  }

  return (
    // Pasamos todo al Provider para que Login y Sidebar puedan usarlo
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
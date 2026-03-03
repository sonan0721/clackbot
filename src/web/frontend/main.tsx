import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";

function App() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Clackbot 대시보드</h1>
      <p className="text-muted-foreground mt-2">React + shadcn/ui 마이그레이션 완료</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

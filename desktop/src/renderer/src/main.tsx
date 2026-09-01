import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MiniApp } from "./MiniApp";
import "./styles.css";

const isMini = window.location.hash.replace(/^#/, "").startsWith("mini");
if (isMini) document.body.classList.add("mini-body");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isMini ? <MiniApp /> : <App />}</React.StrictMode>
);

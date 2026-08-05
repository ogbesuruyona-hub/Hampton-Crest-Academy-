import React from "react";
import { Link } from "react-router-dom";
import BrandLockup from "../components/BrandLockup";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#071925] text-[#fffaf0] flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <div className="flex justify-center"><BrandLockup large /></div>
        <p className="mt-12 hc-overline text-[#f7d982]">Error 404</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Esta página no existe.</h1>
        <p className="mt-5 text-white/75">La dirección puede haber cambiado o ser incorrecta.</p>
        <Link to="/" className="mt-8 inline-flex bg-[#e3c36d] text-[#071925] px-7 py-4 text-xs tracking-[0.18em] uppercase font-bold">Volver al inicio</Link>
      </div>
    </main>
  );
}

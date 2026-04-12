import { Link } from "react-router-dom";

export default function NjilaLogo({ size = "md", white = false }) {
  const sizes = { sm: "h-7", md: "h-9", lg: "h-12", xl: "h-16" };
  const textSizes = { sm: "text-lg", md: "text-xl", lg: "text-2xl", xl: "text-3xl" };

  return (
    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
      <img
        src="/NJILA_logo.png"
        alt="NJILA"
        className={`${sizes[size]} w-auto object-contain`}
        onError={(e) => {
          // Fallback si le logo ne charge pas
          e.target.style.display = "none";
          e.target.nextSibling.style.display = "flex";
        }}
      />
      {/* Fallback SVG */}
      <div
        style={{ display: "none" }}
        className="w-9 h-9 bg-[#135bec] rounded-lg items-center justify-center"
      >
        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
        </svg>
      </div>
      <span className={`font-extrabold tracking-tight ${textSizes[size]} ${white ? "text-white" : "text-[#135bec]"}`}>
        NJILA
      </span>
    </Link>
  );
}

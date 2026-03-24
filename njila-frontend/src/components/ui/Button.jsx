import { cn } from "../../utils/cn";
import { Loader2 } from "lucide-react";

export default function Button({
  children, variant = "primary", size = "md",
  loading = false, disabled = false,
  className = "", type = "button", onClick, ...props
}) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:   "bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500",
    secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 focus:ring-primary-500",
    danger:    "bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-500",
    ghost:     "text-gray-600 hover:bg-gray-100 focus:ring-gray-400",
    success:   "bg-success-600 hover:bg-success-700 text-white focus:ring-success-500",
  };

  const sizes = {
    sm:   "px-3 py-1.5 text-sm",
    md:   "px-4 py-2.5 text-sm",
    lg:   "px-6 py-3 text-base",
    xl:   "px-8 py-4 text-lg",
    full: "w-full px-4 py-3 text-base",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

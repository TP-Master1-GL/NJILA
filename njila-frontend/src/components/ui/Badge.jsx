import { cn } from "../../utils/cn";

const variants = {
  success:  "bg-success-50 text-success-700 border border-success-200",
  warning:  "bg-warning-50 text-warning-700 border border-warning-200",
  danger:   "bg-danger-50 text-danger-700 border border-danger-200",
  primary:  "bg-primary-50 text-primary-700 border border-primary-200",
  gray:     "bg-gray-100 text-gray-600 border border-gray-200",
  dark:     "bg-gray-800 text-white",
};

export default function Badge({ children, variant = "gray", className = "" }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      variants[variant], className
    )}>
      {children}
    </span>
  );
}

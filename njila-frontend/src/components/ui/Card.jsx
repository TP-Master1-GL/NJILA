import { cn } from "../../utils/cn";

export default function Card({ children, className = "", padding = true }) {
  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 shadow-sm",
      padding && "p-6",
      className
    )}>
      {children}
    </div>
  );
}

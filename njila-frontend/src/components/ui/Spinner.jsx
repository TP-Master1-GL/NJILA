import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export default function Spinner({ size = "md", className = "" }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2 className={cn("animate-spin text-primary-600", sizes[size])} />
    </div>
  );
}

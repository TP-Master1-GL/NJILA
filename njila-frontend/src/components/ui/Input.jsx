import { cn } from "../../utils/cn";

export default function Input({
  label, error, icon: Icon, className = "", type = "text", ...props
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          type={type}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white",
            "text-gray-900 placeholder-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-all duration-200 text-sm",
            Icon && "pl-10",
            error && "border-danger-500 focus:ring-danger-500",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}

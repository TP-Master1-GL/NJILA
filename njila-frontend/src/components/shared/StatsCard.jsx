import { cn } from "../../utils/cn";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatsCard({ title, value, trend, trendValue, icon: Icon, color = "primary" }) {
  const colors = {
    primary: "bg-primary-50 text-primary-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    danger:  "bg-danger-50 text-danger-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {Icon && (
          <div className={cn("p-2 rounded-lg", colors[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {trendValue && (
        <div className="flex items-center gap-1 mt-2">
          {trend === "up"
            ? <TrendingUp className="w-4 h-4 text-success-600" />
            : <TrendingDown className="w-4 h-4 text-danger-600" />
          }
          <span className={cn("text-xs font-medium",
            trend === "up" ? "text-success-600" : "text-danger-600"
          )}>
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}

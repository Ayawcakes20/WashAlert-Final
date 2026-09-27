import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConnectivityErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  variant?: "card" | "banner" | "table-row";
  colSpan?: number;
}

export const ConnectivityErrorState: React.FC<ConnectivityErrorStateProps> = ({
  title = "Unable to load data",
  message = "Please check your internet connection and try again.",
  onRetry,
  retrying = false,
  className = "",
  variant = "card",
  colSpan = 10,
}) => {
  if (variant === "table-row") {
    return (
      <tr>
        <td colSpan={colSpan} className="p-8 md:p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto py-2">
            <div className="p-3 rounded-2xl bg-destructive/10 text-destructive shadow-xs">
              <WifiOff className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-base font-bold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            {onRetry && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={retrying}
                className="mt-2 gap-2 font-semibold border-border hover:bg-muted"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                {retrying ? "Retrying..." : "Retry"}
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  if (variant === "banner") {
    return (
      <div
        role="alert"
        className={`rounded-2xl border border-destructive/25 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
        </div>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={retrying}
            className="shrink-0 gap-2 font-semibold border-destructive/30 hover:bg-destructive/10 text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Retrying..." : "Retry"}
          </Button>
        )}
      </div>
    );
  }

  // Default: full card
  return (
    <div
      role="alert"
      className={`glass-card rounded-2xl p-10 md:p-14 text-center border border-border/40 shadow-sm max-w-xl mx-auto my-8 ${className}`}
    >
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4 shadow-xs">
        <WifiOff className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-md mx-auto">
        {message}
      </p>
      {onRetry && (
        <Button
          type="button"
          size="lg"
          onClick={onRetry}
          disabled={retrying}
          className="gap-2 font-semibold px-6 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying..." : "Retry"}
        </Button>
      )}
    </div>
  );
};

export default ConnectivityErrorState;

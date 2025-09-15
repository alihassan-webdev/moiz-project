import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-4xl font-bold mb-3">404</h1>
      <p className="text-lg text-muted-foreground mb-6">Oops! Page not found</p>
      <a href="/" className="text-primary hover:underline">
        Return to Home
      </a>
    </div>
  );
};

export default NotFound;

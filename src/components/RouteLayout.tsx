
import React from 'react';
import { Route } from "lucide-react";

type RouteLayoutProps = {
  children: React.ReactNode;
};

const RouteLayout: React.FC<RouteLayoutProps> = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        {/* Title: solid blue, same as END button, no shadow, no gradient */}
        <h1 className="inline-block text-blue-600 text-6xl md:text-7xl font-extrabold tracking-tight py-2 px-4 rounded-xl animate-fade-in">
          <span className="flex items-center justify-center gap-4">
            <Route className="w-14 h-14 md:w-16 md:h-16 text-blue-600" />
            OptiRoute
          </span>
        </h1>
        <p className="text-gray-700 text-lg font-medium animate-fade-in">
          Efficient route optimization with real-time tracking and bulk location upload.
        </p>
      </div>
      {children}
    </div>
  </div>
);

export default RouteLayout;


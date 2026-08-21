import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import AppBuilder from "./pages/AppBuilder";
import BuilderHub from "./pages/BuilderHub";
import Landing from "./pages/Landing";
import NewProject from "./pages/NewProject";
import NotFound from "./pages/NotFound";
import ProjectDetail from "./pages/ProjectDetail";
import WorkspaceSettings from "./pages/WorkspaceSettings";

function Router() {
  return <Switch><Route path="/" component={Landing} /><Route path="/dashboard" component={Dashboard} /><Route path="/build" component={BuilderHub} /><Route path="/settings" component={WorkspaceSettings} /><Route path="/projects/new" component={NewProject} /><Route path="/projects/:projectId/build" component={AppBuilder} /><Route path="/projects/:projectId/brief" component={ProjectDetail} /><Route path="/projects/:projectId" component={AppBuilder} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors theme="dark" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

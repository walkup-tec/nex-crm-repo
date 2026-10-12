import { createFileRoute, Outlet } from "@tanstack/react-router";
import { WorkspaceProvider } from "@/lib/chatbot/store";
import "@/components/chatbot/chatbot.css";

export const Route = createFileRoute("/_authenticated/chatbot")({
  component: function ChatbotLayout() {
    return (
      <WorkspaceProvider>
        <Outlet />
      </WorkspaceProvider>
    );
  },
});

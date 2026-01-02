import { useLocation, Link } from "wouter";
import { MessageSquarePlus, History, Settings, Zap, BarChart3, Swords, Wrench, Trophy, LogOut, Home, FileText } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const menuItems = [
  {
    title: "New Chat",
    url: "/app",
    icon: MessageSquarePlus,
  },
  {
    title: "AI Arena",
    url: "/arena",
    icon: Swords,
  },
  {
    title: "Toolkit",
    url: "/toolkit",
    icon: Wrench,
  },
  {
    title: "Leaderboard",
    url: "/leaderboard",
    icon: Trophy,
  },
  {
    title: "History",
    url: "/history",
    icon: History,
  },
  {
    title: "Benchmark",
    url: "/benchmark",
    icon: BarChart3,
  },
  {
    title: "Proposals",
    url: "/proposals",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Cooperation Engine</span>
            <span className="text-xs text-muted-foreground">AI Comparison Tool</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || (item.url === "/app" && location === "/compose")}
                  >
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
        <a href="/" className="block">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2"
            data-testid="button-public-page"
          >
            <Home className="h-4 w-4" />
            <span>Public Page</span>
          </Button>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}

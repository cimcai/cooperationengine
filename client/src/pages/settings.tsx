import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Zap, Info } from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import type { Chatbot } from "@shared/schema";

const providerIcons: Record<string, React.ReactNode> = {
  openai: <SiOpenai className="h-5 w-5" />,
  anthropic: <span className="text-sm font-bold">A</span>,
  gemini: <SiGoogle className="h-5 w-5" />,
  xai: <span className="text-sm font-bold">X</span>,
};

const providerColors: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  gemini: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  xai: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

const providerDescriptions: Record<string, string> = {
  openai: "OpenAI's GPT models via Replit AI Integrations",
  anthropic: "Anthropic's Claude models via Replit AI Integrations",
  gemini: "Google's Gemini models via Replit AI Integrations",
  xai: "xAI's Grok models - requires XAI_API_KEY secret",
};

export default function SettingsPage() {
  const { data: chatbots = [] } = useQuery<Chatbot[]>({
    queryKey: ["/api/chatbots"],
  });

  const groupedChatbots = chatbots.reduce((acc, chatbot) => {
    if (!acc[chatbot.provider]) {
      acc[chatbot.provider] = [];
    }
    acc[chatbot.provider].push(chatbot);
    return acc;
  }, {} as Record<string, Chatbot[]>);

  return (
    <div className="flex flex-col h-full p-6">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure available AI providers and models
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              About Cooperation Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cooperation Engine allows you to send the same prompts to multiple AI chatbots 
              simultaneously and compare their responses side-by-side. This is useful for:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Running experiments like the Prisoner's Dilemma with different AI agents</li>
              <li>Comparing how different models respond to the same question</li>
              <li>Testing prompt effectiveness across providers</li>
              <li>Research and analysis of AI behavior</li>
            </ul>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <Zap className="h-4 w-4 text-primary" />
              <p className="text-sm">
                <span className="font-medium">Powered by Replit AI Integrations</span>
                <span className="text-muted-foreground"> - No API keys required. Usage is billed to your Replit credits.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available Providers</CardTitle>
            <CardDescription>
              Models available through Replit AI Integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedChatbots).map(([provider, models], idx) => (
              <div key={provider}>
                {idx > 0 && <Separator className="mb-6" />}
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md ${providerColors[provider]}`}>
                    {providerIcons[provider]}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium capitalize">{provider}</h3>
                    <p className="text-sm text-muted-foreground">{providerDescriptions[provider]}</p>
                    
                    <div className="mt-4 space-y-3">
                      {models.map((model) => (
                        <div key={model.id} className="flex items-center justify-between gap-4 p-3 border rounded-md">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{model.displayName}</span>
                              <Badge variant="outline" className="text-xs font-mono">
                                {model.model}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`model-${model.id}`} className="text-xs text-muted-foreground">
                              {model.enabled ? "Active" : "Inactive"}
                            </Label>
                            <Switch
                              id={`model-${model.id}`}
                              checked={model.enabled}
                              disabled
                              data-testid={`switch-model-${model.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

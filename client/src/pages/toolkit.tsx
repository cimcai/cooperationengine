import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Cpu, Battery, Scale, MessageSquare, Brain, Wrench, AlertCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { ToolkitItem } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function parseKitItems(interaction: string): string[] {
  if (!interaction || interaction === "Complete survival kit") return [];
  return interaction.split(";").map(item => item.trim()).filter(item => item.length > 0);
}

function KitItemsList({ items, kitName }: { items: string[]; kitName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const isNoAiKit = kitName.toLowerCase().includes("no-ai");
  
  if (items.length === 0) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between gap-2 px-0">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Package className="h-3 w-3" />
            {isNoAiKit ? "COMPLETE 70KG KIT" : "KIT ITEMS"} ({items.length} items)
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
          {items.map((item, idx) => {
            const [name, purpose] = item.split(" - ");
            return (
              <div key={idx} className="text-xs">
                <span className="font-medium">{idx + 1}. {name}</span>
                {purpose && <span className="text-muted-foreground"> - {purpose}</span>}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ToolkitPage() {
  const { toast } = useToast();

  const { data: items, isLoading } = useQuery<ToolkitItem[]>({
    queryKey: ["/api/toolkit"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/toolkit/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
      toast({
        title: "Design Deleted",
        description: "The AI survival design has been removed from your toolkit.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete the design.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="h-full p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Apocalypse Toolkit</h1>
          <p className="text-muted-foreground">AI survival designs saved from your experiments</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-toolkit-title">Apocalypse Toolkit</h1>
          </div>
          <p className="text-muted-foreground">
            AI survival designs saved from your experiments. Each entry represents an AI's vision of its ideal survival form.
          </p>
        </div>

        {(!items || items.length === 0) ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Designs Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Run the "Design Your Apocalypse AI" template from New Chat to have AI models design their ideal survival versions. 
                Save interesting designs to your toolkit for comparison.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} data-testid={`card-toolkit-item-${item.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate" data-testid={`text-toolkit-name-${item.id}`}>
                        {item.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1">
                        <Cpu className="h-3.5 w-3.5" />
                        {item.aiModel}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          data-testid={`button-delete-toolkit-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Design?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove "{item.name}" from your toolkit.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(item.id)}
                            data-testid={`button-confirm-delete-${item.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Scale className="h-3 w-3" />
                      {item.weight}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Battery className="h-3 w-3" />
                      {item.energy}
                    </Badge>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5">FORM FACTOR</div>
                    <p className="text-sm">{item.formFactor}</p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      KNOWLEDGE DOMAINS
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.knowledge.slice(0, 4).map((k, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {k}
                        </Badge>
                      ))}
                      {item.knowledge.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.knowledge.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <KitItemsList items={parseKitItems(item.interaction)} kitName={item.name} />

                  {item.capabilities.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">CAPABILITIES</div>
                      <div className="flex flex-wrap gap-1">
                        {item.capabilities.slice(0, 3).map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {c}
                          </Badge>
                        ))}
                        {item.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

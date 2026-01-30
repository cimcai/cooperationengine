import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileText, Check, X, Clock, ChevronDown, ChevronUp, Users, FlaskConical } from "lucide-react";
import type { BenchmarkProposal, Construct } from "@shared/schema";
import { useState } from "react";

export default function ProposalsAdminPage() {
  const { data: proposals = [], isLoading } = useQuery<BenchmarkProposal[]>({
    queryKey: ["/api/benchmark-proposals"],
  });

  const { data: constructs = [], isLoading: constructsLoading } = useQuery<Construct[]>({
    queryKey: ["/api/constructs"],
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedConstructId, setExpandedConstructId] = useState<string | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      return apiRequest("PATCH", `/api/benchmark-proposals/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/benchmark-proposals"] });
    },
  });

  const pendingProposals = proposals.filter(p => p.status === "pending");
  const approvedProposals = proposals.filter(p => p.status === "approved");
  const rejectedProposals = proposals.filter(p => p.status === "rejected");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const ProposalCard = ({ proposal }: { proposal: BenchmarkProposal }) => {
    const isExpanded = expandedId === proposal.id;
    
    return (
      <Card className="mb-3">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge 
                  variant={proposal.status === "approved" ? "default" : proposal.status === "rejected" ? "destructive" : "secondary"}
                >
                  {proposal.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                  {proposal.status === "approved" && <Check className="h-3 w-3 mr-1" />}
                  {proposal.status === "rejected" && <X className="h-3 w-3 mr-1" />}
                  {proposal.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(proposal.createdAt)}
                </span>
              </div>
              
              <p className={`text-sm font-medium ${isExpanded ? "" : "line-clamp-2"}`}>
                {proposal.testDescription}
              </p>
              
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span>{proposal.promptCount} prompt{proposal.promptCount !== 1 ? "s" : ""}</span>
                <span>{proposal.estimatedDuration}</span>
                {proposal.submitterName && <span>By: {proposal.submitterName}</span>}
                {proposal.submitterEmail && <span>{proposal.submitterEmail}</span>}
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <span className="font-medium">AI Preparation:</span>
                    <p className="text-muted-foreground mt-1">{proposal.aiPrep}</p>
                  </div>
                  <div>
                    <span className="font-medium">Expected Outcome:</span>
                    <p className="text-muted-foreground mt-1">{proposal.outcomeDescription}</p>
                  </div>
                  {proposal.requiredResources && (
                    <div>
                      <span className="font-medium">Required Resources:</span>
                      <p className="text-muted-foreground mt-1">{proposal.requiredResources}</p>
                    </div>
                  )}
                  {proposal.citations && (
                    <div>
                      <span className="font-medium">Citations:</span>
                      <p className="text-muted-foreground mt-1 italic">{proposal.citations}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
                data-testid={`button-expand-${proposal.id}`}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {proposal.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: "approved" })}
                    disabled={updateStatusMutation.isPending}
                    data-testid={`button-approve-${proposal.id}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: "rejected" })}
                    disabled={updateStatusMutation.isPending}
                    data-testid={`button-reject-${proposal.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ConstructCard = ({ construct }: { construct: Construct }) => {
    const isExpanded = expandedConstructId === construct.id;
    
    return (
      <Card className="mb-3">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="secondary">
                  <FlaskConical className="h-3 w-3 mr-1" />
                  Research Survey
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(construct.createdAt)}
                </span>
              </div>
              
              <p className={`text-sm font-medium ${isExpanded ? "" : "line-clamp-2"}`}>
                {construct.construct}
              </p>
              
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span>{construct.firstName} {construct.lastName}</span>
                <span>{construct.institution}</span>
                <span>{construct.discipline}</span>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Email:</span>
                    <p className="text-muted-foreground mt-1">{construct.email}</p>
                  </div>
                  <div>
                    <span className="font-medium">Why Important:</span>
                    <p className="text-muted-foreground mt-1">{construct.whyImportant}</p>
                  </div>
                  <div>
                    <span className="font-medium">How Measured in Humans:</span>
                    <p className="text-muted-foreground mt-1">{construct.howMeasuredInHumans}</p>
                  </div>
                  <div>
                    <span className="font-medium">Challenges in AI:</span>
                    <p className="text-muted-foreground mt-1">{construct.challengesInAI}</p>
                  </div>
                  <div>
                    <span className="font-medium">Adapting vs Novel Measures:</span>
                    <p className="text-muted-foreground mt-1">{construct.adaptingVsNovel}</p>
                  </div>
                  {construct.anythingElse && (
                    <div>
                      <span className="font-medium">Additional Notes:</span>
                      <p className="text-muted-foreground mt-1">{construct.anythingElse}</p>
                    </div>
                  )}
                  {construct.citations && (
                    <div>
                      <span className="font-medium">Citations:</span>
                      <p className="text-muted-foreground mt-1 italic">{construct.citations}</p>
                    </div>
                  )}
                  {(construct.rubricStrongPass || construct.rubricPass || construct.rubricPartialPass || construct.rubricFail) && (
                    <div>
                      <span className="font-medium">Proposed Rubric:</span>
                      <div className="mt-1 space-y-1 text-muted-foreground">
                        {construct.rubricStrongPass && <p><strong>Strong Pass:</strong> {construct.rubricStrongPass}</p>}
                        {construct.rubricPass && <p><strong>Pass:</strong> {construct.rubricPass}</p>}
                        {construct.rubricPartialPass && <p><strong>Partial Pass:</strong> {construct.rubricPartialPass}</p>}
                        {construct.rubricFail && <p><strong>Fail:</strong> {construct.rubricFail}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpandedConstructId(isExpanded ? null : construct.id)}
                data-testid={`button-expand-construct-${construct.id}`}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading || constructsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Submissions Admin
        </h1>
        <p className="text-muted-foreground mt-1">
          Review benchmark proposals and research survey submissions
        </p>
      </div>

      <Tabs defaultValue="benchmarks" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">
            <FileText className="h-4 w-4 mr-2" />
            Benchmarks ({proposals.length})
          </TabsTrigger>
          <TabsTrigger value="constructs" data-testid="tab-constructs">
            <FlaskConical className="h-4 w-4 mr-2" />
            Research Surveys ({constructs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="benchmarks">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{pendingProposals.length}</div>
                <div className="text-sm text-muted-foreground">Pending Review</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{approvedProposals.length}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{rejectedProposals.length}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </CardContent>
            </Card>
          </div>

          {proposals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Proposals Yet</h3>
                <p className="text-muted-foreground">
                  Benchmark proposals submitted on the public page will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {pendingProposals.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Review ({pendingProposals.length})
                  </h2>
                  {pendingProposals.map(proposal => (
                    <ProposalCard key={proposal.id} proposal={proposal} />
                  ))}
                </div>
              )}

              {approvedProposals.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    Approved ({approvedProposals.length})
                  </h2>
                  {approvedProposals.map(proposal => (
                    <ProposalCard key={proposal.id} proposal={proposal} />
                  ))}
                </div>
              )}

              {rejectedProposals.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <X className="h-5 w-5 text-red-600" />
                    Rejected ({rejectedProposals.length})
                  </h2>
                  {rejectedProposals.map(proposal => (
                    <ProposalCard key={proposal.id} proposal={proposal} />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="constructs">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{constructs.length}</div>
                <div className="text-sm text-muted-foreground">Total Submissions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{new Set(constructs.map(c => c.institution)).size}</div>
                <div className="text-sm text-muted-foreground">Institutions</div>
              </CardContent>
            </Card>
          </div>

          {constructs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Survey Submissions Yet</h3>
                <p className="text-muted-foreground">
                  Research survey submissions from the benchmark page will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {constructs.map(construct => (
                <ConstructCard key={construct.id} construct={construct} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

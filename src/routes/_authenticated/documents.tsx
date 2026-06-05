import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { isHrOrAdmin } from "@/lib/hrms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

const CATEGORIES = ["id_proof", "address_proof", "education", "experience", "contract", "payslip", "certificate", "other"] as const;
type Category = (typeof CATEGORIES)[number];

function formatBytes(n?: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPage() {
  const { user, roles } = useMe();
  const qc = useQueryClient();
  const hr = isHrOrAdmin(roles);
  const [targetEmp, setTargetEmp] = useState<string>("");
  const [category, setCategory] = useState<Category>("other");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const employees = useQuery({
    queryKey: ["doc-employees"],
    enabled: hr,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      return data ?? [];
    },
  });

  const effectiveEmp = hr ? (targetEmp || user?.id || "") : user?.id ?? "";

  const docs = useQuery({
    queryKey: ["documents", effectiveEmp],
    enabled: !!effectiveEmp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents" as never)
        .select("*")
        .eq("employee_id", effectiveEmp)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; name: string; category: string; storage_path: string;
        mime_type: string | null; size_bytes: number | null; created_at: string; employee_id: string;
      }>;
    },
  });

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Pick a file");
    if (!effectiveEmp) return toast.error("Select employee");
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    setUploading(true);
    try {
      const path = `${effectiveEmp}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage.from("employee-documents").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (up.error) throw up.error;
      const ins = await supabase.from("employee_documents" as never).insert({
        employee_id: effectiveEmp,
        uploaded_by: user?.id,
        name: file.name,
        category,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      } as never);
      if (ins.error) throw ins.error;
      toast.success("Uploaded");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["documents", effectiveEmp] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("employee-documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const onDelete = async (id: string, path: string) => {
    if (!confirm("Delete this document?")) return;
    const rm = await supabase.storage.from("employee-documents").remove([path]);
    if (rm.error) return toast.error(rm.error.message);
    const del = await supabase.from("employee_documents" as never).delete().eq("id", id);
    if (del.error) return toast.error(del.error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["documents", effectiveEmp] });
  };

  const grouped = useMemo(() => {
    const out: Record<string, number> = {};
    (docs.data ?? []).forEach((d) => { out[d.category] = (out[d.category] ?? 0) + 1; });
    return out;
  }, [docs.data]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">Securely upload and manage employee documents.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload</CardTitle>
          <CardDescription>Max 20MB per file. Stored privately with role-based access.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {hr && (
            <div className="space-y-1">
              <Label className="text-xs">Employee</Label>
              <Select value={targetEmp || user?.id || ""} onValueChange={setTargetEmp}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(employees.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">File</Label>
            <Input type="file" ref={fileRef} />
          </div>
          <div className="flex items-end">
            <Button onClick={onUpload} disabled={uploading} className="w-full">
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        {CATEGORIES.slice(0, 4).map((c) => (
          <Card key={c}>
            <CardHeader className="pb-2">
              <CardDescription className="capitalize">{c.replace("_", " ")}</CardDescription>
              <CardTitle className="text-2xl">{grouped[c] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Files</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(docs.data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{d.category.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{formatBytes(d.size_bytes)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => onDownload(d.storage_path, d.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(d.id, d.storage_path)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(docs.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No documents uploaded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

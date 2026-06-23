import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { documentService, employeeService } from "@/services/api";
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
  const { user, roles, employee } = useMe();
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
      const emps = await employeeService.getAll();
      return (emps ?? []).map((e: any) => ({
        id: e.id,
        full_name: e.name,
        email: e.email,
      }));
    },
  });

  const effectiveEmp = hr ? (targetEmp || employee?.id || "") : employee?.id ?? "";

  const docs = useQuery({
    queryKey: ["documents", effectiveEmp],
    enabled: !!effectiveEmp,
    queryFn: async () => {
      const data = await documentService.getAll(effectiveEmp);
      return (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.document_name,
        category: d.category,
        size_bytes: d.size_bytes,
        created_at: d.created_at,
        employee_id: d.employee_id,
      }));
    },
  });

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Pick a file");
    if (!effectiveEmp) return toast.error("Select employee");
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("employee_id", String(effectiveEmp));
      formData.append("category", category);
      await documentService.upload(formData);
      toast.success("Uploaded");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["documents", effectiveEmp] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setUploading(false);
    }
  };

  const onDownload = (id: string | number) => {
    const url = documentService.download(id);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const onDelete = async (id: string | number) => {
    if (!confirm("Delete this document?")) return;
    try {
      await documentService.delete(id);
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["documents", effectiveEmp] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message);
    }
  };

  const grouped = useMemo(() => {
    const out: Record<string, number> = {};
    (docs.data ?? []).forEach((d: any) => { out[d.category] = (out[d.category] ?? 0) + 1; });
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
              <Select value={targetEmp || String(employee?.id || "")} onValueChange={setTargetEmp}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(employees.data ?? []).map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.full_name || e.email}</SelectItem>
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
              {(docs.data ?? []).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{d.category.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{formatBytes(d.size_bytes)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => onDownload(d.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(d.id)}>
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


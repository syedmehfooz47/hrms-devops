import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export type Payslip = {
  id: string;
  month: number;
  year: number;
  basic: number;
  hra: number;
  allowances: number;
  gross: number;
  pf: number;
  tax: number;
  other_deductions: number;
  net: number;
  working_days: number;
  paid_days: number;
};

export type SalaryBreakdown = {
  basic: number;
  hra: number;
  allowances: number;
  gross: number;
  pf: number;
  tax: number;
  net: number;
};

// India-style monthly salary breakdown from basic salary
export function computeSalary(basicMonthly: number, paidDays = 30, workingDays = 30): SalaryBreakdown {
  const factor = workingDays > 0 ? paidDays / workingDays : 1;
  const basic = Math.round(basicMonthly * factor);
  const hra = Math.round(basic * 0.4);
  const allowances = Math.round(basic * 0.15);
  const gross = basic + hra + allowances;
  const pf = Math.round(basic * 0.12);
  // Simple progressive tax (annualized)
  const annualGross = gross * 12;
  let annualTax = 0;
  if (annualGross > 1500000) annualTax = (annualGross - 1500000) * 0.3 + 187500;
  else if (annualGross > 1000000) annualTax = (annualGross - 1000000) * 0.2 + 87500;
  else if (annualGross > 500000) annualTax = (annualGross - 500000) * 0.1 + 12500;
  else if (annualGross > 250000) annualTax = (annualGross - 250000) * 0.05;
  const tax = Math.round(annualTax / 12);
  const net = gross - pf - tax;
  return { basic, hra, allowances, gross, pf, tax, net };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const monthName = (m: number) => MONTHS[m - 1] ?? "";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function downloadPayslipPDF(opts: {
  slip: Payslip;
  employee: { full_name: string; employee_code: string; designation?: string | null; department?: string | null; email?: string | null };
  company?: { name: string; address?: string };
}) {
  const { slip, employee, company } = opts;
  const co = company ?? { name: "Pulse HRMS", address: "" };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(20, 30, 48);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18).setFont("helvetica", "bold");
  doc.text(co.name, 40, 35);
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("Payslip", 40, 52);
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text(`${monthName(slip.month)} ${slip.year}`, W - 40, 35, { align: "right" });
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy")}`, W - 40, 52, { align: "right" });

  doc.setTextColor(20, 20, 20);

  // Employee block
  let y = 100;
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("Employee Details", 40, y);
  doc.setDrawColor(220);
  doc.line(40, y + 4, W - 40, y + 4);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const rows: [string, string][] = [
    ["Name", employee.full_name],
    ["Employee Code", employee.employee_code],
    ["Designation", employee.designation || "—"],
    ["Department", employee.department || "—"],
    ["Working Days", String(slip.working_days)],
    ["Paid Days", String(slip.paid_days)],
  ];
  rows.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 40 + col * (W / 2 - 40);
    const yy = y + row * 16;
    doc.setTextColor(110);
    doc.text(`${r[0]}:`, x, yy);
    doc.setTextColor(20);
    doc.text(r[1], x + 90, yy);
  });
  y += Math.ceil(rows.length / 2) * 16 + 14;

  // Earnings & deductions tables
  autoTable(doc, {
    startY: y,
    head: [["Earnings", "Amount"]],
    body: [
      ["Basic", fmt(slip.basic)],
      ["HRA", fmt(slip.hra)],
      ["Allowances", fmt(slip.allowances)],
      [{ content: "Gross", styles: { fontStyle: "bold" } }, { content: fmt(slip.gross), styles: { fontStyle: "bold" } }],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 30, 48], textColor: 255 },
    margin: { left: 40, right: W / 2 + 5 },
    columnStyles: { 1: { halign: "right" } },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: y,
    head: [["Deductions", "Amount"]],
    body: [
      ["Provident Fund (12%)", fmt(slip.pf)],
      ["Income Tax", fmt(slip.tax)],
      ["Other", fmt(slip.other_deductions)],
      [
        { content: "Total Deductions", styles: { fontStyle: "bold" } },
        { content: fmt(slip.pf + slip.tax + slip.other_deductions), styles: { fontStyle: "bold" } },
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 30, 48], textColor: 255 },
    margin: { left: W / 2 + 5, right: 40 },
    columnStyles: { 1: { halign: "right" } },
    styles: { fontSize: 9 },
  });

  // Net pay box
  const finalY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFillColor(240, 246, 255);
  doc.setDrawColor(20, 30, 48);
  doc.rect(40, finalY, W - 80, 44, "FD");
  doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(20, 30, 48);
  doc.text("NET PAY", 56, finalY + 27);
  doc.setFontSize(16);
  doc.text(fmt(slip.net), W - 56, finalY + 28, { align: "right" });

  doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(120);
  doc.text(
    "This is a system-generated payslip and does not require a signature.",
    W / 2,
    finalY + 70,
    { align: "center" }
  );

  doc.save(`payslip-${employee.employee_code}-${slip.year}-${String(slip.month).padStart(2, "0")}.pdf`);
}
